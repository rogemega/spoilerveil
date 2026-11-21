// Content script: finds post/comment text, prefilters locally by show names, and only then asks
// the extension to judge. Matching posts stay blurred until a verdict arrives.
import { matchShow, type ShowProfile } from '../src/core/match';
import type { JudgeReply } from './messages';

const SELECTORS = [
  '[data-testid="tweetText"]',                 // X
  'ytd-comment-view-model #content-text',      // YouTube comments
  'ytd-comment-renderer #content-text',
  'a#video-title',                             // YouTube titles in search / feeds
  'yt-formatted-string#video-title',
  'h3.yt-lockup-metadata-view-model__heading-reset', // YouTube titles (new lockup layout)
  'h3.shortsLockupViewModelHostMetadataTitle',  // YouTube Shorts titles
  'shreddit-comment [slot="comment"]',         // Reddit comments
  'shreddit-post [slot="title"]',              // Reddit post titles
  'shreddit-post [slot="text-body"]',
].join(',');

// When a title is a spoiler, the whole card goes: thumbnails and description snippets leak too.
const CARDS = [
  'ytd-video-renderer', 'ytd-rich-item-renderer', 'ytd-compact-video-renderer', 'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model', 'ytd-reel-item-renderer', 'article[data-testid="tweet"]', 'shreddit-post',
].join(',');

function cardOf(el: HTMLElement): HTMLElement {
  const isComment = el.closest('ytd-comment-view-model, ytd-comment-renderer, shreddit-comment');
  return (!isComment && el.closest<HTMLElement>(CARDS)) || el;
}

let shows: ShowProfile[] = [];
let enabled = true;

async function loadState() {
  const s = await chrome.storage.local.get(['shows', 'settings']);
  shows = (s.shows ?? []) as ShowProfile[];
  enabled = (s.settings as { enabled?: boolean } | undefined)?.enabled ?? true;
}

function veil(textEl: HTMLElement, reason: string) {
  const el = cardOf(textEl);
  textEl.classList.remove('sv-checking');
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
  if (el === textEl) el.before(tag);
  else { el.classList.add('sv-card'); el.prepend(tag); }
}

async function check(el: HTMLElement) {
  if (el.dataset.sv) return;
  const text = el.innerText.trim();
  if (text.length < 8) return;
  // On a page about a followed show (e.g. its video), judge every comment, not just ones naming it.
  const isComment = !!el.closest('ytd-comment-view-model, ytd-comment-renderer, shreddit-comment');
  const pageTitle = isComment && matchShow(document.title, shows) ? document.title : undefined;
  if (!matchShow(text, shows) && !pageTitle) { el.dataset.sv = 'skip'; return; }
  el.dataset.sv = 'pending';
  cardOf(el).classList.add('sv-checking');
  try {
    const reply = (await chrome.runtime.sendMessage({ type: 'judge', text, pageTitle })) as JudgeReply;
    if (reply.ok && reply.judgement.verdict === 'spoiler') {
      el.dataset.sv = 'veiled';
      veil(el, reply.judgement.reason);
      return;
    }
    el.dataset.sv = reply.ok ? 'safe' : 'error';
  } catch {
    el.dataset.sv = 'error';
  }
  cardOf(el).classList.remove('sv-checking');
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
