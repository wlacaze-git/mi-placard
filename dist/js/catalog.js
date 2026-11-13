/* Catálogo de prendas, colores y ocasiones.
   Sin dependencias: se usa tanto en el navegador como en los tests de Node. */
(function (global) {
  'use strict';

  var CATEGORIES = [
    // --- tops ---
    { id: 'remera',     label: 'Remera',      slot: 'top',     warmth: 1.2, formality: 1.4, aliases: ['remera', 'remeras', 'camiseta', 'camisetas', 'tee'] },
    { id: 'musculosa',  label: 'Musculosa',   slot: 'top',     warmth: 0.9, formality: 1.2, aliases: ['musculosa', 'musculosas', 'top', 'tank'] },
    { id: 'camisa',     label: 'Camisa',      slot: 'top',     warmth: 2.2, formality: 3.0, aliases: ['camisa', 'camisas', 'camisola', 'oversize'] },
    { id: 'blusa',      label: 'Blusa',       slot: 'top',     warmth: 1.9, formality: 2.9, aliases: ['blusa', 'blusas'] },
    { id: 'buzo',       label: 'Buzo',        slot: 'top',     warmth: 3.6, formality: 1.6, aliases: ['buzo', 'buzos', 'hoodie', 'canguro', 'sweatshirt'] },
    { id: 'pullover',   label: 'Pullover',    slot: 'top',     warmth: 4.2, formality: 2.2, aliases: ['pullover', 'pullovers', 'sweater', 'sueter', 'tejido', 'lana'] },
    // --- abrigos ---
    { id: 'campera',    label: 'Campera',     slot: 'outer',   warmth: 4.8, formality: 1.9, aliases: ['campera', 'camperas', 'chaqueta', 'campera de jean', 'abrigo'] },
    { id: 'tapado',     label: 'Tapado',      slot: 'outer',   warmth: 5.6, formality: 3.4, aliases: ['tapado', 'tapados', 'trench', 'abrigo largo', 'piloto'] },
    // --- bottoms ---
    { id: 'jean',       label: 'Jean',        slot: 'bottom',  warmth: 3.0, formality: 2.0, aliases: ['jean', 'jeans', 'vaquero', 'mom', 'baggy', 'denim'] },
    { id: 'pantalon',   label: 'Pantalón',    slot: 'bottom',  warmth: 3.1, formality: 3.0, aliases: ['pantalon', 'pantalones', 'cargo', 'sastrero', 'palazzo', 'jogger'] },
    { id: 'short',      label: 'Short',       slot: 'bottom',  warmth: 0.8, formality: 1.2, aliases: ['short', 'shorts', 'bermuda', 'bombacha'] },
    { id: 'pollera',    label: 'Pollera',     slot: 'bottom',  warmth: 1.3, formality: 2.4, aliases: ['pollera', 'polleras', 'falda', 'minifalda', 'plizada'] },
    // --- vestidos ---
    { id: 'vestido',    label: 'Vestido',     slot: 'dress',   warmth: 1.9, formality: 3.3, aliases: ['vestido', 'vestidos', 'enterizo', 'mono'] },
    // --- calzado ---
    { id: 'zapatillas', label: 'Zapatillas',  slot: 'shoes',   warmth: 2.0, formality: 1.5, aliases: ['zapatillas', 'zapatilla', 'sneakers', 'zapas', 'tenis', 'urbanas'] },
    { id: 'zapatos',    label: 'Zapatos',     slot: 'shoes',   warmth: 2.2, formality: 3.6, aliases: ['zapatos', 'zapato', 'chatitas', 'mule', 'mary jane', 'tacones'] },
    { id: 'botas',      label: 'Botas',       slot: 'shoes',   warmth: 3.4, formality: 2.6, aliases: ['botas', 'bota', 'borcegos', 'botinetas', 'caña alta'] },
    { id: 'sandalias',  label: 'Sandalias',   slot: 'shoes',   warmth: 0.7, formality: 2.1, aliases: ['sandalias', 'sandalia', 'ojotas', 'chancletas'] },
    // --- accesorios ---
    { id: 'cartera',    label: 'Cartera',     slot: 'acc',     warmth: 0,   formality: 2.6, aliases: ['cartera', 'carteras', 'bolso', 'bandolera', 'mochila', 'bolsa'] },
    { id: 'gorra',      label: 'Gorra',       slot: 'acc',     warmth: 0,   formality: 1.1, aliases: ['gorra', 'gorras', 'gorro', 'cap'] },
    { id: 'bufanda',    label: 'Bufanda',     slot: 'acc',     warmth: 1.2, formality: 2.0, aliases: ['bufanda', 'bufandas', 'chalina', 'panuelo', 'cuello'] },
    { id: 'anteojos',   label: 'Anteojos',    slot: 'acc',     warmth: 0,   formality: 2.2, aliases: ['anteojos', 'lentes', 'gafas', 'sunglasses'] },
    { id: 'cinturon',   label: 'Cinturón',    slot: 'acc',     warmth: 0,   formality: 2.6, aliases: ['cinturon', 'cinturones', 'correa'] },
    { id: 'collar',     label: 'Collar',      slot: 'acc',     warmth: 0,   formality: 2.8, aliases: ['collar', 'collares', 'cadena', 'dije'] }
  ];

  var BY_ID = {};
  CATEGORIES.forEach(function (c) { BY_ID[c.id] = c; });

  var SLOT_LABEL = {
    top: 'arriba',
    bottom: 'abajo',
    dress: 'vestido',
    outer: 'abrigo',
    shoes: 'calzado',
    acc: 'accesorio'
  };

  var SEASONS = [
    { id: 'verano',      label: 'Verano',      warmth: 1.4 },
    { id: 'entretiempo', label: 'Entretiempo', warmth: 3.0 },
    { id: 'invierno',    label: 'Invierno',    warmth: 4.4 },
    { id: 'todo',        label: 'Todo el año', warmth: 3.0 }
  ];

  var OCCASIONS = [
    { id: 'casual',   label: 'Día a día', emoji: '☕', formality: 1.9, aliases: ['casual', 'dia a dia', 'todos los dias', 'informal', 'mate'] },
    { id: 'salir',    label: 'Salir',     emoji: '✨', formality: 3.0, aliases: ['salir', 'salida', 'juntada', 'previa', 'bar', 'boliche', 'amigas', 'recital', 'cita'] },
    { id: 'facultad', label: 'Facultad',  emoji: '📚', formality: 2.4, aliases: ['facultad', 'facu', 'uni', 'universidad', 'clase', 'clases', 'estudiar', 'secundaria', 'cole'] },
    { id: 'trabajo',  label: 'Trabajo',   emoji: '💼', formality: 3.4, aliases: ['trabajo', 'oficina', 'laburo', 'entrevista'] },
    { id: 'formal',   label: 'Formal',    emoji: '🥂', formality: 4.3, aliases: ['formal', 'elegante', 'fiesta', 'casamiento', 'cena', 'graduacion', 'evento'] },
    { id: 'deporte',  label: 'Deporte',   emoji: '🏃', formality: 1.3, aliases: ['deporte', 'gimnasio', 'gym', 'entrenar', 'correr', 'yoga', 'pilates'] }
  ];

  /* Colores con nombre en castellano. "family" agrupa para buscar ("verde" encuentra oliva y lima). */
  var COLORS = [
    { name: 'Negro',        hex: '#141414', family: 'negro',    neutral: true },
    { name: 'Gris',         hex: '#8C8A87', family: 'gris',     neutral: true },
    { name: 'Gris claro',   hex: '#C9C6C1', family: 'gris',     neutral: true },
    { name: 'Blanco',       hex: '#FAF8F3', family: 'blanco',   neutral: true },
    { name: 'Crema',        hex: '#EFE3CC', family: 'crema',    neutral: true },
    { name: 'Beige',        hex: '#D8C2A0', family: 'beige',    neutral: true },
    { name: 'Camel',        hex: '#BE8F5E', family: 'marron',   neutral: true },
    { name: 'Marrón',       hex: '#6E4A32', family: 'marron',   neutral: true },
    { name: 'Chocolate',    hex: '#4A2E20', family: 'marron',   neutral: true },
    { name: 'Rojo',         hex: '#B93B32', family: 'rojo',     neutral: false },
    { name: 'Bordo',        hex: '#6D1F2C', family: 'rojo',     neutral: false },
    { name: 'Coral',        hex: '#E2725B', family: 'naranja',  neutral: false },
    { name: 'Naranja',      hex: '#D9762B', family: 'naranja',  neutral: false },
    { name: 'Mostaza',      hex: '#C39A2B', family: 'amarillo', neutral: false },
    { name: 'Amarillo',     hex: '#E5C94C', family: 'amarillo', neutral: false },
    { name: 'Verde',        hex: '#4F7A4A', family: 'verde',    neutral: false },
    { name: 'Verde oliva',  hex: '#6D6A3A', family: 'verde',    neutral: false },
    { name: 'Verde lima',   hex: '#A3C94A', family: 'verde',    neutral: false },
    { name: 'Mint',         hex: '#A8D5BA', family: 'verde',    neutral: false },
    { name: 'Verde agua',   hex: '#7FC4B8', family: 'verde',    neutral: false },
    { name: 'Celeste',      hex: '#9BC4DD', family: 'azul',     neutral: false },
    { name: 'Azul',         hex: '#3A5F9E', family: 'azul',     neutral: false },
    { name: 'Azul marino',  hex: '#22344F', family: 'azul',     neutral: false },
    { name: 'Jean',         hex: '#4E6E9E', family: 'azul',     neutral: false },
    { name: 'Turquesa',     hex: '#2F9E8F', family: 'azul',     neutral: false },
    { name: 'Lila',         hex: '#B49BD6', family: 'violeta',  neutral: false },
    { name: 'Violeta',      hex: '#7C5CBF', family: 'violeta',  neutral: false },
    { name: 'Fucsia',       hex: '#C43B7A', family: 'rosa',     neutral: false },
    { name: 'Rosa',         hex: '#E39BB0', family: 'rosa',     neutral: false },
    { name: 'Rosa palo',    hex: '#E7C6C2', family: 'rosa',     neutral: true },
    { name: 'Dorado',       hex: '#C9A227', family: 'dorado',   neutral: false },
    { name: 'Plateado',     hex: '#B9B9B9', family: 'plateado', neutral: true }
  ];

  /* Palabras que puede escribir o decir Mati -> familias de color. */
  var COLOR_WORDS = [
    { words: ['verde', 'verdes', 'oliva', 'lima', 'mint', 'esmeralda'], families: ['verde'] },
    { words: ['azul', 'azules', 'celeste', 'celestes', 'turquesa', 'marino', 'navy', 'petroleo'], families: ['azul'] },
    { words: ['rojo', 'roja', 'rojos', 'bordo', 'borgoña'], families: ['rojo'] },
    { words: ['rosa', 'rosado', 'rosada', 'fucsia', 'chicle'], families: ['rosa'] },
    { words: ['violeta', 'lila', 'lilac', 'purpura', 'morado'], families: ['violeta'] },
    { words: ['amarillo', 'amarilla', 'mostaza', 'ocre'], families: ['amarillo'] },
    { words: ['naranja', 'coral', 'salmón', 'salmon'],    families: ['naranja'] },
    { words: ['marron', 'cafe', 'camel', 'tabaco', 'chocolate', 'habano'], families: ['marron'] },
    { words: ['negro', 'negra', 'negros'],                families: ['negro'] },
    { words: ['blanco', 'blanca', 'blancos'],             families: ['blanco'] },
    { words: ['gris', 'grises', 'grisaceo'],              families: ['gris'] },
    { words: ['beige', 'crema', 'crudo', 'manteca', 'nude'], families: ['beige', 'crema'] },
    { words: ['dorado', 'oro', 'dorada'],                 families: ['dorado'] },
    { words: ['plateado', 'plata', 'metalizado'],         families: ['plateado'] }
  ];

  var COLOR_FAMILY_LABEL = {
    negro: 'negro', gris: 'gris', blanco: 'blanco', crema: 'crema', beige: 'beige',
    marron: 'marrón', rojo: 'rojo', naranja: 'naranja', amarillo: 'amarillo',
    verde: 'verde', azul: 'azul', violeta: 'violeta', rosa: 'rosa',
    dorado: 'dorado', plateado: 'plateado'
  };

  /* ---------- Íconos (SVG 64x64, usan currentColor) ---------- */
  var ICONS = {
    remera: '<path d="M23 10c2.7-1.4 5.7-2 9-2s6.3.6 9 2l11 6.4-5.8 9.6-4.6-2.8v31.6a2.2 2.2 0 0 1-2.2 2.2H24.6a2.2 2.2 0 0 1-2.2-2.2V23.2l-4.6 2.8L12 16.4z"/><path d="M27 8.6c1 3.2 3 5 5 5s4-1.8 5-5" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2.4" stroke-linecap="round"/>',
    musculosa: '<path d="M21 9h6c0 4 2.4 6 5 6s5-2 5-6h6l3.4 8.4-3.4 3v30.4A3.2 3.2 0 0 1 39.8 54H24.2A3.2 3.2 0 0 1 21 50.8V20.4l-3.4-3z"/><path d="M33.4 15.6 31 20l-2.4-4.4" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/>',
    camisa: '<path d="M23 10 32 18l9-8 10 6-5 10-4-3v30.2A2.2 2.2 0 0 1 39.8 55H24.2A2.2 2.2 0 0 1 22 52.8V23l-4 3-5-10z"/><path d="M23 10l9 8 9-8-4.4-3L32 11.6 27.4 7z" fill="rgba(0,0,0,.2)"/><path d="M32 19v33" stroke="rgba(0,0,0,.24)" stroke-width="1.6"/>',
    blusa: '<path d="M22 11c3-2 6.4-3 10-3s7 1 10 3l9 5.6-5 9.4-4-2.6v31a2.4 2.4 0 0 1-2.4 2.4H24.4A2.4 2.4 0 0 1 22 54.8V23.4l-4 2.6-5-9.4z"/><path d="M26.6 8.6c1.2 4 3.2 6.4 5.4 6.4s4.2-2.4 5.4-6.4" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2.2"/><path d="M22 34c3-2 6-3 10-3s7 1 10 3" fill="none" stroke="rgba(0,0,0,.16)" stroke-width="2"/>',
    buzo: '<path d="M22 17h20l2.6 4.4v32.4A2.2 2.2 0 0 1 42.4 56H21.6A2.2 2.2 0 0 1 19.4 53.8V21.4z"/><path d="M22.4 17.6 12 22.4l3.4 22.6 6.8-2z"/><path d="M41.6 17.6 52 22.4l-3.4 22.6-6.8-2z"/><path d="M24 17c0-6.4 3.4-10 8-10s8 3.6 8 10c-2.4 3-4.8 4.2-8 4.2S26.4 20 24 17z" fill="rgba(0,0,0,.17)"/><path d="M24.6 41h14.8v7.4H24.6z" fill="rgba(0,0,0,.12)"/>',
    pullover: '<path d="M22 16h20l2.6 4.6v33A2.2 2.2 0 0 1 42.4 56H21.6A2.2 2.2 0 0 1 19.4 53.6V20.6z"/><path d="M22.4 16.8 12 21.8l3.6 23 6.8-2.2z"/><path d="M41.6 16.8 52 21.8l-3.6 23-6.8-2.2z"/><path d="M25 9c2.8-1.6 4.6-2.2 7-2.2s4.2.6 7 2.2" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="2.6" stroke-linecap="round"/><path d="M22.4 49h19.2v4.4H22.4z" fill="rgba(0,0,0,.13)"/>',
    campera: '<path d="M23 12h18l10 6-4.4 10.4-3.6-2.8v29.2A2.2 2.2 0 0 1 40.8 57H23.2A2.2 2.2 0 0 1 21 54.8V25.6l-3.6 2.8L13 18z"/><path d="M32 18v38" stroke="rgba(0,0,0,.3)" stroke-width="1.8"/><path d="M26.6 11 32 17l5.4-6" fill="none" stroke="rgba(0,0,0,.26)" stroke-width="2.2"/><path d="M21 38h22" stroke="rgba(0,0,0,.14)" stroke-width="2"/>',
    tapado: '<path d="M23 10h18l11 7-4.6 11-3.4-3v30.4A2.2 2.2 0 0 1 41.8 57H22.2A2.2 2.2 0 0 1 20 54.4V25l-3.4 3L12 17z"/><path d="M32 16v41" stroke="rgba(0,0,0,.28)" stroke-width="1.8"/><path d="M24 10l8 7 8-7" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="2.2"/><path d="M20 36h24v24H20z" fill="rgba(0,0,0,.07)"/>',
    jean: '<path d="M19 9h26v6l3.4 41H34.6L32 30.4 29.4 56H15.6L19 15z"/><path d="M19 15h26" stroke="rgba(0,0,0,.26)" stroke-width="2"/><path d="M32 15v15" stroke="rgba(0,0,0,.22)" stroke-width="1.8"/><path d="M23.4 12.4h4.2M36.4 12.4h4.2" stroke="rgba(0,0,0,.22)" stroke-width="1.8"/>',
    pantalon: '<path d="M18 9h28v7l2.4 42H33.2L32 27.4 30.8 58H15.6L18 16z"/><path d="M18 16h28" stroke="rgba(0,0,0,.26)" stroke-width="2"/><path d="M32 16v11" stroke="rgba(0,0,0,.18)" stroke-width="1.8"/>',
    short: '<path d="M18 10h28v8l2.4 19H34.4L32.4 26 30 37H15.6L18 18z"/><path d="M18 18h28" stroke="rgba(0,0,0,.26)" stroke-width="2"/><path d="M23 13.4h4M37 13.4h4" stroke="rgba(0,0,0,.2)" stroke-width="1.8"/>',
    pollera: '<path d="M21 11h22l10 42H11z"/><path d="M21 11h22v6.4H21z" fill="rgba(0,0,0,.16)"/><path d="M32 17.4V53M24 17.4 19 53M40 17.4 45 53" stroke="rgba(0,0,0,.14)" stroke-width="1.6"/>',
    vestido: '<path d="M24 9h16l3 15 9.4 34H11.6L21 24z"/><path d="M24 9h16l1.2 5.4H22.8z" fill="rgba(0,0,0,.18)"/><path d="M21.4 24h21.2" stroke="rgba(0,0,0,.18)" stroke-width="1.8"/>',
    zapatillas: '<path d="M8 46v-5.4c0-4 3-7 7-7h3.6l7.4 6.2c4 3.4 9 5.4 15 6.4l5 1c3 .6 5 2.8 5 5.8v2H8z"/><path d="M8 49h56v4.4H8z" fill="rgba(0,0,0,.28)"/><path d="M20 36.4l4.4 4.2M24.6 33.4l4.4 4.2" stroke="rgba(0,0,0,.3)" stroke-width="2.2"/>',
    zapatos: '<path d="M12 50.4c0-7 3-12.4 8-17.4l5-5 4.4 5.4 11 9c3 2.6 5 4.6 5 7v3H12z"/><path d="M47 52h5v8h-5z"/><path d="M12 50.4h40" stroke="rgba(0,0,0,.2)" stroke-width="2"/>',
    botas: '<path d="M20 8h14v24h5.4c5 0 9 4 9 9v11.2a2.2 2.2 0 0 1-2.2 2.2H22.2A2.2 2.2 0 0 1 20 52.2z"/><path d="M20 8h14v4.4H20z" fill="rgba(0,0,0,.2)"/><path d="M20 49.6h28.4V54H20z" fill="rgba(0,0,0,.26)"/><path d="M20 8v41" stroke="rgba(0,0,0,.14)" stroke-width="2"/>',
    sandalias: '<path d="M7 43h50c2.6 0 4.6 2 4.6 4.6V55H2.4v-7.4C2.4 45 4.4 43 7 43z"/><path d="M17 43 32 27M47 43 32 27" fill="none" stroke="currentColor" stroke-width="4.6" stroke-linecap="round"/><path d="M32 27v-6" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round"/>',
    cartera: '<path d="M14 24h36l4.4 26.6A3.4 3.4 0 0 1 51 54H13a3.4 3.4 0 0 1-3.4-3.4z"/><path d="M23 24v-5a9 9 0 0 1 18 0v5" fill="none" stroke="currentColor" stroke-width="3.6"/><path d="M10 33h44" stroke="rgba(0,0,0,.16)" stroke-width="2"/>',
    gorra: '<path d="M12 38a20 20 0 0 1 40 0z"/><path d="M12 38h34c5 0 8 2.4 8 5.4V45H12z"/><path d="M32 18.4V38" stroke="rgba(0,0,0,.22)" stroke-width="2"/>',
    bufanda: '<path d="M22 10h7.4v18c0 3 1.6 4.6 3.2 4.6s3.2-1.6 3.2-4.6V10h7.4v18c0 8-4.6 13.4-10.6 13.4S22 36 22 28z"/><path d="M23 40h6.6v16H23zM34.4 40h6.6v16h-6.6z"/><path d="M23 52.6h6.6M34.4 52.6h6.6" stroke="rgba(0,0,0,.22)" stroke-width="1.8"/>',
    anteojos: '<g fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"><rect x="8" y="25" width="20" height="15" rx="7.5"/><rect x="36" y="25" width="20" height="15" rx="7.5"/><path d="M28.4 31c1.6 2.2 5.6 2.2 7.2 0"/><path d="M8 29.4 2.4 25.6"/><path d="M56 29.4l5.6-3.8"/></g>',
    cinturon: '<path d="M5.6 28h52.8v9H5.6z"/><rect x="24" y="24" width="16" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="3.4"/><path d="M32 27v11" stroke="rgba(0,0,0,.3)" stroke-width="2"/>',
    collar: '<path d="M16 13c0 18.6 7 31 16 31s16-12.4 16-31" fill="none" stroke="currentColor" stroke-width="3.4"/><circle cx="32" cy="46.4" r="4.6"/>'
  };

  function icon(id, className) {
    var art = ICONS[id] || ICONS.remera;
    return '<svg class="' + (className || '') + '" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" focusable="false">' + art + '</svg>';
  }

  function cat(id) { return BY_ID[id] || null; }

  function slotLabel(slot) { return SLOT_LABEL[slot] || slot; }

  function seasonByWarmth(w) {
    if (w >= 3.8) return 'invierno';
    if (w >= 2.4) return 'entretiempo';
    return 'verano';
  }

  global.Catalog = {
    CATEGORIES: CATEGORIES,
    BY_ID: BY_ID,
    SLOT_LABEL: SLOT_LABEL,
    SEASONS: SEASONS,
    OCCASIONS: OCCASIONS,
    COLORS: COLORS,
    COLOR_WORDS: COLOR_WORDS,
    COLOR_FAMILY_LABEL: COLOR_FAMILY_LABEL,
    ICONS: ICONS,
    icon: icon,
    cat: cat,
    slotLabel: slotLabel,
    seasonByWarmth: seasonByWarmth
  };
})(typeof window !== 'undefined' ? window : globalThis);
