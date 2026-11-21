# Rutas y paradas oficiales del IMIPE Celaya (2021)

Copia sin modificar de dos capas del **Sistema de Información Geográfica Municipal** del Instituto Municipal de Investigación,
Planeación y Estadística (IMIPE) de Celaya, tomadas del visor público el 21 de noviembre de 2026.

| Archivo | Origen | Última modificación en el servidor | Contenido |
|---|---|---|---|
| `rutas.json` | https://imipecelaya.org/cartografia-celaya/vialidades/rutas.json | 2 feb 2021 | 120 trazos (60 rutas: 35 urbanas, 25 suburbanas), uno por sentido |
| `paradas.json` | https://imipecelaya.org/cartografia-celaya/equipamiento/paradas.json | 2 feb 2021 | 774 paradas oficiales |

En el visor (https://imipecelaya.org/cartografia-celaya/) aparecen como “Rutas de Transporte” y “Paradas Oficiales”.

**Campos de `rutas.json`:** `num_ruta`, `nombre_rut` (cortado a 30 caracteres), `tipo_ruta` (URBANO / SUBURBANO), `Sentido`
(IDA / REGRESO) y `Longitud` en metros. **Campos de `paradas.json`:** `Nom_Parada` y `Ubicación` (cruce de calles).

## Cómo se usan

`npm run importar-imipe` convierte estas capas al formato de AppRutas (`data/rutas/*.geojson` y `data/paradas.geojson`):

- Reconstruye los nombres cortados usando el sentido contrario (“SAN JOSE DE GT” + “SAN JOSE DE GTO”), pone acentos y expande
  abreviaturas (“MDO.” → Mercado, “PTA” → Puerta).
- Aplica las correcciones manuales de `correcciones.json` (cada una explica por qué).
- Detecta circuitos (trazos que terminan donde empiezan) y separa las variantes de la ruta 37: (A) y (B).
- Asigna colores de la paleta y deja la fuente y la fecha en cada ruta.

Las paradas se asocian a cada ruta al compilar (`npm run datos`): una parada pertenece a un sentido si está a menos de 30 m de su
trazo, y se ordenan a lo largo del recorrido.

## Problemas conocidos de la fuente

- Los datos son de 2021: algunas rutas pudieron cambiar, desaparecer o crearse después (la 61, por ejemplo, no aparece).
- En los pares 30/35, 17/58, 24/25 y 27/56 el trazo de una ruta es idéntico al de la otra (en 24/25, solo un sentido): puede ser
  un error de captura. La app lo indica en la ficha de esas rutas.
- El regreso de la ruta 48 viene marcado como “URABNO”; se trata como urbana.

## Uso de los datos

Es información publicada por un organismo municipal en su visor público. AppRutas la cita en cada ruta y en “Acerca de”.
Conviene confirmar con el IMIPE (planeacionimipe@celaya.gob.mx) las condiciones de reutilización y si existe una versión más
reciente.
