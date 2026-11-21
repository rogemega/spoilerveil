// Bundles the web demo and the Chrome extension with esbuild.
// Secrets are never committed: the App Check debug token (dev builds only) and the
// reCAPTCHA site key are read from .env.local or the environment.
import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const env = { ...process.env };
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2];
  }
}

const define = {
  __APPCHECK_DEBUG_TOKEN__: JSON.stringify(env.APPCHECK_DEBUG_TOKEN ?? ''),
  __RECAPTCHA_SITE_KEY__: JSON.stringify(env.RECAPTCHA_SITE_KEY ?? ''),
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/web', { recursive: true });
mkdirSync('dist/extension', { recursive: true });

const common = { bundle: true, format: 'esm', target: 'chrome130', define, minify: false, sourcemap: true, logLevel: 'info' };

await esbuild.build({ ...common, entryPoints: { demo: 'web/demo.ts' }, outdir: 'dist/web' });
cpSync('web/index.html', 'dist/web/index.html');
cpSync('web/style.css', 'dist/web/style.css');

await esbuild.build({
  ...common,
  entryPoints: {
    background: 'extension/background.ts',
    offscreen: 'extension/offscreen.ts',
    popup: 'extension/popup.ts',
  },
  outdir: 'dist/extension',
});
// Content scripts cannot be ES modules.
await esbuild.build({ ...common, format: 'iife', entryPoints: { content: 'extension/content.ts' }, outdir: 'dist/extension' });
for (const f of ['manifest.json', 'offscreen.html', 'popup.html', 'popup.css', 'content.css']) {
  cpSync(`extension/${f}`, `dist/extension/${f}`);
}
cpSync('extension/icons', 'dist/extension/icons', { recursive: true });
console.log('built dist/web and dist/extension');
