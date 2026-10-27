# Metric

Cifra con etiqueta, unidad y una línea secundaria opcional con la variación respecto a una referencia.

- Props: `label`, `value`, `unit`, `size` (`l`, `m` o `s`), `accent` (token de la magnitud), `delta`, `deltaUnit`, `deltaFormat`, `lowerIsBetter` y `sub`.
- La variación se colorea según sea mejor o peor (`lowerIsBetter` para tiempos y fatiga) y lleva siempre ▲ o ▼.
- En filas de cabecera, coloca las métricas en una tira con `line` de separación vertical, no en tarjetas sueltas.
- `accent` solo cuando la cifra es de una magnitud con color propio.
