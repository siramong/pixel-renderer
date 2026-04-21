# Stream Deck Plugin (Local)

Plugin local para Stream Deck que usa tu API en `http://127.0.0.1:3050` y actualiza la key con icono centrado + glow del estado actual.

## Estructura

- `src/main.js`: runtime del plugin (WebSocket con Stream Deck + polling API local)
- `com.pixelrenderer.localstatus.sdPlugin/manifest.json`: manifiesto del plugin
- `com.pixelrenderer.localstatus.sdPlugin/imgs/`: iconos del plugin
- `com.pixelrenderer.localstatus.sdPlugin/dist/plugin.exe`: ejecutable compilado para Windows

## Build

Desde `streamdeck-plugin`:

```powershell
npm install
npm run build:win
```

## Instalacion local

1. Copia la carpeta completa `com.pixelrenderer.localstatus.sdPlugin` a:

`%APPDATA%\\Elgato\\StreamDeck\\Plugins\\`

2. Reinicia la app de Stream Deck.
3. Busca la categoria `Pixel Renderer` y arrastra la accion `Estado Local` a una key.

## Requisitos

- Tu backend debe estar corriendo en `http://127.0.0.1:3050`
- Endpoint usado por el plugin:
  - `GET /api/streamdeck/button.svg?size=144`

## Notas

- Si la API local no responde, la key mostrara `OFF`.
- Puedes editar defaults (`apiBase`, `size`, `pollMs`) en `src/main.js`.
