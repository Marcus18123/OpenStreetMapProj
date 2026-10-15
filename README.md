# SmartMap — OpenStreetMap UX Enhancement Prototype

A front-end mapping prototype built with HTML5, CSS3, JavaScript ES modules and Leaflet. It focuses on a full-screen map, translucent floating controls, location search, nearby points of interest, place details, preferences, and optional weather overlays.

## Run in VS Code

1. Extract the `SmartMap` folder.
2. Open the folder in VS Code.
3. Install the **Live Server** extension (or use another local HTTP server).
4. Right-click `index.html` and select **Open with Live Server**.
5. Allow network access for the map and API requests. Use `http://localhost` rather than opening the file directly because JavaScript modules and browser APIs work more reliably over HTTP.

No build step or backend is required.

## Features

- Full-screen Leaflet map with OpenStreetMap tiles.
- Animated location search suggestions using the Photon geocoding API.
- Category-based nearby POI search using the Overpass API.
- Place details, coordinate copying, share links and browser share support.
- Optional browser geolocation.
- Open-Meteo current weather display and lightweight Canvas wind/rain effects.
- English, Hindi and Malayalam interface labels.
- Saved interface language, map-label preference and motion preference.
- Loading states, empty states, network feedback and API error handling.
- Responsive floating sidebar and panels.

## APIs and usage notes

- **OpenStreetMap tile service:** Public standard tiles are subject to the OpenStreetMap tile usage policy. Keep attribution visible and do not bulk-download or prefetch tiles.
- **Photon:** Public geocoding endpoint; use modest request volume. The input is debounced before fetching suggestions.
- **Overpass API:** Public community infrastructure. Queries can be slow or temporarily unavailable; this prototype tries two endpoints and reports failures.
- **Open-Meteo:** Weather data is requested for the map center when the weather panel is opened and when the map is moved while the panel is open.

Public endpoints are not guaranteed to be always available. For a production app, review current service terms, usage policies, attribution requirements, caching rules and any commercial-use conditions.

## Known prototype limitations

- The base map uses standard OpenStreetMap raster tiles. The map-label preference is saved and used for application place names, but it cannot globally change the language of labels baked into the standard tile images. A separate label-capable tile style/provider is needed for full map-wide label control.
- Satellite imagery and a true 3D globe are not included. They require a separate imagery/terrain provider and potentially a different rendering engine.
- The compass button explains the limitation because the current Leaflet map is 2D and north-up.
- Weather effects are lightweight visualizations. The rain effect is only enabled when the latest weather response reports measurable precipitation.
- The six links to GPS Tracks, User Diaries, Communities, Copyright, Help and About lead to the original OpenStreetMap website.

## Main file structure

```text
SmartMap/
├── index.html
├── README.md
├── css/
│   ├── style.css
│   └── weather.css
└── js/
    ├── app.js
    ├── map.js
    ├── search.js
    ├── places.js
    ├── weather.js
    └── ui.js