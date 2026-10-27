# StateBlock

Estado de carga, vacío o error de un bloque, con título, causa y acción. `Skeleton` cubre la carga con forma conocida.

- Props: `kind` (`loading`, `empty` o `error`), `title`, `detail` y `action`. `Skeleton`: `height`, `width` y `radius`.
- Un vacío explica la causa y ofrece la salida («Restablecer filtros»). Un error dice qué falló y si se perdió algo.
- Usa `Skeleton` cuando sepas la forma del contenido (detalle de actividad, resultado de herramienta).
