# Mi Placard

App web instalable (PWA) para gestionar el guardarropa y pedir looks con la ropa que ya tenés.

**Abrir la app:** https://wlacaze-git.github.io/mi-placard/

## Qué hace

- Cargar prendas con foto (se comprime y detecta el color sola).
- Ver el placard agrupado por categoría, buscar por nombre o color y filtrar.
- Pedir un look como se habla: “quiero usar algo verde para salir”, “un jean para la facu”, “hace frío”.
- La app propone 3 combinaciones completas y explica por qué combinan.
- Guardar looks, registrar “Me lo pongo” y ver el historial.
- Funciona sin conexión y se instala en el celular.
- Backup/exportación desde Ajustes.

## Privacidad

Las fotos y los datos se guardan **solo en el dispositivo**, en IndexedDB. No hay cuentas, servidores ni analítica.

## Instalación en el celular

1. Abrir el link en el celular.
2. Android: menú ⋮ → **Instalar app**. iPhone: Compartir → **Agregar a pantalla de inicio**.

## Desarrollo

Es una app estática, sin build: `index.html`, `styles.css` y `js/*.js`. Se puede servir con cualquier servidor estático, por ejemplo:

```bash
npx serve .
```

El código fuente completo y las pruebas viven en el proyecto local (esta publicación es el build de `dist`).
