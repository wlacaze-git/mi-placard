/* Placard de ejemplo: sirve para probar la app sin cargar nada. */
(function (global) {
  'use strict';

  var DAY = 86400000;

  var ITEMS = [
    ['Remera oversize blanca', 'remera', '#F3EFE7', ['verano', 'entretiempo'], ['casual', 'facultad', 'salir'], true, 8],
    ['Remera verde oliva', 'remera', '#6D6A3A', ['verano', 'entretiempo'], ['casual', 'salir'], false, 3],
    ['Remera rosa', 'remera', '#E39BB0', ['verano'], ['casual', 'salir'], false, 2],
    ['Camisa de jean celeste', 'camisa', '#9BC4DD', ['todo'], ['facultad', 'trabajo', 'casual'], true, 5],
    ['Blusa lila', 'blusa', '#B49BD6', ['entretiempo', 'verano'], ['trabajo', 'salir'], false, 1],
    ['Buzo gris', 'buzo', '#8C8A87', ['invierno', 'entretiempo'], ['casual', 'facultad', 'deporte'], true, 9],
    ['Pullover negro', 'pullover', '#141414', ['invierno'], ['casual', 'salir', 'trabajo'], false, 4],
    ['Campera de jean', 'campera', '#4E6E9E', ['entretiempo'], ['casual', 'facultad', 'salir'], true, 7],
    ['Campera de cuero', 'campera', '#2E2B29', ['invierno', 'entretiempo'], ['salir'], false, 2],
    ['Tapado camel', 'tapado', '#BE8F5E', ['invierno'], ['trabajo', 'formal'], false, 1],
    ['Jean mom azul', 'jean', '#4E6E9E', ['todo'], ['casual', 'facultad', 'salir'], true, 12],
    ['Jean negro', 'jean', '#141414', ['todo'], ['salir', 'trabajo'], false, 4],
    ['Pantalón cargo beige', 'pantalon', '#D8C2A0', ['entretiempo', 'verano'], ['casual', 'facultad'], false, 3],
    ['Pollera plizada negra', 'pollera', '#141414', ['verano', 'entretiempo'], ['salir', 'formal'], false, 2],
    ['Pollera de jean', 'pollera', '#4E6E9E', ['verano'], ['casual', 'salir'], false, 1],
    ['Vestido floral', 'vestido', '#E39BB0', ['verano'], ['salir', 'formal'], true, 2],
    ['Short denim', 'short', '#9BC4DD', ['verano'], ['casual', 'deporte'], false, 2],
    ['Zapatillas blancas', 'zapatillas', '#FAF8F3', ['todo'], ['casual', 'facultad', 'deporte'], true, 15],
    ['Zapatillas negras', 'zapatillas', '#141414', ['todo'], ['casual', 'salir'], false, 6],
    ['Botas marrones', 'botas', '#6E4A32', ['invierno', 'entretiempo'], ['salir', 'casual'], true, 5],
    ['Sandalias negras', 'sandalias', '#141414', ['verano'], ['salir', 'formal'], false, 2],
    ['Zapatos nude', 'zapatos', '#D8C2A0', ['todo'], ['trabajo', 'formal'], false, 1],
    ['Cartera marrón', 'cartera', '#6E4A32', ['todo'], ['salir', 'trabajo'], true, 30],
    ['Gorra negra', 'gorra', '#141414', ['todo'], ['casual', 'deporte'], false, 4],
    ['Bufanda mostaza', 'bufanda', '#C39A2B', ['invierno'], ['casual', 'salir'], false, 2],
    ['Anteojos negros', 'anteojos', '#141414', ['todo'], ['casual', 'salir'], true, 20]
  ];

  var NOTES = {
    'Vestido floral': 'El que uso para cumpleaños.',
    'Campera de cuero': 'De mi mamá, me queda grande.',
    'Zapatillas blancas': 'Ya están pidiendo reemplazo.',
    'Jean mom azul': 'El que mejor me queda.'
  };

  function build() {
    var CU = global.ColorUtil || (typeof ColorUtil !== 'undefined' ? ColorUtil : null);
    var now = Date.now();
    return ITEMS.map(function (row, i) {
      var name = row[0], category = row[1], hex = row[2];
      var seasons = row[3], occasions = row[4], favorite = row[5], worn = row[6];
      var info = CU ? CU.colorInfo(hex) : { hex: hex, name: 'Color', family: 'otro', neutral: false };
      var palette = [hex];
      if (name === 'Vestido floral') palette = [hex, '#4F7A4A', '#EFE3CC'];
      if (name === 'Camisa de jean celeste') palette = ['#9BC4DD', '#4E6E9E'];
      return {
        id: 'demo-' + (i + 1),
        name: name,
        category: category,
        color: { hex: hex, name: CU ? info.name : 'Color', family: info.family, neutral: info.neutral },
        palette: palette,
        photo: null,
        demo: true,
        seasons: seasons,
        occasions: occasions,
        favorite: !!favorite,
        notes: NOTES[name] || '',
        wornCount: worn,
        lastWorn: worn ? now - Math.round((i % 9) + 1) * DAY : null,
        createdAt: now - (ITEMS.length - i) * DAY,
        updatedAt: now - (ITEMS.length - i) * DAY
      };
    });
  }

  function looks() {
    var now = Date.now();
    return [{
      id: 'demo-look-1',
      title: 'El de todos los días',
      reason: 'Blanco + jean azul: la combinación que nunca falla. La campera de jean le suma abrigo sin perder el aire casual.',
      itemIds: ['demo-11', 'demo-1', 'demo-18', 'demo-8'],
      query: 'algo cómodo para la facu',
      createdAt: now - 2 * DAY,
      wornAt: now - 2 * DAY,
      demo: true
    }];
  }

  global.Sample = {
    wardrobe: function () { return build(); },
    looks: looks
  };
})(typeof window !== 'undefined' ? window : globalThis);
