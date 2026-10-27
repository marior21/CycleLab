# BarChart

Gráfico de barras, simples o apiladas, con una línea opcional en el eje derecho.

- Props: `data`, `x`, `series` (apila si hay más de una), `line` (`{key, label, color, unit, zeroBased}`), `height`, `xFormat`, `yFormat`, `legend`, `tooltipTitle` y `onBarClick(row, i)`.
- Úsalo para carga semanal por tipo, potencia por serie o tiempo por zona a lo largo del tiempo.
- Una fila puede forzar su color con `_color`.
