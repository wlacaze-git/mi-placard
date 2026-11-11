/* Persistencia local con IndexedDB. Nada sale del dispositivo. */
(function (global) {
  'use strict';

  var DB_NAME = 'mi-placard';
  var DB_VERSION = 1;
  var STORES = ['garments', 'looks', 'meta'];
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('Este navegador no permite guardar datos.')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        STORES.forEach(function (name) {
          if (!db.objectStoreNames.contains(name)) {
            var store = db.createObjectStore(name, { keyPath: name === 'meta' ? 'key' : 'id' });
            if (name === 'garments') {
              store.createIndex('category', 'category', { unique: false });
            }
          }
        });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('No se pudo abrir la base local.')); };
      req.onblocked = function () { reject(new Error('Cerrá otras pestañas de la app e intentá de nuevo.')); };
    });
    return dbPromise;
  }

  function run(storeName, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result;
        var req;
        try { req = fn(store); } catch (err) { reject(err); return; }
        if (req) {
          req.onsuccess = function () { result = req.result; };
          req.onerror = function () { reject(req.error); };
        }
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Operación cancelada')); };
      });
    });
  }

  var DB = {
    ready: function () { return open(); },
    all: function (store) { return run(store, 'readonly', function (s) { return s.getAll(); }); },
    get: function (store, id) { return run(store, 'readonly', function (s) { return s.get(id); }); },
    put: function (store, value) { return run(store, 'readwrite', function (s) { return s.put(value); }); },
    del: function (store, id) { return run(store, 'readwrite', function (s) { return s.delete(id); }); },
    clear: function (store) { return run(store, 'readwrite', function (s) { return s.clear(); }); },
    getAll: function (store) { return run(store, 'readonly', function (s) { return s.getAll(); }); },
    getLook: function (id) { return run('looks', 'readonly', function (s) { return s.get(id); }); }
  };

  global.DB = DB;
})(typeof window !== 'undefined' ? window : globalThis);
