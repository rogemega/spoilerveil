// SpoilerVeil core: the hybrid split.
//  - Cloud (once per show): build a "spoiler profile" — names to watch for, what the viewer
//    already knows, and the later plot points that must stay hidden. Needs world knowledge
//    (or an episode guide), so it runs on Gemini in the cloud.
//  - On-device (every post, hundreds of times while scrolling): Gemini Nano judges whether a
//    post reveals one of those hidden plot points. Free, fast, and the posts you read plus
//    what you are watching never leave the browser. If Nano is not available, the same call
//    falls back to the cloud automatically (Firebase AI Logic hybrid inference).
import { InferenceMode, getGenerativeModel, type GenerativeModel } from 'firebase/ai';
import { getFirebase } from './firebase';
import { matchShow, type ShowProfile } from './match';

export type { ShowProfile } from './match';

export const CLOUD_MODEL = 'gemini-3.5-flash-lite';

export type Verdict = 'spoiler' | 'safe';
export type Source = 'on_device' | 'in_cloud' | 'skipped';

export interface Judgement {
  verdict: Verdict;
  /** Deliberately vague text for the UI: it must never repeat the spoiler. */
  reason: string;
  source: Source;
  ms: number;
  showId?: string;
}

/**
 * The small on-device model is far more reliable at "which numbered item does this match?"
 * than at open-ended judgement, and the output is a single integer (fast, nothing to leak).
 */
function judgeSchema(n: number) {
  return {
    type: 'object',
    properties: { reveals: { type: 'integer', minimum: 0, maximum: n } },
    required: ['reveals'],
  };
}

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    terms: { type: 'array', items: { type: 'string' }, maxItems: 80 },
    knownFacts: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    hiddenPlot: { type: 'array', items: { type: 'string' }, maxItems: 16 },
  },
  required: ['title', 'terms', 'knownFacts', 'hiddenPlot'],
};

export type JudgeMode = 'hybrid' | 'cloud';

// One model per (mode, number of hidden points): the JSON constraint depends on the list length.
const judgeModels = new Map<string, GenerativeModel>();

export function judgeModel(mode: JudgeMode, points = 16): GenerativeModel {
  const key = `${mode}:${points}`;
  let m = judgeModels.get(key);
  if (m) return m;
  const { ai } = getFirebase();
  const schema = judgeSchema(points);
  m = getGenerativeModel(ai, {
    mode: mode === 'hybrid' ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      },
      promptOptions: { responseConstraint: schema },
    },
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0 },
    },
  });
  judgeModels.set(key, m);
  return m;
}

/** Call from a user gesture (click) — Chrome only downloads Gemini Nano after user activation. */
export async function prepareOnDevice(onProgress?: (p: number) => void): Promise<void> {
  await judgeModel('hybrid').initializeDeviceModel(onProgress);
}

/** Reports what Chrome says about Gemini Nano in this context. */
export async function onDeviceAvailability(): Promise<string> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: object) => Promise<string> } }).LanguageModel;
  if (!LM) return 'unavailable (no Prompt API in this browser)';
  try {
    return await LM.availability({
      expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch (e) {
    return `unavailable (${(e as Error).message})`;
  }
}

function judgePrompt(show: ShowProfile, post: string, context?: string): string {
  const list = show.hiddenPlot.map((h, i) => `${i + 1}. ${h}`).join('\n');
  return [
    `Secret plot points of "${show.title}" (numbered):\n${list}`,
    ...(context ? [`The post appears on a page titled: "${context.slice(0, 200)}"`] : []),
    `Social media post (English or Japanese):\n"${post.slice(0, 1000)}"`,
    `Does the post state or clearly imply one of the secret plot points? Answer with its number. ` +
      `If the post only gives opinions, news, theories or questions without stating a secret plot point, answer 0.`,
  ].join('\n\n');
}

function parseJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as T;
}

export interface JudgeOptions {
  mode: JudgeMode;
  /** Title of the page the post sits on (e.g. a video about the show). If it names a followed show,
   *  every comment on the page is judged against that show even when the comment names nothing. */
  pageTitle?: string;
}

export async function judgePost(post: string, shows: ShowProfile[], opts: JudgeOptions): Promise<Judgement> {
  const t0 = performance.now();
  const showId = matchShow(post, shows) ?? (opts.pageTitle ? matchShow(opts.pageTitle, shows) : undefined);
  const show = shows.find(s => s.id === showId);
  if (!show || !show.hiddenPlot.length) {
    return { verdict: 'safe', reason: 'Not about a show you follow', source: 'skipped', ms: performance.now() - t0 };
  }
  const res = await judgeModel(opts.mode, show.hiddenPlot.length).generateContent(judgePrompt(show, post, opts.pageTitle));
  const { reveals } = parseJson<{ reveals: number }>(res.response.text());
  const source: Source = res.response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud';
  const spoiler = Number.isInteger(reveals) && reveals > 0;
  return {
    verdict: spoiler ? 'spoiler' : 'safe',
    reason: spoiler ? `reveals something after ${show.progress}` : 'No spoiler',
    source,
    ms: performance.now() - t0,
    showId: show.id,
  };
}

/**
 * Cloud step, once per show. With an episode guide (or a fictional show), the guide is the source
 * of truth; otherwise Gemini relies on what it knows about the title.
 */
export async function buildProfile(title: string, progress: string, guide = ''): Promise<ShowProfile> {
  const { ai } = getFirebase();
  const model = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: PROFILE_SCHEMA, temperature: 0.2 },
    },
  });
  const prompt = [
    `Build a spoiler-filter profile for the show/book/game "${title}". The viewer has seen up to: ${progress}.`,
    guide ? `Use this episode guide as the source of truth:\n"""${guide.slice(0, 20000)}"""` : `Use what you know about this title. If you do not know it, keep hiddenPlot generic (deaths, betrayals, finale outcome).`,
    `terms: names of characters (including ones who only appear AFTER the viewer's progress — later villains and reveals are strong spoiler signals), places, groups, ships, nicknames and the title. Used for keyword matching, so include short forms, first names alone, and Japanese names/katakana transliterations of every name and of the title (e.g. "Mara" → "マーラ").`,
    `knownFacts: up to 10 short facts the viewer already saw.`,
    `hiddenPlot: up to 16 short, concrete plot points that happen AFTER the viewer's progress (who dies, who is the traitor, who wins, how it ends). These are only read by a local filter model, never shown to the viewer.`,
  ].join('\n\n');
  const res = await model.generateContent(prompt);
  const p = parseJson<{ title: string; terms: string[]; knownFacts: string[]; hiddenPlot: string[] }>(res.response.text());
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: p.title || title,
    progress,
    terms: [...new Set(p.terms.map(s => s.trim()).filter(Boolean))],
    knownFacts: p.knownFacts,
    hiddenPlot: p.hiddenPlot,
    createdAt: Date.now(),
  };
}
