// Service worker: owns storage and routes work to the offscreen document, which is a real
// extension page where Firebase AI Logic and Chrome's Prompt API (Gemini Nano) can run.
import { DEFAULT_SETTINGS, type BuildReply, type Counters, type JudgeReply, type Settings, type ToBackground, type ToOffscreen } from './messages';
import type { ShowProfile } from '../src/core/veil';

let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (contexts.length) return;
  creating ??= chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Runs Gemini Nano (Prompt API) and Firebase AI Logic to classify post text for spoilers.',
    })
    .finally(() => { creating = null; });
  await creating;
}

async function load() {
  const s = await chrome.storage.local.get(['shows', 'settings', 'counters']);
  return {
    shows: (s.shows ?? []) as ShowProfile[],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) } as Settings,
    counters: (s.counters ?? { checked: 0, veiled: 0, onDevice: 0, inCloud: 0 }) as Counters,
  };
}

// Judge requests are serialized: Gemini Nano runs one prompt at a time anyway.
let queue: Promise<unknown> = Promise.resolve();

async function judge(text: string, pageTitle?: string): Promise<JudgeReply> {
  const { shows, settings } = await load();
  if (!settings.enabled || !shows.length) {
    return { ok: true, judgement: { verdict: 'safe', reason: 'off', source: 'skipped', ms: 0 } };
  }
  await ensureOffscreen();
  const msg: ToOffscreen = { target: 'offscreen', type: 'judge', text, pageTitle, shows, settings };
  const reply = (await chrome.runtime.sendMessage(msg)) as JudgeReply;
  if (reply.ok && reply.judgement.source !== 'skipped') {
    const { counters } = await load();
    counters.checked++;
    if (reply.judgement.verdict === 'spoiler') counters.veiled++;
    if (reply.judgement.source === 'on_device') counters.onDevice++; else counters.inCloud++;
    await chrome.storage.local.set({ counters });
  }
  return reply;
}

async function build(title: string, progress: string, guide: string): Promise<BuildReply> {
  await ensureOffscreen();
  const msg: ToOffscreen = { target: 'offscreen', type: 'build', title, progress, guide };
  const reply = (await chrome.runtime.sendMessage(msg)) as BuildReply;
  if (reply.ok) {
    const { shows } = await load();
    await chrome.storage.local.set({ shows: [...shows, reply.profile] });
  }
  return reply;
}

chrome.runtime.onMessage.addListener((msg: ToBackground & { target?: string }, _sender, sendResponse) => {
  if (msg.target === 'offscreen') return false;
  if (msg.type === 'judge') {
    const p = queue.then(() => judge(msg.text, msg.pageTitle));
    queue = p.catch(() => undefined);
    p.then(sendResponse, e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'build') {
    build(msg.title, msg.progress, msg.guide).then(sendResponse, e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
