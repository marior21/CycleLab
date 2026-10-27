# Sidebar

Barra lateral fija de `sidebar-width` con la marca, la navegación principal y el pie de sincronización.

- Props: `items` (`[{id, label, icon, shortcut}]`), `active`, `onSelect(id)`, `header`, `footer` y `children`.
- Va siempre fija arriba (`position: sticky`) y con la altura completa de la ventana. El contenido de la derecha usa `flex: 1`.
- El ítem actual usa `bg-400` y su icono en `brand-ink`.
- En Electron, reserva la parte superior de `header` para los semáforos de macOS (`titleBarStyle: hiddenInset`).
