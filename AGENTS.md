# AGENTS.md — CycleLab

## Qué es
CycleLab es una app de escritorio para macOS que sirve para analizar entrenamientos de ciclismo sincronizados desde Garmin. Incluye un entrenador IA (vía OpenRouter) que responde con gráficas y tablas.
La app real ya está implementada. Evoluciona sus funciones siguiendo `ROADMAP.md` y el sistema visual de `design/`; el prototipo conserva las cinco pantallas originales.

## Stack
- Electron + React 18 + TypeScript, empaquetado con Vite (por ejemplo, electron-vite).
- Gráficos ECharts con renderer SVG y APIs del diseño; reutiliza los componentes existentes.
- Mapa: MapLibre + MapTiler para datos reales, con recursos por IPC; `RouteMap` simulado en demo y como alternativa sin cartografía.

## Fuente de verdad del diseño (`design/`)
Léelo en este orden antes de escribir código:
1. `design/README.md`: reglas del sistema (color, tipografía, tono de textos, formato de cifras, gráficos y estados). Es obligatorio cumplirlas.
2. `design/tokens.json`: todos los valores. Genera a partir de él las variables CSS (`--bg-000`, `--brand`…) para los temas `dark` (por defecto) y `light`, con `data-theme` en `<html>`. No escribas colores ni medidas a mano en los componentes.
3. `design/components/index.d.ts`: la API (props) de cada componente. Mantén los mismos nombres y props.
4. `design/components/<Comp>/README.md`: la guía de uso de cada componente.
5. `design/prototype.html`: el prototipo completo, que funciona sin servidor (ábrelo en un navegador). Es la referencia visual y de comportamiento: pantallas, atajos, filtros, selección de intervalos, comparaciones, panel IA, y estados de carga, error y sincronización.

Material de referencia, que no se copia tal cual:
- `design/components/bundle.js` y `bundle.css` son la implementación del prototipo, en JS plano con `React.createElement`. Úsalos para entender el comportamiento y los detalles visuales, y reescríbelos en TSX tipado con CSS Modules (o CSS con las variables de los tokens).
- `design/components/Prototype/preview.html` contiene la lógica de las pantallas, los datos de demostración y el entrenador IA simulado. Úsalo como guía para la estructura de pantallas y la capa de datos.
- Los `preview.html` de cada componente son fragmentos pensados para el visor del sistema de diseño y no se abren solos. Para verlos funcionando, usa `prototype.html`.

## Orden de trabajo
1. Scaffold de Electron + React + TS. Ventana de 1440 × 900 (mínimo 1200 × 760), barra de título oculta con los botones de ventana de macOS integrados en la barra lateral, y modo oscuro por defecto.
2. Tokens → CSS, fuentes (Barlow, Barlow Condensed y JetBrains Mono, empaquetadas en local, no desde Google Fonts) y selector de tema.
3. Componentes base: Icon, Button, Segmented, Chip, Badge, Metric, Progress, Panel, Sidebar, SyncStatus, StateBlock, Skeleton.
4. Gráficos y datos: LineChart, BarChart, Legend, ZoneBar, RouteMap, DataTable.
5. Pantallas, en el orden del prototipo: Dashboard, Actividades, Rendimiento, Segmentos, Puertos y Entrenador IA, más Ajustes, el panel IA lateral (⌘J) y la navegación ⌘1–⌘6.
6. Capa de datos detrás de interfaces: `GarminSource` y `CoachProvider`. Implementaciones reales Garmin Personal y OpenRouter, además de la demo aislada. Claves cifradas con `safeStorage` y nunca devueltas al renderer.

## Reglas
- Los textos de la interfaz van en español de España, tal como aparecen en el prototipo.
- Los datos de demostración se marcan siempre con el badge «Datos de demostración» mientras sean ficticios.
- El renderer trabaja con `contextIsolation: true` y `nodeIntegration: false`, y todo el acceso a red y a disco pasa por un `preload` con IPC tipado.
- Accesibilidad: foco visible (anillo `focus`), navegación con teclado como en el prototipo (← → para intervalos y Esc para limpiar) y contraste según el README.
- Respeta `prefers-reduced-motion`.

## Validación
Después de cada fase, la app debe arrancar sin errores en consola, el lint y el typecheck deben pasar, y cada pantalla terminada debe compararse con `design/prototype.html` en ambos temas.
