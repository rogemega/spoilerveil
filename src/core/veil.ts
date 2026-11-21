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

export type Verdict = 'spoiler' | 'safe' | 'unsure';
export type Source = 'on_device' | 'in_cloud' | 'skipped';


export type SpoilerKind = 'death' | 'identity' | 'twist' | 'relationship' | 'survival' | 'winner' | 'ending' | 'other' | 'none';

/** Human-readable label for a spoiler kind. Deliberately vague: the label itself must not spoil. */
export const KIND_LABEL: Record<SpoilerKind, string> = {
  death: "a character's fate",
  identity: 'a hidden identity',
  twist: 'a plot twist',
  relationship: 'a secret relationship',
  survival: "a character's fate",
  winner: 'who wins',
  ending: 'the ending',
  other: 'later events',
  none: 'later events',
};

export interface Judgement {
  verdict: Verdict;
  kind: SpoilerKind;
  reason: string;
  source: Source;
  ms: number;
  showId?: string;
}

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['spoiler', 'safe', 'unsure'] },
    kind: { type: 'string', enum: ['death', 'identity', 'twist', 'relationship', 'survival', 'winner', 'ending', 'other', 'none'] },
  },
  required: ['verdict', 'kind'],
};

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    terms: { type: 'array', items: { type: 'string' }, maxItems: 40 },
    knownFacts: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    hiddenPlot: { type: 'array', items: { type: 'string' }, maxItems: 16 },
  },
  required: ['title', 'terms', 'knownFacts', 'hiddenPlot'],
};

export type JudgeMode = 'hybrid' | 'cloud';

const judgeModels = new Map<JudgeMode, GenerativeModel>();

export function judgeModel(mode: JudgeMode): GenerativeModel {
  let m = judgeModels.get(mode);
  if (m) return m;
  const { ai } = getFirebase();
  m = getGenerativeModel(ai, {
    mode: mode === 'hybrid' ? InferenceMode.PREFER_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en', 'ja'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      },
      promptOptions: { responseConstraint: JUDGE_SCHEMA },
    },
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: JUDGE_SCHEMA, temperature: 0 },
    },
  });
  judgeModels.set(mode, m);
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

function judgePrompt(show: ShowProfile, post: string): string {
  const bullets = (xs: string[]) => xs.map(x => `- ${x}`).join('\n') || '- (none)';
  return [
    `You are a spoiler filter for a viewer of "${show.title}". They have seen up to: ${show.progress}.`,
    `Already seen (safe to mention):\n${bullets(show.knownFacts)}`,
    `NOT seen yet (these are spoilers):\n${bullets(show.hiddenPlot)}`,
    `Post (may be English or Japanese):\n"""${post.slice(0, 1200)}"""`,
    `Does the post reveal, confirm or strongly hint at anything in the NOT-seen list, or any other later twist, death, identity reveal, winner or ending?`,
    `Opinions, hype, release dates, casting news and already-seen events are safe. Use "unsure" only if it is genuinely ambiguous.`,
    `Reply as JSON: {"verdict": "spoiler"|"safe"|"unsure", "kind": the kind of spoiler, or "none" if safe}.`,
  ].join('\n\n');
}

function parseJson<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as T;
}

export interface JudgeOptions {
  mode: JudgeMode;
  /** When the on-device verdict is "unsure", ask the cloud model once more. */
  cloudSecondOpinion: boolean;
}

export async function judgePost(post: string, shows: ShowProfile[], opts: JudgeOptions): Promise<Judgement> {
  const t0 = performance.now();
  const showId = matchShow(post, shows);
  const show = shows.find(s => s.id === showId);
  if (!show) return { verdict: 'safe', kind: 'none', reason: 'Not about a show you follow', source: 'skipped', ms: performance.now() - t0 };

  const ask = async (mode: JudgeMode) => {
    const res = await judgeModel(mode).generateContent(judgePrompt(show, post));
    const out = parseJson<{ verdict: Verdict; kind?: SpoilerKind }>(res.response.text());
    const source: Source = res.response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud';
    return { ...out, source };
  };

  let r = await ask(opts.mode);
  if (r.verdict === 'unsure' && r.source === 'on_device' && opts.cloudSecondOpinion) {
    r = await ask('cloud');
  }
  const kind: SpoilerKind = r.kind && r.kind in KIND_LABEL ? r.kind : 'other';
  return { verdict: r.verdict, kind, reason: r.verdict === 'spoiler' ? `Reveals ${KIND_LABEL[kind]}` : 'No spoiler', source: r.source, ms: performance.now() - t0, showId: show.id };
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
    `terms: names of characters, places, groups, ships, nicknames and the title (used for keyword matching, so include short forms, first names alone, and Japanese katakana transliterations of every name and of the title, e.g. "Mara" → "マーラ").`,
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
