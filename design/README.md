CycleLab es una app de escritorio para macOS (React + TypeScript + Electron) para analizar entrenamientos de ciclismo sincronizados desde Garmin, con un entrenador IA que responde con gráficas y tablas. La interfaz es oscura, precisa y deportiva: los datos son los protagonistas y el resto da un paso atrás.

Todos los datos de ejemplo de este sistema (atleta, actividades, puertos, fechas de las marchas) son **ficticios** y se marcan en la interfaz con el badge `Datos de demostración`.

## Principios

- **Gráfico primero.** Cada pantalla tiene un gráfico principal. Las cifras sirven para leerlo, no para competir con él.
- **Un color por magnitud.** Potencia, frecuencia cardíaca, cadencia y zonas tienen su propio color y no lo prestan a nada más.
- **Superficies planas y filetes.** Las secciones se separan con `line` de 1px y un solo nivel de `Panel`. Sin gradientes decorativos, sin sombras salvo en capas flotantes y sin tarjetas dentro de tarjetas.
- **Escritorio denso pero con aire.** Ventana de referencia de 1440 × 900, barra lateral fija de `sidebar-width` y contenido con `flex: 1`.

## Tono y textos

- La interfaz está en español de España. Tutea al usuario («Tu CTL ha subido…», «Marca dos para comparar»).
- Títulos y botones en mayúscula inicial, nunca en mayúsculas completas. Las mayúsculas solo aparecen en las etiquetas `label` (con espaciado `.06em`).
- Las cifras llevan su unidad separada por un espacio: `275 W`, `3,44 W/kg`, `172 ppm`, `91 rpm`, `1.263 kJ`, `46,3 km`. Usa coma decimal y punto de miles (`es-ES`).
- Las duraciones de actividad se escriben `h:mm:ss` (`1:41:13`). Las duraciones de esfuerzo se escriben en palabras cortas (`5 min`, `20 min`, `4 h`).
- Vocabulario fijo: *Potencia normalizada (NP)*, *IF*, *TSS*, *Fitness (CTL)*, *Fatiga (ATL)*, *Forma (TSB)*, *FTP*, *Umbral cardíaco (LTHR)*, *VAM*, *W′*.
- El entrenador IA habla en primera persona, con frases cortas, y siempre cita el dato concreto en el que se apoya («252 W frente a 242 W»). Nada de emojis.

## Color

- Fondos por capas: `bg-000` (ventana) → `bg-100` (barra lateral, listas maestras) → `bg-200` (Panel) → `bg-300` (hover) → `bg-400` (seleccionado).
- Texto: `ink` para cifras y títulos, `ink-muted` para etiquetas y unidades y `ink-faint` para metadatos y ejes. Los tres cumplen 4,5:1 sobre las superficies de su nota de uso en ambos temas.
- Marca: el índigo `brand` solo se usa como **relleno** (botón primario, avatar del entrenador, selección en gráficos, temporada actual) y siempre lleva `on-brand` encima. Como trazo o texto sobre una superficie, usa `brand-ink`.
- Magnitudes: `power` (ámbar), `heart` (rosa), `cadence` (celeste), `speed` (menta) y `elevation` (gris, solo como área). Nunca se usan para estados.
- Zonas: de `z1` a `z7` (Coggan para potencia; Friel Z1–Z5c para FC con los mismos colores). Una zona siempre lleva su etiqueta (`Z4`): el color no basta por sí solo.
- Tipos de actividad: Resistencia `z2`, Intervalos `z5`, Ascensión `z4` y BTT `speed`.
- Carga: `fitness` (CTL), `fatigue` (ATL, en línea discontinua) y `form` (TSB, en área).
- Estados: `success`, `warning`, `danger` e `info`, siempre con un icono o una palabra al lado.
- Comparaciones A/B: A en `brand` con línea continua y B en `ink-muted` con línea discontinua. La forma del trazo distingue A y B sin depender del color.

## Tipografía

- `Barlow` (`sans`) para la interfaz, `Barlow Condensed` (`display`) para las cifras y `JetBrains Mono` (`mono`) para ejes, atajos y llamadas a herramientas IA. Se sirven desde Google Fonts.
- Cifras: usa `metric-xl` para una sola cifra protagonista por pantalla, `metric-l` en las filas de cabecera y `metric-m` en el detalle. Usa siempre `tabular-nums`.
- Texto: `title-l` para el título de pantalla, `title-m` para el título del detalle, `title-s` para el título de un Panel, `body` y `body-s` para el texto corrido y las celdas, y `label` en mayúsculas para las etiquetas.

## Espacio, forma y profundidad

- La rejilla es de 4px: `space-4` para el padding de Panel y el hueco entre paneles, `space-6` para el margen de pantalla y `space-8` entre bloques.
- Radios: `radius-sm` para badges, `radius-md` para controles y `radius-lg` para Panel. Los chips y las barras de progreso usan `radius-pill`.
- `shadow-pop` solo se usa en tooltips, el panel IA lateral y los menús.
- Anillo de foco: 2px sólido en `focus` con 2px de separación, en todos los controles.
- Movimiento: 150–220 ms con `ease`. Se desactiva con `prefers-reduced-motion`.

## Gráficos

- `LineChart` y `BarChart` dibujan rejillas horizontales en `line`, ejes en `data-s` y un tooltip `bg-300` con `shadow-pop` que lista cada serie con su muestra de color.
- Los gráficos del análisis de una actividad comparten el cursor (`hoverIndex`) y la selección: arrastrar sobre cualquiera de ellos selecciona un tramo, que se resalta en todos los gráficos y en el mapa.
- El análisis de actividad permite elegir el eje X entre tiempo y distancia. La selección se guarda como rango de índices, así que se conserva al cambiar de eje.
- Teclado en el análisis: ← → recorre los intervalos, ↑ ↓ mueve dentro de la tabla y Esc limpia la selección.
- Mapa: la ruta va en `ink-muted` sobre `bg-100`, con relieve en `line`, agua en `cadence` muy tenue, carreteras en `bg-400`, puntos kilométricos cada 5, 10 o 20 km según la distancia y el tramo seleccionado en `brand-ink`.
- La potencia se dibuja con media de 30 s sobre bandas de zona muy tenues (opacidad 0,06).
- La curva de potencia usa una escala logarítmica de 1 s a 5 h, con marcas en 1 s, 5 s, 15 s, 1 min, 5 min, 20 min, 1 h y 4 h.

## Iconografía

- Iconos de trazo propios de 24 × 24, con trazo de 1,75 y extremos redondeados, en `currentColor`. Son un conjunto provisional: no había un conjunto de iconos de marca del que partir, así que puede sustituirse por Lucide sin cambiar los nombres.
- No hay logotipo: «CycleLab» se compone en `display` a 700.

## Estados

- Carga: `Skeleton` con la forma del contenido; `StateBlock kind="loading"` solo para esperas sin forma conocida.
- Vacío: `StateBlock` con título, una frase de causa y una acción («Restablecer filtros»).
- Error: un banner con `role="alert"` bajo la cabecera para errores globales (sincronización con Garmin) y `StateBlock kind="error"` dentro del bloque de herramienta IA que falló, con «Reintentar».
- Sincronización: `SyncStatus` en el pie de la barra lateral (sincronizado, sincronizando, error y sin conexión).

## Prototipo

`Prototype` reúne las cinco pantallas (Dashboard, Actividades, Rendimiento, Puertos y Entrenador IA), con navegación (⌘1–⌘5), el panel IA lateral (⌘J), filtros, comparaciones, selección de intervalos, estados de sincronización (el segundo intento simula un error 429), cambio de tema y respuestas simuladas del entrenador. No se conecta ni a Garmin ni a OpenRouter.
