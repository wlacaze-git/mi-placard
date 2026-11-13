/* Pruebas de lógica (sin navegador): catálogo, colores y recomendador.
   Ejecutar: node test/logic.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['js/catalog.js', 'js/colors.js', 'js/sample.js', 'js/recommend.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

const C = globalThis.Catalog;
const CU = globalThis.ColorUtil;
const R = globalThis.Recommend;
let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

console.log('\nCatálogo y colores');
ok('todas las categorías tienen ícono', () => {
  for (const cat of C.CATEGORIES) assert.ok(C.ICONS[cat.id], 'falta ícono: ' + cat.id);
});
ok('los slots son válidos', () => {
  for (const cat of C.CATEGORIES) assert.ok(['top', 'bottom', 'dress', 'outer', 'shoes', 'acc'].includes(cat.slot), cat.id);
});
ok('nombre de color en castellano', () => {
  assert.equal(CU.nameColor('#4F7A4A').name, 'Verde');
  assert.equal(CU.nameColor('#141414').name, 'Negro');
  assert.equal(CU.nameColor('#BE8F5E').family, 'marron');
});
ok('armonía: neutro combina con todo', () => {
  assert.ok(CU.harmony('#4F7A4A', '#FAF8F3') > 0.9);
  assert.ok(CU.harmony('#4F7A4A', '#141414') > 0.9);
});
ok('armonía: un neutro suma más que un choque cálido', () => {
  const conNeutro = CU.harmony('#B93B32', '#F3EFE7');
  const choque = CU.harmony('#B93B32', '#4F7A4A');
  assert.ok(conNeutro > choque, 'neutro ' + conNeutro + ' debería superar a ' + choque);
});

console.log('\nInterpretación del pedido');
ok('detecta color', () => {
  const p = R.parse('quiero usar algo verde');
  assert.deepEqual(p.colors, ['verde']);
});
ok('detecta prenda', () => {
  const p = R.parse('quiero un jean');
  assert.ok(p.cats.includes('jean'));
});
ok('detecta ocasión', () => {
  assert.equal(R.parse('para salir con amigas').occasion, 'salir');
  assert.equal(R.parse('para la facu').occasion, 'facultad');
});
ok('detecta frío y calor', () => {
  assert.equal(R.parse('hace frío, quiero algo abrigado').feel, 'frio');
  assert.equal(R.parse('hace mucho calor').feel, 'calor');
});
ok('entiende acentos y mayúsculas', () => {
  const p = R.parse('QUIERO USAR ALGO VERDE PARA LA FACU');
  assert.deepEqual(p.colors, ['verde']);
  assert.equal(p.occasion, 'facultad');
});
ok('no confunde "verde" con "verdad"', () => {
  assert.deepEqual(R.parse('la verdad no sé').colors, []);
});

console.log('\nRecomendaciones');
const wardrobe = globalThis.Sample.wardrobe();
const complete = (look) => {
  const slots = look.items.map((g) => C.BY_ID[g.category].slot);
  const hasBase = (slots.includes('top') && slots.includes('bottom')) || slots.includes('dress');
  return hasBase && slots.includes('shoes');
};
const idsOf = (look) => look.items.map((g) => g.id);
const hasFamily = (look, family) => look.items.some((g) => (g.palette || []).concat(g.color.hex).some((h) => CU.nameColor(h).family === family));

ok('arma 3 looks completos para "algo verde"', () => {
  const res = R.suggest(wardrobe, 'quiero usar algo verde', { seed: 42 });
  assert.equal(res.status, 'ok');
  assert.equal(res.looks.length, 3);
  for (const look of res.looks) {
    assert.ok(complete(look), 'look incompleto: ' + idsOf(look));
    assert.ok(hasFamily(look, 'verde'), 'sin verde: ' + idsOf(look));
    assert.ok(look.items.length >= 3 && look.items.length <= 5, 'cantidad rara: ' + look.items.length);
    assert.ok(new Set(idsOf(look)).size === look.items.length, 'prendas repetidas');
    assert.ok(look.title.length > 0 && look.reason.length > 20);
    assert.ok(!/undefined|null/.test(look.reason + look.title));
  }
});

ok('"jean" ancla en un jean', () => {
  const res = R.suggest(wardrobe, 'quiero un jean', { seed: 7 });
  assert.equal(res.status, 'ok');
  assert.ok(res.looks.length > 0);
  for (const look of res.looks) {
    assert.ok(idsOf(look).includes('demo-11') || idsOf(look).includes('demo-12'), 'sin jean: ' + idsOf(look));
  }
});

ok('"un vestido" resuelve vestido + calzado', () => {
  const res = R.suggest(wardrobe, 'un vestido para salir', { seed: 3 });
  assert.equal(res.status, 'ok');
  assert.ok(res.looks[0].items.some((g) => g.category === 'vestido'));
  assert.ok(res.looks[0].items.some((g) => C.BY_ID[g.category].slot === 'shoes'));
});

ok('con frío mete abrigo', () => {
  const res = R.suggest(wardrobe, 'hace frío para salir', { seed: 5 });
  assert.equal(res.status, 'ok');
  const withOuter = res.looks.filter((l) => l.items.some((g) => C.BY_ID[g.category].slot === 'outer'));
  assert.ok(withOuter.length >= 2, 'esperaba abrigo en la mayoría de los looks');
});

ok('con calor evita abrigos y prendas pesadas', () => {
  const res = R.suggest(wardrobe, 'hace calor', { seed: 11 });
  assert.equal(res.status, 'ok');
  for (const look of res.looks) {
    for (const g of look.items) {
      assert.notEqual(C.BY_ID[g.category].slot, 'outer', 'abrigo con calor');
      assert.ok(C.BY_ID[g.category].warmth < 3.4, 'prenda pesada con calor: ' + g.name);
    }
  }
});

ok('"remera verde para la facu" combina color + prenda + ocasión', () => {
  const res = R.suggest(wardrobe, 'remera verde para la facu', { seed: 9 });
  assert.equal(res.status, 'ok');
  assert.ok(res.looks[0].items.some((g) => g.id === 'demo-2'), 'no usó la remera verde');
});

ok('avisa cuando no hay el color pedido', () => {
  const res = R.suggest(wardrobe, 'quiero algo plateado', { seed: 1 });
  assert.equal(res.status, 'no-color');
  assert.ok(res.availableColors.length > 0);
});

ok('placard vacío devuelve estado empty', () => {
  const res = R.suggest([], 'algo verde', { seed: 1 });
  assert.equal(res.status, 'empty');
  assert.equal(res.looks.length, 0);
});

ok('look parcial cuando faltan zapatos', () => {
  const onlyTops = wardrobe.filter((g) => C.BY_ID[g.category].slot === 'top');
  const res = R.suggest(onlyTops, 'algo verde', { seed: 2 });
  assert.ok(res.looks.length > 0);
  assert.ok(res.looks[0].missing.includes('shoes') || res.looks[0].missing.includes('bottom'));
});

ok('los resultados vienen ordenados por puntaje', () => {
  const res = R.suggest(wardrobe, 'algo para salir', { seed: 21 });
  for (let i = 1; i < res.looks.length; i++) {
    assert.ok(res.looks[i - 1].score >= res.looks[i].score);
  }
});

ok('"ver otras" evita repetir la misma combinación', () => {
  const first = R.suggest(wardrobe, 'algo negro', { seed: 4 });
  const sigs = first.looks.map((l) => l.signature);
  const second = R.suggest(wardrobe, 'algo negro', { seed: 5, exclude: sigs });
  const repeated = second.looks.filter((l) => sigs.includes(l.signature));
  assert.ok(repeated.length <= 1, 'repitió demasiado');
});

ok('es determinístico con la misma semilla', () => {
  const a = R.suggest(wardrobe, 'algo verde para salir', { seed: 123 });
  const b = R.suggest(wardrobe, 'algo verde para salir', { seed: 123 });
  assert.deepEqual(a.looks.map((l) => l.signature), b.looks.map((l) => l.signature));
});

console.log('\n' + passed + ' pruebas OK\n');
