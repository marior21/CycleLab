# ChatMessage

Mensaje del chat del entrenador IA: burbuja del usuario a la derecha y respuesta del entrenador a todo el ancho con avatar.

- Props: `role` (`user` o `assistant`) y `children`.
- La respuesta del entrenador puede contener uno o varios `ToolResult` seguidos de un párrafo de conclusión.
- El texto del entrenador cita siempre las cifras en las que se basa.
