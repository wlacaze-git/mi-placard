/* Utilidades de color: conversiones, nombres en castellano, paleta desde una foto y armonía. */
(function (global) {
  'use strict';

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    function p(n) { return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0'); }
    return '#' + p(r) + p(g) + p(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  function hexToHsl(hex) {
    var c = hexToRgb(hex);
    return rgbToHsl(c.r, c.g, c.b);
  }

  /* Distancia perceptual aproximada (redmean), 0..~765 */
  function distance(a, b) {
    var ca = hexToRgb(a), cb = hexToRgb(b);
    var rm = (ca.r + cb.r) / 2;
    var dr = ca.r - cb.r, dg = ca.g - cb.g, db = ca.b - cb.b;
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }

  function luminance(hex) {
    var c = hexToRgb(hex);
    var a = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function mix(hex, target, amount) {
    var a = hexToRgb(hex), b = hexToRgb(target);
    return rgbToHex(
      a.r + (b.r - a.r) * amount,
      a.g + (b.g - a.g) * amount,
      a.b + (b.b - a.b) * amount
    );
  }

  function tint(hex, amount) { return mix(hex, '#FFFFFF', amount == null ? 0.86 : amount); }
  function shade(hex, amount) { return mix(hex, '#000000', amount == null ? 0.2 : amount); }

  function textOn(hex) {
    return luminance(hex) > 0.55 ? '#241F1B' : '#FFFDF9';
  }

  function nameColor(hex) {
    var best = null, bestD = Infinity;
    var list = (global.Catalog && global.Catalog.COLORS) || [];
    for (var i = 0; i < list.length; i++) {
      var d = distance(hex, list[i].hex);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    if (!best) return { name: 'Color', hex: hex, family: 'otro', neutral: false, distance: 0 };
    return {
      name: best.name,
      hex: best.hex,
      family: best.family,
      neutral: !!best.neutral,
      distance: Math.round(bestD)
    };
  }

  function colorInfo(hex, fallbackName) {
    var named = nameColor(hex);
    return {
      hex: hex,
      name: fallbackName || named.name,
      family: named.family,
      neutral: named.neutral
    };
  }

  function familyLabel(family) {
    var m = (global.Catalog && global.Catalog.COLOR_FAMILY_LABEL) || {};
    return m[family] || family;
  }

  /* Armonía entre dos colores de una prenda. 0..1 */
  function harmony(a, b) {
    var na = nameColor(a), nb = nameColor(b);
    var ha = hexToHsl(a), hb = hexToHsl(b);
    var valueGap = Math.abs(ha.l - hb.l);
    var isNeutral = function (info, hsl) { return info.neutral || hsl.s < 0.12; };

    if (isNeutral(na, ha) && isNeutral(nb, hb)) {
      return 0.88 + 0.12 * clamp(valueGap * 2, 0, 1);
    }
    if (isNeutral(na, ha) || isNeutral(nb, hb)) {
      return 0.84 + 0.16 * clamp(valueGap * 2, 0, 1);
    }
    var d = Math.abs(ha.h - hb.h);
    if (d > 180) d = 360 - d;
    var base;
    if (d <= 20) base = 0.9 + 0.06 * clamp(valueGap * 2, 0, 1);       // monocromático
    else if (d <= 45) base = 0.88;                                     // análogo
    else if (d >= 145) base = 0.82;                                    // complementario
    else if (d <= 75) base = 0.6;                                      // choque cálido
    else base = 0.7;
    // dos colores muy saturados y claros a la vez compiten
    if (ha.s > 0.6 && hb.s > 0.6 && Math.abs(ha.l - hb.l) < 0.08) base -= 0.06;
    return clamp(base, 0, 1);
  }

  /* ---------- Paleta desde una imagen ---------- */
  function extractPalette(img, max) {
    max = max || 6;
    var W = 64, H = 64;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    var sw = img.width || img.naturalWidth || 1;
    var sh = img.height || img.naturalHeight || 1;
    // recorte tipo "cover" para quedarnos con el centro de la prenda
    var scale = Math.max(W / sw, H / sh);
    var dw = sw * scale, dh = sh * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

    var data;
    try { data = ctx.getImageData(0, 0, W, H).data; } catch (err) { return []; }

    function px(x, y) {
      var i = (y * W + x) * 4;
      return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    }

    // color de fondo: esquinas. Sólo filtramos si las esquinas son parecidas entre sí.
    var corners = [];
    [[0, 0], [W - 9, 0], [0, H - 9], [W - 9, H - 9]].forEach(function (p) {
      for (var y = p[1]; y < p[1] + 9; y++) for (var x = p[0]; x < p[0] + 9; x++) corners.push(px(x, y));
    });
    var bg = { r: 0, g: 0, b: 0 };
    corners.forEach(function (c) { bg.r += c.r; bg.g += c.g; bg.b += c.b; });
    bg.r /= corners.length; bg.g /= corners.length; bg.b /= corners.length;
    var bgHex = rgbToHex(bg.r, bg.g, bg.b);
    var uniformBg = corners.every(function (c) { return distance(rgbToHex(c.r, c.g, c.b), bgHex) < 55; });

    var buckets = {};
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var c = px(x, y);
        if (c.a < 128) continue;
        var hex = rgbToHex(c.r, c.g, c.b);
        if (uniformBg && distance(hex, bgHex) < 42) continue;
        // peso mayor al centro (ahí suele estar la prenda)
        var dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        var radial = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.25);
        var weight = 0.35 + radial * 1.65;
        var key = (c.r >> 4) + ',' + (c.g >> 4) + ',' + (c.b >> 4);
        var bkt = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, w: 0, n: 0 });
        bkt.r += c.r * weight; bkt.g += c.g * weight; bkt.b += c.b * weight;
        bkt.w += weight; bkt.n++;
      }
    }

    var arr = Object.keys(buckets).map(function (k) {
      var b = buckets[k];
      return { hex: rgbToHex(b.r / b.w, b.g / b.w, b.b / b.w), w: b.w, n: b.n };
    }).sort(function (a, b) { return b.w - a.w; });

    var total = arr.reduce(function (s, a) { return s + a.w; }, 0);
    var out = [];
    for (var i = 0; i < arr.length && out.length < max; i++) {
      if (arr[i].w / total < 0.004 && out.length) continue;
      var ok = out.every(function (o) { return distance(o, arr[i].hex) > 30; });
      if (ok) out.push(arr[i].hex);
    }
    return out;
  }

  function paletteFromDataUrl(dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(extractPalette(img, 6)); };
      img.onerror = function () { resolve([]); };
      img.src = dataUrl;
    });
  }

  global.ColorUtil = {
    clamp: clamp,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    hexToHsl: hexToHsl,
    distance: distance,
    luminance: luminance,
    mix: mix,
    tint: tint,
    shade: shade,
    textOn: textOn,
    nameColor: nameColor,
    colorInfo: colorInfo,
    familyLabel: familyLabel,
    harmony: harmony,
    extractPalette: extractPalette,
    paletteFromDataUrl: paletteFromDataUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
