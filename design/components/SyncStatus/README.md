# SyncStatus

Estado de la sincronización con Garmin Connect. Al pulsarlo, se sincroniza.

- Props: `state` (`synced`, `syncing`, `error` u `offline`), `detail`, `title` (sustituye el texto por defecto) y `onClick`.
- Mientras sincroniza está desactivado y muestra un icono giratorio en `info`.
- Un error también debe mostrarse como banner con `role="alert"` en la cabecera, con «Reintentar».
