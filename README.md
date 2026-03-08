# Antipode Finder

Find the point on Earth directly opposite any location — no ads, no clutter, no API keys.

**Live:** https://parmsam.github.io/antipode-finder/

Inspired by the [Sketchplanations post on antipodes](https://sketchplanations.com/antipodes).

## Features

- **Dual interactive maps** — click either map to set origin or antipode
- **Draggable markers** — drag to refine position on both sides
- **Place search** — search any location on either map (powered by Photon)
- **GPS** — use your current location as the origin
- **Shareable URLs** — location encoded in the URL hash (`#lat=…&lng=…`), copy with the Share button
- **Fun facts** — shows whether the antipode is ocean or land, and distance through Earth (~12,742 km)
- **No API keys** — uses OpenStreetMap tiles, Photon, and Nominatim

## Usage

Open https://parmsam.github.io/antipode-finder/ and:

1. Click anywhere on the origin map, or type a place name in the search box
2. The antipode map updates instantly
3. Hit **Share** to copy a link anyone can open to the same location

## Local Development

No build step required. Serve the project root over HTTP:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

> Opening `index.html` directly from the filesystem (`file://`) will break geocoding search due to CORS restrictions from Nominatim. Always use a local server.

## Stack

| Concern | Tool |
|---|---|
| Maps | [Leaflet.js](https://leafletjs.com/) 1.9 |
| Tiles | [OpenStreetMap](https://www.openstreetmap.org/) |
| Place search | [Photon](https://photon.komoot.io/) (by Komoot) |
| Reverse geocoding | [Nominatim](https://nominatim.org/) |
| Hosting | GitHub Pages |

No build tools, no bundlers, no frameworks — plain HTML, CSS, and JS loaded from CDN.

## Antipode Math

```js
function calcAntipode(lat, lng) {
  return {
    lat: -lat,
    lng: lng <= 0 ? lng + 180 : lng - 180,
  };
}
```

## Attribution

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Place search by [Photon](https://photon.komoot.io/) (Komoot)
- Reverse geocoding by [Nominatim](https://nominatim.org/)
- Antipodes illustration by [Sketchplanations](https://sketchplanations.com/antipodes)
