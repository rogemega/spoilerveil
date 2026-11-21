// Offscreen document: the only place where Firebase AI Logic runs inside the extension.
import { buildProfile, judgePost } from '../src/core/veil';
import type { ToOffscreen } from './messages';

chrome.runtime.onMessage.addListener((msg: ToOffscreen, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return false;
  if (msg.type === 'judge') {
    judgePost(msg.text, msg.shows, { mode: msg.settings.mode, pageTitle: msg.pageTitle })
      .then(judgement => sendResponse({ ok: true, judgement }), e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === 'build') {
    buildProfile(msg.title, msg.progress, msg.guide)
      .then(profile => sendResponse({ ok: true, profile }), e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  return false;
});
