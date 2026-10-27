# Segmented

Selector de una sola opción para rangos de fechas, unidades y métricas de zona.

- Props: `options` (`[{value, label}]` o cadenas), `value`, `onChange(value)` y `label` (nombre accesible del grupo).
- De 2 a 4 opciones cortas. Si hay más, usa `Chip`.
- La opción activa usa `bg-400` sobre `bg-100`.
