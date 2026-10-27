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

### 1.2. Copias de seguridad y recuperación · P0 · M

SQLite ya conserva actividades, segmentos y conversaciones, pero falta un flujo de copia/restauración en la app. Perder los segmentos personales o las notas futuras sería más grave que tener que volver a descargar actividades.

**Entrega mínima:** exportar una copia consistente y versionada, restaurarla con validación y conservar una copia previa antes de migraciones. Separar datos personales de credenciales; al mover datos a otro Mac, pedir de nuevo las claves.

**Terminado cuando:** se recuperan segmentos, conversaciones y ajustes en un perfil limpio; una copia dañada o incompatible no sustituye la base válida. No copiar sin más el archivo SQLite mientras está abierto en modo WAL.

### 1.3. Cobertura y procedencia de cada métrica · P0 · M

La carga actual excluye actividades sin TSS y arranca desde CTL/ATL cero. La advertencia ya existe, pero conviene convertirla en información útil para interpretar el gráfico.

**Entrega:** indicar actividades con/sin potencia, FC, GPS, TSS y muestras descargadas dentro del periodo seleccionado. Distinguir datos de Garmin, cálculos locales y estimaciones. Mostrar qué falta y permitir reintentar las descargas fallidas.

**Terminado cuando:** un periodo incompleto no parece equivalente a uno completo, y una métrica desconocida nunca aparece como cero. El entrenador recibe la misma información de cobertura.

### 1.4. Historial de FTP, peso y LTHR · P1 · L

Actualmente el perfil contiene un único valor de cada magnitud. Eso limita la interpretación de W/kg y zonas al comparar temporadas.

**Entrega mínima:** valores con fecha de vigencia; conservar las métricas importadas y distinguirlas de las recalculadas. Si se ofrece recalcular IF/TSS o zonas, hacerlo explícitamente y con el umbral correspondiente a la actividad. No inventar valores históricos para rellenar huecos.

**Terminado cuando:** cambiar el FTP de hoy no modifica silenciosamente el significado de una sesión de hace dos años, y las comparaciones indican qué peso/umbral utilizan.

### 1.5. Mantenimiento y privacidad comprensibles · P1 · M

- Ver espacio ocupado y estado de las importaciones; pausar/cancelar sin perder lo ya descargado.
- Borrar conversaciones o datos locales por origen con confirmación y alcance claro.
- Explicar qué contexto y resultados se envían a OpenRouter antes del primer uso real; mantener la exclusión de GPS y secretos.
- Permitir exportar un diagnóstico sin claves, coordenadas ni contenido privado por defecto.
- Alinear la documentación inicial con las funciones actuales: seis accesos principales, mapas reales y proveedores reales.

## Fase 2 — Conectar las funciones que ya están

### 2.1. Que el entrenador entienda tus segmentos y puertos · P1 · M

Es la carencia funcional más clara: la interfaz de Puertos usa segmentos guardados y coincidencias GPS, mientras `comparar_ascensiones` sigue consultando el catálogo antiguo. En datos reales, `realDataset` devuelve ese catálogo vacío. La información existe, pero no llega a esa herramienta.

**Entrega:** consultar segmentos y sus resultados persistidos, seleccionar intentos por fecha y mostrar cobertura/estado de la búsqueda. Actualizar también el contador de ascensiones del entrenador.

**Terminado cuando:** «Compara mis dos últimas subidas a este puerto» usa los mismos intentos que la pantalla Puertos, enlaza las actividades y explica cuándo faltan datos o las coincidencias son aproximadas.

### 2.2. Preguntar por la selección actual · P1 · M

El contexto enviado al entrenador incluye pantalla y actividad, pero no el intervalo seleccionado, el segmento ni la pareja que se compara.

**Entrega:** acciones «Analizar este tramo» y «Explicar esta comparación», con contexto visible y datos calculados localmente. La búsqueda del entrenador debe aceptar fechas y tipos, e indicar cuándo limita resultados: actualmente devuelve hasta 20 actividades por texto.

**Terminado cuando:** al seleccionar cuatro repeticiones, la respuesta trata esas cuatro; al consultar un año antiguo, no responde únicamente con las actividades recientes. Los resultados permiten volver a la actividad o selección de origen.

### 2.3. Comparar intentos de un segmento visualmente · P1 · L

La tabla histórica es útil; el siguiente salto es saber dónde se ganó o perdió tiempo.

**Entrega mínima:** elegir dos intentos y superponer potencia, FC y velocidad sobre distancia recorrida, con diferencia de tiempo acumulada y navegación a cada actividad. Reutilizar gráficos y selección existentes.

**Terminado cuando:** la alineación respeta huecos y sentido del recorrido; se explican los tiempos aproximados y no se interpolan grandes tramos sin datos como si fueran medidos.

### 2.4. Gestionar y revisar los segmentos · P1 · M

- Renombrar y buscar segmentos; marcar favoritos.
- Excluir una coincidencia incorrecta con motivo y restaurarla después.
- Conservar exclusiones y nombres al recalcular resultados.
- Mostrar mejor marca, último intento y evolución sin abrir cada actividad.

Esto es especialmente importante porque la tolerancia GPS puede confundir caminos paralelos. Primero dar control sobre las coincidencias; después ampliar la detección automática.

### 2.5. Un chat más cómodo y trazable · P1 · M

- Cancelación de una respuesta en curso y texto progresivo cuando el proveedor lo permita.
- Conversaciones separadas por tema, con título, búsqueda y borrado, manteniendo el aislamiento demo/Garmin.
- Referencias navegables a actividades, periodos e intentos utilizados.
- Consumo y coste cuando el proveedor los devuelva; diferenciar coste observado de estimación y permitir un límite de gasto por petición.

**Terminado cuando:** cancelar libera la interfaz, los fallos conservan la pregunta y cualquier conclusión importante puede rastrearse a sus datos. La cancelación no debe prometer anular costes ya incurridos.

## Fase 3 — Pasar del análisis puntual al seguimiento

### 3.1. Resumen semanal que invite a volver · P1 · M

Una vista con volumen, desnivel, distribución de intensidad, mejores esfuerzos y comparación con la semana anterior o una media reciente. Cada cambio abre las actividades que lo explican.

Empezar con cálculos locales y un resumen determinista; añadir una explicación IA bajo demanda. No generar llamadas de pago por abrir el Dashboard.

**Terminado cuando:** semanas parciales y datos ausentes están identificados y se puede reconstruir cada total desde sus actividades.

### 3.2. Sensaciones y corrección manual · P1 · M

Añadir RPE, notas y una valoración simple de fatiga por sesión; permitir corregir la etiqueta automática sin perder su motivo original. Una sesión puede sentirse dura aunque los vatios sean normales.

**Terminado cuando:** la sincronización y «Volver a etiquetar todo» conservan las decisiones manuales, y el entrenador distingue sensaciones declaradas de métricas registradas.

### 3.3. Objetivos reales · P1 · M

Los objetivos actuales pertenecen a la demo. Añadir nombre, fecha, tipo de prueba y objetivo personal, visibles en Dashboard y disponibles para el entrenador.

La primera versión debe servir para contextualizar el seguimiento. No hace falta un calendario de entrenamiento completo ni prescribir un CTL objetivo automáticamente.

**Terminado cuando:** se pueden crear, editar y archivar objetivos reales, persisten tras reiniciar y el entrenador no los confunde con eventos de demostración.

### 3.4. Rendimiento con referencias útiles · P1 · L

- Comparar últimos 42/90 días con otro periodo, además de años naturales.
- Abrir la actividad y el tramo que originaron cada mejor esfuerzo de la curva.
- Mostrar distribución de tiempo en zonas para el periodo y su cobertura.
- Añadir potencia crítica y W′ solo después de definir el modelo, sus requisitos de datos y la calidad del ajuste. Hoy esas métricas reales no están calculadas.

**Terminado cuando:** cada récord es trazable; el modelo se oculta o se marca como insuficiente cuando los esfuerzos disponibles no permiten un ajuste defendible. Evitar convertir una estimación de FTP en un valor configurado sin intervención del usuario.

### 3.5. Importación y exportación manual · P2 · M–L

Importar FIT local reutilizando el decodificador; exportar tablas CSV y un informe sencillo de actividad o comparación. Resolver identidad, duplicados y procedencia antes de mezclar archivos con Garmin. Empezar por FIT y CSV; otros formatos solo si hay una necesidad concreta.

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

Este roadmap solo añade documentación. No se han ejecutado la app ni los tests, ni se han utilizado claves o datos privados para elaborarlo; el fallo de mapas citado procede de la validación registrada, no de una reproducción nueva.
