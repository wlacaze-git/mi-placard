/* Mi Placard — lógica de la app */
(function () {
  'use strict';

  var C = window.Catalog;
  var CU = window.ColorUtil;
  var DAY = 86400000;

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return (prefix || 'g') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  function fmtDate(ts) {
    try {
      return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(ts));
    } catch (err) { return ''; }
  }

  function relDate(ts) {
    if (!ts) return '';
    var days = Math.floor((Date.now() - ts) / DAY);
    if (days <= 0) return 'hoy';
    if (days === 1) return 'ayer';
    if (days < 7) return 'hace ' + days + ' días';
    if (days < 30) {
      var weeks = Math.floor(days / 7);
      return 'hace ' + weeks + (weeks === 1 ? ' semana' : ' semanas');
    }
    var months = Math.floor(days / 30);
    return 'hace ' + months + (months === 1 ? ' mes' : ' meses');
  }

  function seasonLabel(id) {
    var s = C.SEASONS.filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  }

  function occLabel(id) {
    var o = C.OCCASIONS.filter(function (x) { return x.id === id; })[0];
    return o ? o.label : id;
  }

  function catLabel(id) {
    var c = C.cat(id);
    return c ? c.label : 'Prenda';
  }

  var SLOT_TEXT = {
    top: 'una prenda de arriba',
    bottom: 'algo de abajo',
    dress: 'un vestido',
    shoes: 'calzado',
    outer: 'un abrigo',
    acc: 'un accesorio'
  };
  var SLOT_PRESET = { top: 'remera', bottom: 'jean', shoes: 'zapatillas', outer: 'campera', acc: 'cartera', dress: 'vestido' };

  // ---------- estado ----------
  var S = {
    garments: [],
    looks: [],
    userName: 'Mati',
    tab: 'closet',
    filter: { cat: 'all', q: '' },
    urls: new Map(),
    results: null,
    lastSigs: [],
    seed: 1,
    draft: null,
    draftUrl: null,
    nameTouched: false,
    editing: false,
    pendingConfirm: null,
    installPrompt: null
  };

  // ---------- fotos ----------
  function photoSrc(g) {
    if (!g.photo) return null;
    if (typeof g.photo === 'string') return g.photo;
    var cached = S.urls.get(g.id);
    if (cached && cached.blob === g.photo) return cached.url;
    if (cached) URL.revokeObjectURL(cached.url);
    var url = URL.createObjectURL(g.photo);
    S.urls.set(g.id, { blob: g.photo, url: url });
    return url;
  }

  function garmentVisual(g) {
    var src = photoSrc(g);
    if (src) return '<img src="' + src + '" alt="' + esc(g.name) + '" loading="lazy">';
    var hex = (g.color && g.color.hex) || '#D9C7A7';
    var bg = CU.tint(hex, 0.8);
    var fg = CU.luminance(hex) > 0.78 ? CU.shade(hex, 0.52) : hex;
    return '<div class="ph" style="background:' + bg + ';color:' + fg + '">' + C.icon(g.category, 'ph-icon') + '</div>';
  }

  function garmentById(id) {
    for (var i = 0; i < S.garments.length; i++) if (S.garments[i].id === id) return S.garments[i];
    return null;
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg, ms) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, ms || 2800);
  }

  // ---------- hoja modal ----------
  function openSheet(html) {
    var sheet = $('#sheet');
    sheet.innerHTML = html;
    $('#sheetRoot').hidden = false;
    document.body.classList.add('locked');
    sheet.scrollTop = 0;
    try { sheet.focus({ preventScroll: true }); } catch (err) { /* noop */ }
  }

  function hideSheet() {
    $('#sheetRoot').hidden = true;
    if ($('#addScreen').hidden) document.body.classList.remove('locked');
  }

  function closeSheet() {
    if (S.pendingConfirm) resolveConfirm(false);
    hideSheet();
  }

  function resolveConfirm(value) {
    var fn = S.pendingConfirm;
    S.pendingConfirm = null;
    if (fn) fn(value);
  }

  function askConfirm(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      if (S.pendingConfirm) resolveConfirm(false);
      S.pendingConfirm = resolve;
      var cls = danger ? 'btn danger' : 'btn primary';
      openSheet(
        '<h2 id="sheetTitle">' + esc(title) + '</h2>' +
        '<p class="sheet-sub">' + esc(text) + '</p>' +
        '<div class="sheet-actions">' +
        '<button class="' + cls + '" data-action="confirm-ok">' + esc(okLabel || 'Listo') + '</button>' +
        '<button class="btn ghost" data-action="close-sheet">Cancelar</button>' +
        '</div>'
      );
    });
  }

  // ---------- render: placard ----------
  function filteredGarments() {
    var q = normalize(S.filter.q);
    return S.garments.filter(function (g) {
      if (S.filter.cat === 'fav' && !g.favorite) return false;
      if (S.filter.cat !== 'all' && S.filter.cat !== 'fav' && g.category !== S.filter.cat) return false;
      if (!q) return true;
      var cat = C.cat(g.category);
      var parts = [
        g.name, g.notes,
        cat ? cat.label : '',
        g.color ? g.color.name : '',
        g.color ? CU.familyLabel(g.color.family) : '',
        (g.occasions || []).map(occLabel).join(' '),
        (g.seasons || []).map(seasonLabel).join(' ')
      ];
      return normalize(parts.join(' ')).indexOf(q) >= 0;
    });
  }

  function cardHTML(g) {
    var cat = C.cat(g.category);
    var color = g.color || { name: 'Color', hex: '#C9C6C1' };
    return '<button class="card" data-action="open-garment" data-id="' + g.id + '" aria-label="' + esc(g.name) + '">' +
      '<div class="card-thumb">' + garmentVisual(g) +
      (g.favorite ? '<span class="fav-flag" aria-label="Favorita"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.3S4.5 15.8 4.5 10.7A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 3.4c0 5.1-7.5 9.6-7.5 9.6Z"/></svg></span>' : '') +
      '</div>' +
      '<div class="card-info"><h3>' + esc(g.name) + '</h3>' +
      '<p><span class="dot" style="background:' + color.hex + '"></span>' + esc(color.name) + ' · ' + esc(cat ? cat.label : '') + '</p></div>' +
      '</button>';
  }

  function renderFilters() {
    var counts = {};
    S.garments.forEach(function (g) { counts[g.category] = (counts[g.category] || 0) + 1; });
    if (S.filter.cat !== 'all' && S.filter.cat !== 'fav' && !counts[S.filter.cat]) S.filter.cat = 'all';
    var ids = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var html = '<button class="chip ' + (S.filter.cat === 'all' ? 'is-active' : '') + '" data-action="filter-cat" data-cat="all">Todo</button>' +
      '<button class="chip ' + (S.filter.cat === 'fav' ? 'is-active' : '') + '" data-action="filter-cat" data-cat="fav">♥ Favoritas</button>';
    ids.forEach(function (id) {
      var cat = C.cat(id);
      if (!cat) return;
      html += '<button class="chip ' + (S.filter.cat === id ? 'is-active' : '') + '" data-action="filter-cat" data-cat="' + id + '">' + esc(cat.label) + '</button>';
    });
    $('#catFilters').innerHTML = html;
  }

  function renderCloset() {
    var has = S.garments.length > 0;
    $('#closetEmpty').hidden = has;
    $('#searchWrap').hidden = !has;
    $('#catFilters').hidden = !has;
    $('#closetGrid').innerHTML = '';

    if (!has) {
      $('#closetNoResults').hidden = true;
      return;
    }

    var list = filteredGarments();
    $('#closetGrid').innerHTML = list.map(cardHTML).join('');
    var noResults = list.length === 0;
    $('#closetNoResults').hidden = !noResults;
    if (noResults) {
      var q = S.filter.q.trim();
      var title = 'No encontré nada';
      var text = 'Probá con otro color o sacá el filtro.';
      if (q) { title = 'No encontré “' + q + '”'; text = 'Fijate si está escrito distinto o cargala en tu placard.'; }
      else if (S.filter.cat === 'fav') { title = 'No tenés favoritas todavía'; text = 'Tocá una prenda y marcala con el corazón.'; }
      else { title = 'No hay prendas en esa categoría'; text = 'Probá con otro filtro.'; }
      $('#closetNoResults').querySelector('.empty-title').textContent = title;
      $('#closetNoResults').querySelector('.empty-text').textContent = text;
    }

    var searchEl = $('#searchInput');
    if (searchEl.value !== S.filter.q) searchEl.value = S.filter.q;
    $('#searchWrap').querySelector('.search-clear').hidden = !S.filter.q;
  }

  function updateStats() {
    var n = S.garments.length;
    var l = S.looks.length;
    $('#greeting').textContent = 'Hola, ' + S.userName;
    $('#closetStats').textContent = n === 0
      ? 'Todavía no cargaste prendas.'
      : n + ' ' + plural(n, 'prenda') + (l ? ' · ' + l + ' ' + plural(l, 'look') : '');
    $('#looksStats').textContent = l === 0
      ? 'Guardá los looks que te gusten y quedan acá.'
      : l + ' ' + plural(l, 'look') + ' guardado' + (l === 1 ? '' : 's');
  }

  // ---------- render: probador ----------
  var ASK_CHIPS = ['algo verde', 'jean', 'un vestido', 'para salir', 'para la facu', 'hace frío', 'hace calor', 'algo cómodo'];

  function renderStyle() {
    $('#askChips').innerHTML = ASK_CHIPS.map(function (q) {
      return '<button class="chip" data-action="ask-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>';
    }).join('');

    if (!S.results) {
      $('#results').innerHTML = '<div class="note-box">' +
        (S.garments.length
          ? 'Escribí lo que tenés ganas de usar o tocá una idea. La app arma el look con lo que ya está en tu placard.'
          : 'Primero cargá algunas prendas y después te armo el look. <br><br><button class="btn primary small" data-action="add">Agregar prenda</button>') +
        '</div>';
    }
  }

  function resultTitle(res) {
    var p = res.parsed;
    if (p.colors.length) return 'Looks con ' + p.colorLabels.join(' o ');
    if (p.cats.length) return 'Ideas con ' + p.cats.map(catLabel).join(' y ').toLowerCase();
    if (p.occasion) return 'Para ' + occLabel(p.occasion).toLowerCase();
    if (p.feel === 'frio') return 'Para el frío';
    if (p.feel === 'calor') return 'Para el calor';
    return 'Tres ideas para hoy';
  }

  function renderResults(res) {
    var html = '';
    var p = res.parsed;

    if (res.status === 'empty') {
      html = '<div class="note-box">Tu placard está vacío. <strong>Cargá tu primera prenda</strong> y te armo el look.<br><br><button class="btn primary small" data-action="add">Agregar prenda</button></div>';
      $('#results').innerHTML = html;
      return;
    }

    if (res.status === 'no-color') {
      var fams = res.availableColors.map(function (f) { return CU.familyLabel(f); });
      html = '<div class="note-box">No tenés nada <strong>' + esc(p.colorLabels.join(' ni ')) + '</strong> en el placard.' +
        (fams.length ? '<div class="chiprow">' + fams.map(function (f) {
          return '<button class="chip" data-action="ask-chip" data-q="' + esc(f) + '">' + esc(f) + '</button>';
        }).join('') + '</div>' : '') +
        '<br><button class="btn primary small" data-action="add">Cargar una prenda así</button></div>';
      $('#results').innerHTML = html;
      return;
    }

    if (res.status === 'no-cat') {
      html = '<div class="note-box">No tenés <strong>' + esc(p.cats.map(catLabel).join(' ni ').toLowerCase()) + '</strong> cargado.<br><br><button class="btn primary small" data-action="add">Cargar esa prenda</button></div>';
      $('#results').innerHTML = html;
      return;
    }

    if (res.status === 'no-combo') {
      html = '<div class="note-box">Con lo que hay no llego a armar un look completo. Probá cargando alguna prenda más.<br><br><button class="btn primary small" data-action="add">Agregar prenda</button></div>';
      $('#results').innerHTML = html;
      return;
    }

    if (!res.looks.length) {
      $('#results').innerHTML = '<div class="note-box">No me salió nada con eso. Probá pidiéndolo de otra forma.</div>';
      return;
    }

    html += '<div class="result-head"><div><p class="eyebrow">Elegí el que te guste</p><h2>' + esc(resultTitle(res)) + '</h2></div>' +
      '<button class="link-btn" data-action="shuffle">Ver otras</button></div>';

    if (res.relaxed) {
      html += '<div class="note-box" style="text-align:left;padding:10px 12px;font-size:12px">No encontré exactamente eso, pero esto se le parece bastante.</div>';
    }

    html += res.looks.map(function (look, idx) { return lookCardHTML(look, idx, p); }).join('');
    $('#results').innerHTML = html;
  }

  function lookCardHTML(look, idx, parsed) {
    var items = look.items.map(function (g) {
      return '<figure class="look-item"><div class="look-thumb">' + garmentVisual(g) + '</div>' +
        '<figcaption>' + esc(g.name) + '</figcaption></figure>';
    }).join('');

    var missing = '';
    if (look.missing && look.missing.length) {
      var slot = look.missing[0];
      missing = '<div class="look-missing"><span>Te falta ' + esc(SLOT_TEXT[slot] || 'algo') + ' para completarlo.</span>' +
        '<button data-action="add-missing" data-slot="' + slot + '">Agregar</button></div>';
    }

    return '<article class="look-card" style="animation-delay:' + (idx * 70) + 'ms">' +
      '<div class="look-top"><h3>' + esc(look.title) + '</h3><span class="badge">Look ' + (idx + 1) + '</span></div>' +
      '<div class="look-strip">' + items + '</div>' +
      '<p class="look-reason">' + esc(look.reason) + '</p>' +
      missing +
      '<div class="look-actions">' +
      '<button class="btn primary" data-action="wear-result" data-idx="' + idx + '">Me lo pongo</button>' +
      '<button class="btn ghost" data-action="save-result" data-idx="' + idx + '">Guardar look</button>' +
      '</div></article>';
  }

  function runSuggest(shuffle) {
    var q = ($('#askInput').value || '').trim();
    S.seed = Math.floor(Math.random() * 999983) + 1;
    var res = Recommend.suggest(S.garments, q, {
      seed: S.seed,
      exclude: shuffle ? S.lastSigs : []
    });
    S.results = res;
    S.lastSigs = (res.looks || []).map(function (l) { return l.signature; });
    renderResults(res);
    var box = $('#results');
    if (box) {
      var top = box.getBoundingClientRect().top + (window.pageYOffset || 0) - 74;
      try { window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } catch (err) { window.scrollTo(0, Math.max(0, top)); }
    }
  }

  // ---------- render: looks guardados ----------
  function renderLooks() {
    updateStats();
    var list = S.looks.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    $('#looksEmpty').hidden = list.length > 0;
    $('#looksList').innerHTML = list.map(savedLookHTML).join('');
  }

  function savedLookHTML(look) {
    var items = (look.itemIds || []).map(garmentById).filter(Boolean);
    var strip = items.map(function (g) {
      return '<figure class="look-item"><div class="look-thumb">' + garmentVisual(g) + '</div>' +
        '<figcaption>' + esc(g.name) + '</figcaption></figure>';
    }).join('');

    var missingItems = (look.itemIds || []).length - items.length;
    var dateLine = 'Guardado el ' + fmtDate(look.createdAt);
    if (look.wornAt) dateLine += ' · usado ' + relDate(look.wornAt);

    return '<article class="look-card">' +
      '<div class="look-top"><div><p class="look-date">' + esc(dateLine) + '</p><h3>' + esc(look.title || 'Mi look') + '</h3></div>' +
      '<button class="icon-btn" data-action="delete-look" data-id="' + look.id + '" aria-label="Eliminar look">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12a1.7 1.7 0 0 0 1.7 1.6h6a1.7 1.7 0 0 0 1.7-1.6L17.5 7"/></svg>' +
      '</button></div>' +
      (strip ? '<div class="look-strip">' + strip + '</div>' : '<p class="look-reason">Las prendas de este look ya no están en tu placard.</p>') +
      (missingItems > 0 && strip ? '<p class="hint">' + missingItems + ' prenda' + (missingItems === 1 ? '' : 's') + ' de este look ya no está' + (missingItems === 1 ? '' : 'n') + '.</p>' : '') +
      (look.reason ? '<p class="look-reason" style="margin-top:10px">' + esc(look.reason) + '</p>' : '') +
      '<div class="look-actions">' +
      '<button class="btn primary" data-action="wear-saved" data-id="' + look.id + '">Usar hoy</button>' +
      '</div></article>';
  }

  // ---------- navegación ----------
  function go(tab) {
    S.tab = tab;
    $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== tab; });
    $$('.tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('.fab').hidden = tab !== 'closet';
    window.scrollTo(0, 0);
    if (tab === 'closet') { renderCloset(); updateStats(); }
    if (tab === 'looks') renderLooks();
    if (tab === 'style') renderStyle();
  }

  // ---------- alta / edición ----------
  function newDraft() {
    return {
      id: uid('g'),
      name: '',
      category: '',
      color: null,
      palette: [],
      photo: null,
      seasons: [],
      occasions: [],
      favorite: false,
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wornCount: 0,
      lastWorn: null
    };
  }

  function openAdd(preset) {
    S.draft = newDraft();
    S.editing = false;
    S.nameTouched = false;
    if (typeof preset === 'string' && C.cat(preset)) S.draft.category = preset;
    if (preset && typeof preset === 'object') {
      if (preset.category && C.cat(preset.category)) S.draft.category = preset.category;
      if (preset.color) S.draft.color = preset.color;
    }
    renderAddForm();
    $('#addScreen').hidden = false;
    $('#addScreen').scrollTop = 0;
    document.body.classList.add('locked');
  }

  function openEdit(id) {
    var g = garmentById(id);
    if (!g) return;
    S.draft = Object.assign({}, g, {
      palette: (g.palette || []).slice(),
      seasons: (g.seasons || []).slice(),
      occasions: (g.occasions || []).slice()
    });
    S.editing = true;
    S.nameTouched = true;
    renderAddForm();
    $('#addScreen').hidden = false;
    $('#addScreen').scrollTop = 0;
    document.body.classList.add('locked');
  }

  function closeAdd() {
    $('#addScreen').hidden = true;
    if (S.draftUrl) { URL.revokeObjectURL(S.draftUrl); S.draftUrl = null; }
    S.draft = null;
    if ($('#sheetRoot').hidden) document.body.classList.remove('locked');
  }

  function renderPhoto() {
    var img = $('#photoImg');
    if (S.draftUrl) { URL.revokeObjectURL(S.draftUrl); S.draftUrl = null; }
    var has = !!(S.draft && S.draft.photo);
    $('#photoPreview').hidden = !has;
    $('#photoEmpty').hidden = has;
    $('#photoBox').classList.toggle('has-photo', has);
    if (has) {
      S.draftUrl = URL.createObjectURL(S.draft.photo);
      img.src = S.draftUrl;
    } else {
      img.removeAttribute('src');
    }
  }

  function swatchHTML(hex, name, active) {
    return '<button type="button" class="swatch' + (active ? ' is-active' : '') + '" data-action="pick-color" data-hex="' + hex + '"' +
      ' style="background:' + hex + '" title="' + esc(name) + '" aria-label="' + esc(name) + '"></button>';
  }

  function renderPalette() {
    var block = $('#paletteBlock');
    var palette = (S.draft && S.draft.palette) || [];
    if (!palette.length) { block.hidden = true; $('#paletteRow').innerHTML = ''; return; }
    block.hidden = false;
    $('#paletteRow').innerHTML = palette.map(function (hex) {
      var info = CU.colorInfo(hex);
      var active = !!(S.draft.color && CU.distance(S.draft.color.hex, hex) < 24);
      return swatchHTML(hex, info.name, active);
    }).join('');
  }

  var COMMON_COLORS = ['Negro', 'Blanco', 'Gris', 'Beige', 'Marrón', 'Camel', 'Rojo', 'Bordo', 'Rosa', 'Fucsia', 'Lila', 'Violeta', 'Azul', 'Celeste', 'Jean', 'Verde', 'Verde oliva', 'Mint', 'Amarillo', 'Mostaza', 'Naranja', 'Coral', 'Dorado', 'Plateado'];

  function renderColorChoices() {
    var list = C.COLORS.filter(function (c) { return COMMON_COLORS.indexOf(c.name) >= 0; });
    $('#colorRow').innerHTML = list.map(function (c) {
      var active = !!(S.draft.color && CU.distance(S.draft.color.hex, c.hex) < 24);
      return swatchHTML(c.hex, c.name, active);
    }).join('');
    var picked = $('#colorPicked');
    if (S.draft.color) {
      picked.textContent = 'Elegiste: ' + S.draft.color.name;
    } else {
      picked.textContent = 'Sin color elegido';
    }
    if (S.draft.color) $('#customColor').value = S.draft.color.hex;
  }

  function renderCatGrid() {
    $('#catGrid').innerHTML = C.CATEGORIES.map(function (c) {
      var active = S.draft.category === c.id;
      return '<button type="button" data-action="pick-cat" data-cat="' + c.id + '" class="' + (active ? 'is-active' : '') + '"' +
        ' role="radio" aria-checked="' + (active ? 'true' : 'false') + '">' + C.icon(c.id) + '<span>' + esc(c.label) + '</span></button>';
    }).join('');
  }

  function renderSeasonChoices() {
    $('#seasonRow').innerHTML = C.SEASONS.map(function (s) {
      var active = (S.draft.seasons || []).indexOf(s.id) >= 0;
      return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-action="toggle-season" data-season="' + s.id + '" aria-pressed="' + active + '">' + esc(s.label) + '</button>';
    }).join('');
  }

  function renderOccasionChoices() {
    $('#occasionRow').innerHTML = C.OCCASIONS.map(function (o) {
      var active = (S.draft.occasions || []).indexOf(o.id) >= 0;
      return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-action="toggle-occasion" data-occ="' + o.id + '" aria-pressed="' + active + '">' + o.emoji + ' ' + esc(o.label) + '</button>';
    }).join('');
  }

  function renderAddForm() {
    var d = S.draft;
    if (!d) return;
    $('#addTitle').textContent = S.editing ? 'Editar prenda' : 'Nueva prenda';
    $('#gName').value = d.name || '';
    $('#gNotes').value = d.notes || '';
    $('#gFav').checked = !!d.favorite;
    $('#customColor').value = d.color ? d.color.hex : '#4F7A4A';
    renderPhoto();
    renderPalette();
    renderCatGrid();
    renderColorChoices();
    renderSeasonChoices();
    renderOccasionChoices();
    if (d.category) autoNameIfNeeded();
  }

  function autoNameIfNeeded() {
    var d = S.draft;
    if (!d || !d.category) return;
    if (S.nameTouched && ($('#gName').value || '').trim()) return;
    var name = catLabel(d.category) + (d.color ? ' ' + d.color.name.toLowerCase() : '');
    $('#gName').value = name;
    d.name = name;
  }

  async function saveGarment() {
    var d = S.draft;
    if (!d) return;
    if (!d.category) {
      toast('Primero elegí una categoría.');
      $('#catGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!d.color) {
      toast('Elegí el color de la prenda.');
      var colorRow = $('#colorRow');
      if (colorRow) colorRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var name = ($('#gName').value || '').trim() || (catLabel(d.category) + ' ' + d.color.name.toLowerCase());
    var cat = C.cat(d.category);
    var seasons = (d.seasons || []).length ? d.seasons.slice() : [C.seasonByWarmth(cat.warmth)];
    var occasions = (d.occasions || []).length ? d.occasions.slice() : ['casual'];
    var wasEditing = S.editing;

    var g = {
      id: d.id,
      name: name,
      category: d.category,
      color: d.color,
      palette: (d.palette || []).slice(),
      photo: d.photo || null,
      seasons: seasons,
      occasions: occasions,
      favorite: !!$('#gFav').checked,
      notes: ($('#gNotes').value || '').trim(),
      createdAt: d.createdAt || Date.now(),
      updatedAt: Date.now(),
      wornCount: d.wornCount || 0,
      lastWorn: d.lastWorn || null
    };

    try {
      await DB.put('garments', g);
    } catch (err) {
      toast('No pudimos guardarla. Probá de nuevo.');
      return;
    }

    await reloadGarments();
    closeAdd();
    renderAll();
    go('closet');
    toast(wasEditing ? 'Prenda actualizada' : '¡Prenda guardada!');
  }

  // ---------- detalle de prenda ----------
  function openGarment(id) {
    var g = garmentById(id);
    if (!g) return;
    var cat = C.cat(g.category);
    var src = photoSrc(g);
    var media;
    if (src) {
      media = '<img class="sheet-img" src="' + src + '" alt="' + esc(g.name) + '">';
    } else {
      var hex = g.color ? g.color.hex : '#D9C7A7';
      var fg = CU.luminance(hex) > 0.82 ? CU.shade(hex, 0.3) : hex;
      media = '<div class="sheet-photo" style="background:' + CU.tint(hex, 0.8) + ';color:' + fg + '">' + C.icon(g.category) + '</div>';
    }

    var tags = [];
    if (g.favorite) tags.push('<span class="tag is-fav">Favorita</span>');
    (g.seasons || []).forEach(function (s) { tags.push('<span class="tag">' + esc(seasonLabel(s)) + '</span>'); });
    (g.occasions || []).forEach(function (o) { tags.push('<span class="tag">' + esc(occLabel(o)) + '</span>'); });

    var wc = g.wornCount || 0;
    var worn = wc
      ? 'La usaste ' + wc + ' ' + plural(wc, 'vez', 'veces') + (g.lastWorn ? ' · última vez ' + relDate(g.lastWorn) : '')
      : 'Todavía no la usaste';

    var html = media +
      '<h2 id="sheetTitle">' + esc(g.name) + '</h2>' +
      '<p class="sheet-sub">' + esc(cat ? cat.label : 'Prenda') + ' · ' + esc(g.color ? g.color.name : '') + '</p>' +
      '<div class="tagrow" style="margin-top:12px">' + tags.join('') + '</div>' +
      (g.notes ? '<p class="sheet-sub" style="margin-top:14px;font-style:italic">“' + esc(g.notes) + '”</p>' : '') +
      '<p class="hint" style="margin-top:14px">' + esc(worn) + '</p>' +
      '<div class="sheet-actions">' +
      '<button class="btn primary" data-action="style-with" data-id="' + g.id + '">Armar un look con esta prenda</button>' +
      '</div>' +
      '<div class="sheet-actions row">' +
      '<button class="btn ghost" data-action="toggle-fav" data-id="' + g.id + '">' +
      (g.favorite ? '♥ Es favorita' : '♡ Marcar favorita') + '</button>' +
      '<button class="btn ghost" data-action="edit-garment" data-id="' + g.id + '">Editar</button>' +
      '</div>' +
      '<div class="sheet-actions">' +
      '<button class="btn danger" data-action="delete-garment" data-id="' + g.id + '">Eliminar prenda</button>' +
      '</div>';

    openSheet(html);
  }

  function styleWithGarment(id) {
    var g = garmentById(id);
    if (!g) return;
    hideSheet();
    var q = catLabel(g.category).toLowerCase() + ' ' + (g.color ? g.color.name.toLowerCase() : '');
    go('style');
    $('#askInput').value = q.trim();
    runSuggest(false);
  }

  async function toggleFavorite(id) {
    var g = garmentById(id);
    if (!g) return;
    g.favorite = !g.favorite;
    g.updatedAt = Date.now();
    try { await DB.put('garments', g); } catch (err) { toast('No pudimos cambiarlo.'); return; }
    renderCloset();
    openGarment(id);
  }

  async function deleteGarment(id) {
    var g = garmentById(id);
    if (!g) return;
    var ok = await askConfirm('¿Eliminar esta prenda?', '“' + g.name + '” va a salir de tu placard. Los looks guardados que la usan van a quedar incompletos.', 'Sí, eliminar', true);
    if (!ok) return;
    try { await DB.del('garments', id); } catch (err) { toast('No pudimos eliminarla.'); return; }
    var cached = S.urls.get(id);
    if (cached) { URL.revokeObjectURL(cached.url); S.urls.delete(id); }
    await reloadGarments();
    hideSheet();
    renderAll();
    toast('Prenda eliminada');
  }

  // ---------- looks: guardar y usar ----------
  async function saveResultLook(idx) {
    var res = S.results;
    if (!res || !res.looks[idx]) return;
    var look = res.looks[idx];
    var ids = look.items.map(function (g) { return g.id; }).sort().join('|');
    var exists = S.looks.some(function (l) { return (l.itemIds || []).slice().sort().join('|') === ids; });
    if (exists) { toast('Ya tenías guardado ese look.'); return; }
    var saved = {
      id: uid('look'),
      title: look.title,
      reason: look.reason,
      itemIds: look.items.map(function (g) { return g.id; }),
      query: res.parsed.text,
      createdAt: Date.now(),
      wornAt: null
    };
    try { await DB.put('looks', saved); } catch (err) { toast('No pudimos guardar el look.'); return; }
    await reloadLooks();
    renderLooks();
    updateStats();
    var btn = document.querySelector('[data-action="save-result"][data-idx="' + idx + '"]');
    if (btn) { btn.textContent = 'Guardado ✓'; btn.disabled = true; }
    toast('Look guardado en tu lista ✨');
  }

  async function wearItemsAndSave(look) {
    var now = Date.now();
    for (var i = 0; i < look.items.length; i++) {
      var fresh = garmentById(look.items[i].id);
      if (!fresh) continue;
      fresh.wornCount = (fresh.wornCount || 0) + 1;
      fresh.lastWorn = now;
      fresh.updatedAt = now;
      try { await DB.put('garments', fresh); } catch (err) { /* seguimos */ }
    }

    var sig = look.items.map(function (g) { return g.id; }).sort().join('|');
    var existing = S.looks.filter(function (l) {
      return (l.itemIds || []).slice().sort().join('|') === sig;
    })[0];

    if (existing) {
      existing.wornAt = now;
      existing.title = look.title;
      existing.reason = look.reason;
      try { await DB.put('looks', existing); } catch (err) { /* seguimos */ }
    } else {
      var saved = {
        id: uid('look'),
        title: look.title,
        reason: look.reason,
        itemIds: look.items.map(function (g) { return g.id; }),
        query: S.results ? S.results.parsed.text : '',
        createdAt: now,
        wornAt: now
      };
      try { await DB.put('looks', saved); } catch (err) { /* seguimos */ }
    }

    await Promise.all([reloadGarments(), reloadLooks()]);
    renderAll();
    toast('¡Anotado! Que lo disfrutes ✨');
  }

  function wearResult(idx) {
    var res = S.results;
    if (!res || !res.looks[idx]) return;
    var look = res.looks[idx];
    var wearBtn = document.querySelector('[data-action="wear-result"][data-idx="' + idx + '"]');
    var saveBtn = document.querySelector('[data-action="save-result"][data-idx="' + idx + '"]');
    if (wearBtn) { wearBtn.disabled = true; wearBtn.textContent = 'Anotando…'; }
    wearItemsAndSave(look).then(function () {
      if (wearBtn) wearBtn.textContent = 'Anotado ✓';
      if (saveBtn) { saveBtn.textContent = 'Guardado ✓'; saveBtn.disabled = true; }
    });
  }

  async function wearSavedLook(id) {
    var look = S.looks.filter(function (l) { return l.id === id; })[0];
    if (!look) return;
    var items = (look.itemIds || []).map(garmentById).filter(Boolean);
    if (!items.length) { toast('Las prendas de este look ya no están.'); return; }
    var now = Date.now();
    for (var i = 0; i < items.length; i++) {
      items[i].wornCount = (items[i].wornCount || 0) + 1;
      items[i].lastWorn = now;
      items[i].updatedAt = now;
      try { await DB.put('garments', items[i]); } catch (err) { /* seguimos */ }
    }
    look.wornAt = now;
    try { await DB.put('looks', look); } catch (err) { /* seguimos */ }
    await reloadGarments();
    renderAll();
    renderLooks();
    toast('¡Anotado! Que lo disfrutes ✨');
  }

  async function deleteLook(id) {
    var ok = await askConfirm('¿Eliminar este look?', 'Se borra de tu lista de guardados, pero las prendas siguen en tu placard.', 'Sí, eliminar', true);
    if (!ok) return;
    try { await DB.del('looks', id); } catch (err) { toast('No pudimos eliminarlo.'); return; }
    await reloadLooks();
    hideSheet();
    renderLooks();
    renderAll();
    toast('Look eliminado');
  }

  // ---------- ajustes / backup ----------
  function openSettings() {
    var html = '<h2 id="sheetTitle">Ajustes</h2>' +
      '<p class="sheet-sub">Tus fotos y prendas viven solo en este dispositivo. Si cambiás de celular, llevate un backup.</p>' +
      '<div class="sheet-section"><h3>Tu nombre</h3>' +
      '<input class="setting-input" id="setName" value="' + esc(S.userName) + '" maxlength="24" aria-label="Tu nombre">' +
      '<p class="hint">En iPhone: tocá Compartir y elegí “Agregar a pantalla de inicio”.</p></div>' +
      '<div class="sheet-section"><h3>Datos</h3>' +
      '<div class="setting-row"><div><strong>Exportar backup</strong><small>Un archivo con tus prendas, fotos y looks.</small></div>' +
      '<button class="btn ghost small" data-action="export">Exportar</button></div>' +
      '<div class="setting-row"><div><strong>Importar backup</strong><small>Reemplaza lo que tenés ahora.</small></div>' +
      '<button class="btn ghost small" data-action="import">Elegir archivo</button></div>' +
      '<div class="setting-row"><div><strong>Placard de ejemplo</strong><small>26 prendas y un look para probar.</small></div>' +
      '<button class="btn ghost small" data-action="demo">Cargar</button></div>' +
      (S.installPrompt ? '<div class="setting-row"><div><strong>Instalar la app</strong><small>Agregala a tu pantalla de inicio.</small></div><button class="btn ghost small" data-action="install">Instalar</button></div>' : '') +
      '<div class="setting-row"><div><strong>Borrar todo</strong><small>No se puede deshacer.</small></div>' +
      '<button class="btn danger small" data-action="wipe">Borrar</button></div></div>' +
      '<div class="sheet-actions"><button class="btn primary" data-action="close-sheet">Listo</button></div>';
    openSheet(html);
  }

  async function exportBackup() {
    try {
      var garments = await DB.all('garments');
      var looks = await DB.all('looks');
      var meta = await DB.all('meta');
      var gs = [];
      for (var i = 0; i < garments.length; i++) {
        var g = Object.assign({}, garments[i]);
        if (g.photo instanceof Blob) g.photo = await Photo.blobToDataUrl(g.photo);
        else if (!g.photo) g.photo = null;
        else delete g.photo;
        gs.push(g);
      }
      var data = { app: 'mi-placard', version: 1, exportedAt: new Date().toISOString(), garments: gs, looks: looks, meta: meta };
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'mi-placard-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('Backup descargado');
    } catch (err) {
      toast('No pudimos exportar: ' + (err.message || 'error'));
    }
  }

  function pickImportFile() {
    var input = $('#importInput');
    if (input) input.click();
  }

  function importBackup(file) {
    var input = $('#importInput');
    if (input) input.value = '';
    var reader = new FileReader();
    reader.onload = async function () {
      var data;
      try { data = JSON.parse(reader.result); } catch (err) { toast('Ese archivo no es un backup válido.'); return; }
      if (!data || !Array.isArray(data.garments)) { toast('Ese archivo no es un backup de Mi Placard.'); return; }

      var ok = await askConfirm('¿Reemplazar tus datos?', 'Se borran las prendas y looks que tenés ahora y se cargan los del backup.', 'Sí, importar', true);
      if (!ok) { openSettings(); return; }

      try {
        await DB.clear('garments');
        await DB.clear('looks');
        await DB.clear('meta');
        for (var i = 0; i < data.garments.length; i++) {
          var g = data.garments[i];
          if (typeof g.photo === 'string' && g.photo.indexOf('data:') === 0) g.photo = Photo.dataUrlToBlob(g.photo);
          else if (typeof g.photo !== 'object') g.photo = null;
          await DB.put('garments', g);
        }
        for (var j = 0; j < (data.looks || []).length; j++) await DB.put('looks', data.looks[j]);
        for (var k = 0; k < (data.meta || []).length; k++) await DB.put('meta', data.meta[k]);
        await reloadAll();
        hideSheet();
        renderAll();
        go('closet');
        toast('Backup importado: ' + S.garments.length + ' prendas');
      } catch (err) {
        toast('No pudimos importar: ' + (err.message || 'error'));
      }
    };
    reader.onerror = function () { toast('No pudimos leer el archivo.'); };
    reader.readAsText(file);
  }

  async function wipeAll() {
    var ok = await askConfirm('¿Borrar todo?', 'Se van a eliminar todas las prendas, fotos y looks de este dispositivo.', 'Sí, borrar todo', true);
    if (!ok) { openSettings(); return; }
    try {
      await DB.clear('garments');
      await DB.clear('looks');
      S.urls.forEach(function (v) { URL.revokeObjectURL(v.url); });
      S.urls.clear();
      await reloadAll();
      S.results = null;
      hideSheet();
      renderAll();
      go('closet');
      toast('Listo, placard vacío');
    } catch (err) {
      toast('No pudimos borrar todo.');
    }
  }

  async function seedDemo(withConfirm) {
    if (S.garments.length) {
      if (!withConfirm) return;
      var ok = await askConfirm('¿Cargar el placard de ejemplo?', 'Se agregan 26 prendas de prueba a tu placard actual (no se borra nada).', 'Sí, agregar', false);
      if (!ok) { openSettings(); return; }
    }
    var items = Sample.wardrobe();
    for (var i = 0; i < items.length; i++) await DB.put('garments', items[i]);
    var demoLooks = Sample.looks();
    for (var j = 0; j < demoLooks.length; j++) await DB.put('looks', demoLooks[j]);
    await reloadAll();
    hideSheet();
    renderAll();
    go('closet');
    toast('Placard de ejemplo listo. Probá el Probador ✨');
  }

  function applyName(name) {
    S.userName = (name || '').trim() || 'Mati';
    try { localStorage.setItem('mp.name', S.userName); } catch (err) { /* noop */ }
    updateStats();
  }

  async function installApp() {
    if (!S.installPrompt) {
      toast('Abrí el menú del navegador y elegí “Agregar a pantalla de inicio”.', 4200);
      return;
    }
    S.installPrompt.prompt();
    try {
      var choice = await S.installPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') toast('¡Instalada! Ya está en tu pantalla de inicio.');
    } catch (err) { /* noop */ }
    S.installPrompt = null;
  }

  // ---------- datos ----------
  async function reloadGarments() {
    S.garments = await DB.all('garments');
    var order = {};
    C.CATEGORIES.forEach(function (cat, i) { order[cat.id] = i; });
    S.garments.sort(function (a, b) {
      var oa = order[a.category] == null ? 99 : order[a.category];
      var ob = order[b.category] == null ? 99 : order[b.category];
      if (oa !== ob) return oa - ob;
      if (!!b.favorite !== !!a.favorite) return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
      return String(a.name || '').localeCompare(String(b.name || ''), 'es');
    });
  }

  async function reloadLooks() {
    S.looks = await DB.all('looks');
    S.looks.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  async function reloadAll() {
    await Promise.all([reloadGarments(), reloadLooks()]);
  }

  function renderAll() {
    updateStats();
    renderCloset();
    renderLooks();
    renderStyle();
  }

  // ---------- eventos ----------
  function handleAction(el) {
    var action = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');

    switch (action) {
      case 'add': openAdd(null); break;
      case 'close-add': closeAdd(); break;
      case 'save-garment': saveGarment(); break;
      case 'pick-photo': $('#photoInput').click(); break;
      case 'pick-cat':
        S.draft.category = el.getAttribute('data-cat');
        renderCatGrid();
        autoNameIfNeeded();
        break;
      case 'pick-color': {
        var hex = el.getAttribute('data-hex');
        S.draft.color = CU.colorInfo(hex);
        if (!S.draft.palette || !S.draft.palette.length) S.draft.palette = [hex];
        renderPalette();
        renderColorChoices();
        autoNameIfNeeded();
        break;
      }
      case 'toggle-season': {
        var sid = el.getAttribute('data-season');
        var i = S.draft.seasons.indexOf(sid);
        if (i >= 0) S.draft.seasons.splice(i, 1); else S.draft.seasons.push(sid);
        renderSeasonChoices();
        break;
      }
      case 'toggle-occasion': {
        var oid = el.getAttribute('data-occ');
        var j = S.draft.occasions.indexOf(oid);
        if (j >= 0) S.draft.occasions.splice(j, 1); else S.draft.occasions.push(oid);
        renderOccasionChoices();
        break;
      }
      case 'filter-cat':
        S.filter.cat = el.getAttribute('data-cat');
        renderFilters();
        renderCloset();
        break;
      case 'clear-search':
        S.filter.q = '';
        renderCloset();
        break;
      case 'reset-filters':
        S.filter.q = '';
        S.filter.cat = 'all';
        renderFilters();
        renderCloset();
        break;
      case 'open-garment': openGarment(id); break;
      case 'close-sheet': closeSheet(); break;
      case 'toggle-fav': toggleFavorite(id); break;
      case 'style-with': styleWithGarment(id); break;
      case 'edit-garment': hideSheet(); openEdit(id); break;
      case 'delete-garment': deleteGarment(id); break;
      case 'suggest': runSuggest(false); break;
      case 'shuffle': runSuggest(true); break;
      case 'ask-chip': {
        var q = el.getAttribute('data-q');
        var input = $('#askInput');
        var current = input.value.trim();
        var already = normalize(current).indexOf(normalize(q)) >= 0;
        if (!already) input.value = (current ? current + ' ' : '') + q;
        runSuggest(false);
        break;
      }
      case 'save-result': saveResultLook(parseInt(el.getAttribute('data-idx'), 10)); break;
      case 'wear-result': wearResult(parseInt(el.getAttribute('data-idx'), 10)); break;
      case 'add-missing': {
        var slot = el.getAttribute('data-slot');
        openAdd(SLOT_PRESET[slot] || null);
        break;
      }
      case 'wear-saved': wearSavedLook(id); break;
      case 'delete-look': deleteLook(id); break;
      case 'go-style': go('style'); break;
      case 'settings': openSettings(); break;
      case 'export': exportBackup(); break;
      case 'import': pickImportFile(); break;
      case 'wipe': wipeAll(); break;
      case 'demo': seedDemo(true); break;
      case 'install': installApp(); break;
      case 'confirm-ok': {
        var fn = S.pendingConfirm;
        S.pendingConfirm = null;
        hideSheet();
        if (fn) fn(true);
        break;
      }
      default: break;
    }
  }

  document.addEventListener('click', function (e) {
    var tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { go(tabBtn.getAttribute('data-tab')); return; }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    e.preventDefault();
    handleAction(el);
  });

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'searchInput') {
      S.filter.q = t.value;
      renderCloset();
    } else if (t.id === 'gName') {
      S.nameTouched = true;
      if (S.draft) S.draft.name = t.value;
    } else if (t.id === 'gNotes') {
      if (S.draft) S.draft.notes = t.value;
    } else if (t.id === 'customColor') {
      if (!S.draft) return;
      S.draft.color = CU.colorInfo(t.value);
      if (!S.draft.palette || !S.draft.palette.length) S.draft.palette = [t.value];
      renderPalette();
      renderColorChoices();
      autoNameIfNeeded();
    } else if (t.id === 'setName') {
      applyName(t.value);
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'gFav' && S.draft) S.draft.favorite = e.target.checked;
    if (e.target.id === 'photoInput') {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      handlePhoto(file);
    }
    if (e.target.id === 'importInput' && e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('#addScreen').hidden) { closeAdd(); return; }
      if (!$('#sheetRoot').hidden) closeSheet();
    }
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'askInput') {
      e.preventDefault();
      runSuggest(false);
    }
  });

  async function handlePhoto(file) {
    if (!file) return;
    toast('Preparando la foto…');
    try {
      var res = await Photo.process(file);
      if (!S.draft) return;
      S.draft.photo = res.blob;
      S.draft.palette = res.palette.slice();
      if (res.palette.length) S.draft.color = CU.colorInfo(res.palette[0]);
      renderPhoto();
      renderPalette();
      renderColorChoices();
      autoNameIfNeeded();
      toast('Foto lista. Revisá el color.');
    } catch (err) {
      toast(err.message || 'No pudimos procesar la foto.');
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    S.installPrompt = e;
  });

  window.addEventListener('scroll', function () {
    document.querySelector('.app').classList.toggle('is-scrolled', window.scrollY > 4);
  }, { passive: true });

  // ---------- arranque ----------
  async function boot() {
    try { S.userName = localStorage.getItem('mp.name') || 'Mati'; } catch (err) { /* noop */ }
    applyName(S.userName);

    // Offline: registrar el service worker ya mismo, antes de que termine de cargar todo.
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* sin offline */ });
    }

    var params = new URLSearchParams(location.search);
    if (params.get('demo') === '1' && !S.garments.length) {
      try {
        var items = Sample.wardrobe();
        for (var i = 0; i < items.length; i++) await DB.put('garments', items[i]);
        var demoLooks = Sample.looks();
        for (var j = 0; j < demoLooks.length; j++) await DB.put('looks', demoLooks[j]);
      } catch (err) { /* seguimos sin demo */ }
    }

    try {
      await reloadAll();
    } catch (err) {
      toast('No pudimos abrir tus datos. Probá recargar.');
    }

    $('#emptyArt').innerHTML = C.icon('vestido');
    $('#looksArt').innerHTML = C.icon('cartera');

    renderAll();
    renderFilters();
    go(params.get('view') || 'closet');

    var ask = params.get('ask');
    if (ask) {
      $('#askInput').value = ask;
      go('style');
      runSuggest(false);
    }

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.ready.then(function (reg) {
        if (reg && reg.update) reg.update().catch(function () { /* noop */ });
      }).catch(function () { /* noop */ });
    }

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () { /* noop */ });
    }

    document.body.setAttribute('data-ready', '1');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
