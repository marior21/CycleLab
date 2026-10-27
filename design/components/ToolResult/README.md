# ToolResult

Bloque que muestra la llamada a una herramienta de análisis y su resultado visual dentro de la respuesta del entrenador.

- Props: `tool` (nombre de la función), `args` (texto de argumentos), `status` (`running`, `done` o `error`), `meta` (filas, tiempo), `title` y `children` (un gráfico, una tabla o un `StateBlock`).
- Mientras está en `running`, muestra un `Skeleton` con la forma del resultado. En `error`, muestra un `StateBlock kind="error"` con «Reintentar».
- Herramientas del prototipo: `buscar_actividades`, `analizar_intervalos`, `comparar_ascensiones`, `curva_potencia` y `carga_entrenamiento`.
