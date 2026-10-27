# ZoneBar

Distribución del tiempo por zonas: una barra apilada y una lista con tiempo y porcentaje.

- Props: `zones` (`[{label, name, value, color}]`), `format(value)` y `compact` (solo la barra).
- El orden siempre va de Z1 a Z7 (o de Z1 a Z5c en FC), aunque haya zonas a cero.
- Combínalo con un `Segmented` Potencia/FC en la cabecera del Panel.
