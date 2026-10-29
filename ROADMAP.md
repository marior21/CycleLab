# Roadmap de CycleLab

Fecha: 27 de octubre de 2026.

## Dirección del producto

CycleLab debería ayudarte a responder tres preguntas: **qué ha cambiado en mi rendimiento, por qué y qué merece la pena revisar en mi siguiente entrenamiento**. Su mayor oportunidad está en unir el análisis de actividades, los segmentos personales y un entrenador que pueda justificar cada conclusión con tus datos.

Mi prioridad sería consolidar esa experiencia antes de ampliar proveedores o añadir planificación compleja. Ya hay bastante funcionalidad; ahora falta que las piezas compartan contexto y que el usuario pueda confiar en el histórico y en sus comparaciones.

Este documento distingue capacidades presentes, carencias observadas en el código y propuestas de producto. Se basa en la lectura del repositorio, `README.md`, `VALIDATION.md` y las reglas de diseño. No es una auditoría completa ni una nueva validación de las conexiones reales. Las fases expresan orden recomendado, no fechas comprometidas.

## Lo que ya existe

- App Electron con temas claro/oscuro, fuentes locales, atajos y separación entre demo y datos reales.
- Importación Garmin de todo el histórico, persistencia SQLite, reanudación y tratamiento de errores de descarga.
- Actividades con filtros por fechas y tipo, clasificación automática explicada, vueltas, selección de tramos y comparación entre dos sesiones.
- Curva de potencia por año, mejores esfuerzos y carga CTL/ATL/TSB con advertencia de cobertura.
- Creación de segmentos, búsqueda de pasos por GPS en el histórico y marcado manual como puerto.
- MapLibre y MapTiler, coloreado de rutas, cursor compartido y selección sobre el mapa.
- Entrenador OpenRouter con herramientas locales, gráficas, tablas e historial persistente.
- Credenciales cifradas mediante `safeStorage`, IPC validado y pruebas unitarias, Electron y visuales.

Garmin real, OpenRouter y cartografía real **no son pendientes de implementación**, aunque queda validación con cuentas reales documentada. El código ya ha superado varias fases del planteamiento inicial de `AGENTS.md`.

## Orden recomendado

| Fase | Resultado buscado | Prioridad | Tamaño relativo |
| --- | --- | --- | --- |
| 1. Confianza | Datos recuperables, cobertura comprensible y regresiones controladas | P0 | M–L |
| 2. Análisis conectado | Comparar esfuerzos y preguntar por exactamente lo que estás viendo | P1 | L |
| 3. Seguimiento | Entender tendencias y relacionarlas con sensaciones y objetivos | P1 | L |
| 4. Diferenciación | Descubrir mejoras y comparar tus recorridos habituales | P2 | M–L por función |
| 5. Distribución | Instalar y actualizar con seguridad fuera del entorno de desarrollo | P1 antes de distribuir | M–L |

S = cambio localizado; M = varias capas o pantallas; L = datos, cálculos o flujos nuevos con validación significativa. Son orientaciones, no estimaciones en días. Las fases se pueden entregar por partes.

## Fase 1 — Poder confiar en la app

### 1.1. Cerrar la regresión pendiente de mapas · P0 · M

`VALIDATION.md` registra que una prueba de MapTiler falla al esperar el esquema alternativo tras una desconexión simulada y un cambio de tema. También documenta la decisión de conservar el canvas ante errores parciales de tiles. Hay que resolver qué comportamiento corresponde a cada situación antes de cambiar código o expectativas del test.

**Entrega:** arranque fallido, error parcial, cambio de tema y recuperación tienen estados claros; la ruta sigue siendo consultable cuando sea posible.

**Terminado cuando:** la prueba reproduce y distingue esos casos, pasa de forma repetible y se revisan ambos temas. Completar además una comprobación con cartografía real, sin confundir el tile simulado de los tests con esa validación.

**Completada el 28/10/2026.** La ruta se carga al disponer del estilo; los errores parciales conservan el mapa y los fallos de estilo muestran el esquema alternativo. La prueba distingue estilos en caché y arranques sin caché, cambios de tema y recuperación. Validación con MapTiler real en ambos temas, incluida la corrección de tiles vacíos HTTP 204. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-11--regresión-de-mapas-cerrada-28102026).

### 1.2. Copias de seguridad y recuperación · P0 · M

SQLite ya conserva actividades, segmentos y conversaciones, pero falta un flujo de copia/restauración en la app. Perder los segmentos personales o las notas futuras sería más grave que tener que volver a descargar actividades.

**Entrega mínima:** exportar una copia consistente y versionada, restaurarla con validación y conservar una copia previa antes de migraciones. Separar datos personales de credenciales; al mover datos a otro Mac, pedir de nuevo las claves.

**Terminado cuando:** se recuperan segmentos, conversaciones y ajustes en un perfil limpio; una copia dañada o incompatible no sustituye la base válida. No copiar sin más el archivo SQLite mientras está abierto en modo WAL.

**Completada el 28/10/2026.** Exportación y restauración desde Ajustes mediante copias lógicas versionadas, consistentes en WAL y sin credenciales. Validación de integridad y contenido, reemplazo transaccional y copia automática previa a restauraciones y migraciones. Recuperación verificada en un perfil limpio, con rechazo de archivos dañados/incompatibles y rollback ante fallo de escritura. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-12--copias-de-seguridad-y-recuperación-28102026).

### 1.3. Cobertura y procedencia de cada métrica · P0 · M

La carga actual excluye actividades sin TSS y arranca desde CTL/ATL cero. La advertencia ya existe, pero conviene convertirla en información útil para interpretar el gráfico.

**Entrega:** indicar actividades con/sin potencia, FC, GPS, TSS y muestras descargadas dentro del periodo seleccionado. Distinguir datos de Garmin, cálculos locales y estimaciones. Mostrar qué falta y permitir reintentar las descargas fallidas.

**Terminado cuando:** un periodo incompleto no parece equivalente a uno completo, y una métrica desconocida nunca aparece como cero. El entrenador recibe la misma información de cobertura.

**Completada el 28/10/2026.** Cobertura por filtros y temporadas de potencia, FC, GPS, TSS y muestras; distingue ausencia de datos y sensores sin comprobar. Procedencia visible y compartida con el entrenador, carga identificada como estimación y reintento de las descargas fallidas del periodo. El TSS diario desconocido, las zonas sin muestras y el W/kg sin FTP conservan su estado ausente. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-13--cobertura-y-procedencia-28102026).

### 1.4. Historial de FTP, peso y LTHR · P1 · L

Actualmente el perfil contiene un único valor de cada magnitud. Eso limita la interpretación de W/kg y zonas al comparar temporadas.

**Entrega mínima:** valores con fecha de vigencia; conservar las métricas importadas y distinguirlas de las recalculadas. Si se ofrece recalcular IF/TSS o zonas, hacerlo explícitamente y con el umbral correspondiente a la actividad. No inventar valores históricos para rellenar huecos.

**Terminado cuando:** cambiar el FTP de hoy no modifica silenciosamente el significado de una sesión de hace dos años, y las comparaciones indican qué peso/umbral utilizan.

**Completada el 28/10/2026.** Historial por magnitud, fecha UTC y procedencia, editable desde Ajustes y recuperable en copias. Zonas y W/kg utilizan referencias de la actividad; las comparaciones muestran el perfil aplicado y las curvas el peso de cada marca. Se conservan IF/TSS importados y los huecos históricos. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-14--historial-de-ftp-peso-y-lthr-28102026).

### 1.5. Mantenimiento y privacidad comprensibles · P1 · M

- Ver espacio ocupado y estado de las importaciones; pausar/cancelar sin perder lo ya descargado.
- Borrar conversaciones o datos locales por origen con confirmación y alcance claro.
- Explicar qué contexto y resultados se envían a OpenRouter antes del primer uso real; mantener la exclusión de GPS y secretos.
- Permitir exportar un diagnóstico sin claves, coordenadas ni contenido privado por defecto.
- Alinear la documentación inicial con las funciones actuales: seis accesos principales, mapas reales y proveedores reales.

**Completada el 28/10/2026.** Ajustes incorpora almacenamiento y estado por origen, pausa/cancelación persistentes, borrado confirmado, explicación y aceptación previa al entrenador real y diagnóstico sin contenido privado. Documentación actualizada y pruebas de aislamiento, persistencia y reanudación. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-15--mantenimiento-y-privacidad-28102026).

## Fase 2 — Conectar las funciones que ya están

### 2.1. Que el entrenador entienda tus segmentos y puertos · P1 · M

Es la carencia funcional más clara: la interfaz de Puertos usa segmentos guardados y coincidencias GPS, mientras `comparar_ascensiones` sigue consultando el catálogo antiguo. En datos reales, `realDataset` devuelve ese catálogo vacío. La información existe, pero no llega a esa herramienta.

**Entrega:** consultar segmentos y sus resultados persistidos, seleccionar intentos por fecha y mostrar cobertura/estado de la búsqueda. Actualizar también el contador de ascensiones del entrenador.

**Terminado cuando:** «Compara mis dos últimas subidas a este puerto» usa los mismos intentos que la pantalla Puertos, enlaza las actividades y explica cuándo faltan datos o las coincidencias son aproximadas.

**Completada el 28/10/2026.** El entrenador consulta segmentos y resultados persistidos por origen, selecciona los dos últimos intentos con filtros de fecha y muestra cobertura, estado y límites de las coincidencias GPS. Las tablas abren las actividades y el contador suma los intentos de los segmentos marcados como puerto. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-21--segmentos-y-puertos-en-el-entrenador-28102026).

### 2.2. Preguntar por la selección actual · P1 · M

El contexto enviado al entrenador incluye pantalla y actividad, pero no el intervalo seleccionado, el segmento ni la pareja que se compara.

**Entrega:** acciones «Analizar este tramo» y «Explicar esta comparación», con contexto visible y datos calculados localmente. La búsqueda del entrenador debe aceptar fechas y tipos, e indicar cuándo limita resultados: actualmente devuelve hasta 20 actividades por texto.

**Terminado cuando:** al seleccionar cuatro repeticiones, la respuesta trata esas cuatro; al consultar un año antiguo, no responde únicamente con las actividades recientes. Los resultados permiten volver a la actividad o selección de origen.

**Completada el 28/10/2026.** Selección de tramos e intervalos múltiples, pareja de actividades y segmento actual compartidos con el entrenador; métricas y diferencias calculadas localmente, contexto visible y enlaces de vuelta al tramo. La búsqueda filtra todo el histórico por fechas y tipos, pagina y declara sus límites. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-22--preguntar-por-la-selección-actual-28102026).

### 2.3. Comparar intentos de un segmento visualmente · P1 · L

La tabla histórica es útil; el siguiente salto es saber dónde se ganó o perdió tiempo.

**Entrega mínima:** elegir dos intentos y superponer potencia, FC y velocidad sobre distancia recorrida, con diferencia de tiempo acumulada y navegación a cada actividad. Reutilizar gráficos y selección existentes.

**Terminado cuando:** la alineación respeta huecos y sentido del recorrido; se explican los tiempos aproximados y no se interpolan grandes tramos sin datos como si fueran medidos.

**Completada el 28/10/2026.** Selección de dos intentos en Segmentos y Puertos, superposición de potencia, FC y velocidad por distancia y diferencia acumulada A − B. Cursor y selección compartidos, acceso a cada actividad con su tramo y cortes explícitos ante huecos. Se mantienen el recorrido y sentido verificados por la búsqueda, sin estirar distancias ni extrapolar. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-23--comparación-visual-de-intentos-28102026).

### 2.4. Gestionar y revisar los segmentos · P1 · M

- Renombrar y buscar segmentos; marcar favoritos.
- Excluir una coincidencia incorrecta con motivo y restaurarla después.
- Conservar exclusiones y nombres al recalcular resultados.
- Mostrar mejor marca, último intento y evolución sin abrir cada actividad.

Esto es especialmente importante porque la tolerancia GPS puede confundir caminos paralelos. Primero dar control sobre las coincidencias; después ampliar la detección automática.

**Completada el 29/10/2026.** Segmentos y Puertos permiten buscar por nombre, renombrar y marcar favoritos (primeros en la lista). Cada coincidencia GPS se puede excluir con motivo y restaurar; las exclusiones y el nombre se guardan en el segmento, sobreviven al recálculo y a las copias, y se aplican en mejor tiempo, comparación, contador de ascensiones y entrenador. Resultados muestra mejor marca, último intento y evolución del tiempo por fecha. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-24--gestión-y-revisión-de-segmentos-29102026).

### 2.5. Un chat más cómodo y trazable · P1 · M

- Cancelación de una respuesta en curso y texto progresivo cuando el proveedor lo permita.
- Conversaciones separadas por tema, con título, búsqueda y borrado, manteniendo el aislamiento demo/Garmin.
- Referencias navegables a actividades, periodos e intentos utilizados.
- Consumo y coste cuando el proveedor los devuelva; diferenciar coste observado de estimación y permitir un límite de gasto por petición.

**Terminado cuando:** cancelar libera la interfaz, los fallos conservan la pregunta y cualquier conclusión importante puede rastrearse a sus datos. La cancelación no debe prometer anular costes ya incurridos.

**Completada el 29/10/2026.** «Detener» cancela la respuesta en curso, conserva lo recibido y devuelve la pregunta al cuadro de texto; el texto de OpenRouter llega progresivamente. Las conversaciones están separadas por origen y tienen título, búsqueda, renombrado y borrado. Cada respuesta enlaza las actividades, intentos, tramos y periodos que ha utilizado. Muestra tokens y coste (observado o estimado) y admite un límite de gasto por petición. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-25--un-chat-más-cómodo-y-trazable-29102026).

## Fase 3 — Pasar del análisis puntual al seguimiento

### 3.1. Resumen semanal que invite a volver · P1 · M

Una vista con volumen, desnivel, distribución de intensidad, mejores esfuerzos y comparación con la semana anterior o una media reciente. Cada cambio abre las actividades que lo explican.

Empezar con cálculos locales y un resumen determinista; añadir una explicación IA bajo demanda. No generar llamadas de pago por abrir el Dashboard.

**Terminado cuando:** semanas parciales y datos ausentes están identificados y se puede reconstruir cada total desde sus actividades.

**Completada el 29/10/2026.** Resumen semanal en el Dashboard: volumen, desnivel, carga, intensidad por IF y mejores esfuerzos frente a la semana anterior o la media de cuatro. La semana en curso se compara con los mismos días, los datos ausentes se cuentan aparte y nunca suman cero, y cada total y cada esfuerzo abre sus actividades. El resumen es local y determinista; la explicación IA solo se pide con «Explicar». Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-31--resumen-semanal-29102026).

### 3.2. Sensaciones y corrección manual · P1 · M

Añadir RPE, notas y una valoración simple de fatiga por sesión; permitir corregir la etiqueta automática sin perder su motivo original. Una sesión puede sentirse dura aunque los vatios sean normales.

**Terminado cuando:** la sincronización y «Volver a etiquetar todo» conservan las decisiones manuales, y el entrenador distingue sensaciones declaradas de métricas registradas.

**Completada el 29/10/2026.** Cada actividad admite RPE, fatiga, notas y una etiqueta manual que conserva la automática y su motivo. Se guardan aparte del resumen sincronizado, por lo que la sincronización y «Volver a etiquetar todo» no las tocan, y entran en las copias de seguridad. El entrenador las recibe como sensaciones declaradas, separadas de las métricas. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-32--sensaciones-y-corrección-manual-29102026).

### 3.3. Objetivos reales · P1 · M

Los objetivos actuales pertenecen a la demo. Añadir nombre, fecha, tipo de prueba y objetivo personal, visibles en Dashboard y disponibles para el entrenador.

La primera versión debe servir para contextualizar el seguimiento. No hace falta un calendario de entrenamiento completo ni prescribir un CTL objetivo automáticamente.

**Terminado cuando:** se pueden crear, editar y archivar objetivos reales, persisten tras reiniciar y el entrenador no los confunde con eventos de demostración.

**Completada el 29/10/2026.** El Dashboard permite crear, editar, archivar y restaurar objetivos reales con nombre, fecha, tipo de prueba y objetivo personal. Persisten por origen, entran en las copias de seguridad y la demo conserva sus objetivos ficticios sin poder editarlos. El entrenador recibe solo los activos, marcados como del usuario o de demostración. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-33--objetivos-reales-29102026).

### 3.4. Rendimiento con referencias útiles · P1 · L

- Comparar últimos 42/90 días con otro periodo, además de años naturales.
- Abrir la actividad y el tramo que originaron cada mejor esfuerzo de la curva.
- Mostrar distribución de tiempo en zonas para el periodo y su cobertura.
- Añadir potencia crítica y W′ solo después de definir el modelo, sus requisitos de datos y la calidad del ajuste. Hoy esas métricas reales no están calculadas.

**Terminado cuando:** cada récord es trazable; el modelo se oculta o se marca como insuficiente cuando los esfuerzos disponibles no permiten un ajuste defendible. Evitar convertir una estimación de FTP en un valor configurado sin intervención del usuario.

**Completada el 29/10/2026.** Rendimiento compara los últimos 42/90 días con el periodo anterior o con hace un año, cada marca abre su actividad y tramo, y el tiempo en zonas del periodo usa el FTP de cada fecha e indica su cobertura. CP y W′ salen de un modelo trabajo-tiempo con 5, 10 y 20 min y se marcan insuficientes cuando el ajuste no es defendible; el FTP configurado no cambia. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-34--rendimiento-con-referencias-útiles-29102026).

### 3.5. Importación y exportación manual · P2 · M–L

Importar FIT local reutilizando el decodificador; exportar tablas CSV y un informe sencillo de actividad o comparación. Resolver identidad, duplicados y procedencia antes de mezclar archivos con Garmin. Empezar por FIT y CSV; otros formatos solo si hay una necesidad concreta.

**Completada el 29/10/2026.** Actividades importa archivos FIT locales al histórico real con identidad estable, rechazo de duplicados por hora de inicio en ambos sentidos y procedencia visible. Exporta la lista filtrada en CSV y un informe HTML de actividad o comparación, con la demo siempre marcada. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-35--importación-y-exportación-manual-29102026).

## Fase 4 — Cosas que podrían molar de verdad

| Idea | Valor para el ciclista | Primera versión razonable | Dependencia |
| --- | --- | --- | --- |
| «Dónde gané tiempo» | Entender una mejora en un puerto | Diferencia acumulada entre dos intentos sobre distancia | Comparación de segmentos y alineación fiable |
| Récords personales al sincronizar | Descubrir un nuevo mejor esfuerzo sin buscarlo | Resumen local de marcas con acceso al tramo | Procedencia de la curva y cobertura |
| Rutas habituales | Comparar salidas parecidas a lo largo del año | Agrupar recorridos completos con revisión manual | Coincidencia GPS validada y trabajo de rendimiento |
| Deriva cardíaca y resistencia a la fatiga | Explorar cómo cambia la relación potencia/FC | Comparar mitades de un tramo estable con cobertura suficiente | Tratamiento de pausas, intervalos y sensores ausentes |
| Detección de intervalos sin vueltas | Analizar sesiones no estructuradas en Garmin | Proponer bloques sobre la señal de potencia y permitir corregirlos | Validación con protocolos variados; conservar el detector actual |
| Sugerir puertos del recorrido | Ahorrar selección manual | Detectar ascensos por perfil y pedir que el usuario los guarde | Suavizado de elevación y validación de GPS |
| Informe de temporada | Compartir o guardar una visión completa | Resumen exportable con volumen, marcas y segmentos favoritos | Periodos, fuentes de métricas y exportación |

Estas ideas deben mostrar limitaciones de medición. Una mejora de tiempo no demuestra por sí sola una mejora fisiológica: pueden influir tráfico, viento, superficie o condiciones que CycleLab aún no registra.

Se entregan en cuatro bloques y en este orden: A parte de lo que ya existe, B analiza la señal, C trabaja sobre la geografía y D resume. Cada entrega se cierra igual: cálculo en `src/domain` con pruebas unitarias que incluyan casos negativos (huecos, pausas, sensores ausentes, cobertura insuficiente, demo); IPC validado si hace falta; una prueba Electron propia con reinicio y aislamiento demo/Garmin; lint, typecheck, pruebas unitarias y suite Electron completas; capturas en ambos temas; ensayo de solo lectura con el histórico real cuando aplique; entrada en `VALIDATION.md` y un commit. Al final de cada bloque se ejecutan además `test:visual`, `package` y `test:package`.

### 4.1. Récords personales al sincronizar · Bloque A · S–M

Al terminar una sincronización o una importación FIT, mostrar las marcas de la curva de potencia que superan el mejor valor anterior, con acceso a la actividad y al tramo. Reutilizar la procedencia de la curva de la fase 3.4.

**Terminado cuando:** una actividad nueva con una marca genera un aviso que abre su tramo; volver a sincronizar o reiniciar no repite el aviso; las actividades sin potencia o con cobertura insuficiente no generan marcas; la primera importación del histórico no inunda de avisos; la demo queda marcada.

**Completada el 29/10/2026.** El Dashboard avisa de las marcas de potencia de las actividades posteriores a la última revisión que superan todo el histórico anterior, con enlace a su tramo y al de la marca previa. «Entendido» lo cierra para siempre; la primera importación completa se toma como histórico sin avisar. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-41--récords-personales-al-sincronizar-29102026).

### 4.2. Dónde gané tiempo · Bloque A · S

Ampliar la comparación de intentos de la 2.3 con un desglose por tramos (kilómetro o cambio de pendiente) de dónde se ganó o perdió tiempo.

**Terminado cuando:** la suma de los tramos coincide con la diferencia total salvo redondeo; los huecos se excluyen y se señalan; se advierte que viento, tráfico o superficie también influyen.

**Completada el 29/10/2026.** La comparación de intentos desglosa la diferencia A − B en tramos de 1 km (250 m en segmentos cortos) que suman exactamente el total; los límites dentro de un hueco unen sus tramos y los marcan, y cada tramo selecciona su distancia en los gráficos. Con ella se cierra el bloque A: `test:visual`, `package` y `test:package` correctos, sin cambios visuales frente a la fase 3. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-42--dónde-gané-tiempo-29102026).

### 4.3. Deriva cardíaca y resistencia a la fatiga · Bloque B · M

Comparar la relación potencia/FC entre las dos mitades de un tramo estable.

**Terminado cuando:** solo se calcula sobre tramos estables, sin pausas y con cobertura de potencia y FC suficiente; en otro caso se marca como insuficiente y se explica por qué.

**Completada el 29/10/2026.** Al seleccionar un tramo o una vuelta, Actividades muestra la deriva Pa:FC entre mitades con sus eficiencias. Descuenta pausas y paradas de hasta 2 min y exige, en movimiento, 20 min, potencia y FC en el 95 % del tiempo y VI ≤ 1,10; si no, la marca como insuficiente con el motivo. En el histórico real cumplen los requisitos 7 de 62 tramos; en terreno ondulado conviene seleccionar a mano un tramo estable. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-43--deriva-cardíaca-29102026).

### 4.4. Detección de intervalos sin vueltas · Bloque B · M–L

Proponer bloques de trabajo sobre la señal de potencia y permitir corregirlos. El detector actual por vueltas se conserva.

**Terminado cuando:** se valida con señales sintéticas de protocolos variados (4×4, 30/30, 3×20, over-unders) y casos negativos; la corrección manual persiste tras sincronizar y volver a etiquetar.

**Completada el 29/10/2026.** Actividades propone bloques de trabajo sobre la potencia (entrada al 88 % y salida al 75 % del FTP de la fecha; esfuerzos de 60 s o más y series de 5 o más de 20–60 s) y resume su patrón con el detector por vueltas, que no cambia. Se pueden descartar, añadir desde la selección y restablecer; la corrección se guarda aparte del resumen sincronizado y sobrevive a sincronizar y volver a etiquetar. En las sesiones reales el patrón coincide con las vueltas; en salidas con muchas subidas propone bastantes bloques. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-44--detección-de-intervalos-sin-vueltas-29102026).

### 4.5. Sugerir puertos del recorrido · Bloque C · M

Detectar ascensos por perfil suavizado y proponer guardarlos como segmentos, reutilizando la creación y la búsqueda existentes.

**Terminado cuando:** nada se guarda sin confirmación; se valida con altimetría ruidosa y GPS degradado; al guardar, la búsqueda histórica funciona como con un segmento manual.

**Completada el 29/10/2026.** Actividades sugiere las subidas del recorrido (0,5 km, 40 m y 3 % sobre la altitud suavizada, sin atravesar saltos de GPS ni huecos) y marca las que ya están guardadas. «Guardar como puerto» abre el creador de segmentos con la marca de puerto y solo guarda al confirmar; la búsqueda histórica es la misma. En el histórico real cubre 10 de 11 pasos por segmentos guardados con 0–5 sugerencias por salida. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-45--sugerir-puertos-del-recorrido-29102026).

### 4.6. Rutas habituales · Bloque C · L

Agrupar recorridos completos parecidos y pedir revisión manual. Antes, medir el coste con el histórico real; si no es razonable, recortar el alcance o aplazarla.

**Terminado cuando:** los grupos propuestos se pueden aceptar o corregir, persisten y el tiempo de cálculo con el histórico real está medido y documentado.

**Medida el 29/10/2026.** Con las 241 actividades reales, agrupar todo el histórico cuesta unos 2,5 s en frío y una salida nueva, milisegundos. Unir pares en cadena mezcla rutas distintas; agrupar alrededor de un representante da 26 grupos con el 38 % de las salidas y buena coherencia. Viable, pero **aplazada el 29/10/2026** por decisión del propietario: la versión mínima (grupos por representante al 80 %, firmas guardadas, lista con evolución y revisión manual) es una entrega grande y se retomará después de la fase 4. Detalle en [VALIDATION.md](VALIDATION.md#fase-46--rutas-habituales-medición-previa-29102026).

### 4.7. Informe de temporada · Bloque D · M

HTML exportable con volumen, marcas y segmentos favoritos, reutilizando el informe de la 3.5.

**Terminado cuando:** cada cifra se puede reconstruir desde sus actividades, los periodos parciales y los datos ausentes se indican y la demo queda marcada.

**Completada el 29/10/2026.** Actividades exporta el informe del año elegido: volumen con los datos ausentes aparte, meses, tipos, marcas frente al año anterior, segmentos favoritos y la lista de actividades que respalda cada cifra; marca la temporada en curso y la demo. Con el histórico real, los totales coinciden exactamente con sus actividades. Evidencia y límites en [VALIDATION.md](VALIDATION.md#fase-47--informe-de-temporada-29102026).

**Fase 4 cerrada el 29/10/2026** con 4.1–4.5 y 4.7 entregadas y la 4.6 medida y aplazada. Evidencia en [VALIDATION.md](VALIDATION.md#cierre-de-la-fase-4-29102026).

## Fase 5 — Preparar una versión para uso diario y distribución

### Fiabilidad y rendimiento

- Medir carga de la app, búsqueda de actividades, memoria y búsqueda de segmentos con históricos representativos grandes. Registrar el punto de partida antes de optimizar.
- Si esas mediciones lo justifican, paginar/virtualizar listas, evitar recalcular agregados completos y sacar cálculos pesados del proceso principal. No introducir workers ni otra base de datos por anticipación.
- Automatizar lint, typecheck y pruebas unitarias en CI; ejecutar los recorridos Electron en macOS y revisar cambios visuales en ambos temas. El repositorio revisado no contiene `.github/`.
- Cubrir migraciones desde versiones anteriores y restauración de copias; conservar fixtures de FIT problemáticos anonimizados.
- Validar fechas cercanas a medianoche y cambios de hora. La app usa actualmente calendario UTC: decidir y documentar cómo representar el día local de una actividad sin romper filtros ni agregaciones.

### Acabado de escritorio

- Revisar a 1200 × 760 y 1440 × 900, con ambos temas, teclado, VoiceOver y movimiento reducido.
- Conservar filtros y selección al volver de una actividad; estados vacíos con una acción útil.
- Primera ejecución guiada: demo, conexión Garmin, perfil y primera sincronización. OpenRouter y MapTiler pueden configurarse después.
- Revisar la fidelidad al sistema de diseño y mantener tokens, unidades, formatos y vocabulario; las pantallas nuevas necesitan su propia referencia visual.

### Distribución

La compilación actual está documentada como no firmada ni notarizada. Antes de distribuirla: firma y notarización, instalador, prueba en un Mac limpio y política explícita de arquitecturas compatibles. Después, actualizaciones con migraciones protegidas y notas de versión. Las claves de firma y los costes asociados requieren configuración del propietario.

**Terminado cuando:** se puede instalar, actualizar y recuperar datos en un entorno limpio; los límites conocidos y las conexiones efectivamente verificadas están documentados.

### Entregas de la fase 5

Cada entrega se cierra como en la fase 4: lint, typecheck, pruebas unitarias y suite Electron completas, entrada en `VALIDATION.md` y un commit.

| Entrega | Terminado cuando |
| --- | --- |
| 5.1. Medición con un histórico grande | Hay un script reproducible que genera un perfil sintético de varios años y mide arranque, filtrado, memoria y búsqueda de segmentos; el punto de partida queda en `VALIDATION.md` y solo se optimiza lo que la medición justifica. |
| 5.2. Integración continua | Cada push y pull request ejecuta lint, typecheck y pruebas unitarias, y la suite Electron en macOS. |
| 5.3. Migraciones, restauración y FIT difíciles | Cada esquema anterior soportado migra al actual conservando datos con su copia previa; una copia de un esquema anterior se restaura en un perfil limpio; los FIT sin GPS, con pausas o truncados tienen casos de prueba. |
| 5.4. Día local de cada actividad | Las actividades se agrupan por el día en que se hicieron, en la zona horaria del lugar, sin romper filtros, semanas, meses ni temporadas; el criterio queda documentado. |
| 5.5. Acabado de escritorio | Volver a Actividades conserva filtros y selección; la primera ejecución ofrece demo, conexión Garmin, perfil y primera sincronización; los estados vacíos tienen una acción útil; revisado a 1200 × 760 y 1440 × 900 en ambos temas. |
| 5.6. Distribución | La firma y notarización se activan con los secretos del propietario sin tocar el código; la política de arquitecturas y la prueba en un Mac limpio están documentadas. La firma real, el instalador firmado y las actualizaciones automáticas dependen de las credenciales del propietario. |

**5.1–5.3 completadas el 29/10/2026.** Medición reproducible con `npm run measure`; la caché de mejores esfuerzos y la lista paginada bajan el refresco de 840 a 24–39 ms con 1.000 actividades. CI en cada push y pull request. Migraciones desde los esquemas 4–8 y FIT difíciles con prueba. Evidencia en [VALIDATION.md](VALIDATION.md#fase-51--medición-con-un-histórico-grande-29102026).

**5.4 completada el 29/10/2026.** Las actividades se fechan con el día local del lugar donde se grabaron, a partir del desfase de Garmin o del FIT, con la zona del Mac como respaldo. Evidencia en [VALIDATION.md](VALIDATION.md#fase-54--día-local-de-cada-actividad-29102026).

**5.5 completada el 29/10/2026.** Primeros pasos en Actividades hasta la primera sincronización, filtros conservados al volver y revisión a 1200 × 760 y 1440 × 900 en ambos temas con prueba propia. Queda la revisión con VoiceOver. Evidencia en [VALIDATION.md](VALIDATION.md#fase-55--acabado-de-escritorio-29102026).

**5.6 preparada el 29/10/2026.** Firma y notarización activadas por los secretos del propietario, macOS 12+ y un instalador por arquitectura, documentación de instalación, actualización y recuperación. Falta la primera release firmada, la prueba en un Mac limpio y las actualizaciones automáticas, que dependen de las credenciales del propietario. Evidencia en [VALIDATION.md](VALIDATION.md#fase-56--distribución-29102026).

## Qué dejaría fuera por ahora

- Red social, clasificaciones públicas y cuentas propias en la nube.
- Aplicación móvil y sincronización multidispositivo.
- Editor completo de rutas, navegación giro a giro, mapas 3D y satélite.
- Descarga masiva de mapas offline antes de comprobar necesidad, almacenamiento y condiciones del proveedor.
- Planificación automática de temporadas y envío de entrenamientos al dispositivo antes de tener objetivos, sensaciones y análisis fiables.
- Más proveedores o modelos locales sin una necesidad que el flujo actual no cubra.
- Una reescritura de gráficos, almacenamiento o componentes solo por preferencia tecnológica.

## Las siguientes cinco entregas que haría

1. **Resolver el caso pendiente de mapas** y dejar una validación reproducible.
2. **Añadir copia y restauración** antes de nuevas migraciones de datos personales.
3. **Conectar el entrenador con los segmentos y puertos reales**, incluidos sus contadores y cobertura.
4. **Enviar al entrenador la selección y comparación actuales**, con referencias navegables.
5. **Comparar dos intentos de un segmento** con gráficos alineados y diferencia de tiempo.

Después abordaría perfil histórico, resumen semanal, sensaciones y objetivos. Esa secuencia proporciona mejoras visibles aprovechando lo que ya existe y prepara una base más sólida para recomendaciones de entrenamiento.

## Referencias y criterio de seguimiento

Fuentes principales: [estado y límites](README.md), [validaciones anteriores](VALIDATION.md), [reglas visuales](design/README.md), [contratos y contexto IA](src/shared/models.ts), [herramientas del entrenador](src/main/coach.ts), [cálculos reales](src/domain/analysis.ts), [persistencia](src/main/store.ts), [rendimiento](src/renderer/features/Performance.tsx) y [configuración de distribución](package.json).

Cada entrega debería registrar: problema resuelto, comportamiento visible, criterio de aceptación, pruebas ejecutadas y límites pendientes. Para cambios funcionales: lint y typecheck, pruebas de lógica afectada, recorrido Electron y revisión visual cuando corresponda. Para integraciones: distinguir pruebas simuladas de comprobaciones reales.

La elaboración inicial de este roadmap solo añadió documentación, sin ejecutar la app ni los tests ni utilizar claves o datos privados. Las entregas posteriores registran su estado y validaciones en cada fase y en `VALIDATION.md`.
