import { onDeviceAvailability, prepareOnDevice, type ShowProfile } from '../src/core/veil';
import { DEFAULT_SETTINGS, type BuildReply, type Counters, type Settings } from './messages';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function state() {
  const s = await chrome.storage.local.get(['shows', 'settings', 'counters']);
  return {
    shows: (s.shows ?? []) as ShowProfile[],
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) } as Settings,
    counters: s.counters as Counters | undefined,
  };
}

async function saveSettings(patch: Partial<Settings>) {
  const { settings } = await state();
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}

async function render() {
  const { shows, settings, counters } = await state();
  $<HTMLInputElement>('enabled').checked = settings.enabled;
  document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach(r => { r.checked = r.value === settings.mode; });
  const list = $<HTMLUListElement>('shows');
  list.replaceChildren(...shows.map(show => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.innerHTML = '<strong></strong><br><small></small>';
    name.querySelector('strong')!.textContent = show.title;
    name.querySelector('small')!.textContent = `seen up to ${show.progress} · ${show.terms.length} names · ${show.hiddenPlot.length} hidden points`;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      await chrome.storage.local.set({ shows: shows.filter(s => s.id !== show.id) });
      render();
    });
    li.append(name, del);
    return li;
  }));
  if (counters) {
    $('counters').textContent = `Checked ${counters.checked} posts · veiled ${counters.veiled} · on-device ${counters.onDevice} · cloud ${counters.inCloud}`;
  }
  const a = await onDeviceAvailability();
  $('nano').textContent = a === 'available' ? 'Gemini Nano is ready on this device.' : `Gemini Nano: ${a}. Until it is ready, posts are judged in the cloud.`;
  $<HTMLButtonElement>('warm').hidden = a === 'available' || a.startsWith('unavailable');
}

$<HTMLInputElement>('enabled').addEventListener('change', e => saveSettings({ enabled: (e.target as HTMLInputElement).checked }));
document.querySelectorAll<HTMLInputElement>('input[name=mode]').forEach(r =>
  r.addEventListener('change', () => saveSettings({ mode: r.value as Settings['mode'] })));

$<HTMLButtonElement>('warm').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('warm');
  btn.disabled = true;
  try {
    await prepareOnDevice(p => { $('nano').textContent = `Downloading Gemini Nano… ${Math.round(p * 100)}%`; });
  } catch (e) {
    $('nano').textContent = `Could not prepare Gemini Nano: ${(e as Error).message}`;
  }
  btn.disabled = false;
  render();
});

$<HTMLFormElement>('add').addEventListener('submit', async e => {
  e.preventDefault();
  const status = $('addStatus');
  status.textContent = 'Building spoiler profile in the cloud…';
  const reply = (await chrome.runtime.sendMessage({
    type: 'build',
    title: $<HTMLInputElement>('title').value.trim(),
    progress: $<HTMLInputElement>('progress').value.trim(),
    guide: $<HTMLTextAreaElement>('guide').value,
  })) as BuildReply;
  status.textContent = reply.ok ? `Added "${reply.profile.title}". Spoilers will be veiled as you scroll.` : `Failed: ${reply.error}`;
  if (reply.ok) ($<HTMLFormElement>('add')).reset();
  render();
});

render();
