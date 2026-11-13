/* Reconocimiento de prendas con un modelo que corre en el celular.
   La primera vez descarga ~30 MB; después queda cacheado y funciona sin internet.
   No sube la foto a ningún lado. */
(function (global) {
  'use strict';

  var MODEL = 'Xenova/convnext-tiny-224';
  var CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';
  var MIN_SCORE = 0.2;

  // Etiquetas de ImageNet -> categorías de la app.
  var RULES = [
    [/jersey|t-shirt|tee shirt|tee-shirt/, 'remera'],
    [/tank top|sleeveless/, 'musculosa'],
    [/sweatshirt/, 'buzo'],
    [/cardigan/, 'pullover'],
    [/trench coat|fur coat|overcoat|cloak|poncho|blazer|jacket/, 'campera'],
    [/\bcoat\b/, 'campera'],
    [/jean|denim/, 'jean'],
    [/miniskirt|hoopskirt|overskirt|\bskirt\b/, 'pollera'],
    [/gown|kimono|abaya|sarong|\bdress\b/, 'vestido'],
    [/\bshorts\b/, 'short'],
    [/trousers|\bpants\b|chinos/, 'pantalon'],
    [/\bshirt\b/, 'camisa'],
    [/running shoe|tennis shoe|sneaker/, 'zapatillas'],
    [/sandal|\bclog\b/, 'sandalias'],
    [/cowboy boot|\bboot\b/, 'botas'],
    [/loafer|oxford|\bpump\b/, 'zapatos'],
    [/purse|backpack|wallet|handbag/, 'cartera'],
    [/\bbag\b/, 'cartera'],
    [/cowboy hat|bonnet|sombrero|\bcap\b/, 'gorra'],
    [/\bhat\b/, 'gorra'],
    [/stole|feather boa|scarf/, 'bufanda'],
    [/sunglass|eyeglass|spectacle/, 'anteojos'],
    [/\bbelt\b/, 'cinturon'],
    [/necklace/, 'collar']
  ];

  var pipePromise = null;
  var progressHandler = null;

  function categoryFor(label) {
    var l = String(label || '').toLowerCase();
    if (/suitcase|shoe shop|shoe store|clothing store|bookstore|store\b/.test(l)) return null;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(l)) return RULES[i][1];
    }
    return null;
  }

  function load(onProgress) {
    progressHandler = onProgress || null;
    if (!pipePromise) {
      pipePromise = (async function () {
        var mod = await import(CDN);
        mod.env.allowLocalModels = false;
        mod.env.useBrowserCache = true;
        return mod.pipeline('image-classification', MODEL, {
          dtype: 'q8',
          progress_callback: function (p) {
            if (progressHandler) progressHandler(p);
          }
        });
      })();
      pipePromise.catch(function () { pipePromise = null; });
    }
    return pipePromise;
  }

  async function classify(imageUrl, onProgress) {
    var clf = await load(onProgress);
    var out = await clf(imageUrl, { topk: 6 });
    var best = null;
    (out || []).forEach(function (r) {
      var cat = categoryFor(r.label);
      if (!cat) return;
      if (!best || r.score > best.score) {
        best = { category: cat, score: r.score, label: r.label };
      }
    });
    return {
      best: best && best.score >= MIN_SCORE ? best : null,
      raw: out || []
    };
  }

  global.Vision = {
    classify: classify,
    categoryFor: categoryFor,
    load: load,
    MODEL: MODEL
  };
})(window);
