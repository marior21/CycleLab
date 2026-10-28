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
