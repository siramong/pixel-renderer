# Pixel Renderer

El frontend solo renderiza el display pixelado. Toda la lógica de estado vive en el backend, que lee la ventana activa de Windows y la traduce a un estado visual según un mapa editable.

## Qué usa

- [backend/server.js](backend/server.js) consulta la ventana activa y publica el estado actual.
- [backend/window-map.json](backend/window-map.json) define las reglas editables por proceso o título.
- [frontend/src/App.jsx](frontend/src/App.jsx) solo monta el display.

## Estados por defecto

- `code.exe` -> `CODING`
- `Capcut` -> `EDITING`
- `Roblox Studio` -> `TESIS`

## Uso

```bash
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

Si quieres un arranque tipo produccion en un solo proceso, primero genera el frontend y luego inicia el backend:

```bash
npm run build
npm start
```

En ese modo, el backend sirve tambien el frontend compilado desde `frontend/dist`, asi que todo corre desde un solo puerto.

## API

- `GET /api/status` devuelve el estado actual.
- `GET /api/streamdeck/button` devuelve estado + URL del icono local para Stream Deck.
- `GET /api/streamdeck/button.svg` devuelve el boton renderizado en SVG (icono con color del estado actual).
- `GET /api/window-map` devuelve el mapa cargado.
- `GET /health` devuelve health check.

## Boton custom local para Stream Deck

Si quieres usar este proyecto como fuente de un boton dinamico local:

1. Inicia backend en tu PC.
2. Usa esta URL de imagen dinamica:
	- `http://localhost:3050/api/streamdeck/button.svg`
3. Si tu flujo/plugin necesita metadata del estado + URL calculada:
	- `http://localhost:3050/api/streamdeck/button`

Opciones de query en `button.svg`:

- `size`: tamano del boton entre `32` y `512` (default `72`).

El boton Stream Deck ahora se renderiza en modo fijo: icono centrado con glow y sin texto.

Ejemplos:

- `http://localhost:3050/api/streamdeck/button.svg?size=72`
- `http://localhost:3050/api/streamdeck/button.svg?size=144`

## Editar el mapa

Modifica [backend/window-map.json](backend/window-map.json) para cambiar procesos, títulos, colores, iconos o agregar nuevas reglas. El backend recarga el archivo automáticamente.
