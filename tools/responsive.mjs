/* Verificación responsive: 360, 430 y 1280 px. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9343;
const profile = path.join(process.cwd(), '.tmp-responsive');
const OUT = path.join(process.cwd(), 'shots');
fs.rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--disable-breakpad', '--disable-crash-reporter',
  '--no-first-run', '--hide-scrollbars', '--window-size=1280,900',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });

async function main() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break; } catch (e) { /* noop */ }
    await sleep(150);
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id) { const cb = pending.get(m.id); pending.delete(m.id); if (cb) cb(m); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evl = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout: 15000 });
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || out.exceptionDetails.text);
    return out.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');

  const sizes = [
    { w: 360, h: 800, name: 'responsive-360', dpr: 2 },
    { w: 430, h: 932, name: 'responsive-430', dpr: 2 },
    { w: 1280, h: 900, name: 'responsive-desktop', dpr: 1 }
  ];

  for (const size of sizes) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: size.w, height: size.h, deviceScaleFactor: size.dpr, mobile: false
    });
    await send('Page.navigate', { url: `${process.env.MP_BASE || 'http://127.0.0.1:4180'}/?demo=1` });
    await sleep(1200);
    const info = JSON.parse(await evl(`JSON.stringify({
      vw: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cards: document.querySelectorAll('#closetGrid .card').length,
      app: (() => { const r = document.querySelector('.app').getBoundingClientRect(); return {x: Math.round(r.x), w: Math.round(r.width)}; })(),
      firstCard: (() => { const r = document.querySelector('#closetGrid .card').getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })(),
      fab: (() => { const r = document.querySelector('.fab').getBoundingClientRect(); return {x: Math.round(r.x), right: Math.round(r.right), hidden: document.querySelector('.fab').hidden}; })()
    })`));
    console.log(size.name, JSON.stringify(info), info.scrollWidth === size.w ? 'OK' : 'OVERFLOW');
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, size.name + '.png'), Buffer.from(shot.data, 'base64'));
  }

  ws.close();
  chrome.kill();
}
main().catch((err) => { console.error('FALLO', err); chrome.kill(); process.exit(1); });
