/* Motor de recomendación: entiende el pedido de Mati y arma looks con lo que hay en el placard. */
(function (global) {
  'use strict';

  var C = global.Catalog;
  var CU = global.ColorUtil;
  var DAY = 86400000;

  function normalize(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hasWord(text, word) {
    word = normalize(word);
    if (!word) return false;
    var re = new RegExp('(^|\\s)' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)');
    return re.test(text);
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var OCCASION_BY_ID = {};
  C.OCCASIONS.forEach(function (o) { OCCASION_BY_ID[o.id] = o; });

  var FEEL_WORDS = {
    frio: ['frio', 'fria', 'frios', 'invierno', 'fresco', 'fresca', 'abrigo', 'abrigada', 'abrigado', 'llueve', 'lluvia'],
    calor: ['calor', 'caluroso', 'calurosa', 'verano', 'playa', 'humedo', 'humeda']
  };

  function parse(text) {
    var t = normalize(text);
    var colors = [], colorLabels = [];
    C.COLOR_WORDS.forEach(function (cw) {
      cw.words.forEach(function (w) {
        if (hasWord(t, w)) {
          cw.families.forEach(function (f) { if (colors.indexOf(f) < 0) colors.push(f); });
          if (colorLabels.indexOf(w) < 0) colorLabels.push(w);
        }
      });
    });

    var cats = [];
    C.CATEGORIES.forEach(function (cat) {
      cat.aliases.forEach(function (a) {
        if (hasWord(t, a) && cats.indexOf(cat.id) < 0) cats.push(cat.id);
      });
    });

    var occasion = null;
    C.OCCASIONS.forEach(function (o) {
      if (occasion) return;
      if (o.aliases.some(function (a) { return hasWord(t, a); })) occasion = o.id;
    });

    var feel = null;
    if (FEEL_WORDS.frio.some(function (w) { return hasWord(t, w); })) feel = 'frio';
    else if (FEEL_WORDS.calor.some(function (w) { return hasWord(t, w); })) feel = 'calor';

    var comfy = ['comodo', 'comoda', 'comodos', 'comodas', 'comfy', 'relajado', 'relajada'].some(function (w) { return hasWord(t, w); });
    var dressy = ['elegante', 'arreglada', 'arreglado', 'producción', 'produccion', 'fachera', 'fachero'].some(function (w) { return hasWord(t, w); });

    return {
      text: String(text || '').trim(),
      colors: colors,
      colorLabels: colorLabels,
      cats: cats,
      occasion: occasion,
      feel: feel,
      comfy: comfy,
      dressy: dressy,
      hasFilters: colors.length > 0 || cats.length > 0 || !!occasion || !!feel
    };
  }

  function colorFamilies(g) {
    var fams = [];
    if (g && g.color) {
      if (g.color.family) fams.push(g.color.family);
      if (g.color.neutral) fams.push('neutro');
    }
    ((g && g.palette) || []).forEach(function (hex) {
      var info = CU.nameColor(hex);
      if (fams.indexOf(info.family) < 0) fams.push(info.family);
    });
    return fams;
  }

  function matchesColor(g, families) {
    if (!families || !families.length) return true;
    var fams = colorFamilies(g);
    return families.some(function (f) { return fams.indexOf(f) >= 0; });
  }

  /* Coincidencia con el color principal (no con los colores del estampado). */
  function matchesMainColor(g, families) {
    if (!families || !families.length) return false;
    return !!(g && g.color && families.indexOf(g.color.family) >= 0);
  }

  function matchesCats(g, cats) {
    if (!cats || !cats.length) return true;
    return cats.indexOf(g.category) >= 0;
  }

  function categoryOf(g) { return C.BY_ID[g.category] || { slot: null, warmth: 2, formality: 2 }; }

  function slotOf(g) { return categoryOf(g).slot; }

  function formalityOf(g) { return categoryOf(g).formality; }

  function warmthOf(g) {
    var cat = categoryOf(g);
    if (cat.slot === 'acc') return 0;
    return cat.warmth;
  }

  function targetWarmth(feel) {
    if (feel === 'calor') return 1.6;
    if (feel === 'frio') return 3.5;
    return 2.7;
  }

  function targetFormality(parsed) {
    var t = parsed.occasion ? OCCASION_BY_ID[parsed.occasion].formality : 2.6;
    if (parsed.comfy) t -= 0.5;
    if (parsed.dressy) t += 0.6;
    return t;
  }

  function recencyPenalty(g) {
    if (!g.lastWorn) return 0;
    var days = (Date.now() - g.lastWorn) / DAY;
    if (days < 1) return 0.09;
    if (days < 3) return 0.05;
    if (days < 6) return 0.02;
    return 0;
  }

  var FEM_CATS = ['remera', 'musculosa', 'camisa', 'blusa', 'campera', 'pollera', 'bufanda', 'cartera', 'gorra', 'zapatillas', 'botas', 'sandalias'];
  var PLURAL_CATS = ['zapatillas', 'botas', 'sandalias', 'zapatos', 'anteojos'];

  function articleFor(g) {
    if (PLURAL_CATS.indexOf(g.category) >= 0) return FEM_CATS.indexOf(g.category) >= 0 ? 'Las' : 'Los';
    return FEM_CATS.indexOf(g.category) >= 0 ? 'La' : 'El';
  }

  function anchorScore(g, parsed, rnd) {
    var s = 0;
    var slot = slotOf(g);
    if (slot === 'top' || slot === 'bottom') s += 0.25;
    else if (slot === 'outer' || slot === 'dress') s += 0.12;
    if (slot === 'acc') s -= 0.7;
    if (parsed.cats.length && matchesCats(g, parsed.cats)) s += 0.8;
    if (parsed.colors.length) {
      if (matchesMainColor(g, parsed.colors)) s += 0.9;
      else if (matchesColor(g, parsed.colors)) s += 0.12;
    }
    // coincidencia más fina: "oliva" o "marino" dentro del nombre del color
    var cname = normalize((g.color && g.color.name) || '');
    parsed.colorLabels.forEach(function (w) { if (cname.indexOf(normalize(w)) >= 0) s += 0.4; });
    if (g.favorite) s += 0.1;
    if (parsed.occasion && (g.occasions || []).indexOf(parsed.occasion) >= 0) s += 0.2;
    s += rnd() * 0.22;
    return s;
  }

  function itemFit(g, parsed) {
    var occ = parsed.occasion ? 1 - Math.min(1, Math.abs(formalityOf(g) - targetFormality(parsed)) / 2.4) : 0.7;
    var warm = 1 - Math.min(1, Math.abs(warmthOf(g) - targetWarmth(parsed.feel)) / 2.6);
    return { occ: occ, warm: warm };
  }

  function compatScore(g, anchor, parsed, rnd) {
    var h = CU.harmony(anchor.color.hex, g.color.hex);
    var fit = itemFit(g, parsed);
    var s = 0.55 * h + 0.16 * fit.occ + 0.14 * fit.warm + 0.05 * (g.favorite ? 1 : 0) + 0.1 * rnd();
    s -= recencyPenalty(g);
    if (parsed.occasion && (g.occasions || []).indexOf(parsed.occasion) < 0) s -= 0.05;
    return s;
  }

  function candidatesFor(slot, pool, anchor, parsed, rnd, limit) {
    var list = pool.filter(function (g) {
      return g.id !== anchor.id && slotOf(g) === slot;
    });
    if (parsed.feel === 'calor') {
      list = list.filter(function (g) { return warmthOf(g) < 3.4; });
    }
    if (!list.length) return [];
    return list.map(function (g) {
      return { g: g, s: compatScore(g, anchor, parsed, rnd) };
    }).sort(function (a, b) { return b.s - a.s; })
      .slice(0, limit || 3)
      .map(function (x) { return x.g; });
  }

  function slotsNeeded(anchor) {
    switch (slotOf(anchor)) {
      case 'top': return ['bottom', 'shoes'];
      case 'bottom': return ['top', 'shoes'];
      case 'dress': return ['shoes'];
      case 'outer': return ['top', 'bottom', 'shoes'];
      case 'shoes': return ['top', 'bottom'];
      case 'acc': return ['top', 'bottom', 'shoes'];
      default: return ['top', 'bottom', 'shoes'];
    }
  }

  function comboScore(items, parsed, anchor, rnd, excludeSigs) {
    var colorSum = 0, pairs = 0;
    for (var i = 0; i < items.length; i++) {
      for (var j = i + 1; j < items.length; j++) {
        var h = CU.harmony(items[i].color.hex, items[j].color.hex);
        // los pares con la prenda protagonista pesan doble
        var weight = (items[i].id === anchor.id || items[j].id === anchor.id) ? 2 : 1;
        colorSum += h * weight;
        pairs += weight;
      }
    }
    var colorAvg = pairs ? colorSum / pairs : 0.7;

    var formSum = 0, warmSum = 0, favs = 0, cloth = 0;
    items.forEach(function (g) {
      formSum += formalityOf(g);
      warmSum += warmthOf(g);
      if (g.favorite) favs++;
      if (slotOf(g) !== 'acc') cloth++;
    });
    var form = formSum / items.length;
    var warmAvg = cloth ? warmSum / cloth : 0;

    var occScore = 1 - Math.min(1, Math.abs(form - targetFormality(parsed)) / 2.4);
    var warmScore = 1 - Math.min(1, Math.abs(warmAvg - targetWarmth(parsed.feel)) / 2.2);

    var novelty = items.reduce(function (s, g) { return s + recencyPenalty(g); }, 0) / items.length;

    var anchorMatch = 0.6;
    if (parsed.colors.length) anchorMatch = matchesColor(anchor, parsed.colors) ? 1 : 0.4;
    if (parsed.cats.length && matchesCats(anchor, parsed.cats)) anchorMatch += 0.25;

    var score = 0.33 * colorAvg + 0.22 * occScore + 0.18 * warmScore +
      0.08 * (favs / items.length) + 0.12 * anchorMatch - novelty + 0.06 * rnd();

    // El color pedido tiene que estar en la prenda principal, no solo en un estampado.
    if (parsed.colors.length) {
      score += matchesMainColor(anchor, parsed.colors) ? 0.16 : -0.05;
    }

    var sig = items.map(function (g) { return g.id; }).sort().join('|');
    if (excludeSigs && excludeSigs.indexOf(sig) >= 0) score -= 1;
    return { score: score, sig: sig, colorAvg: colorAvg };
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function joinList(parts) {
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  function uniqueNames(items, key) {
    var out = [];
    items.forEach(function (g) {
      var v = key(g);
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }

  function shortCategory(g) {
    var c = C.BY_ID[g.category];
    return c ? c.label.toLowerCase() : 'prenda';
  }

  var OCC_PHRASE = {
    casual: 'Funciona para el día a día.',
    salir: 'Funciona para salir.',
    facultad: 'Va bien para la facultad.',
    trabajo: 'Sirve para el trabajo.',
    formal: 'Queda bien para un evento formal.',
    deporte: 'Va bien para hacer deporte.'
  };

  function makeTitle(items, parsed, anchor) {
    var second = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === anchor.id) continue;
      var s = slotOf(items[i]);
      if (s === 'bottom' || s === 'top' || s === 'dress' || s === 'shoes') { second = items[i]; break; }
    }
    var head;
    if (parsed.colors.length && matchesMainColor(anchor, parsed.colors)) {
      head = cap(anchor.color.name);
    } else {
      head = cap(anchor.name);
    }
    if (second) return head + ' + ' + shortCategory(second);
    return head;
  }

  function makeReason(items, parsed, anchor) {
    var bits = [];

    if (parsed.colors.length) {
      if (matchesMainColor(anchor, parsed.colors)) {
        bits.push('El ' + anchor.color.name.toLowerCase() + ' es el que manda.');
      } else {
        bits.push('El ' + CU.familyLabel(parsed.colors[0]) + ' aparece en el estampado.');
      }
    } else {
      bits.push(articleFor(anchor) + ' ' + anchor.name.toLowerCase() + ' es el punto de partida.');
    }

    var others = items.filter(function (g) { return g.id !== anchor.id; });
    var neutrals = uniqueNames(others.filter(function (g) { return g.color.neutral; }), function (g) { return g.color.name; });
    if (neutrals.length) {
      bits.push(joinList(neutrals.slice(0, 3).map(function (n) { return 'el ' + n.toLowerCase(); })) +
        (neutrals.length > 1 ? ' equilibran.' : ' equilibra.'));
    } else {
      var accents = uniqueNames(others, function (g) { return g.color.name; })
        .filter(function (n) { return normalize(n) !== normalize(anchor.color.name); });
      if (accents.length) bits.push('El ' + accents[0].toLowerCase() + ' lo acompaña bien.');
    }

    if (slotOf(anchor) === 'dress') {
      bits.push('El vestido ya resuelve todo: solo faltaba el calzado.');
    } else if (parsed.occasion && OCC_PHRASE[parsed.occasion]) {
      bits.push(OCC_PHRASE[parsed.occasion]);
    }

    if (parsed.feel === 'frio') bits.push('Suma abrigo para el frío.');
    else if (parsed.feel === 'calor') bits.push('Livianito para el calor.');

    return bits.map(cap).join(' ');
  }

  function buildLook(items, parsed, anchor, rnd, excludeSigs, missing) {
    var result = comboScore(items, parsed, anchor, rnd, excludeSigs);
    return {
      items: items,
      score: Math.round(result.score * 100) / 100,
      title: makeTitle(items, parsed, anchor),
      reason: makeReason(items, parsed, anchor),
      missing: missing || [],
      signature: result.sig,
      anchorId: anchor.id
    };
  }

  function suggest(garments, text, options) {
    options = options || {};
    var parsed = parse(text);
    var pool = (garments || []).filter(function (g) { return g && C.BY_ID[g.category]; });
    var out = {
      parsed: parsed,
      looks: [],
      status: 'ok',
      availableColors: [],
      availableCats: [],
      relaxed: false
    };
    if (!pool.length) { out.status = 'empty'; return out; }

    var colorOnly = parsed.colors.length ? pool.filter(function (g) { return matchesColor(g, parsed.colors); }) : [];
    var catOnly = parsed.cats.length ? pool.filter(function (g) { return matchesCats(g, parsed.cats); }) : [];
    var both = pool.filter(function (g) {
      return matchesColor(g, parsed.colors) && matchesCats(g, parsed.cats);
    });

    if (parsed.colors.length && !colorOnly.length) {
      out.status = 'no-color';
      out.availableColors = [];
      pool.forEach(function (g) {
        var fam = g.color && g.color.family;
        if (fam && out.availableColors.indexOf(fam) < 0) out.availableColors.push(fam);
      });
      return out;
    }
    if (parsed.cats.length && !catOnly.length && !colorOnly.length) {
      out.status = 'no-cat';
      out.availableCats = [];
      pool.forEach(function (g) {
        if (out.availableCats.indexOf(g.category) < 0) out.availableCats.push(g.category);
      });
      return out;
    }

    var anchors;
    if (!parsed.colors.length && !parsed.cats.length) anchors = pool.slice();
    else if (both.length) anchors = both.slice();
    else if (colorOnly.length) { anchors = colorOnly.slice(); out.relaxed = parsed.cats.length > 0; }
    else anchors = catOnly.slice();

    var rnd = mulberry32(options.seed || 1);
    anchors = anchors.map(function (g) { return { g: g, s: anchorScore(g, parsed, rnd) }; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 5)
      .map(function (x) { return x.g; });

    var excludeSigs = options.exclude || [];
    var combos = [];

    anchors.forEach(function (anchor) {
      var needed = slotsNeeded(anchor);
      var lists = needed.map(function (slot) {
        return candidatesFor(slot, pool, anchor, parsed, rnd, slot === 'shoes' ? 2 : 3);
      });
      var missingSlots = [];
      needed.forEach(function (slot, i) { if (!lists[i].length) missingSlots.push(slot); });

      var optional = [];
      if (slotOf(anchor) !== 'outer' && parsed.feel !== 'calor') {
        var outers = candidatesFor('outer', pool, anchor, parsed, rnd, 1);
        if (outers.length) optional.push(outers);
      }
      if (slotOf(anchor) !== 'acc') {
        var accs = candidatesFor('acc', pool, anchor, parsed, rnd, 1);
        if (accs.length) optional.push(accs);
      }

      var allLists = lists.map(function (list) { return list.length ? list : [null]; });
      var optionalLists = optional.map(function (list) { return [null].concat(list); });

      var maxCombos = 90;
      var count = 0;

      function walk(li, chosen) {
        if (count >= maxCombos) return;
        if (li === allLists.length) {
          var base = [anchor].concat(chosen.filter(Boolean));
          function walkOpt(oi, optChosen) {
            if (count >= maxCombos) return;
            if (oi === optionalLists.length) {
              var items = base.concat(optChosen.filter(Boolean));
              if (items.length >= 1) {
                combos.push(buildLook(items, parsed, anchor, rnd, excludeSigs, missingSlots));
                count++;
              }
              return;
            }
            optionalLists[oi].forEach(function (item) { walkOpt(oi + 1, optChosen.concat(item ? [item] : [])); });
          }
          walkOpt(0, []);
          return;
        }
        allLists[li].forEach(function (item) { walk(li + 1, chosen.concat(item ? [item] : [])); });
      }
      walk(0, []);
    });

    combos.sort(function (a, b) { return b.score - a.score; });

    var chosen = [], usedCore = {}, perAnchor = {};
    combos.forEach(function (look) {
      if (chosen.length >= 3) return;
      var core = look.items.filter(function (g) {
        var s = slotOf(g);
        return s === 'top' || s === 'bottom' || s === 'dress' || s === 'shoes';
      }).map(function (g) { return g.id; }).sort().join('+');
      if (usedCore[core]) return;
      if ((perAnchor[look.anchorId] || 0) >= 2) return;
      usedCore[core] = true;
      perAnchor[look.anchorId] = (perAnchor[look.anchorId] || 0) + 1;
      chosen.push(look);
    });
    if (chosen.length < 3) {
      combos.forEach(function (look) {
        if (chosen.length >= 3) return;
        if (chosen.indexOf(look) < 0) chosen.push(look);
      });
    }

    out.looks = chosen;
    if (!chosen.length) out.status = 'no-combo';
    if (out.relaxed) out.status = 'relaxed';
    return out;
  }

  global.Recommend = {
    parse: parse,
    suggest: suggest,
    matchesColor: matchesColor,
    matchesMainColor: matchesMainColor,
    colorFamilies: colorFamilies,
    normalize: normalize
  };
})(typeof window !== 'undefined' ? window : globalThis);
