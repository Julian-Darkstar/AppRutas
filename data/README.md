# Datos de rutas

Cada ruta es un archivo GeoJSON en `rutas/` (por ejemplo, `61.geojson`). GitHub los muestra como mapa: abre uno en la web para
ver el recorrido. Antes de cada `npm run dev` y `npm run build`, `scripts/compilar-datos.mjs` los valida y los junta en
`public/data/rutas.json`, el único archivo de datos que descarga la app.

## Agregar una ruta

**Opción A: trazarla en Google My Maps** (como se hizo con las primeras):

1. Traza la línea de **ida**. Si regresa por otras calles, traza el **regreso** como otra línea cuyo nombre incluya “regreso” o
   “retorno”. Si es un circuito, una sola línea que termine donde empieza.
2. Agrega puntos de referencia (escuelas, hospitales, plazas). Los puntos que se llamen “Inicio…”, “Terminal…” o “Parada…”
   cuentan como paradas.
3. Menú ⋮ → **Exportar a KML/KMZ** → marca *Exportar a un archivo .KML*.
4. Impórtala:

   ```bash
   npm run importar-kml -- ~/Descargas/ruta-62.kml --numero 62 --nombre "Centro – Las Insurgentes"
   ```

5. Abre `rutas/62.geojson` y completa `origen`, `destino`, `palabrasClave`, `frecuencia`, `horario`, `tarifa` y `verificado`.

**Opción B: grabarla con GPS** viajando en el camión, con una app como OsmAnd o GPX Logger. Exporta a KML (o convierte el GPX
en [geojson.io](https://geojson.io)) y sigue desde el paso 4.

**Opción C: actualizar desde el IMIPE.** Las 61 rutas y 774 paradas oficiales vienen del SIG municipal del IMIPE Celaya
(`fuentes/imipe-2021/`, con su `LEEME.md`). Si el IMIPE publica una versión nueva, reemplaza `rutas.json` y `paradas.json` en una
carpeta nueva de `fuentes/` y corre:

```bash
npm run importar-imipe -- --fuente data/fuentes/imipe-AAAA
```

El importador no toca las rutas que trazó el equipo (como la 61 y la 15-A) salvo que uses `--forzar`. Los ajustes a mano (nombres
cortados, alias) van en `correcciones.json`, cada uno con su motivo.

Los KML originales de 2023 están en `kml-original/` como respaldo.

## Formato

```jsonc
{
  "type": "FeatureCollection",
  "ruta": {
    "id": "61",                     // igual al nombre del archivo; minúsculas, números y guiones
    "numero": "61",                 // como aparece en el camión ("15-A")
    "nombre": "Salvador Ortega – Cd. Industrial",
    "color": "#C24A0A",             // de la paleta (docs/identidad-visual.md)
    "tipo": "ida-regreso",          // "ida-regreso" o "circuito"
    "origen": "Salvador Ortega",    // texto o null
    "destino": "Cd. Industrial",
    "descripcion": "…",
    "palabrasClave": ["CETIS 115"], // colonias y lugares para la búsqueda
    "frecuencia": null,             // p. ej. "Cada 15 min"
    "horario": null,                // p. ej. "5:30 – 22:00"
    "tarifa": null,                 // p. ej. "$11"
    "verificado": "2023-03",        // cuándo se comprobó el recorrido (AAAA, AAAA-MM o AAAA-MM-DD)
    "fuente": "…",
    "notas": null                   // avisos visibles en la ficha
  },
  "features": [
    { "type": "Feature", "properties": { "tipo": "recorrido", "sentido": "ida" },
      "geometry": { "type": "LineString", "coordinates": [[-100.871, 20.5624], …] } },
    { "type": "Feature", "properties": { "tipo": "parada", "nombre": "Inicio del recorrido" },
      "geometry": { "type": "Point", "coordinates": [-100.871, 20.5624] } },
    { "type": "Feature", "properties": { "tipo": "lugar", "nombre": "CETIS No. 115" },
      "geometry": { "type": "Point", "coordinates": [-100.81147, 20.55127] } }
  ]
}
```

- `sentido`: `ida` y `regreso` para rutas de ida y regreso. Un circuito lleva un recorrido `circuito`, o dos (`ida` y
  `regreso`) si da la vuelta en ambos sentidos; cada recorrido puede tener su propio `nombre` (“Circuito 3 Sur”).
- `servicio`: `urbana`, `suburbana` o `null`.
- Coordenadas en orden **[longitud, latitud]** (en Celaya, la longitud es negativa: −100.8…). El validador avisa si están
  invertidas.
- Cada coordenada va en una sola línea, para que los cambios se lean fácil en git.

`npm test` también valida todos los archivos.

## Paradas

`paradas.geojson` reúne las paradas que comparten todas las rutas:

```jsonc
{ "type": "Feature",
  "properties": { "id": "p001", "nombre": "Irrigacion Estadio", "ubicacion": "Irrigacion - Av. Tecnologico" },
  "geometry": { "type": "Point", "coordinates": [-100.81878, 20.5358] } }
```

No hace falta decir qué rutas pasan por cada parada: al compilar, una parada se asigna a un sentido si está a menos de 30 m de su
trazo, en el orden en que el camión las recorre. Si corriges un trazo, sus paradas se recalculan solas.

## Hacia GTFS

El formato es simple a propósito, pero cada campo tiene equivalente en [GTFS](https://gtfs.org), el estándar que usan Google
Maps y Moovit (`routes.txt`, `shapes.txt`, `stops.txt`). Cuando haya paradas y horarios confiables, un script podrá exportar
GTFS desde estos mismos archivos.
