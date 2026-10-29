# Validación de CycleLab — 27 de octubre de 2026

## Comprobaciones ejecutadas

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm test`: 58 pruebas unitarias correctas (cálculos, FIT, proveedores, sincronización y herramientas).
- `npm run test:e2e`: 4 recorridos Playwright sobre Electron correctos; navegación, filtros, selección por teclado, eje tiempo/distancia, comparación A/B, chat, estados de carga/error, ajustes, reinicio, consulta local sin conexión y aislamiento IPC. Sin errores de página en el recorrido principal.
- `npm run package`: aplicación macOS arm64 generada con SQLite nativo.
- `node scripts/smoke-package.mjs`: comprueba el ejecutable empaquetado, SQLite, cifrado/descifrado de un valor de prueba mediante safeStorage y persistencia del perfil tras reiniciar.
- `npm audit`: sin vulnerabilidades conocidas en la instalación utilizada.

## Comparación con el diseño

`npm run test:visual` captura el prototipo sin modificar y Electron a 1440 × 900, escala 2. Pixelmatch usa umbral 0,15 y excluye sus diferencias de antialiasing por defecto. Se revisaron las capturas para corregir medidas, fuentes, ancho útil, formato de cifras y zonas.

| Captura | Píxeles distintos |
|---|---:|
| dashboard-dark | 1.58 % |
| dashboard-dark-bottom | 1.23 % |
| activities-dark | 1.48 % |
| activities-dark-bottom | 0.63 % |
| performance-dark | 0.35 % |
| performance-dark-bottom | 0.29 % |
| climbs-dark | 0.52 % |
| climbs-dark-bottom | 0.93 % |
| coach-dark | 0.66 % |
| drawer-dark | 1.02 % |
| dashboard-light | 1.58 % |
| dashboard-light-bottom | 1.24 % |
| activities-light | 1.46 % |
| activities-light-bottom | 0.66 % |
| performance-light | 0.45 % |
| performance-light-bottom | 0.38 % |
| climbs-light | 0.66 % |
| climbs-light-bottom | 1.07 % |
| coach-light | 0.68 % |
| drawer-light | 1.00 % |
| selection-light | 2.47 % |
| empty-filter-light | 2.16 % |
| comparison-light | 1.55 % |
| comparison-light-bottom | 0.72 % |
| sync-loading-light | 0.70 % |
| sync-error-light | 0.75 % |

Los PNG de aplicación, referencia y diferencia están en `artifacts/visual/`. Se regeneran con el script y no se incluyen en Git. Las capturas de Ajustes no tienen una referencia original: esta pantalla se ha añadido con los componentes y tokens existentes.

Diferencias conocidas: los controles nativos de macOS no se capturan en el contenido de la ventana; Ajustes añade una fila al pie de la barra lateral; ECharts tiene diferencias de trazado y separación de barras frente al SVG original. El mapa conserva su representación sin tiles. El entrenador simulado consulta las herramientas locales y produce textos deterministas, no reproduce palabra por palabra las respuestas del prototipo.

## Pendiente de validar con la cuenta del usuario

No se han utilizado claves reales de Garmin ni OpenRouter, ni se ha realizado ninguna inferencia de pago. Deben probarse la autenticación de esas cuentas, el histórico disponible, sus límites de servicio y una pregunta con el modelo elegido desde Ajustes. La prueba FIT utiliza un archivo sintético válido, no un entrenamiento descargado de la cuenta.

No se han implementado mapas con tiles, detección geográfica de puertos, firma ni notarización, tal como queda fuera del alcance. No se ha hecho una auditoría externa de accesibilidad ni una prueba de rendimiento con un histórico real de muchos años.

## Corrección de autenticación Garmin

La respuesta observada del intercambio de clave es un JWT en texto plano. El cliente intentaba deserializarla siempre como JSON. Ahora admite texto plano, cadena JSON y el sobre JSON previo; valida el formato y convierte los errores de lectura en un mensaje que no incluye el token.

Validación de la corrección: lint y typecheck; 29 pruebas unitarias; prueba Playwright específica de «Guardar y comprobar» con respuesta JWT de texto plano, cifrado local, formulario vacío al cambiar clave y desconexión. No se ha utilizado la clave real del usuario. El paquete corregido se genera en `dist/garmin-fix/mac-arm64/CycleLab.app`, manteniendo intacta la aplicación que estaba abierta.

## Corrección del etiquetado automático

Se elimina el valor predeterminado «Resistencia» de Garmin y se añade clasificación local explicable a partir de subtipo, nombre, vueltas estructuradas y métricas. La migración del histórico se ejecuta en una transacción y se limita al origen Garmin. Pruebas unitarias de prioridades, datos ausentes, vueltas automáticas frente a estructuradas y totales semanales; prueba Electron de reclasificación tras reiniciar, filtros y explicación visible en ambos temas. Paquete: `dist/auto-tags/mac-arm64/CycleLab.app`.

Los umbrales de clasificación son heurísticas explícitas, no una clasificación oficial de Garmin ni un análisis fisiológico validado con el histórico del usuario.

## Histórico completo y reclasificación manual

Se añade la operación IPC `reclassifyActivities` y el botón «Volver a etiquetar todo», que reutilizan la misma transacción de reclasificación del arranque. Actividades abre «Mis datos» con «Todo» seleccionado y sustituye la etiqueta confusa «Temporada».

Validado con lint, typecheck, 47 pruebas unitarias y 4 recorridos Electron. La prueba de importación recorre páginas con actividades de 2012, 2019 y 2026; la prueba de interfaz incluye actividades guardadas de 2018 y 2021, cambia entre «90 d» y «Todo», vuelve a etiquetar sin reiniciar y comprueba el contador y la clasificación en SQLite. Paquete actualizado: `dist/full-history/mac-arm64/CycleLab.app`. No se ha comprobado la cobertura completa de la cuenta real del usuario.

## Filtros por año y fechas

Se añade el selector de año del histórico y los campos Desde/Hasta, con límites inclusivos, extremos opcionales y validación de fechas/rangos invertidos. La lógica de fechas vive en `src/domain/activityFilters.ts` y se comparte entre la lista y los contadores por tipo. No se modifica la importación ni se limita el histórico almacenado.

Pruebas unitarias de año completo, final del día, rangos abiertos, fechas imposibles y accesos rápidos; recorrido Electron con actividades de distintos años, combinación con nombre, limpieza de filtros y capturas en ambos temas. La interfaz añade los controles usando los tokens existentes. Paquete: `dist/date-filters/mac-arm64/CycleLab.app`.

## Detección de intervalos por potencia de vueltas

Se verificó en modo de solo lectura la última actividad Garmin guardada localmente: todas las vueltas tenían `kind: lap`. El detector nuevo identificó cuatro esfuerzos de 242 s de media, 312 W, con recuperaciones intermedias de 42 W, y devolvió `intervals`. No se modificó la base del usuario ni se consultaron credenciales para esa comprobación.

Validación: lint, typecheck y 58 pruebas unitarias; nuevo recorrido Electron de migración desde la revisión 1 del clasificador, explicación de la detección en ambos temas y reclasificación manual. Los casos negativos incluyen potencia constante, cuestas de duración irregular, menos de tres repeticiones, datos ausentes y pausas largas. La prueba de sincronización confirma que la evidencia no se pierde al refrescar resúmenes. Paquete: `dist/power-intervals/mac-arm64/CycleLab.app`.

La clasificación por patrón es una heurística explicable, no una garantía de intención de entrenamiento. No se ha validado manualmente todo el histórico ni se han añadido detección continua sin vueltas o reconocimiento de todos los protocolos de intervalos.

## Creador de segmentos manuales (27/10/2026)

- Lint y typecheck correctos; 60 pruebas unitarias y 6 pruebas Playwright/Electron superadas.
- Nueva cobertura: validación de límites/nombres, métricas del tramo y datos ausentes; creación desde selección por teclado, IPC con índices inválidos, persistencia tras reiniciar, aislamiento demo/Garmin y eliminación confirmada.
- Capturas del nuevo panel revisadas en oscuro y claro (`test-results/segments-dark.png`, `test-results/segments-light.png`). Componentes y tokens existentes reutilizados.
- Compilación macOS ARM64 en `dist/segments/mac-arm64/CycleLab.app`. Sin conexiones reales nuevas ni cambios en las credenciales del usuario.
- Límite: selección manual vinculada a una actividad, sin detección de coincidencias GPS entre actividades. Migración SQLite a versión 3; las versiones anteriores de la aplicación no abren este esquema.
- Ejecutado `scripts/visual.mjs`: 26 comparaciones con el prototipo en ambos temas, guardadas en `artifacts/visual/comparison.json`. Las pestañas de segmentos y el formulario de creación son ampliaciones del diseño; no se declara igualdad de píxeles con el prototipo original.

## Menús Segmentos y Puertos (27/10/2026)

- Dos entradas de navegación; Puertos filtra los segmentos con `isClimb: true`. Marcar/desmarcar actualiza el mismo registro JSON en SQLite, sin duplicar ni borrar segmentos ni cambiar el esquema.
- Contrato IPC específico con origen, UUID y booleano validados; error recuperable si el segmento ya no existe.
- Los segmentos anteriores sin la propiedad se mantienen como segmentos no marcados. Los ejemplos antiguos de puertos del prototipo dejan de mostrarse como puertos guardados.
- Prueba Electron ampliada: estado vacío, marcar, ver el mismo tramo en ambas vistas, persistencia de la marca al reiniciar, aislamiento de origen, desmarcar sin borrar y navegación ⌘4/⌘5.
- Lint, typecheck y 60 pruebas unitarias correctos. Las 6 pruebas Electron pasan tras actualizar el antiguo atajo del entrenador a ⌘6 (5 en la suite y la prueba corregida repetida individualmente).
- Ejecutadas 26 comparaciones visuales con el prototipo en ambos temas. Puertos ahora tiene el nuevo estado vacío hasta marcar un segmento; el menú adicional y este contenido son cambios intencionados respecto al prototipo.
- Paquete actualizado en `dist/segments-ports/mac-arm64/CycleLab.app`.

## Resultados históricos de segmentos (27/10/2026)

- Búsqueda local por GPS de todos los años y varias repeticiones por actividad, en el mismo sentido. Comprueba el recorrido completo, orden, longitud, extremos y continuidad de las muestras. No usa las coordenadas proyectadas del mapa ni coordenadas de demostración.
- Proceso en segundo plano con cesiones periódicas al bucle de eventos, cola sin búsquedas duplicadas, progreso, persistencia SQLite (esquema 4), invalidación al importar datos y reintento de errores. Los segmentos anteriores se procesan al iniciar; los trabajos interrumpidos se reinician sin eliminar entrenamientos.
- Lint y typecheck correctos. 67 pruebas unitarias: dirección, desvíos, extremos iguales, vueltas, muestreo diferente, GPS ausente, intervalos cortos, huecos, resultados desconocidos, coalescencia, reanudación y conservación de resultados ante errores.
- Suite completa de 7 pruebas Electron superada; repetida la prueba de resultados tras el último ajuste de la cola. Comprueba creación automática, histórico de 2016 a 2026, repeticiones, persistencia, aislamiento de origen y actualización al llegar muestras nuevas.
- Capturas de Resultados revisadas en ambos temas: `test-results/segment-results-dark.png` y `test-results/segment-results-light.png`.
- Ensayo de solo lectura con el segmento existente y 241 actividades reales locales: 74 coincidencias en 21 actividades, 5,5 s. No se modificó la base del usuario ni se consultaron credenciales; no se revisó manualmente cada coincidencia.
- Límites explícitos: referencia de al menos 100 m, GPS sin huecos >30 s o saltos >200 m, tolerancia espacial de 35 m y tiempos aproximados a las muestras. Caminos paralelos cercanos y GPS degradado pueden producir falsos positivos/negativos. Sin conexiones externas ni descargas nuevas.
- Ejecutadas de nuevo 26 comparaciones contra el prototipo en oscuro y claro. El panel nuevo se valida además con capturas propias; no se declara igualdad de píxeles en pantallas ampliadas.
- Paquete macOS ARM64 preparado en `dist/segment-results/mac-arm64/CycleLab.app`. Usar esta compilación o posteriores después de la migración a esquema 4.

## Ordenación de resultados (27/10/2026)

- Cabeceras activables con ratón, Enter y Espacio; `aria-sort` y flecha para identificar columna y dirección. Orden inicial: fecha descendente. Sin cambios en tablas que no soliciten ordenación.
- Fecha, actividad, tiempo, potencia, FC y cadencia ordenados por valores originales; nulos al final en ambos sentidos, ceros válidos, empates estables y reporte sin mutaciones. Los cambios de progreso conservan el orden elegido mientras está abierto el segmento.
- Lint y typecheck correctos; 69 pruebas unitarias y la prueba Electron de resultados ampliada con ordenación y teclado superadas. Capturas revisadas en ambos temas.
- Compilación macOS en `dist/segment-sorting/mac-arm64/CycleLab.app`. Sin migración ni cambios en los entrenamientos guardados.

## MapLibre y MapTiler (27/10/2026)

- MapLibre GL JS 6.16 con worker empaquetado, estilos Outdoor v4 claro/oscuro, atribución y logotipo oficial. Actividades, Segmentos y Puertos muestran GPS real; la demo conserva el mapa SVG original.
- Panel MapTiler con guardado cifrado mediante safeStorage, comprobación, cambio y desconexión. Recursos descargados por main mediante IPC validado; renderer sin clave ni acceso directo a MapTiler. URLs de recursos saneadas, destino fijo, límites de tamaño/caché y pausa ante 429. Sin migración de SQLite ni modificación de datos del usuario durante las pruebas.
- Zoom, ajuste de vista, color por potencia/pendiente/velocidad, cursor compartido con gráficos y selección de inicio/final por clic. Fallback esquemático con error recuperable y reintento sin conexión.
- Lint y typecheck correctos; 74 pruebas unitarias y las 8 pruebas Playwright/Electron superadas. Nuevas pruebas de recursos JSON/binarios, saneamiento de claves, caché, 403/429, respuestas inválidas y conexión interrumpida. Prueba Electron con proveedor simulado: clave, IPC, carga del mapa, selección, cambio de tema, caída/recuperación y desconexión.
- Capturas propias revisadas en `test-results/maptiler-dark.png` y `test-results/maptiler-light.png`. El fondo uniforme de estas capturas corresponde a un tile de prueba, no a cartografía real.
- Paquete macOS ARM64 en `dist/maptiler/mac-arm64/CycleLab.app`; arranque y campo de MapTiler comprobados con userData temporal. Sin firma/notarización.
- Pendiente: introducir la clave del usuario y validar estilos, tiles, sprites y fuentes contra su cuenta real. No se han consultado sus credenciales ni declarado validada esa conexión. Sin mapas offline descargables, satélite, relieve 3D ni planificación de rutas. La pendiente entre muestras es aproximada y puede ser ruidosa.
- Ejecutadas 26 comparaciones contra `design/prototype.html` en ambos temas, guardadas en `artifacts/visual/comparison.json`. La cartografía real es una ampliación sin equivalente en el prototipo; se revisó mediante sus capturas propias.

## Errores parciales al hacer zoom (27/10/2026)

- El manejador anterior trataba cualquier evento de error de MapLibre como fallo completo y ocultaba el mapa. Ahora, después de cargar la ruta, los errores de recursos muestran un aviso sin ocultar el canvas ni sustituirlo por el esquema SVG. El fallback se conserva cuando falla el arranque.
- Se ignoran eventos AbortError y se comprueba la cancelación antes y después del IPC, incluso si este rechaza: una descarga obsoleta al cambiar el zoom no debe convertirse en un fallo de red visible.
- Lint, typecheck, build y 74 pruebas unitarias correctos. Prueba Electron de mapas ampliada y superada: fallo 503 de tiles al alejar, canvas todavía visible, zoom posterior operativo, ausencia de fallback y recuperación después de un fallo de carga inicial al cambiar de tema.
- Paquete en `dist/map-zoom-fix/mac-arm64/CycleLab.app`. No se han usado las claves del usuario ni determinado qué respuesta concreta de MapTiler provocó su captura. Un fallo real de descarga puede dejar partes de cartografía incompletas; el aviso permite reintentar.

## Visibilidad inicial de la ruta (27/10/2026)

- Se unen las aristas GPS contiguas con el mismo color/selección en líneas continuas, conservando los huecos, las fronteras de color y los datos originales. Se desactiva la simplificación de la fuente de ruta y se añade un borde con tokens de tema para separar el recorrido del mapa.
- Al desmontar MapLibre se invalida la referencia antes de eliminar la instancia, evitando que sus eventos de cierre actualicen el estado del mapa siguiente.
- 76 pruebas unitarias superadas, incluidos trazados densos, inmutabilidad, huecos y cambios de color/selección. Prueba Electron de mapas superada con 1.001 muestras GPS: selección, zoom con descargas fallidas, cambio de tema y recuperación. Captura `test-results/route-initial.png` revisada antes de interactuar con el zoom: línea continua visible.
- Compilación en `dist/route-line-fix/mac-arm64/CycleLab.app`. Ensayo con cartografía simulada; no se ha probado visualmente el recorrido concreto del usuario sobre MapTiler real.

## Pantalla de creación de segmentos (27/10/2026)

- Acceso desde Crear segmento en una actividad, conservando como punto de partida el tramo seleccionado o el recorrido completo. Vista propia con mapa, perfil, límites ajustables por muestra, resumen y segundo paso para nombre/guardado. Se mantiene el IPC y la validación de persistencia existentes.
- Lint, typecheck, build y 76 pruebas unitarias correctos. Pruebas Electron de navegación y creación/persistencia de segmentos superadas, incluyendo cancelación, teclado, límites que no se cruzan y regreso desde la revisión. Capturas de la nueva pantalla inspeccionadas en claro y oscuro; referencia del prototipo abierta en navegador. El prototipo no contiene esta pantalla nueva.
- La prueba adicional MapTiler falla al esperar el esquema alternativo tras desconexión simulada y cambio de tema: el aviso aparece, pero el canvas permanece. El mismo fallo se reproduce al retirar los cambios de posición de los marcadores GPS. No se ha modificado la gestión de errores del mapa en esta tarea ni probado una cuenta MapTiler real.

## Fase 1.1 — Regresión de mapas cerrada (28/10/2026)

- Reproducido el fallo anterior antes de modificar código. La comprobación de credenciales había dejado el estilo claro en caché: desconectar la red y cambiar de tema no equivalía a fallar la descarga del estilo.
- Comportamiento acordado: mientras carga el estilo se muestra «Cargando cartografía…»; si falla el estilo o la inicialización, aparece el esquema SVG con el tramo seleccionado y reintento. Si el estilo está disponible, la ruta se añade en `style.load`, sin esperar a todos los tiles. Los errores parciales conservan el canvas, zoom y selección, con aviso y reintento. Cambiar de tema aplica las mismas reglas; recuperar la conexión y reintentar elimina el aviso y reconstruye el mapa.
- La prueba Electron distingue tiles con 503 tras hacer zoom, cambio de tema sin conexión con estilo en caché, arranque sin estilo en caché, recuperación y desconexión de MapTiler. Recorre ambos temas, conserva la selección y comprueba ausencia de errores JavaScript. Tres ejecuciones consecutivas correctas (`npx playwright test -g MapTiler --repeat-each=3`). Capturas `test-results/map-partial-*.png`, `map-cached-*.png`, `map-startup-*.png` y `maptiler-*.png` revisadas en ambos temas. El fondo de esta prueba sigue siendo un tile simulado.
- Comprobación adicional contra **MapTiler real**, desde la app empaquetada en un perfil temporal con una ruta GPS ficticia en Santander. Solo se copió la credencial MapTiler cifrada desde la base original, abierta en modo de solo lectura; no se modificaron el perfil ni sus entrenamientos ni se copiaron otras claves. Estilos Outdoor v4 claro/oscuro, tiles vectoriales, sprites y fuentes descargados correctamente; ruta y cartografía visibles, sin avisos ni errores JavaScript. Capturas revisadas en `artifacts/visual/map-real-dark.png` y `map-real-light.png`.
- Esa comprobación descubrió que los tiles vacíos devuelven HTTP 204. Ahora se entregan a MapLibre como datos binarios vacíos; los estilos y TileJSON sin cuerpo siguen siendo errores. Prueba unitaria específica de ambos casos; la comprobación real posterior incluye cuatro respuestas 204 sin avisos.
- Lint, typecheck, build y 84 pruebas unitarias correctos. Suite completa de 8 pruebas Electron superada después de la corrección de 204. Ejecutadas 26 comparaciones con `design/prototype.html` en ambos temas; el mapa real se revisa en sus capturas propias porque el prototipo solo contiene el esquema SVG.
- Compilación macOS ARM64: `dist/roadmap-1.1/mac-arm64/CycleLab.app`, sin firma ni notarización. Sin migraciones ni cambios en las APIs de mapas, IPC o credenciales.
- Límites: comprobación real puntual de una zona y cuenta, no de todas las cuotas o restricciones del proveedor. La caché es temporal; no se ofrece cartografía offline persistente. Un fallo parcial puede dejar huecos en el fondo, conservando la ruta y el aviso hasta reintentar.

## Fase 1.2 — Copias de seguridad y recuperación (28/10/2026)

- Ajustes incorpora exportación y restauración con diálogos nativos. Formato `.cyclelab-backup.json` v1, versión de esquema SQLite y fecha; SHA-256 detecta alteraciones accidentales. Se incluyen registros de actividades y muestras, segmentos/resultados, conversaciones y ajustes de ambos orígenes. No se exporta la tabla `secrets`; las claves del Mac de destino se conservan y un perfil limpio debe configurarlas de nuevo.
- La exportación obtiene una instantánea lógica dentro de una transacción de lectura, incluyendo registros confirmados en WAL. No copia el archivo SQLite abierto. Escribe un temporal con permisos 0600, sincroniza el archivo y lo renombra al destino. Las copias se excluyen de Git.
- Restauración con confirmación y validación del formato, versiones, checksum, JSON tipado, identificadores y referencia/índices de los segmentos. El reemplazo de tablas y la recuperación de trabajos interrumpidos se hacen en una sola transacción. Una excepción revierte todo. Antes se guarda otra copia en `backups/` del perfil; si no puede guardarse, no empieza el reemplazo. Mientras se elige/confirma el archivo se impiden otras operaciones IPC que puedan modificar datos. No se permite restaurar durante sincronizaciones o respuestas del entrenador. Los cálculos de segmentos anteriores se detienen y vuelven a programarse sobre los datos restaurados.
- Antes de migrar un esquema existente (1–3 → 4), se guarda una copia sin credenciales. Se admite restaurar esas copias antiguas sobre el esquema actual, reconstruyendo `best` desde el detalle cuando procede. Una base con versión posterior sigue siendo rechazada.
- `npm run lint`, `npm run typecheck`, `npm test` (94 pruebas) y `npm run build` correctos. Suite completa Electron: 10 pruebas superadas. Los dos recorridos nuevos comprueban exportación con WAL abierto, recuperación en perfil limpio y tras reiniciar, segmento/muestras/conversaciones/perfil/modelo/tema, exclusión de credenciales y conservación de claves locales, cancelación, rechazo de corrupción e incompatibilidad, rollback mediante fallo SQL simulado y copia/restauración previa a migrar desde v1. Pruebas unitarias adicionales rechazan contenido inválido aun con checksum correcto. Recorrido de copias repetido tras añadir la comprobación de respuesta del entrenador en curso.
- Panel nuevo revisado en `test-results/backup-dark.png` y `backup-light.png`, con componentes/tokens existentes y sin estilos nuevos. El prototipo no contiene Ajustes ni copias: se completaron además las 26 comparaciones generales contra `design/prototype.html` en ambos temas (`artifacts/visual/comparison.json`). Sin errores JavaScript en los recorridos nuevos.
- Límites: comprobación con perfiles temporales, sin tocar entrenamientos ni claves reales del usuario. No se ha probado físicamente la transferencia a otro Mac ni medido el coste con históricos masivos. La copia se procesa en memoria y de forma síncrona en main; una base grande puede pausar temporalmente la interfaz. Las copias contienen GPS y conversaciones sin cifrar; deben guardarse en una ubicación segura. No hay rotación automática: las copias previas se conservan hasta borrarlas manualmente. SHA-256 comprueba integridad, no autenticidad. Sin nuevo instalador firmado/notarizado.

## Fase 1.3 — Cobertura y procedencia (28/10/2026)

- Cobertura desplegable en Actividades (fechas, tipos y búsqueda actuales), Dashboard (6/12/20 semanas) y Rendimiento (temporadas seleccionadas, incluidas las que no tienen curva). Recuenta actividades con/sin potencia, FC, GPS, TSS y muestras. Potencia y FC pueden proceder del resumen o del FIT; se indica además cuántas actividades tienen muestras de cada canal. Sin FIT, un sensor ausente del resumen queda «Sin comprobar». Un periodo vacío tiene su propio estado y los incompletos llevan aviso visible incluso con el detalle cerrado.
- Procedencia explícita: resúmenes y FIT de Garmin; trabajo, estadísticas de tramos, zonas y mejores esfuerzos calculados localmente; carga CTL/ATL/TSB estimada desde cero. La demo conserva su identificación como datos ficticios. El gráfico y las cifras de carga real indican estimación; si falta TSS, se sustituye la valoración de forma por un aviso y se informa también de carencias anteriores al periodo. El TSS de un día con alguna actividad desconocida es `null`, aunque haya otras con TSS ese día; el cero medido se conserva. Las zonas sin muestras y el W/kg sin FTP ya no se presentan como cero.
- Reintento mediante preload/IPC validado: solo descarga los FIT de las actividades con error incluidas en el periodo. Reutiliza la sincronización, conserva muestras correctas y no vuelve a pedir resúmenes ni reinicia el cursor de importación. Los fallos restantes y las muestras pendientes siguen reflejados en el estado global. Al llegar las muestras se invalida la cobertura almacenada en memoria y se actualiza el detalle abierto.
- El entrenador recibe los mismos recuentos y reglas de procedencia mediante el cálculo compartido. El contexto inicial incluye la cobertura del histórico o de la actividad abierta; cada herramienta añade la de sus registros/temporadas/días consultados. Se transmiten recuentos de GPS, nunca coordenadas. La búsqueda sigue limitada a 20 resultados y lo explicita; el envío de filtros y selección visual al entrenador corresponde a la fase 2.2.
- `npm run lint`, `npm run typecheck`, `npm test` (98 pruebas) y `npm run build` correctos. Suite completa Electron: 11 pruebas superadas. Repetidos navegación/chat y cobertura después de los ajustes visuales y del estado sin curva. Pruebas específicas de cero frente a ausencia, sensores no comprobados, GPS inválido, periodos vacíos, cobertura compartida con el entrenador, TSS parcial, reintento selectivo, conservación del cursor y estado pendiente tras recuperar una descarga.
- Recorrido nuevo en un perfil temporal con registros controlados: cambio de año/temporada, estado vacío, error visible al reintentar sin Garmin configurado, métricas ausentes, teclado para abrir/cerrar cobertura, ausencia de desbordamiento horizontal a 1200 × 760 y ausencia de errores JavaScript. Capturas `test-results/coverage-{activities,dashboard,performance}-{dark,light}.png` y `coverage-minimum-light.png`. Ejecutadas las 26 comparaciones contra `design/prototype.html` en ambos temas; revisadas las capturas de las pantallas afectadas. El desplegable de cobertura es una ampliación sin equivalente en el prototipo.
- Límites: se mide disponibilidad por actividad dentro del histórico local importado, no se certifica que Garmin haya entregado todas las actividades ni continuidad temporal de cada sensor. Las estimaciones de carga siguen sumando solo el TSS conocido y pueden quedar infravaloradas. La primera consulta de cobertura lee las muestras locales; después se conservan solo indicadores en memoria hasta su invalidación. No se ha medido con históricos masivos ni se han usado entrenamientos, claves o conexiones reales del usuario: Garmin y OpenRouter se han comprobado con proveedores simulados. Sin migración de base de datos ni dependencias nuevas.

## Fase 1.4 — Historial de FTP, peso y LTHR (28/10/2026)

- Ajustes permite registrar y corregir FTP, peso y LTHR con fecha de vigencia UTC y procedencia. Cada magnitud tiene su propio historial; un valor vacío marca desconocido desde esa fecha. Guardar sustituye explícitamente los valores de la misma fecha. Los valores antiguos sin fecha se mantienen como referencias actuales, sin asignarlos a actividades pasadas.
- Actividades usa el perfil vigente al inicio del día de la sesión para zonas, bandas, referencia LTHR, vueltas, esfuerzos y W/kg. Detalle y comparación A/B muestran valores, fecha y origen. IF/TSS importados se conservan: no hay recálculo de estas métricas. Añadir una referencia pasada sí actualiza los cálculos locales de zonas y W/kg, tal como avisa el formulario.
- Rendimiento conserva las marcas en vatios y asocia a cada una el peso y la fecha de la actividad que la originó. El modo W/kg normaliza esa misma marca (no busca un récord independiente de W/kg); los huecos históricos quedan vacíos. Tooltip por temporada y tabla indican el peso usado. La línea de FTP y el porcentaje de fondo se identifican como referencias actuales.
- El entrenador recibe referencias históricas en búsquedas y análisis de intervalos, además del contexto de la actividad y del peso/fecha de cada marca de la curva. No se envían coordenadas ni secretos nuevos. Garmin solo completa umbrales sin configurar y sin historial, con la fecha de la actividad consultada; valida los valores y respeta cambios de perfil efectuados durante la petición.
- SQLite pasa a esquema 5, con copia automática previa mediante el mecanismo existente. El historial vive en los ajustes y se valida tanto por IPC como al restaurar copias. Las copias admiten los indicadores de conexión booleanos que guardaban sincronizaciones antiguas; se vuelven a resolver desde las credenciales locales al leer el perfil. La demo conserva referencias ficticias independientes. No se cambian actividades, muestras ni valores IF/TSS al editar el perfil.
- Validación: lint, typecheck, build y 105 pruebas unitarias correctos. Pruebas de fechas inclusivas, huecos, valores desconocidos, corrección de fechas, límites y duplicados, conservación de IF/TSS, peso de marcas antiguas, procedencia del entrenador e importación de umbrales Garmin. Los 12 recorridos Electron pasan (11 en la ejecución completa y el restante tras actualizar su expectativa del nuevo campo `history`). Perfil, copias y cobertura: guardado por formulario, persistencia tras reinicio, aislamiento de demo y uso de 240 W/75 kg en una sesión de 2024 con perfil actual de 300 W/80 kg; recuperación del historial en perfil limpio y rechazo de copias inválidas.
- Revisión visual en ambos temas: formulario/historial y sesión histórica en `artifacts/visual/profile-*.png`; comparación de pantallas con `design/prototype.html` mediante el recorrido visual existente. El prototipo no contiene Ajustes ni historial. Se conserva la tabla compacta de Rendimiento mostrando el peso bajo W/kg y en el tooltip.
- Límites: pruebas con perfiles temporales y datos simulados; sin llamadas a Garmin/OpenRouter reales. Vigencia por día UTC, sin cambios intradía. No se reconstruyen valores históricos ausentes ni se deduce el FTP usado por Garmin para IF/TSS. Sin nuevo instalador firmado/notarizado.

## Arranque con histórico grande y migración a v5 (28/10/2026)

- Reproducido el cierre nativo SIGTRAP de la app empaquetada con una copia consistente del perfil v4 (325 actividades, SQLite de unos 200 MB). La copia de prueba se creó en una carpeta temporal, sin credenciales; no se modificó el perfil original. Electron informó `OOM error in V8: Zone Allocation failed` al construir la copia automática previa a la migración.
- La exportación y las copias automáticas ahora recorren las filas con `iterate()` y escriben el JSON escapado y su SHA-256 incrementalmente. Se mantiene una transacción de lectura consistente, el formato v1, permisos 0600, temporal, fsync y renombrado atómico. Ya no se construye el archivo completo como una cadena en memoria.
- La copia del perfil migra a v5 y la app permanece abierta. Verificado externamente el JSON de la copia previa (263.156.524 bytes), su versión de origen 4 y su checksum. Tres pruebas Electron de copias correctas, incluida una nueva migración con 192 mensajes de 1 MiB; conserva los registros y genera la copia previa. Lint, typecheck y 105 pruebas unitarias correctos.
- `npm run package` ejecuta ahora la prueba existente de la app empaquetada: arranque, SQLite, cifrado de prueba y persistencia tras reiniciar, siempre en un perfil temporal. Disponible también como `npm run test:package`, con ruta opcional al ejecutable. Sin cambios visuales ni de diseño.
- Límite pendiente: restaurar sigue leyendo y validando una copia completa en memoria; la escritura se acota al tamaño de un registro, no a un número fijo de bytes. La app local continúa sin firma ni notarización.


## Fase 1.5 — Mantenimiento y privacidad (28/10/2026)

- Ajustes muestra tamaño SQLite/WAL/SHM, copias automáticas y contadores por origen.
- Pausa y cancelación cooperativas guardan la petición en curso; la pausa conserva el
  offset y cancelar lo reinicia. Ninguna borra muestras ni se reanuda automáticamente.
- Borrado transaccional por origen, de conversaciones o de todo el histórico local;
  confirmación nativa con alcance explícito, bloqueo durante importación/respuestas,
  perfil Garmin incluido y claves/copias/otro origen conservados. La demo borrada no
  se regenera al reiniciar; tampoco se muestran sus agregados estáticos tras borrarla.
- Consentimiento nativo antes del primer mensaje real, previo a persistir/enviar la
  pregunta. Explica historial, contexto y resultados enviados. La aceptación no viaja
  en las copias. La preferencia de importación automática sí se conserva en ellas.
- Diagnóstico JSON construido por lista permitida de campos: versiones, plataforma,
  tamaños y contadores; sin contenido de actividades, chats, GPS, claves ni errores.
- README y AGENTS actualizados a seis accesos, proveedores reales y MapLibre/MapTiler.

Validación: lint, typecheck y build; 107 pruebas unitarias (incluidas pausa/cancelación
con una descarga pendiente y reanudación sin repetirla). Pruebas Electron de
mantenimiento y copias: confirmación/cancelación, aislamiento de orígenes, conservación
de claves, diagnóstico, consentimiento previo, reapertura, restauración y migraciones.
Capturas de Ajustes y prototipo en ambos temas en `test-results/maintenance-*.png`.
Revisión visual de colores, paneles y controles; el prototipo no contiene Ajustes,
por lo que no hay comparación píxel a píxel de esta pantalla. Sin errores de renderer
observados en el recorrido.

Límites: pruebas con perfiles aislados y proveedores simulados/sin configurar, sin
consultas de pago ni importación de una cuenta real. La detención espera la petición
actual y sus reintentos. El borrado no es forense, no elimina copias ya existentes ni
reduce inmediatamente el archivo SQLite: el espacio se reutiliza. No se ha repetido
la suite visual completa ni la validación de instaladores.


## Fase 2.1 — Segmentos y puertos en el entrenador (28/10/2026)

- `comparar_ascensiones` consulta `segments` y `segment_results` del origen activo,
  igual que Segmentos/Puertos; deja de usar el catálogo antiguo, también en demo.
- Resuelve ID o nombre, ofrece candidatos cuando hay ambigüedad y filtra fechas
  UTC inclusivas (`desde`/`hasta`). Ordena por fecha descendente y, dentro de una
  sesión, por el inicio del intento; muestra los dos últimos del periodo.
- Conserva métricas nulas y referencias históricas del atleta. Envía al modelo y
  muestra en la tabla la misma procedencia, cobertura y advertencias: búsqueda
  pendiente, en curso, interrumpida o desactualizada; ausencia de GPS/muestras y
  coincidencias aproximadas. No envía coordenadas ni muestras GPS.
- Las actividades de la tabla se abren desde la página y el panel lateral del chat.
  El contador suma intentos persistidos de segmentos marcados como puerto y avisa
  de búsquedas incompletas. Los mensajes guardados conservan su resultado original.

Validación: lint, typecheck, build y 114 pruebas unitarias correctos. Nuevos casos
para histórico Garmin sin catálogo antiguo, orden de intentos, fechas inclusivas,
periodos inválidos, métricas ausentes, ambigüedad, aislamiento y resultados
provisionales. Prueba Electron con perfil temporal: mismos intentos en Puertos y
chat, apertura de actividad, contador al desmarcar un puerto y al cambiar de origen,
ambos temas y sin errores de renderer. Capturas en
`test-results/coach-segments-{dark,light}.png`.

Comparación visual ejecutada con `scripts/visual.mjs` y prototipo abierto en
Chromium, revisando Entrenador en ambos temas. Se mantienen componentes y tokens;
las diferencias incluyen navegación, contexto y contador de la app actual frente
al prototipo. Capturas y comparativa en `artifacts/visual/`.

Límites: no se han hecho llamadas de pago a OpenRouter ni una nueva sincronización
Garmin real; se verifican las herramientas con datos controlados y el flujo UI con
la demo. No se ha ejecutado toda la suite Electron ni los instaladores. El segmento
seleccionado en pantalla todavía no viaja en el contexto (fase 2.2): con varios
candidatos hay que indicar su nombre. Los resultados GPS siguen siendo aproximados;
la herramienta consulta el estado persistido y no inicia nuevas descargas.


## Fase 2.2 — Preguntar por la selección actual (28/10/2026)

- «Analizar este tramo» utiliza el rango del gráfico, los intervalos marcados o el
  segmento actual. Los intervalos se envían como rangos independientes, sin incluir
  recuperaciones intermedias. «Explicar esta comparación» conserva la pareja A/B.
- El proceso principal resuelve los identificadores en el origen activo y calcula
  estadísticas de cada rango y diferencias B respecto a A con las funciones del
  análisis. Conserva valores nulos y referencias históricas; incluye recuentos de
  muestras con potencia/FC. No adjunta coordenadas, archivos FIT ni credenciales.
- El contexto es visible junto al campo del chat. Los resultados permiten volver
  a cada actividad o tramo; reintentar conserva el contexto de la pregunta original,
  también después de persistir el historial. Las copias aceptan y validan ese contexto.
- `buscar_actividades` filtra todo el histórico por texto, fechas UTC inclusivas y
  tipos antes de ordenar y paginar. Devuelve 20 filas por página, el total y el
  siguiente offset cuando quedan resultados; cada actividad tiene enlace.
- OpenRouter recibe la selección calculada antes de responder, aunque el modelo
  no invoque herramientas. Los segmentos también sirven como referencia por defecto
  para `comparar_ascensiones`, evitando elegir otro puerto por suposición.

Validación: lint, typecheck, build y 118 pruebas unitarias correctos. Casos nuevos
para cuatro rangos independientes, referencias de otro origen, índices inválidos,
contexto IPC incompatible, sensores ausentes, pareja A/B, búsqueda de 45 actividades
de 2020 y paginación por tipo/fecha. Petición OpenRouter verificada con transporte
simulado: el mismo resultado local llega a la interfaz y al modelo, sin GPS.

Recorrido Electron con perfil temporal: cuatro repeticiones de una sesión 4×8,
retorno al tramo, comparación de dos actividades y elección del segmento correcto
entre varios. Capturas en `test-results/coach-selection-{dark,light}.png`, sin errores
de renderer. También pasan el recorrido de puertos, las dos pruebas de migración
y la prueba de exportación/restauración de copias ejecutada aisladamente (un primer
intento conjunto agotó el tiempo de espera). Comparación visual ejecutada contra `design/prototype.html` en Chromium
para ambos temas, con capturas en `artifacts/visual/`; se mantienen componentes,
colores y tipografía. El prototipo no incluye selección múltiple ni contexto del chat.

Límites: sin llamadas de pago a OpenRouter ni nueva sincronización Garmin real.
La respuesta libre del modelo no se valida con un proveedor real; se comprueban el
contrato enviado y el flujo demo. No se ha ejecutado toda la suite Electron ni los
instaladores. La búsqueda entrega páginas de 20 y conserva el límite existente de
cinco rondas de herramientas por respuesta. Los tramos se basan en índices de las
muestras locales; si faltan o dejan de ser válidos, el análisis devuelve un error.

### Corrección de búsqueda por ID (28/10/2026)

`buscar_actividades` acepta el ID exacto tanto en `actividad` como en `texto`.
Antes, `actividad` se ignoraba y `texto` solo buscaba en el nombre: el entrenador
podía obtener vueltas pero no el resumen de la misma sesión. Se conservan los
filtros de fecha/tipo y no se devuelve el listado general si el ID no existe.
Prueba de regresión con ID numérico, resumen completo, ID ausente/parcial y búsqueda
por nombre. La descripción de la herramienta explica cómo consultar el resumen.

## Fase 2.3 — Comparación visual de intentos (28/10/2026)

- Segmentos y Puertos permiten marcar dos resultados y abrir «Comparar intentos».
  La pareja conserva el orden de selección (A/B), independientemente de la
  ordenación de la tabla. Marcar un tercero conserva los dos últimos.
- Potencia, FC y velocidad se superponen en sus unidades sobre distancia desde
  el inicio de cada intento; A usa trazo continuo y B discontinuo. Un cuarto
  gráfico muestra tiempo transcurrido A − B en segundos: negativo significa que
  A llega antes. Los cuatro comparten cursor y selección por arrastre; Esc y el
  botón de limpieza eliminan la selección. Cada intento abre su actividad con
  el tramo original seleccionado.
- Cálculo local sobre las muestras de los resultados persistidos, cuya búsqueda
  ya comprueba recorrido y sentido. No hay nuevos IPC, dependencias ni cambios
  de almacenamiento. No se normalizan longitudes ni se extrapolan extremos.
- La interpolación solo une muestras consecutivas separadas hasta 30 s y 200 m.
  Se insertan cortes incluso cuando ambos intentos tienen el mismo hueco;
  distancia ausente interrumpe la continuidad y sensores ausentes siguen siendo
  nulos. Los ceros medidos se conservan. Distancias decrecientes/reiniciadas o
  tiempos desordenados invalidan la comparación. Las pausas cuentan en el tiempo
  transcurrido; en distancias repetidas se utiliza el momento de salida.
- La interfaz identifica las actividades, fechas con año, duración e inicio del
  intento, explica el signo del tiempo y los límites de interpolación, y ofrece
  estados de carga, error con reintento y distancia insuficiente.

Validación: typecheck, lint, build y las 126 pruebas unitarias correctos. Siete
pruebas nuevas cubren alineación, signo, interpolación corta, extremos distintos,
huecos temporales/espaciales/distancia ausente, sensores nulos, ceros, pausas y
registros inválidos y ruido de coma flotante (diferencia redondeada al milisegundo). Se conserva la prueba de rechazo de recorridos invertidos.
El recorrido Electron de resultados históricos comprueba dos pasos de una misma
actividad, selección de dos/tres filas, cuatro gráficos, selección compartida y
Esc, y retorno a ambas actividades con el tramo. Sin errores de renderer durante
el recorrido de comparación. Capturas por tema y por gráfico en
`test-results/segment-comparison-{dark,light}*.png`.

Comparación visual del sistema contra `design/prototype.html` en ambos temas,
con evidencias en `artifacts/visual/`. El script original falló al comparar tamaños
porque macOS limitó la altura de la ventana a 803 px; se ejecutó una copia temporal
con el viewport del prototipo igual al de Electron (1440 × 803). La copia se
eliminó después. La referencia solo superpone potencia; FC, velocidad y diferencia
acumulada reutilizan el mismo componente y tokens. No se afirma igualdad de píxeles.

Límites: pruebas con datos sintéticos y perfil temporal; sin nueva sincronización
Garmin real ni ejecución de toda la suite Electron o instaladores. La distancia
registrada y los extremos GPS pueden diferir entre intentos: los tiempos son
aproximados, no cronometraje exacto de un mismo punto geográfico. No se reconstruyen
recorridos sin distancia ni se rellenan grandes huecos.

## Fase 2.4 — Gestión y revisión de segmentos (29/10/2026)

- La lista de Segmentos y Puertos tiene buscador por nombre (sin distinguir
  mayúsculas) y muestra primero los favoritos con la etiqueta «Favorito».
  «Renombrar» edita el nombre en línea (1–100 caracteres, Esc cancela) y
  «Marcar como favorito» alterna la marca. Un único IPC `segment-update`
  validado con zod sustituye a `segment-climb` para nombre, puerto y favorito.
- Cada coincidencia GPS (no la selección original) tiene «Excluir», que pide un
  motivo (1–200 caracteres). Las exclusiones se listan con su motivo y
  «Restaurar». Se guardan en el propio segmento (`excluded`, por identificador
  de intento) mediante `segment-exclude`; los resultados brutos no se tocan, por
  lo que nombre y exclusiones sobreviven a «Volver a buscar» y a cambios del
  histórico. Copias de seguridad validan los nuevos campos.
- Las exclusiones se aplican al recuento, mejor tiempo, último intento,
  evolución, selección para comparar, contador de ascensiones y a
  `comparar_ascensiones`, que indica cuántas coincidencias se descartaron.
- Resultados muestra mejor tiempo y último intento con fecha, y una gráfica de
  evolución del tiempo por fecha cuando hay al menos dos intentos.

Validación: typecheck, lint, build y las 126 pruebas unitarias correctos. El
recorrido Electron de resultados históricos excluye una coincidencia con motivo,
comprueba recuento y último intento, renombra, marca favorito y busca (incluida
búsqueda sin resultados); tras reiniciar y recalcular por nuevas muestras,
nombre, favorito y exclusión se conservan y el intento sigue en los resultados
brutos; «Restaurar» lo devuelve. Pasan también las pruebas Electron de segmentos
y del entrenador con puertos. Capturas en
`test-results/segment-review-{dark,light}.png`, revisadas en ambos temas.

Límites: la exclusión se identifica por actividad y rango de muestras; si una
nueva descarga desplaza las muestras, el intento reaparece para revisarlo. Las
exclusiones huérfanas no se muestran. La columna «Revisión» aparece como
ordenable, sin efecto. Sin resumen de marcas en la propia lista, sin nueva
sincronización Garmin real ni ejecución de toda la suite Electron o instaladores.

## Fase 2.5 — Un chat más cómodo y trazable (29/10/2026)

- «Detener» sustituye a «Enviar» mientras hay una respuesta en curso. Un IPC
  `message-cancel` aborta la petición (o la demo) con `AbortController`; el
  mensaje queda como «Respuesta cancelada», conserva lo recibido, avisa de que
  cancelar no anula el coste ya generado y ofrece «Reintentar». Si la respuesta
  falla o se cancela, la pregunta vuelve al cuadro de texto.
- OpenRouter se pide con `stream: true`: se reconstruyen texto y llamadas a
  herramientas desde los eventos SSE y el texto aparece progresivamente (como
  mucho cinco refrescos por segundo). Si el proveedor responde JSON sin
  streaming, se procesa igual. La demo simula el texto progresivo.
- Conversaciones separadas por origen (tabla `conversations`, esquema 6): título
  automático con la primera pregunta, «Nueva», búsqueda por título o contenido,
  «Renombrar» y «Borrar» con confirmación. Solo se envía al modelo el historial
  de la conversación activa. Los mensajes anteriores y los de copias antiguas se
  agrupan en «Conversación anterior». Copias, borrado local y diagnóstico
  incluyen la nueva tabla.
- Cada respuesta lista «Datos utilizados»: actividades, intentos de segmento,
  tramos seleccionados y periodos consultados. Las actividades se abren en su
  tramo y los periodos abren Actividades con ese filtro de fechas.
- Consumo por respuesta: tokens y coste en US$. Si OpenRouter informa `cost` en
  todas las llamadas se muestra como coste «según OpenRouter»; si no, se estima
  con los precios publicados y se marca «≈ … estimado». En Ajustes se puede
  definir un límite de gasto por petición (0,001–100 US$): antes de cada llamada
  se estima el coste de entrada y se ajusta `max_tokens`; si podría superarse, no
  se envía la llamada o se detiene el análisis, conservando el coste ya hecho.

Validación: typecheck, lint, build y las 130 pruebas unitarias correctos, entre
ellas reconstrucción SSE con herramientas fragmentadas, suma de coste observado,
aborto y rechazo por límite. Pasa toda la suite Electron (17 pruebas): la nueva
`coach-chat` crea dos conversaciones, cancela una respuesta en curso, comprueba
que la pregunta se conserva, busca, renombra y borra, abre una referencia y
verifica la persistencia tras reiniciar. Capturas en
`test-results/coach-chat-{dark,light}.png`, revisadas en ambos temas.

Límites: streaming, coste y límite no se han validado con una cuenta real de
OpenRouter. El límite es una estimación (unos tres caracteres por token) basada
en los precios publicados; el cargo final lo determina OpenRouter. Cancelar
detiene la descarga, pero el proveedor puede cobrar lo ya generado. La migración
de mensajes antiguos solo se ha probado mediante copias sin conversaciones. Los
periodos de `curva_potencia` (temporadas) no generan referencia.

## Fase 3.1 — Resumen semanal (29/10/2026)

- Panel «Resumen semanal» en el Dashboard con semanas de lunes a domingo (UTC):
  tiempo, distancia, desnivel, carga, sesiones, intensidad y mejores esfuerzos
  de 1, 5, 20 y 60 min. Se elige la semana (actual y tres anteriores) y la
  referencia: semana anterior o media de las cuatro anteriores.
- La semana en curso se marca «En curso · N de 7 días» y se compara con los
  mismos días de cada semana de referencia.
- Una métrica que falta no suma cero: el total excluye esas actividades y la
  columna «Sin datos» las cuenta en la semana y en la referencia. Si ninguna
  actividad de una semana tiene el dato, el total es desconocido y no hay cambio.
  Una semana sin actividades sí cuenta como cero.
- Al seleccionar una métrica se listan las actividades que forman el total y la
  referencia, que se abren desde la tabla. Cada mejor esfuerzo abre su actividad
  con el tramo seleccionado.
- La intensidad clasifica el tiempo de cada sesión por su IF (< 0,75, 0,75–0,85,
  ≥ 0,85 o sin IF). No es tiempo en zonas por muestras.
- El resumen se calcula localmente y de forma determinista. «Explicar» envía ese
  resumen al entrenador solo bajo demanda: abrir el Dashboard no genera
  peticiones.

Validación: typecheck, lint y 133 pruebas unitarias correctos, incluidos semana
parcial, datos ausentes, semana vacía y media de cuatro semanas. Revisión en la
app con la demo en ambos temas, sin errores en consola; el esfuerzo de 20 min
abre «3×12′ sweet spot» con su tramo marcado. Sin validar con datos reales de
Garmin ni con la suite Electron completa.

## Fase 3.2 — Sensaciones y corrección manual (29/10/2026)

- Panel «Sensaciones» en el detalle de cada actividad: RPE (1–10), fatiga
  (fresco, normal o cansado), notas y etiqueta. «Automática» deja la
  clasificación calculada; elegir otro tipo la sustituye.
- Las sensaciones se guardan en la tabla `activity_feel` (esquema 7), separada
  del resumen sincronizado. La sincronización y «Volver a etiquetar todo» solo
  reescriben el resumen; la decisión manual se aplica al leer, así que nunca se
  pierde. Con etiqueta manual se muestra «Etiqueta manual · automática: …» junto
  al motivo original.
- El entrenador recibe `tipo`, `tipoAutomatico`, `rpeDeclarado`,
  `fatigaDeclarada` y `notasDeclaradas` en la búsqueda y la selección, y el
  prompt le indica que son sensaciones declaradas, no métricas registradas.
- Las copias de seguridad incluyen las sensaciones (las anteriores se restauran
  sin ellas) y «Borrar todo» de un origen también las elimina.

Validación: typecheck, lint y 135 pruebas unitarias correctos, incluidos la
fusión de la etiqueta manual y los campos declarados del entrenador. Pruebas
Electron de app, copias y mantenimiento (12) correctas; el reetiquetado conserva
tipo manual, RPE, fatiga y notas. Revisión en la app con la demo en ambos temas.
Sin validar con datos reales de Garmin ni con una conversación real de OpenRouter.

## Fase 3.3 — Objetivos reales (29/10/2026)

- Con Garmin, el panel «Objetivos» del Dashboard permite crear, editar,
  archivar y restaurar objetivos con nombre, fecha, tipo de prueba y objetivo
  personal. Los archivados quedan plegados bajo «Archivados · N». Una fecha ya
  pasada se marca «Pasado».
- Se guardan en la tabla `goals` (esquema 8), separados por origen. En la demo
  se siguen viendo los dos objetivos ficticios, que no se pueden modificar: el
  IPC rechaza cualquier escritura en ese origen.
- Los objetivos reales no llevan CTL ni salida larga objetivo; esas barras solo
  aparecen en los de demostración. No se prescribe ningún valor automático.
- El entrenador recibe los objetivos activos (no los archivados) con días
  restantes, tipo de prueba, objetivo personal y `origen` «usuario» o
  «demostración», y el prompt le indica que estos últimos son ficticios.
- Las copias de seguridad incluyen los objetivos y «Borrar todo» de un origen
  también los elimina.

Validación: typecheck, lint y 136 pruebas unitarias correctos, incluido el
filtro de archivados y el origen que recibe el entrenador. Pruebas Electron de
app, copias y mantenimiento (13) correctas; una nueva crea, edita y archiva un
objetivo desde la interfaz, reinicia, comprueba que persiste, lo restaura y
verifica que la demo conserva solo sus objetivos ficticios. Revisión del panel en
ambos temas sin errores en consola. Sin validar con una conversación real de
OpenRouter.

## Fase 3.4 — Rendimiento con referencias útiles (29/10/2026)

- Rendimiento compara «Temporadas» (como antes) o los últimos 42 o 90 días
  frente al periodo anterior de igual duración o los mismos días de hace un
  año. Las curvas de periodo se calculan localmente con los mejores esfuerzos de
  cada actividad (`efforts` incluye ahora todas las duraciones).
- Cada marca de «Duraciones clave» abre su actividad con el tramo
  seleccionado. En temporadas reales también; la curva por temporadas de la demo
  es sintética y no enlaza.
- «Tiempo en zonas de potencia» suma el periodo (o la temporada principal)
  aplicando a cada actividad el FTP vigente en su fecha. Indica cuántas
  actividades cuentan y cuántas se excluyen por falta de muestras, de potencia o
  de FTP; las excluidas no suman tiempo.
- Potencia crítica y W′: modelo de 2 parámetros trabajo-tiempo (W = CP·t + W′)
  ajustado por mínimos cuadrados con los mejores 5, 10 y 20 min del periodo.
  Solo se muestra si existen los tres, bajan con la duración, R² ≥ 0,98 y W′
  está entre 3 y 40 kJ; si no, «Insuficiente» con el motivo. Sustituye a los
  valores fijos que mostraba la demo. El FTP configurado no cambia nunca por
  este cálculo.
- `curva_potencia` admite `dias` y `referencia` (`anterior` o `hace_un_ano`):
  devuelve cada marca con su actividad y tramo, que aparecen como referencias
  navegables, y el ajuste CP/W′ o por qué no es fiable.

Validación: typecheck, lint y 140 pruebas unitarias correctos, incluidos el
origen de cada marca, el ajuste con datos ideales, faltantes, no decrecientes o
submáximos, las zonas con cobertura parcial y la comparación del entrenador.
Suite Electron completa correcta (19); una nueva cambia a 42 días, comprueba la
cobertura de zonas y la referencia sin datos de hace un año, y abre la actividad
de la marca de 20 min con su tramo. Revisión visual en ambos temas sin errores
en consola. Límites: el tiempo en zonas lee las muestras de todo el periodo en
cada consulta; el modelo no puede saber si un esfuerzo fue máximo; sin validar
con datos reales de Garmin.

## Fase 3.5 — Importación y exportación manual (29/10/2026)

- «Importar FIT» en Actividades (solo con datos de Garmin; la demo no acepta
  archivos reales) admite varios `.fit` o `.zip` y reutiliza el decodificador de
  Garmin. Solo admite ciclismo. El resumen se calcula con las muestras; IF y TSS
  se toman del archivo solo si el dispositivo los guardó.
- Identidad: `fit-<inicio>-<número de serie>`, de modo que el mismo archivo se
  reconoce como «Ya estaba importado». Duplicados: una actividad que empieza a
  menos de 60 s de otra del histórico se rechaza. La regla es «la primera copia
  gana»: si después llega de Garmin la misma salida, la sincronización la omite.
- Procedencia: las actividades importadas guardan `provenance` (archivo de
  origen), el detalle muestra «Importada de …» y la nota de IF/TSS lo indica. No
  se piden umbrales a Garmin a partir de ellas.
- «Exportar CSV» guarda la lista filtrada (RFC 4180, coma y punto decimal) con
  sensaciones declaradas, etiqueta automática y procedencia; el texto que
  empieza por `=`, `+`, `-` o `@` se protege para que una hoja de cálculo no lo
  ejecute como fórmula.
- «Exportar informe» guarda un HTML autónomo, sin scripts y con todo el texto
  escapado, de una actividad (resumen, sensaciones declaradas, vueltas y mejores
  esfuerzos) o de una comparación (A, B y cambio). Los datos de la demo llevan
  siempre el aviso «Datos de demostración».
- Los errores de lectura de disco no se reenvían al renderer porque incluyen
  rutas locales.

Validación: typecheck, lint y 145 pruebas unitarias correctos, incluidos la
identidad y el tipo de una actividad FIT, el rechazo de no ciclismo y no FIT, la
omisión en la sincronización de la copia de Garmin, el escape de CSV y HTML y el
aviso de demo. Suite Electron completa correcta (20); una nueva importa con
diálogos simulados, rechaza copia, archivo dañado, inexistente y duplicado por
hora, y exporta CSV e informe. Revisión visual en ambos temas. Límites: sin
probar con archivos FIT reales de otros fabricantes; el entrenador no recibe la
procedencia; la plantilla del informe no sigue el tema de la app.

## Fase 4.1 — Récords personales al sincronizar (29/10/2026)

- El Dashboard muestra «Nuevas marcas de potencia» cuando una actividad
  posterior a la última revisión supera la mejor marca anterior de esa
  duración en todo el histórico. Cada fila enlaza la actividad y el tramo de la
  nueva marca y de la anterior. «Entendido» cierra el aviso.
- Revisión: `recordsSince:<origen>` guarda la fecha de la última actividad
  revisada. Solo avanza, entra en las copias de seguridad y es independiente
  para la demo y para Garmin. Al cerrar el aviso avanza hasta la marca más
  reciente, de modo que las actividades posteriores que aún esperan muestras
  siguen pendientes.
- Sin avalancha inicial: la primera importación completa se considera
  histórico. La fecha se fija en silencio cuando no hay sincronización en
  curso y ya hubo una completa (o Garmin no está configurado, en el caso de
  importar solo FIT). Garmin descarga del más antiguo al más reciente, así que
  una primera importación interrumpida no la fija.
- Reutiliza los mejores esfuerzos guardados y su tramo (fase 3.4). Solo cuentan
  ventanas con potencia en todo el tramo; una duración sin un esfuerzo anterior
  no es una marca y los empates tampoco.

Validación: lint, typecheck y 149 pruebas unitarias correctas (4 nuevas: marca
frente a todo lo anterior, duración sin precedente, potencia ausente, límite
de la fecha y empates). Suite Electron completa correcta (21). La nueva prueba
siembra un histórico inicial que ya contiene una mejora y comprueba que no
avisa; añade una marca y una actividad sin potencia y reinicia; comprueba una
sola fila, abre el tramo, cierra el aviso, reinicia sin que vuelva a aparecer y
verifica el aislamiento de la demo. Capturas revisadas en ambos temas
(`test-results/records-dark.png`, `test-results/records-light.png`).

Ensayo de solo lectura con las 241 actividades reales (80 con potencia, desde
el 4/1/2026): sin marcas en los últimos 90 días, lo que coincide con una
consulta SQL directa de máximos por año. Con fechas de revisión más antiguas
detecta las marcas de marzo a julio. Menos de 1 ms por cálculo. No se modificó
la base del usuario.

Límites: una actividad importada con fecha anterior a la última revisión no
genera aviso; un pico aislado del medidor puede aparecer como marca de 1 s o
5 s, sin filtrado de valores atípicos; la demo no tiene marcas recientes, por
lo que el panel no aparece en ella; el entrenador no recibe el aviso.

## Fase 4.2 — Dónde gané tiempo (29/10/2026)

- La comparación de dos intentos de un segmento añade «Dónde se ganó o perdió
  tiempo»: tramos de 1 km (de 250 m si el segmento mide menos de 2 km) con el
  cambio A − B, el resultado en palabras y si contienen un hueco. Pulsar un
  tramo selecciona esa distancia en los cuatro gráficos; Esc la limpia.
- El cambio de cada tramo es la diferencia acumulada al final menos al inicio,
  calculada sobre las mismas filas alineadas de la 2.3, así que la suma de los
  tramos es el total. Un límite que cae dentro de un hueco no se interpola:
  sus dos tramos se unen y se marcan «Con hueco». El desglose termina en la
  última distancia común con tiempo conocido. El texto advierte que viento,
  tráfico, superficie o paradas no se registran.

Validación: lint, typecheck y 153 pruebas unitarias correctas (4 nuevas: suma
igual al total con interpolación en el límite, unión y marca de huecos, final
en la última diferencia conocida y entradas no válidas, y filas reales de
`compareSegmentAttempts`). La prueba Electron de resultados de segmentos
comprueba la tabla, la selección compartida en los cuatro gráficos y Esc, con
capturas en ambos temas (`test-results/segment-sectors-*.png`).

Ensayo de solo lectura con los dos intentos más rápidos de los 4 segmentos
reales: la suma de tramos coincide con la diferencia final en todos (Alisas por
Arredondo −118,1 s en 8,23 km, Sierrapando −34,3 s, Presillas −20,2 s, Series
Pérez Galdós −6,9 s), entre 5 y 25 ms por comparación. La diferencia final
puede separarse unos segundos de la resta de duraciones porque la alineación
por distancia termina en la última distancia común y los tiempos son
aproximados entre muestras.

Cierre del bloque A: `npm run package` y `test:package` correctos.
`test:visual` ejecutado con una pantalla principal de 1920 × 1080 (con la del
portátil, de 2560 × 1600, la ventana se queda en unos 803 px de alto y no se
puede comparar). Las 26 capturas coinciden al 0,00 % con las del commit
anterior a la fase 4 (`fa27962`), ejecutado en el mismo equipo. Valores
actuales entre 0,86 % (entrenador) y 6,02 % (Dashboard); el aumento respecto a
la tabla del 27/10 procede de las ampliaciones de las fases 1–3. El panel de la
4.1 no aparece en la demo y la tabla de la 4.2 no está en las pantallas del
prototipo; ambos se revisan con sus capturas propias.
- Suite Electron: 21 de 21 tras corregir la prueba de clave de Garmin (ver
  abajo).

Límites: tramos de distancia fija, no por cambios de pendiente (las filas
alineadas no incluyen elevación); un tramo con hueco reparte el tiempo solo
entre sus extremos medidos.

### Cierre de la app en la prueba de clave de Garmin (29/10/2026)

«Garmin settings accepts the plain JWT token response» se quedaba sin cerrar la
app después de completar todos sus pasos. Reproducciones aisladas: el cierre de
Playwright (`app.close()`) justo después de guardar o desconectar la clave
tardaba de 0,6 a 8,5 s y a veces más de 90 s; en esos casos la ventana empezaba
a cerrarse antes de `before-quit` y no terminaba. Descartados: el foco del campo
de contraseña, «Cambiar clave», llamadas IPC en curso sin Garmin, el tamaño del
estado (80 KB), un aviso oculto del llavero y la latencia de `safeStorage`
(3–8 ms). Cerrando como ⌘Q (`app.quit()`) en el mismo escenario, la app salía
en 73–439 ms en 8 de 8 intentos: la aplicación sale bien y el atasco está en la
secuencia de cierre de Playwright.

La prueba cierra ahora con `app.quit()` y espera a que el proceso termine.
Repetida 3 veces (menos de 4 s cada una) y suite completa 21 de 21 en 2,8 min,
sin procesos de Electron colgados. No se ha determinado por qué el cierre de
Playwright empezó a atascarse en este equipo.

Durante la 4.3 el mismo atasco apareció en «navigation, analysis, settings,
chat and persistence». Todas las pruebas Electron cierran ahora con
`tests/e2e/quit.ts` (⌘Q y espera a la salida del proceso) en lugar de
`app.close()`. Suite completa 22 de 22 dos veces seguidas en 3,2–3,3 min (antes
6,2 min).

## Fase 4.3 — Deriva cardíaca (29/10/2026)

- Al seleccionar un tramo o una vuelta en Actividades, la barra de selección
  muestra «Deriva Pa:FC»: desacoplamiento entre la eficiencia (W/ppm) de la
  primera y la segunda mitad por tiempo, con ambas eficiencias y el VI en una
  nota. Positiva significa que la FC sube para la misma potencia. La nota
  advierte que calor, hidratación o descanso no se registran.
- Las pausas cortas se descuentan: huecos entre muestras de más de 30 s y
  paradas (velocidad 0) de hasta 2 min no cuentan en el tiempo ni en las medias,
  y la nota indica cuánto se ha descontado. Una pausa o parada de más de 2 min
  invalida el tramo. Requisitos sobre el tiempo en movimiento: al menos 20 min,
  potencia y FC en al menos el 95 % y VI ≤ 1,10 (juzgado redondeado a dos
  decimales, como se muestra). Las mitades se dividen por tiempo en movimiento.
  Si no se cumplen, se muestra «Insuficiente» y el motivo concreto.

Validación: lint, typecheck y 162 pruebas unitarias correctas (9 nuevas:
deriva nula, subida de FC con valor exacto, solo el rango elegido, tramo corto,
pausa y parada de más de 2 min, pausa y parada cortas descontadas sin alterar
el resultado, 20 min en movimiento y no transcurridos, mitades por tiempo en
movimiento, sensores ausentes, intervalos y VI en el límite). Suite Electron
completa correcta dos veces seguidas (22); la nueva siembra una vuelta estable
de 45 min con una parada de 90 s y la FC de 140 a 150 ppm (6,7 %, «sin contar
0:01:30 de pausas cortas») y otra de 15 min (insuficiente), las recorre con
← → y limpia con Esc. Capturas en ambos temas (`test-results/drift-*.png`).

Ensayo de solo lectura con las 30 últimas actividades reales con potencia y FC
(30 actividades completas y 32 vueltas de 20 min o más). Con la primera versión
(cualquier pausa de más de 30 s invalidaba el tramo) solo eran calculables 2;
30 rechazos eran pausas de 31 a 153 s. Descontando las de hasta 2 min, son
calculables 7 (entre −8,5 % y 14,2 %, VI de 1,04 a 1,10, hasta 63 s
descontados). Rechazos restantes: 46 por VI de más de 1,10, 8 por pausas de más
de 2 min y 1 vuelta que queda por debajo de 20 min en movimiento. Hasta 2,3 ms
por tramo. El primer ensayo encontró además que una vuelta con VI real 1,104 se
rechazaba mostrando «VI 1,10»; se corrigió redondeando antes de comparar. No se
modificó la base del usuario.

Límites: en terreno ondulado el VI sigue descartando la mayoría de tramos; para
esos casos conviene seleccionar a mano un tramo estable. Una deriva negativa
(la FC baja para la misma potencia) suele indicar un calentamiento incluido en
el tramo, que no se detecta. El entrenador no recibe el valor.

## Fase 4.4 — Detección de intervalos sin vueltas (29/10/2026)

- Actividades añade el panel «Bloques de trabajo» bajo las vueltas. Sobre la
  potencia suavizada en una ventana centrada de 10 s, un bloque empieza por
  encima del 88 % del FTP de la fecha y termina por debajo del 75 %, así que
  los over-unders no se parten. Bloques a menos de 15 s se unen; una pausa de
  más de 30 s cierra el bloque. Se proponen los esfuerzos de 60 s o más; los de
  20–60 s solo en series de 5 o más con recuperaciones de hasta 90 s (30/30), de
  modo que un acelerón suelto no aparece. Sin FTP de la fecha no se propone
  nada y se explica.
- Si los bloques se repiten, el detector por vueltas existente (sin cambios)
  los resume como patrón, con el aviso de que la repetición indica estructura,
  no intención.
- Corrección manual: «Descartar» un bloque, «Añadir selección» y «Restablecer
  propuesta». Se guarda como tiempos transcurridos en la tabla nueva
  `activity_blocks` (esquema 9), aparte del resumen sincronizado: la
  sincronización y «Volver a etiquetar todo» no la tocan, entra en las copias
  de seguridad (las anteriores siguen siendo válidas) y «Borrar datos» la
  elimina. IPC validado: hasta 200 rangos con inicio < fin. Pulsar un bloque
  selecciona el tramo (barra de selección y deriva).

Validación: lint, typecheck y 174 pruebas unitarias correctas (12 nuevas: 4×4
con patrón, 30/30, 3×20, over-unders, rodaje, tempo y sprints sin bloques,
acelerones sueltos frente a series, bajada breve que no parte el esfuerzo,
puerto único sin patrón, sin FTP y pausa, rangos guardados, y copias con
bloques válidos y no válidos), todas con ruido de ±12 % por muestra. Suite
Electron 22 + 1 nueva correcta: propuesta y patrón, rodaje sin bloques,
selección, descartar, añadir la vuelta, conservación tras volver a etiquetar,
reescribir el resumen como una sincronización y reiniciar, y restablecer.
Capturas en ambos temas (`test-results/blocks-*.png`). La prueba de copias
grandes compara ahora con la versión de esquema vigente.

Cierre del bloque B: `npm run package` y `test:package` correctos con el
esquema 9. `test:visual`: solo cambian las capturas inferiores de Actividades (+0,40 %
por el panel nuevo, que en la demo detecta el 3×12′ como 3 × 11:50 a 262 W) y
la de selección (+0,02 %, métrica de deriva de la 4.3); el resto, idéntico.

Ensayo de solo lectura con las 30 últimas actividades reales con potencia y el
FTP histórico de cada fecha. La primera versión proponía 15–81 bloques por
salida, casi todos acelerones de 20–60 s en terreno ondulado, y partía una
repetición de 5,5 min por una bajada breve; se añadieron la unión a 15 s y la
regla de series. Resultado final: en las 3 sesiones de intervalos el patrón
coincide con las vueltas (4 × 114 s frente a 4 × 123 s, 3 × 340 s frente a
4 × 334 s, 4 × 236 s frente a 4 × 242 s); en salidas normales, 0–28 bloques de
1–11 min, esfuerzos reales en subidas. Hasta 2,5 ms por actividad. No se
modificó la base del usuario.

Límites: en recorridos con muchas subidas se proponen muchos bloques, que hay
que descartar a mano; una repetición con una bajada de más de 15 s se parte
(el 22/10 da 3 repeticiones de 4); intervalos por debajo del 88 % del FTP
(tempo) o de menos de 20 s no se detectan; ← → sigue recorriendo las vueltas,
no los bloques; los bloques no cambian la clasificación ni llegan al
entrenador.

## Fase 4.5 — Sugerir puertos del recorrido (29/10/2026)

- Actividades añade «Puertos del recorrido»: subidas de al menos 0,5 km, 40 m
  y 3 % sobre la altitud suavizada en ±100 m de distancia. Una bajada de más de
  15 m (o del 10 % del desnivel acumulado) cierra la subida en su cima; los
  llanos de antes y después se recortan (último punto a 3 m del mínimo, primero
  a 3 m del máximo). Un salto de GPS (más de 200 m o retroceso), un hueco de más
  de 30 s o un tramo largo sin altitud cortan el perfil, así que una subida
  nunca los atraviesa.
- «Guardar como puerto» abre el creador de segmentos existente con el tramo y
  la casilla «Marcar como puerto» activada: nada se guarda hasta pulsar
  «Guardar segmento». El IPC de guardado admite ahora la marca de puerto para
  escribir el segmento en una sola operación. Después, la búsqueda histórica es
  la misma que para un segmento manual.
- Una subida que coincide en al menos la mitad con un segmento guardado
  (creado desde esta actividad o encontrado en ella por la búsqueda histórica)
  muestra «Ya guardado · nombre». Pulsar una subida la selecciona.

Validación: lint, typecheck y 179 pruebas unitarias correctas (5 nuevas:
subida con ruido barométrico de ±3 m y picos de 25 m, bajada breve frente a
bajada real, toboganes, falso llano y rampa corta, salto de GPS, hueco de tiempo
y altitud ausente, y datos sin distancia o altitud). Suite Electron completa
correcta (24); la nueva comprueba que abrir y cancelar el creador no guarda
nada, que guardar crea un puerto, que la búsqueda histórica encuentra las dos
salidas y que ambas muestran «Ya guardado». Capturas en ambos temas
(`test-results/climbs-*.png`). `test:visual`: solo cambian las capturas
inferiores de Actividades (−0,07 %, panel nuevo; en la demo, «Sin subidas
destacables»).

Ensayo de solo lectura con las 40 últimas actividades reales, antes de la
interfaz: 0–5 sugerencias por salida (53 en total, 17 salidas sin ninguna),
de 0,5 a 6 km y del 3 % al 8,5 %; 10 de los 11 pasos por segmentos guardados
quedan cubiertos por una sugerencia. Falta un paso de «Series Pérez Galdós»
(1,47 km al 3,3 %, en el límite), cuyas otras repeticiones sí aparecen. Hasta
2,3 ms por actividad. Las pruebas sintéticas encontraron antes dos fallos del
recorte de llanos (la cima avanzaba por el llano superior y un pico aislado
detenía el recorte), corregidos. No se modificó la base del usuario.

Límites: valores sobre el perfil suavizado (una subida de 2 km al 6 % se
muestra como 1,9 km al 5,9 %); subidas cortas y muy duras (menos de 0,5 km) o
tendidas (menos del 3 %) no se proponen; «Ya guardado» depende de que la
búsqueda histórica del segmento haya terminado; sin nombre sugerido.

## Fase 4.6 — Rutas habituales: medición previa (29/10/2026)

Medición de viabilidad, sin cambios en la aplicación. Prototipo fuera del
repositorio sobre una exportación de solo lectura de las 241 actividades reales
(todas con GPS; 180 MB de detalle), borrada al terminar.

Método: firma de un punto GPS cada 200 m (media de 218 puntos); comparación de
pares con longitud parecida (±25 %) y zonas que se solapan; similitud = mínimo
de la fracción de puntos de cada salida a menos de 100 m de la otra, con una
rejilla espacial.

Coste (en frío, todo el histórico): lectura 0,1–0,4 s, parseo 0,8 s, firmas y
rejilla 25 ms, comparación 1,5 s (5.709 de 28.920 pares pasan el filtro);
20 MB de memoria con solo las firmas. Una salida nueva frente a las existentes
se compara en milisegundos. El coste no es un obstáculo.

Calidad:
- Unir pares similares en cadena no sirve: al 80 % agrupa 94 salidas en 17
  grupos, pero el mayor (32 salidas, 19–34 km) tiene una similitud mínima
  interna de 0,44: mezcla recorridos distintos.
- Agrupar alrededor de un representante (la primera salida del grupo) sí: al
  80 %, 26 grupos con 91 salidas (38 % del histórico), similitud mínima interna
  de 0,75–1,0 en todos salvo dos (0,66 y 0,75), con rangos de 14–19 km o
  19–21 km. Al 85 %, 23 grupos y 79 salidas.
- Garmin nombra casi todas las salidas igual («Santander Ciclismo en ruta»),
  así que los grupos necesitan nombre y revisión del usuario.

## Fase 4.7 — Informe de temporada (29/10/2026)

- Actividades añade «Informe <año>» junto a «Exportar CSV»: la temporada es el
  año natural del filtro de año, o el actual si no hay ninguno. Guarda un HTML
  autónomo con el mismo generador de la 3.5 (sin scripts, texto escapado y aviso
  de demostración).
- Contenido: volumen (sesiones, tiempo, distancia, desnivel y TSS, con las
  sesiones sin dato contadas aparte y nunca como cero; «Sin datos» si ninguna
  lo tiene), sesiones sin potencia o FC, desglose por meses con el mes en curso
  marcado, tipos de sesión, mejores marcas de potencia con fecha y actividad
  frente al año anterior, segmentos favoritos (pasos de la temporada, mejor
  tiempo y mejor anterior, respetando exclusiones) y la lista de actividades
  de la que sale cada cifra. Un año en curso indica los días cubiertos.
- El cálculo (`src/domain/season.ts`) reutiliza `total()` del resumen semanal y
  `periodBests()` de la 3.4.

Validación: lint, typecheck y 184 pruebas unitarias correctas (5 nuevas: año
completo y en curso, datos ausentes y meses que suman el total, marcas con
origen y año anterior, informe con escape, demo y segmentos, y dato ausente
mostrado aparte). Suite Electron completa correcta (25); la nueva marca un
segmento de la demo como favorito, exporta el informe con el diálogo simulado y
comprueba el aviso de demostración, el escape del nombre, que el anexo tiene
una fila por actividad del año y que el filtro de año cambia la temporada.
`test:visual`: +0,01 % en las capturas con la lista de Actividades (botón
nuevo); el resto, idéntico.

Ensayo de solo lectura con el histórico real: 2025 (87 sesiones, sin potencia:
TSS «Sin datos» y sin marcas) y 2026 (86 sesiones, en curso, 302 días; 6 sin
TSS). En ambos, tiempo, distancia, desnivel y TSS coinciden exactamente con la
suma de las actividades listadas; menos de 50 ms por informe. No hay segmentos
favoritos reales; para revisar esa sección se simularon los 3 puertos como
favoritos. La revisión del texto llevó a mostrar los totales de tiempo como
«161 h 57» en lugar de «161:56:32». Datos exportados borrados al terminar.

Límites: el informe no sigue el tema de la app; la temporada es siempre el año
natural UTC; sin gráficos; los segmentos solo aparecen si están marcados como
favoritos y su búsqueda histórica ha terminado.

## Cierre de la fase 4 (29/10/2026)

Entregadas 4.1, 4.2, 4.3, 4.4, 4.5 y 4.7; la 4.6 se midió y quedó aplazada por
decisión del propietario. Cierre del bloque D (y de la fase): lint, typecheck,
184 pruebas unitarias, 25 recorridos Electron, `test:visual`, `npm run package`
y `test:package` correctos.

## Fase 5.1 — Medición con un histórico grande (29/10/2026)

`npm run measure -- <actividades>` (por defecto 1.000) genera un perfil
temporal de Garmin con actividades sintéticas de 2 h a 1 Hz con GPS, potencia y
FC (unos 0,9 MB por actividad, como el histórico real), lo abre en Electron y
mide: arranque hasta ver la lista, `getState`, búsqueda por nombre, cambio de
pantalla, memoria y búsqueda de un segmento que pasa dos veces por salida. El
resultado queda en `artifacts/measure/<n>.json` (no se versiona) y el perfil se
borra al terminar. `MEASURE_QUICK=1` omite la búsqueda de segmento.

| 1.000 actividades (909 MB) | Antes | Después |
| --- | ---: | ---: |
| Arranque hasta la lista | 8,2 s | 7,0–12,1 s |
| `getState` (cada refresco) | 840 ms | 24–39 ms |
| Buscar «0777» / pulsación al escribir | 635 ms / – | 136–213 ms / 74–92 ms |
| Cambiar a Rendimiento | 2.351 ms | 450–533 ms |
| Volver a Actividades | 787 ms | 102–152 ms |
| Memoria total (todos los procesos) | 529 MB | 436 MB |
| Búsqueda de segmento (2.000 pasos) | 136 s | 23,7 s |

Con 250 actividades: arranque 4,4 s, `getState` 9 ms, Rendimiento 516 ms,
búsqueda de segmento 3 s (500 pasos) y `getState` durante esa búsqueda
340 ms de mediana (470 ms de máximo). Con 10 actividades el arranque es 2,7 s:
es el coste fijo de Electron.

Causas y cambios justificados por la medición:
- La columna `best` está detrás del detalle completo en la fila, así que leerla
  obligaba a SQLite a recorrer todo el detalle de cada actividad en cada
  refresco. Ahora se guarda en memoria hasta que cambia la revisión de
  actividades. Eso explica también la búsqueda de segmentos: cada aviso de
  progreso pedía un estado de casi 1 s.
- La lista de Actividades pinta 100 filas y ofrece «Mostrar 100 más». Los
  filtros, contadores e informes siguen usando la lista completa.

No se ha optimizado, con su motivo:
- El arranque crece unos 6–9 s por cada 1.000 actividades porque la cobertura
  de muestras lee una vez cada detalle. Con un histórico como el real (241
  actividades) son unos 1,7 s sobre el coste fijo. Guardarla exigiría un esquema
  nuevo y cambios en las copias; se reconsiderará si los históricos reales lo
  piden.
- La búsqueda de segmentos sigue en el proceso principal cediendo el turno entre
  actividades: la app responde en menos de 0,5 s mientras busca. Sin workers.
- Escribir en la búsqueda cuesta 74–92 ms por pulsación con 1.000 actividades;
  aceptable, sin virtualización.

Validación: lint, typecheck, 185 pruebas unitarias y 26 recorridos Electron.

## Fase 5.2 — Integración continua (29/10/2026)

[CI](.github/workflows/ci.yml) se ejecuta en cada push a `main`, en cada pull
request y a mano. En Ubuntu: lint, typecheck y pruebas unitarias. En macOS 15:
la suite Electron completa (`npm run test:e2e`) y `scripts/visual.mjs`, que sube
las capturas de ambos temas junto al prototipo como artefacto `visual-review`
para revisarlas; no falla por diferencias. Si falla la suite, sube
`test-results/`. Release conserva sus propias comprobaciones.

Límite: el workflow no se ha ejecutado todavía en GitHub (el repositorio local
no tiene `gh` y no se ha subido nada). El primer push mostrará si el llavero de
los runners de macOS admite `safeStorage` sin intervención.

## Fase 5.3 — Migraciones, restauración y FIT difíciles (29/10/2026)

- Nueva prueba Electron: perfiles con esquema 4, 5, 6, 7 y 8 (sin las tablas que
  llegaron después) migran al 9 al abrirse, conservan las actividades y las
  sensaciones guardadas cuando su esquema ya las tenía y dejan la copia
  `antes-de-migrar-v<n>`. Ya existían la migración desde la v1 con restauración
  de su copia en el perfil y la copia previa de un perfil v4 grande.
- Nueva prueba unitaria de FIT sin GPS, con una parada de 10 minutos (el tiempo
  transcurrido la incluye y no se inventan muestras) y truncado a la mitad
  (error, sin actividad). Los FIT de prueba se generan en la propia prueba con el
  SDK de Garmin: no se versionan archivos de entrenamientos reales.

Validación: lint, typecheck, 185 pruebas unitarias y 26 recorridos Electron.
