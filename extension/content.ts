// Content script: finds post/comment text, prefilters locally by show names, and only then asks
// the extension to judge. Matching posts stay blurred until a verdict arrives.
import { matchShow, type ShowProfile } from '../src/core/match';
import type { JudgeReply } from './messages';

const SELECTORS = [
  '[data-testid="tweetText"]',                 // X
  'ytd-comment-view-model #content-text',      // YouTube comments
  'ytd-comment-renderer #content-text',
  'yt-formatted-string#video-title',           // YouTube titles in feeds
  'shreddit-comment [slot="comment"]',         // Reddit comments
  'shreddit-post [slot="title"]',              // Reddit post titles
  'shreddit-post [slot="text-body"]',
].join(',');

let shows: ShowProfile[] = [];
let enabled = true;

async function loadState() {
  const s = await chrome.storage.local.get(['shows', 'settings']);
  shows = (s.shows ?? []) as ShowProfile[];
  enabled = (s.settings as { enabled?: boolean } | undefined)?.enabled ?? true;
}

function veil(el: HTMLElement, reason: string) {
  el.classList.remove('sv-checking');
  el.classList.add('sv-veiled');
  const tag = document.createElement('span');
  tag.className = 'sv-tag';
  tag.textContent = `SpoilerVeil: ${reason} — click to show`;
  tag.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    el.classList.remove('sv-veiled');
    tag.remove();
  }, { once: true });
  el.before(tag);
}

async function check(el: HTMLElement) {
  if (el.dataset.sv) return;
  const text = el.innerText.trim();
  if (text.length < 8) return;
  if (!matchShow(text, shows)) { el.dataset.sv = 'skip'; return; }
  el.dataset.sv = 'pending';
  el.classList.add('sv-checking');
  try {
    const reply = (await chrome.runtime.sendMessage({ type: 'judge', text })) as JudgeReply;
    if (reply.ok && reply.judgement.verdict === 'spoiler') {
      el.dataset.sv = 'veiled';
      veil(el, reply.judgement.reason);
      return;
    }
    el.dataset.sv = reply.ok ? 'safe' : 'error';
  } catch {
    el.dataset.sv = 'error';
  }
  el.classList.remove('sv-checking');
}

function scan(root: ParentNode) {
  if (!enabled || !shows.length) return;
  root.querySelectorAll<HTMLElement>(SELECTORS).forEach(el => void check(el));
}

let timer: number | undefined;
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = window.setTimeout(() => scan(document), 150);
});

loadState().then(() => {
  scan(document);
  observer.observe(document.body, { childList: true, subtree: true });
});

chrome.storage.onChanged.addListener(() => {
  loadState().then(() => {
    document.querySelectorAll<HTMLElement>('[data-sv="skip"]').forEach(el => delete el.dataset.sv);
    scan(document);
  });
});
