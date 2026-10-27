# DataTable

Tabla densa con cabecera fija, selección de fila y casillas opcionales para comparar.

- Props: `columns` (`[{key, label, align, width, render(row)}]`), `rows`, `rowKey` (`id` por defecto), `selected`, `onSelect(key, row)`, `checked`, `onCheck(key)`, `compact`, `maxHeight`, `empty`, `selectOnFocus` y `onEscape`.
- Alinea las cifras a la derecha, con unidad y `tabular-nums`.
- Teclado: la tabla tiene una sola parada de tabulación (la fila seleccionada o la primera). Con ↑ ↓, Inicio y Fin se mueve el foco; con `selectOnFocus` también se selecciona la fila. Intro y Espacio seleccionan, y Esc llama a `onEscape`.
- Limita la comparación a dos filas (`slice(-2)`) y activa el botón «Comparar» solo cuando hay dos marcadas.
