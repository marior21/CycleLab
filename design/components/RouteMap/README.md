# RouteMap

Recorrido esquemático en SVG, con tramo resaltado, cursor sincronizado e inicio y fin.

- Props: `points` (`[[x, y]]` en metros, proyectados), `height`, `highlight` (`[i0, i1]`), `zoomToHighlight`, `cursor` (índice), `markers` (`[{index, label}]`, puntos kilométricos), `scale` (barra de escala y norte), `features`, `caption` y `ariaLabel`.
- `features` dibuja el contexto bajo la ruta, en las mismas coordenadas: `sea` (polígono), `coast`, `water` (río), `road`, `track` (pista), `contour` y `contour-major` (curvas de nivel), `label` (`{at, label, major, anchor}`) y `peak` (cima con su cota). Las etiquetas se giran solas si se salen del mapa, y la población principal (`major`) va encima de su punto.
- Sin `features`, se dibuja una rejilla neutra.
- En el prototipo, el relieve, la costa y las poblaciones son ilustrativos. En producción se sustituye por MapLibre con un estilo oscuro sobrio, manteniendo los colores de trazo (`ink-muted` para la ruta y `brand-ink` para el resaltado).
- Inicio en `success` y fin en `danger`.
