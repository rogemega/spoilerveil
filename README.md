# SpoilerVeil

Scroll freely. SpoilerVeil reads every post on your screen **on your device** with Gemini Nano and veils the ones that would spoil the show you are watching.

Built for #BuildHybridAI 2026 with **Firebase AI Logic hybrid inference** (Web / Chrome).

## Why hybrid

| Step | Runs where | Why |
| --- | --- | --- |
| Build a *spoiler profile* when you add a show (names to watch for, what you've already seen, what must stay hidden) | **Cloud** — Gemini (`gemini-3.5-flash-lite`), once per show | Needs world knowledge or a long episode guide. Happens once. |
| Judge each post while you scroll | **On-device** — Gemini Nano via the Prompt API, `InferenceMode.PREFER_ON_DEVICE` | Hundreds of short calls per session: free, low-latency, and *what you watch and what you read never leave the browser*. |
| Fallback | Cloud, automatically | If Nano isn't available (or is still downloading), Firebase AI Logic sends the same request to the cloud. Optional "second opinion" for posts Nano marks as unsure. |

The list of hidden plot points is written by the cloud model and only read by the on-device model. The UI never shows it, and veil labels are deliberately vague ("reveals a character's fate").

A free local prefilter (show names, aliases, katakana transliterations) means posts that are not about your shows never reach a model at all.

## Pieces

- `src/core/` — Firebase bootstrap (App Check + AI Logic) and the hybrid judge (`veil.ts`).
- `web/` — a demo page with a fictional show and a fictional timeline, so you can try it without installing anything.
- `extension/` — a Chrome extension (MV3) for X, YouTube and Reddit. Firebase AI Logic runs in an offscreen document; the content script stays tiny and Firebase-free.

## Run locally

```bash
npm install
echo "APPCHECK_DEBUG_TOKEN=<your App Check debug token>" > .env.local   # never committed
npm run build
npx http-server dist/web -p 5173      # web demo
# Chrome → chrome://extensions → Developer mode → Load unpacked → dist/extension
```

Gemini Nano needs a supported Chrome and device (see Chrome's built-in AI hardware requirements). Without it, everything still works through the cloud fallback.

## License

Apache-2.0
