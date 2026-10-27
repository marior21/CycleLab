# LineChart

Gráfico de líneas y áreas en SVG con tooltip, eje secundario, escala logarítmica, bandas, líneas de referencia y selección por arrastre.

- Props: `data` (filas), `x` (clave del eje X), `series` (`[{key, label, color, unit, axis: 'left'|'right', area, dash, width, format}]`), `height`, `xType` (`linear` o `log`), `xTicks`, `xFormat`, `yFormat`, `yDomain`, `zeroBased`, `bands`, `refLines`, `legend` y `tooltipTitle`.
- Interacción: `onSelect([x0, x1] | null)` activa el arrastre y `selection` lo pinta. `hoverIndex` + `onHover(i)` sincronizan el cursor entre varios gráficos.
- Memoriza `data` en el consumidor (`useMemo`). El gráfico ocupa todo el ancho de su contenedor.
- Usa como mucho dos ejes y cuatro series. Para comparar A/B, usa `dash` en la serie B.
