/* Fotos: reducir, comprimir y sacar la paleta de colores. */
(function (global) {
  'use strict';

  var MAX_SIDE = 1100;
  var QUALITY = 0.84;

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('No pudimos leer esa imagen. Probá con otra foto.'));
      };
      img.src = url;
    });
  }

  function drawScaled(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', QUALITY);
      } else {
        var dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrlToBlob(dataUrl));
      }
    });
  }

  function dataUrlToBlob(dataUrl) {
    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(parts[1] || '');
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  var Photo = {
    process: async function (file) {
      if (!file) throw new Error('No elegiste ninguna foto.');
      if (!/^image\//.test(file.type || '')) throw new Error('Ese archivo no parece una foto.');
      var loaded = await loadImage(file);
      try {
        var canvas = drawScaled(loaded.img);
        var blob = await toBlob(canvas);
        var palette = (global.ColorUtil ? ColorUtil.extractPalette(loaded.img, 6) : []);
        return { blob: blob, palette: palette };
      } finally {
        URL.revokeObjectURL(loaded.url);
      }
    },
    dataUrlToBlob: dataUrlToBlob,
    blobToDataUrl: blobToDataUrl
  };

  global.Photo = Photo;
})(typeof window !== 'undefined' ? window : globalThis);
