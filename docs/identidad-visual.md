# Identidad visual de AppRutas

**Idea central: “Toma la ruta correcta.”** El problema que AppRutas resuelve desde 2023 es subirse al camión equivocado o bajarse
en el lugar incorrecto. La identidad comunica eso: claridad, orientación y algo muy de Celaya.

## Símbolo

![Símbolo](../marca/icono-app.svg)

Un **trazo de ruta con dos paradas**, dibujado con la geometría de los mapas de transporte (tramos rectos y curvas a 90°):

- **Círculo ámbar** = de dónde sales (el origen, “tú estás aquí”).
- **Anillo blanco** = a dónde vas (el destino).
- El trazo sube y avanza: ir de un punto a otro sin perderse.

Funciona desde 16 px (favicon) hasta el ícono de la app. Archivos en `marca/`:

| Archivo | Uso |
|---|---|
| `icono-app.svg` | Ícono con fondo (favicon, redes, documentos) |
| `icono-maskable.svg` | Ícono de Android, a sangre (respeta la zona segura) |
| `simbolo.svg` | Solo el símbolo, sobre fondos claros |
| `logo-horizontal.svg` | Símbolo + nombre |

Los PNG de la app se regeneran con `npm run iconos` (requiere ImageMagick).

**Nombre:** “App” en tinta y “Rutas” en petróleo, en Atkinson Hyperlegible Next ExtraBold (800), con interletra ligeramente
cerrada. Junto al nombre va la etiqueta de ciudad (“Celaya”), pensada para crecer a otras ciudades.

## Color

### Marca (interfaz)

| Token | Hex | Uso |
|---|---|---|
| Petróleo 700 | `#0F4C5C` | Color principal: botones, enlaces, encabezado de la app (texto blanco encima: 9.5:1) |
| Petróleo 50 | `#E6F0F1` | Fondos suaves, estados activos |
| Cajeta 400 | `#F2A33A` | Acento: origen del símbolo, detalles. Un guiño a la cajeta de Celaya. **Nunca para texto.** |
| Cajeta 50 | `#FDF3E4` | Avisos y tarjetas de ayuda |
| Papel | `#F4F1EA` | Fondo de la app y tierra del mapa (cálido, menos cansado que el blanco) |
| Tinta | `#16232A` | Texto principal (16:1 sobre blanco) |
| Tinta suave | `#4A5960` | Texto secundario (7.3:1) |
| Tinta tenue | `#5E6B72` | Texto terciario (≥ 4.9:1 sobre papel) |

Todos los textos cumplen WCAG AA (4.5:1 o más). Los tokens viven en `src/estilos/tokens.css`.

### Rutas (mapa)

Las rutas usan **otra paleta**, separada de la marca, para que ninguna línea se confunda con un botón. Es una paleta de 8
colores en **orden fijo**: cada ruta nueva toma el siguiente color libre (el importador lo hace solo).

| # | Color | Hex |
|---|---|---|
| 1 | Azul | `#1F63CF` |
| 2 | Naranja | `#C24A0A` |
| 3 | Magenta | `#B4197C` |
| 4 | Oliva | `#6F6A10` |
| 5 | Violeta | `#7342C8` |
| 6 | Ocre | `#9A5B00` |
| 7 | Verde | `#0B7F50` |
| 8 | Rojo | `#D1263A` |

Se validó con simulación de daltonismo (protanopia y deuteranopia):

- Los **3 primeros** se distinguen entre sí aunque se crucen en el mapa.
- Todos tienen contraste ≥ 4.3:1 contra el mapa y ≥ 4.9:1 con número blanco encima.
- En un mapa cualquier par de rutas puede quedar lado a lado, y ninguna paleta de 8 colores logra que todos se distingan entre
  sí para todas las personas. Por eso **el color nunca va solo**: cada línea lleva insignias con su número, y la ficha y la lista
  repiten número y nombre. A partir de la ruta 9 los colores se repiten, y el número es lo que identifica.

## Tipografía

**[Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/)**, del Braille Institute, diseñada para máxima
legibilidad en personas con baja visión. Para una app que se consulta en la calle, con sol y en movimiento:

- Distingue a propósito los caracteres que se confunden: el cero lleva diagonal (para no leerse como O) y el 1, la l y la I
  tienen formas distintas. Es clave para leer bien el número de la ruta.
- Una sola familia variable (200–800) autoalojada: unos 34 KB, sin depender de Google Fonts y funciona sin conexión.

Escala: 13 px (etiquetas en mayúsculas), 15–16 px (texto), 21 px (marca), 22 px (título de ruta), 24 px (insignia grande).
Los números de ruta usan cifras tabulares.

## Forma y componentes

- **Radios:** 10 px (insignias), 14 px (botones, tarjetas), 20 px (panel).
- **Insignia de ruta:** rectángulo redondeado del color de la ruta con número blanco en 800. En el mapa lleva un borde blanco de
  2 px para separarse de las calles y de otras líneas.
- **Líneas de ruta:** contorno blanco debajo para que resalten sobre las calles. La ruta elegida se dibuja más gruesa y con
  flechas blancas en el sentido de circulación; el sentido contrario va punteado; las demás rutas se atenúan.
- **Mapa base:** OpenFreeMap Positron recoloreado con la paleta (tierra papel, calles blancas, agua y parques suaves) para que las
  rutas sean lo único con color fuerte.
- **Iconos:** trazo de 2 px con puntas redondeadas, en el color del texto.

## Voz

Cercana, clara y honesta. Tuteo, frases cortas, sin tecnicismos. Si un dato no está confirmado, se dice: “Por confirmar”.
Ejemplos: “Toma la ruta correcta”, “Pasan por aquí”, “¿Falta tu ruta? Ayúdanos a agregarla”.
