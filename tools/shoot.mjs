/* Pruebas de interfaz + capturas con Chrome DevTools Protocol.
   Uso: node tools/shoot.mjs */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9337;
const BASE = process.env.MP_BASE || 'http://127.0.0.1:4180';
const OUT = path.join(process.cwd(), 'shots');
const profile = path.join(process.cwd(), '.tmp-cdp');
const testPhoto = path.join(OUT, 'test-remera.jpg');
const backupFile = path.join(OUT, 'backup-prueba.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(profile, { recursive: true, force: true });

const now = Date.now();
fs.writeFileSync(backupFile, JSON.stringify({
  app: 'mi-placard',
  version: 1,
  exportedAt: new Date(now).toISOString(),
  garments: [{
    id: 'import-1',
    name: 'Campera de jean',
    category: 'campera',
    color: { hex: '#4E6E9E', name: 'Jean', family: 'azul', neutral: false },
    palette: ['#4E6E9E'],
    photo: null,
    seasons: ['entretiempo'],
    occasions: ['casual', 'salir'],
    favorite: true,
    notes: 'Del backup',
    createdAt: now,
    updatedAt: now,
    wornCount: 2,
    lastWorn: now - 86400000
  }],
  looks: [{
    id: 'import-look-1',
    title: 'Look importado',
    reason: 'Prueba de importación.',
    itemIds: ['import-1'],
    createdAt: now,
    wornAt: null
  }],
  meta: []
}));

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--window-size=430,932',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank'
], { stdio: 'ignore' });

async function waitPort() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch (err) { /* todavía no */ }
    await sleep(150);
  }
  throw new Error('Chrome no respondió');
}

let msgId = 0;
const pending = new Map();
const logs = [];

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', reject, { once: true });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const cb = pending.get(msg.id);
        pending.delete(msg.id);
        if (cb) cb(msg);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params.type === 'error' || msg.params.type === 'warning') {
          logs.push('[console.' + msg.params.type + '] ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
        }
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        logs.push('[exception] ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        logs.push('[log] ' + msg.params.entry.text);
      }
    });
  });
}

function makeSend(ws) {
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, (msg) => {
      if (msg.error) reject(new Error(method + ': ' + msg.error.message));
      else resolve(msg.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  await waitPort();
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const ws = await connect(target.webSocketDebuggerUrl);
  const send = makeSend(ws);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('DOM.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: false });

  const checks = [];
  function check(name, value, expected) {
    const ok = expected === undefined ? !!value : value === expected;
    checks.push({ name, ok, value, expected });
    console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : ' → ' + JSON.stringify(value)));
  }

  async function evaluate(expression, timeout = 8000) {
    const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout });
    if (out.exceptionDetails) {
      throw new Error('eval: ' + (out.exceptionDetails.exception?.description || out.exceptionDetails.text));
    }
    return out.result.value;
  }

  async function waitFor(expression, timeout = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { if (await evaluate(expression)) return true; } catch (err) { /* seguimos */ }
      await sleep(120);
    }
    return false;
  }

  async function navigate(url) {
    await send('Page.navigate', { url: BASE + url });
    await waitFor('document.readyState === "complete"');
    const ready = await waitFor('document.body.dataset.ready === "1"', 15000);
    if (!ready) throw new Error('La app no terminó de arrancar en ' + url);
    await sleep(250);
  }

  async function shot(name, full) {
    let clip;
    if (full) {
      const metrics = await send('Page.getLayoutMetrics');
      const size = metrics.cssContentSize || metrics.contentSize;
      clip = { x: 0, y: 0, width: 430, height: Math.ceil(size.height), scale: 1 };
    }
    const out = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full, clip });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(out.data, 'base64'));
    console.log('    → shots/' + name + '.png');
  }

  async function click(selector) {
    const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error('No encontré ' + selector);
    await sleep(350);
  }

  async function type(selector, text) {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`);
    await sleep(150);
  }

  async function setFile(selector, file) {
    const doc = await send('DOM.getDocument', { depth: -1 });
    const found = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    if (!found.nodeId) throw new Error('No encontré el input ' + selector);
    await send('DOM.setFileInputFiles', { files: [file], nodeId: found.nodeId });
  }

  console.log('\n1. Placard con datos de ejemplo');
  await navigate('/?demo=1');
  check('se cargaron 26 prendas', await evaluate('document.querySelectorAll("#closetGrid .card").length'), 26);
  const measure = JSON.parse(await evaluate(`JSON.stringify({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    search: (() => { const r = document.querySelector('.search').getBoundingClientRect(); return {x: Math.round(r.x), right: Math.round(r.right)}; })(),
    stats: document.querySelector('#closetStats').textContent
  })`));
  check('no hay desborde horizontal', measure.scrollWidth, 430);
  check('el buscador respeta los márgenes', measure.search.x === 18 && measure.search.right === 412);
  check('stats sin categorías', /\d+ prendas/.test(measure.stats));
  check('el placard arranca agrupado por categoría', /^Remera/m.test(await evaluate('document.querySelector("#closetGrid .card").innerText')));
  await shot('closet');
  await shot('closet-full', true);

  console.log('\n2. Buscador por color');
  await type('#searchInput', 'verde');
  const filtered = await evaluate('document.querySelectorAll("#closetGrid .card").length');
  check('“verde” filtra el placard', filtered >= 1 && filtered < 26);
  await shot('busqueda');
  await click('[data-action="clear-search"]');

  console.log('\n3. Probador: “algo verde para salir”');
  await navigate('/?view=style&ask=algo%20verde%20para%20salir');
  await waitFor('document.querySelectorAll("#results .look-card").length === 3');
  check('propone 3 looks', await evaluate('document.querySelectorAll("#results .look-card").length'), 3);
  const firstLook = await evaluate('document.querySelector("#results .look-card").innerText');
  check('el look verde usa la remera verde', /Verde oliva/.test(firstLook) && /Remera verde oliva/.test(firstLook));
  check('la razón no dice “Rosa es el que manda”', !/Rosa es el que manda/.test(firstLook));
  check('los looks proponen conjuntos completos', await evaluate('document.querySelectorAll("#results .look-item").length >= 9'));
  const scrolled = await evaluate('window.scrollY > 100');
  check('la pantalla se desplaza a los resultados', scrolled);
  await shot('probador');
  await shot('probador-full', true);

  console.log('\n4. Guardar y usar looks');
  const beforeShuffle = await evaluate('document.querySelector("#results .look-card").innerText');
  await click('[data-action="shuffle"]');
  await sleep(500);
  const afterShuffle = await evaluate('document.querySelector("#results .look-card").innerText');
  check('“Ver otras” cambia la propuesta', beforeShuffle !== afterShuffle);
  await click('[data-action="save-result"]');
  check('el botón queda como guardado', await evaluate('!(document.querySelector("[data-action=\\"save-result\\"]").disabled === false)'));
  await click('[data-action="wear-result"]');
  await sleep(900);
  check('“Me lo pongo” confirma', await evaluate('document.querySelector("#toast").textContent.includes("Anotado")'));
  await shot('probador-guardado');
  await click('[data-tab="looks"]');
  await sleep(400);
  check('los looks quedan guardados', await evaluate('document.querySelectorAll("#looksList .look-card").length'), 2);
  check('no duplica el look al usarlo', await evaluate('document.querySelectorAll("#looksList .look-card").length'), 2);
  await shot('looks');
  await shot('looks-full', true);

  console.log('\n5. Detalle de una prenda');
  await navigate('/?demo=1');
  await click('#closetGrid .card');
  check('abre la ficha de la prenda', await evaluate('!document.querySelector("#sheetRoot").hidden'));
  check('la ficha no dice “1 semanas”', !/1 semanas/.test(await evaluate('document.querySelector("#sheet").innerText')));
  await shot('detalle');
  await click('[data-action="style-with"]');
  await waitFor('document.querySelectorAll("#results .look-card").length === 3');
  check('arma un look a partir de la prenda', /^(remera|jean|vestido)/i.test(await evaluate('document.querySelector("#askInput").value')));
  check('el look incluye la prenda elegida', /Remera oversize blanca/.test(await evaluate('document.querySelector("#results").innerText')));
  await navigate('/?demo=1');

  console.log('\n6. Alta de prenda sin foto');
  await click('.fab');
  check('abre la pantalla de alta', await evaluate('!document.querySelector("#addScreen").hidden'));
  await shot('alta');
  await evaluate('document.querySelector("#addScreen").scrollTop = 700');
  await sleep(300);
  await shot('alta-abajo');
  await click('#catGrid button[data-cat="remera"]');
  await click('[data-action="save-garment"]');
  check('no deja guardar sin color', /color/i.test(await evaluate('document.querySelector("#toast").textContent')));
  await click('[data-action="close-add"]');

  console.log('\n7. Alta de prenda con foto y detección de color');
  await click('.fab');
  await setFile('#photoInput', testPhoto);
  const photoReady = await waitFor(
    '!document.querySelector("#photoPreview").hidden && document.querySelectorAll("#paletteRow .swatch").length > 0'
  );
  check('la foto se procesa y muestra la paleta', photoReady);
  const picked = await evaluate('document.querySelector("#colorPicked").textContent');
  check('detecta el color verde', /Verde/i.test(picked));
  check('el color se muestra como detectado', await evaluate('!document.querySelector("#colorSummary").hidden && /Verde/i.test(document.querySelector("#colorSummaryName").textContent)'));
  check('la paleta completa queda escondida', await evaluate('document.querySelector("#colorEditor").hidden'));
  const consent = await waitFor('!!document.querySelector("[data-action=\\"confirm-ok\\"]")', 10000);
  check('pide permiso para bajar el modelo de IA', consent);
  await click('[data-action="confirm-ok"]');
  const aiDone = await waitFor('!!document.querySelector("#catGrid button.is-active")', 240000);
  const aiCategory = aiDone ? await evaluate('document.querySelector("#catGrid button.is-active").getAttribute("data-cat")') : null;
  check('la IA elige la categoría sola', aiCategory, 'remera');
  check('la IA avisa lo que detectó', /Detectamos Remera/i.test(await evaluate('document.querySelector("#aiHint").textContent')));
  const autoName = await evaluate('document.querySelector("#gName").value');
  check('autocompleta el nombre con categoría y color', /Remera verde/i.test(autoName));
  check('temporada y ocasión se eligen solas', await evaluate('document.querySelectorAll("#seasonRow .chip.is-active").length > 0 && document.querySelectorAll("#occasionRow .chip.is-active").length > 0'));
  check('la foto se muestra desde un blob local', await evaluate('document.querySelector("#photoImg").src.startsWith("blob:")'));
  await evaluate('document.querySelector("#addScreen").scrollTop = 980');
  await sleep(300);
  await shot('alta-foto');
  await click('[data-action="edit-color"]');
  check('“Cambiar” muestra la paleta', await evaluate('!document.querySelector("#colorEditor").hidden'));
  await shot('alta-color');
  await click('[data-action="save-garment"]');
  await waitFor('document.querySelector("#addScreen").hidden === true && document.querySelectorAll("#closetGrid .card").length === 27');
  check('la prenda nueva aparece en el placard', await evaluate('document.querySelectorAll("#closetGrid .card").length'), 27);
  const newCard = await evaluate(`(() => {
    const c = [...document.querySelectorAll('#closetGrid .card')].find(x => x.querySelector('img') && /Remera verde/i.test(x.innerText));
    return c ? c.innerText : '';
  })()`);
  check('la prenda nueva está agrupada con las remeras', /Remera verde/.test(newCard));
  check('la prenda nueva tiene foto', await evaluate(`(() => {
    const c = [...document.querySelectorAll('#closetGrid .card')].find(x => x.querySelector('img') && /Remera verde/i.test(x.innerText));
    return !!(c && c.querySelector('img'));
  })()`));
  console.log('    prenda: ' + newCard.replace(/\n/g, ' · '));

  console.log('\n8. Funcionamiento sin conexión');
  const swReady = await evaluate('navigator.serviceWorker.ready.then(() => true)', 12000).catch(() => false);
  check('el service worker está activo', swReady);
  const manifest = await send('Page.getAppManifest');
  check('el manifest no tiene errores', (manifest.errors || []).length === 0);
  const installability = await send('Page.getInstallabilityErrors');
  check('la app es instalable', (installability.installabilityErrors || []).length === 0);
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await send('Page.reload');
  await waitFor('document.readyState === "complete"');
  const offlineReady = await waitFor('document.body.dataset.ready === "1"', 12000);
  check('la app abre sin internet', offlineReady);
  check('conserva las prendas sin internet', await evaluate('document.querySelectorAll("#closetGrid .card").length'), 27);
  check('conserva las fotos sin internet', await evaluate('document.querySelectorAll("#closetGrid .card img").length') >= 1);
  await shot('offline');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log('\n9. Importar backup');
  await navigate('/?demo=1');
  await click('[data-action="settings"]');
  await shot('ajustes');
  await click('[data-action="import"]');
  await setFile('#importInput', backupFile);
  await waitFor('!document.querySelector("#sheetRoot").hidden && !!document.querySelector("[data-action=\\"confirm-ok\\"]")');
  await click('[data-action="confirm-ok"]');
  await waitFor('document.querySelectorAll("#closetGrid .card").length === 1');
  check('el backup reemplaza el placard', await evaluate('document.querySelectorAll("#closetGrid .card").length'), 1);
  check('importa el nombre de la prenda', await evaluate('document.querySelector("#closetGrid .card h3").textContent'), 'Campera de jean');
  check('importa los looks', await evaluate('document.querySelectorAll("#looksList .look-card").length'), 1);

  console.log('\n10. Borrar todo');
  await click('[data-action="settings"]');
  await click('[data-action="wipe"]');
  await waitFor('!!document.querySelector("[data-action=\\"confirm-ok\\"]")');
  await click('[data-action="confirm-ok"]');
  await waitFor('document.querySelectorAll("#closetGrid .card").length === 0');
  check('el placard queda vacío', await evaluate('document.querySelectorAll("#closetGrid .card").length'), 0);
  check('se ve el estado vacío', await evaluate('!document.querySelector("#closetEmpty").hidden'));
  check('desaparece el buscador vacío', await evaluate('document.querySelector("#searchWrap").hidden'));
  await shot('vacio');
  await shot('vacio-full', true);

  console.log('\n11. Estado final');
  console.log('  Medidas: ' + JSON.stringify(measure));
  if (logs.length) console.log('\nConsola:\n' + logs.slice(0, 30).join('\n'));
  else console.log('  Sin errores de consola.');

  const failed = checks.filter((c) => !c.ok);
  console.log('\n' + (checks.length - failed.length) + '/' + checks.length + ' verificaciones OK' + (failed.length ? ' — FALLARON: ' + failed.map((f) => f.name).join(', ') : ''));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ checks, logs, measure }, null, 2));

  ws.close();
  chrome.kill();
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nFALLO:', err.message);
  console.error(logs.join('\n'));
  chrome.kill();
  process.exitCode = 1;
});
