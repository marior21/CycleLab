# Button

Botón de acción con tres variantes: `primary` (índigo), `secondary` y `ghost`.

- Props: `variant` (`primary`, `secondary` o `ghost`), `size` (`md` o `sm`), `icon`, `iconRight`, `children` y cualquier atributo de `<button>`.
- Solo un `primary` por vista: la acción que lleva al análisis (abrir el entrenador IA, comparar cuando hay dos marcadas, enviar).
- `ghost` se usa para acciones de cabecera de Panel («Ver todas», «Limpiar selección»).
- Un botón que solo tiene icono necesita `aria-label`.
