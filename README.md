# CycleLab

Aplicación de escritorio para macOS basada en el prototipo de `design/`. Electron, React 18, TypeScript, Vite, ECharts (SVG) y SQLite (`better-sqlite3`).

## Ejecutar

Requisitos: macOS y Node.js 22 o posterior compatible con las dependencias del lockfile.

```sh
npm ci
npm run dev
```

`npm ci` recompila SQLite para Electron. No ejecutes `npm rebuild better-sqlite3` para Node; para restaurar el módulo de Electron usa `npm run postinstall`.

```sh
npm run build
npm run preview
npm run package
```

El último comando genera `dist/mac-arm64/CycleLab.app` en un Mac Apple Silicon (la arquitectura depende del equipo). La aplicación no está firmada ni notarizada.

## Configurar las conexiones

1. Abre **Ajustes**, al pie de la barra lateral.
2. Introduce la **API key de Garmin Connect Personal** y pulsa **Guardar y comprobar**. Cambia a **Mis datos** para iniciar la importación; también puedes usar **Sincronizar ahora**. No se admite una clave del programa empresarial de Garmin.
3. Introduce la **API key de OpenRouter**, compruébala y selecciona expresamente un modelo. El catálogo permite buscar por nombre o proveedor y muestra contexto y precios de entrada/salida por millón de tokens. Comprobar claves y cargar el catálogo no genera inferencias; enviar preguntas sí puede tener coste.
4. Introduce la **API key de MapTiler** en su panel y pulsa **Guardar y comprobar** para activar la cartografía en las actividades con GPS de **Mis datos**. Se consume la cuota de tu cuenta MapTiler.
5. Completa FTP, peso y LTHR si faltan. La demo mantiene su propio perfil, entrenamientos y conversación.

Las claves se cifran con `safeStorage` en el proceso principal, protegido por el llavero de macOS. SQLite guarda únicamente el cifrado. El token temporal de Garmin permanece en memoria. Las claves guardadas nunca se devuelven al renderer; el formulario se vacía tras guardarlas. Desconectar conserva las actividades y conversaciones locales.

La base de datos está en el directorio `userData` de Electron (`~/Library/Application Support/CycleLab` en la aplicación empaquetada; el nombre puede aparecer como `cyclelab` en desarrollo). `CYCLELAB_USER_DATA` permite usar un directorio aislado en pruebas.

## Estructura

- `src/main`: ventana, SQLite, credenciales, HTTP, importación Garmin, herramientas y OpenRouter.
- `src/preload` y `src/shared`: puente IPC con operaciones concretas y contratos tipados. Se validan argumentos y emisor en main.
- `src/domain`: modelos de proveedor, cálculos, comparación de muestras y proyección de rutas; sin React.
- `src/data/demo`: datos deterministas y proveedor simulado del prototipo.
- `src/renderer/components`: controles, estados, tablas, mapa MapLibre (SVG en demo o sin cartografía) y gráficos ECharts con las APIs del diseño.
- `src/renderer/features`: las cinco pantallas y Ajustes. `ChatPanel` se comparte con el panel lateral.
- `src/renderer/styles`: tokens generados de `design/tokens.json`, medidas del prototipo y estilos. Las fuentes se empaquetan desde `@fontsource`.

El renderer no dispone de Node, acceso al disco, SQLite ni credenciales persistidas. Las peticiones a proveedores se realizan en main. El entrenador consulta cinco herramientas sobre los datos locales; envía sus resultados limitados, no todo el histórico ni las coordenadas GPS. Se permiten como máximo cinco rondas de herramientas y una respuesta final sin herramientas. Cada respuesta conserva el modelo utilizado.

## Datos reales y límites

- Se pagina todo el ciclismo, incluidos subtipos y etapas de multideporte, en orden ascendente. Se guardan los resúmenes antes de descargar FIT y se persiste el avance. Los identificadores de Garmin impiden duplicados y las importaciones simultáneas se agrupan.
- El token se renueva antes de caducar y se reintenta una vez tras un 401. Los 429/5xx tienen reintentos acotados y respetan `Retry-After`; las esperas superiores a 30 segundos se muestran como error recuperable para reintentar más tarde.
- Un FIT no disponible deja el resumen consultable. Los fallos de descarga no eliminan lo ya guardado. Las rutas con GPS parcial conservan los índices de selección originales.
- Las métricas ausentes se muestran como desconocidas. La carga se calcula únicamente si el histórico importado contiene TSS, y comienza desde CTL/ATL cero; por tanto se señala como cálculo sobre cobertura limitada. Las curvas reales se agrupan por año natural. No se ajusta un modelo de potencia crítica a los datos reales.
- Puertos muestra los segmentos marcados manualmente como puertos y sus resultados GPS. No se asignan nombres de puertos automáticamente ni se crean recorridos ficticios. La herramienta del entrenador para comparar ascensiones sigue usando el catálogo original y aún no consulta los resultados de segmentos. Los objetivos solo pertenecen a la demo.
- Sin red puedes consultar entrenamientos y conversaciones ya guardados. Sincronizar y preguntar al entrenador real requieren conexión. Un error real nunca produce una respuesta simulada.

Las conexiones reales requieren prueba con tus claves. Los tests usan respuestas controladas y archivos FIT generados; no acreditan que tu cuenta tenga acceso a todo su histórico ni a todos los modelos.

Documentación de proveedores: [autenticación Garmin Personal](https://developer.garmin.com/gc-developer-program/personal/personal-faq/), [contratos Garmin](https://developer.garmin.com/gc-developer-program/personal/swagger-docs/), [catálogo OpenRouter](https://openrouter.ai/docs/guides/overview/models), [herramientas OpenRouter](https://openrouter.ai/docs/guides/features/tool-calling).

## Verificación

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npx playwright install chromium
npm run test:visual
```

Las pruebas Electron usan bases temporales. Cubren navegación, teclado, intervalos, comparación, chat, ajustes, aislamiento, validación IPC, funcionamiento local y persistencia tras reiniciar. Las unitarias cubren cálculos y valores ausentes, FIT, paginación, renovación, reanudación, duplicados, fallos HTTP, catálogo y límite de herramientas.

La comparación visual abre el prototipo original en Chromium y la aplicación real en Electron, ambos a 1440 × 900 y escala 2. Guarda capturas, diferencias y `comparison.json` en `artifacts/visual/`. Incluye cinco pantallas, ambos temas, contenido desplazado, panel IA, selección, comparación y estados vacíos/de sincronización. El prototipo requiere Internet para cargar su React y sus fuentes originales; la aplicación no.

Las diferencias incluyen los controles nativos de ventana (no aparecen en la captura del renderer), Ajustes y el trazado SVG de ECharts. El porcentaje de píxeles distintos es un instrumento de revisión, no una afirmación de equivalencia funcional ni una prueba de fidelidad perfecta. Consulta [VALIDATION.md](VALIDATION.md) para los resultados de esta implementación.

Atajos: ⌘1–⌘6, ⌘J, ←/→ para intervalos y Esc para limpiar. La aplicación respeta `prefers-reduced-motion` y mantiene foco visible.

## Etiquetado automático de actividades

Las actividades Garmin ya no se guardan como «Resistencia» por defecto. La clasificación se calcula localmente, sin llamadas a IA, en este orden:

1. **Intervalos:** vueltas FIT con dos o más bloques activos de 30 s a 30 min y recuperación, o indicación explícita en el nombre (series, intervalos, 4×8, sweet spot…).
2. **BTT, Indoor o Gravel:** subtipo de Garmin, o indicación en el nombre cuando el subtipo no lo especifica.
3. **Ascensión:** nombre explícito o estimación por terreno (≥10 km, ≥600 m de ascenso y ≥25 m de ascenso/km). Es una categoría de sesión, no la detección geográfica de un puerto.
4. **Resistencia:** nombre explícito o estimación con ≥45 min, IF entre 0,55 y 0,80 y NP/potencia media ≤1,12.
5. **Ciclismo:** información insuficiente para asignar las anteriores. No se interpreta la intensidad alta, por sí sola, como trabajo por intervalos.

La ficha muestra el motivo; las reglas basadas en nombres o métricas se identifican como estimaciones. Se conserva el subtipo Garmin original y la evidencia de vueltas estructuradas para las siguientes sincronizaciones. Al abrir esta versión se reclasifica el histórico local una vez, sin tocar la demo. Como la versión anterior no conservaba el subtipo original, **Sincronizar ahora** permite recuperarlo para las actividades antiguas cuyo nombre o muestras no basten. Las nuevas categorías se incluyen en filtros y totales de carga.

### Reetiquetar y consultar todos los años

En **Ajustes → Etiquetas del histórico → Volver a etiquetar todo** puedes repetir la clasificación de todas las actividades Garmin descargadas, sin conexión y sin filtrar por fecha. La operación muestra el número de actividades procesadas y espera a que termine cualquier sincronización activa.

En **Mis datos**, Actividades se abre con **Todo** seleccionado. **30 d / 90 d** solo filtran lo que se ve: no limitan la descarga. El antiguo botón «Temporada» se llama ahora «Todo». Para completar las descargas, usa **Ajustes → Garmin → Sincronizar ahora** y deja terminar la importación de resúmenes y muestras. Se recorren todas las páginas disponibles de Garmin, sin fecha de inicio por temporada.

### Buscar por año o fechas

En **Actividades**, el selector **Año** ofrece los años presentes en el histórico descargado. **Desde** y **Hasta** permiten un rango personalizado: ambos días están incluidos y cualquiera de los extremos puede quedar vacío. Las fechas siguen el mismo calendario UTC usado por las fechas de actividad mostradas en la app.

Elegir un año limpia el rango personalizado; escribir una fecha limpia el año y desactiva los accesos rápidos. **30 d**, **90 d**, **Todo** y **Limpiar fechas** sustituyen los filtros de fecha sin borrar el texto de búsqueda ni la selección de tipos. Los contadores de los tipos respetan el periodo seleccionado. Un rango invertido muestra un mensaje para corregirlo. **Restablecer filtros** limpia todos los filtros.

### Intervalos sin etiquetas de trabajo/recuperación

El clasificador también analiza la potencia media y la duración de las vueltas, aunque Garmin las identifique simplemente como `lap`. Busca al menos tres esfuerzos alternados con recuperaciones: bloques de 1–20 minutos con duración dentro de ±20 % y potencia dentro de ±12 % del primer esfuerzo; recuperaciones de al menos 20 segundos, como máximo el doble del esfuerzo (hasta 10 minutos), y potencia no superior al 60 % de los esfuerzos adyacentes. Los bloques de calentamiento y enfriamiento pueden quedar fuera del patrón.

La ficha explica cuántas repeticiones se encontraron, su duración y potencia media y la de las recuperaciones. Se marca como estimación: el patrón no demuestra por sí solo la intención del entrenamiento. No depende del FTP actual, que puede ser diferente del que tenía el atleta cuando hizo la actividad.

La evidencia se conserva al actualizar resúmenes desde Garmin. La revisión 2 del clasificador vuelve a etiquetar el histórico automáticamente al abrir la nueva versión y también mediante «Volver a etiquetar todo». Este detector requiere vueltas con potencia: no segmenta todavía una señal continua sin vueltas ni cubre todos los protocolos piramidales o microintervalos.

### Segmentos manuales

En Actividades, arrastra sobre un gráfico (o selecciona una vuelta con el teclado), escribe el nombre del tramo y pulsa **Guardar segmento**. En **Segmentos** aparecen sus métricas, perfil de elevación y ubicación resaltada, con acceso a la actividad y eliminación confirmada. Se guardan en SQLite por origen: demo y Garmin no se mezclan. Los valores desconocidos se conservan como tales. Al crear un segmento se buscan sus pasos en todo el histórico local del mismo origen y se guardan los resultados.

La base de datos se migra a la versión 4 conservando actividades, conversaciones y credenciales. Después de abrir esta versión, utiliza esta compilación o una posterior; las compilaciones antiguas rechazan la nueva versión de la base de datos.

### Segmentos y puertos

Segmentos muestra todos los tramos guardados. **Marcar como puerto** hace que el mismo segmento aparezca también en Puertos; **Quitar marca de puerto** conserva el tramo y lo retira de esa vista. La marca persiste por origen; los segmentos existentes comienzan sin marcar. Atajos: ⌘4 Segmentos, ⌘5 Puertos y ⌘6 Entrenador IA.

### Resultados históricos de segmentos

La búsqueda se ejecuta en segundo plano al crear un segmento, al abrir segmentos antiguos y después de sincronizar. El panel Resultados muestra progreso, cobertura, fecha (con año), tiempo transcurrido, potencia, FC, cadencia y acceso a la actividad. Incluye varios pasos en la misma actividad, guarda los resultados en SQLite y permite volver a buscar. Las búsquedas interrumpidas se reinician al abrir la app; un error conserva los resultados previos y permite reintentar.

Se compara el trazado completo en orden y en el mismo sentido, no solo los extremos. La referencia necesita al menos 100 m de GPS continuo; se rechazan huecos de más de 30 s o saltos de más de 200 m en el tramo. Se remuestrea cada 20 m y se aplica una tolerancia espacial de 35 m, con comprobación de longitud. Los tiempos corresponden a las muestras más próximas al inicio y final: son aproximados. La tolerancia puede confundir caminos paralelos muy cercanos y omitir pasos con GPS degradado. No se envían coordenadas a servicios externos. No se inventan coincidencias para actividades sin GPS; el resultado original sigue disponible.

La tabla de resultados se ordena pulsando Fecha, Actividad, Tiempo, Potencia, FC o Cadencia. Cada pulsación alterna ascendente/descendente; la flecha muestra el orden activo. Los valores desconocidos aparecen siempre al final. Las cabeceras también funcionan con teclado.

### Cartografía MapLibre + MapTiler

En **Ajustes → MapTiler** puedes guardar, comprobar, cambiar y desconectar la clave. El mapa usa Outdoor v4 en claro y su variante oscura, con atribución a MapTiler y OpenStreetMap. Actividades, Segmentos y Puertos comparten el mapa; la demo mantiene el trazado del prototipo.

Puedes acercar, desplazar, ajustar la vista y colorear el recorrido por potencia absoluta, pendiente entre muestras o velocidad. El cursor de Actividades se sincroniza con los gráficos. **Seleccionar tramo** permite marcar inicio y final con dos clics sobre la ruta y guardar el segmento con el formulario existente; Esc cancela. La selección por teclado sigue disponible desde los gráficos y vueltas.

Todas las descargas de estilos, fuentes, sprites y tiles pasan por IPC validado al proceso principal. La clave se guarda cifrada con `safeStorage` y se elimina de las URLs antes de devolver recursos al renderer. La caché es temporal, en memoria, y respeta las cabeceras del proveedor; no se descargan zonas offline. Sin clave o ante un error, se conserva la vista esquemática y el análisis local. MapTiler recibe las peticiones de los tiles de la zona visible; no se sube el fichero de la actividad ni sus métricas.

La pendiente usa diferencias entre muestras y puede ser ruidosa; los datos ausentes se dibujan en gris. No se añaden planificación de rutas, satélite, relieve 3D ni detección automática de puertos. Documentación: [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), [API de MapTiler](https://docs.maptiler.com/cloud/api/reference/).
