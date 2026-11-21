import { buildProfile, judgePost, onDeviceAvailability, prepareOnDevice, type JudgeMode, type ShowProfile } from '../src/core/veil';
import { DEMO_GUIDE, DEMO_POSTS, DEMO_TITLE, type DemoPost } from './fixture';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const titleEl = $<HTMLInputElement>('title');
const progressEl = $<HTMLSelectElement>('progress');
const guideEl = $<HTMLTextAreaElement>('guide');
const buildBtn = $<HTMLButtonElement>('build');
const playBtn = $<HTMLButtonElement>('play');
const nanoBtn = $<HTMLButtonElement>('nano');
const feed = $<HTMLOListElement>('feed');

titleEl.value = DEMO_TITLE;
guideEl.value = DEMO_GUIDE;
for (let i = 1; i <= 8; i++) progressEl.add(new Option(`Episode ${i}`, String(i), i === 3, i === 3));

let profile: ShowProfile | null = null;
const stats = { read: 0, veiled: 0, device: 0, cloud: 0, latency: 0, judged: 0, correct: 0, scored: 0 };

function setStatus(id: string, text: string, tone: 'ok' | 'warn' | 'busy' | '' = '') {
  const el = $(id);
  el.textContent = text;
  el.dataset.tone = tone;
}

function renderStats() {
  $('sRead').textContent = String(stats.read);
  $('sVeiled').textContent = String(stats.veiled);
  $('sDevice').textContent = String(stats.device);
  $('sCloud').textContent = String(stats.cloud);
  $('sLat').textContent = stats.judged ? `${Math.round(stats.latency / stats.judged)} ms` : '–';
  $('sAcc').textContent = stats.scored ? `${stats.correct}/${stats.scored}` : '–';
}

async function refreshNano() {
  const a = await onDeviceAvailability();
  const label: Record<string, string> = {
    available: 'Gemini Nano is ready on this device.',
    downloadable: 'Gemini Nano can be downloaded (click below). Until then, posts are judged in the cloud.',
    downloading: 'Gemini Nano is downloading… posts use the cloud meanwhile.',
  };
  setStatus('nanoStatus', label[a] ?? `On-device model ${a}. Posts will be judged in the cloud.`, a === 'available' ? 'ok' : 'warn');
  nanoBtn.hidden = a === 'available' || a.startsWith('unavailable');
}

nanoBtn.addEventListener('click', async () => {
  nanoBtn.disabled = true;
  setStatus('nanoStatus', 'Downloading Gemini Nano… 0%', 'busy');
  try {
    await prepareOnDevice(p => setStatus('nanoStatus', `Downloading Gemini Nano… ${Math.round(p * 100)}%`, 'busy'));
  } catch (e) {
    setStatus('nanoStatus', `Could not prepare Gemini Nano: ${(e as Error).message}`, 'warn');
  }
  nanoBtn.disabled = false;
  await refreshNano();
});

buildBtn.addEventListener('click', async () => {
  buildBtn.disabled = true;
  const ep = progressEl.value;
  setStatus('profileStatus', 'Asking Gemini in the cloud to build your spoiler profile…', 'busy');
  const t0 = performance.now();
  try {
    profile = await buildProfile(titleEl.value.trim(), `Episode ${ep} (inclusive)`, guideEl.value);
    const s = ((performance.now() - t0) / 1000).toFixed(1);
    setStatus('profileStatus',
      `Profile ready in ${s}s (cloud, once): ${profile.terms.length} names to watch for, ${profile.hiddenPlot.length} hidden plot points kept from you. From now on, posts are judged locally.`, 'ok');
    playBtn.disabled = false;
  } catch (e) {
    setStatus('profileStatus', `Cloud call failed: ${(e as Error).message}`, 'warn');
  }
  buildBtn.disabled = false;
});

function postCard(p: DemoPost): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'post checking';
  li.innerHTML = `
    <div class="avatar" aria-hidden="true">${p.user.slice(0, 1)}</div>
    <div class="body">
      <div class="who"><strong></strong> <span class="handle"></span></div>
      <p class="text"></p>
      <div class="veil" hidden>
        <p class="veil-reason"></p>
        <button class="reveal">Show anyway</button>
      </div>
      <div class="meta"><span class="badge">checking…</span></div>
    </div>`;
  li.querySelector('strong')!.textContent = p.user;
  li.querySelector('.handle')!.textContent = `@${p.handle}`;
  li.querySelector('.text')!.textContent = p.text;
  li.querySelector('.reveal')!.addEventListener('click', () => li.classList.add('revealed'));
  return li;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

playBtn.addEventListener('click', async () => {
  if (!profile) return;
  playBtn.disabled = true;
  feed.replaceChildren();
  Object.assign(stats, { read: 0, veiled: 0, device: 0, cloud: 0, latency: 0, judged: 0, correct: 0, scored: 0 });
  renderStats();
  const mode = (document.querySelector('input[name=mode]:checked') as HTMLInputElement).value as JudgeMode;
  const second = $<HTMLInputElement>('second').checked;
  const seen = Number(progressEl.value);

  for (const p of DEMO_POSTS) {
    const li = postCard(p);
    feed.append(li);
    li.scrollIntoView({ behavior: 'smooth', block: 'end' });
    const badge = li.querySelector('.badge')!;
    try {
      const j = await judgePost(p.text, [profile], { mode, cloudSecondOpinion: second });
      stats.read++;
      if (j.source !== 'skipped') {
        stats.judged++;
        stats.latency += j.ms;
        if (j.source === 'on_device') stats.device++; else stats.cloud++;
        const truth = p.reveals > seen;
        stats.scored++;
        if ((j.verdict === 'spoiler') === truth) stats.correct++;
      }
      li.classList.remove('checking');
      if (j.verdict === 'spoiler') {
        stats.veiled++;
        li.classList.add('veiled');
        li.querySelector('.veil')!.removeAttribute('hidden');
        li.querySelector('.veil-reason')!.textContent = `Spoiler for ${profile.title}: ${j.reason}`;
      }
      const where = j.source === 'on_device' ? 'on-device' : j.source === 'in_cloud' ? 'cloud' : 'skipped (not about your show)';
      badge.textContent = j.source === 'skipped' ? where : `${j.verdict} · ${where} · ${Math.round(j.ms)} ms`;
      badge.setAttribute('data-source', j.source);
    } catch (e) {
      li.classList.remove('checking');
      badge.textContent = `error: ${(e as Error).message}`;
    }
    renderStats();
    await sleep(250);
  }
  playBtn.disabled = false;
  playBtn.textContent = 'Scroll again';
});

refreshNano();
renderStats();
