const DEFAULT_CENTER = [20.5937, 78.9629];

let map;
let baseLayer;
let labelsLayer;
let activeBaseLayer;
let poiLayer;
let userMarker;
let selectedMarker;
let smoothMotion = true;

export function initMap() {
  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    zoomAnimation: true,
    fadeAnimation: true,
    markerZoomAnimation: true,
    wheelPxPerZoomLevel: 90
  }).setView(DEFAULT_CENTER, 5);

  baseLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(map);
  activeBaseLayer = baseLayer;

  poiLayer = L.layerGroup().addTo(map);
  map.on("click", (event) => {
    const { lat, lng } = event.latlng;
    showSelectedCoordinates(lat, lng);
  });

  map.on("moveend", () => {
    window.dispatchEvent(new CustomEvent("smartmap:mapmove", {
      detail: { center: map.getCenter(), zoom: map.getZoom(), bounds: map.getBounds() }
    }));
  });

  map.on("zoomend", () => {
    window.dispatchEvent(new CustomEvent("smartmap:zoom", { detail: map.getZoom() }));
  });

  setTimeout(() => map.invalidateSize(), 100);
  return map;
}

export function getMap() { return map; }
export function getPoiLayer() { return poiLayer; }

export function flyToLocation(lat, lon, zoom = 15) {
  if (!map) return;
  if (smoothMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    map.flyTo([lat, lon], zoom, { duration: 1.25, easeLinearity: 0.25 });
  } else {
    map.setView([lat, lon], zoom);
  }
}

export function setSmoothMotion(enabled) {
  smoothMotion = enabled;
  document.body.classList.toggle("reduce-motion", !enabled);
  if (map) {
    map.options.zoomAnimation = enabled;
    map.options.fadeAnimation = enabled;
    map.options.markerZoomAnimation = enabled;
  }
}

export function setLabelPreference(preference) {
  if (!map) return;
  if (labelsLayer) map.removeLayer(labelsLayer);
  labelsLayer = null;
  // OSM's standard tile layer renders labels from its tile style. This preference
  // affects selected place names in the UI; a separate label-only tile service
  // would be needed to globally switch every map label.
  window.dispatchEvent(new CustomEvent("smartmap:labels", { detail: preference }));
}

export function setMapLayer(layerName) {
  if (!map) return;
  const sources = {
    standard: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }
    },
    voyager: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      options: { maxZoom: 20, subdomains: "abcd", attribution: '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' }
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      options: { maxZoom: 20, subdomains: "abcd", attribution: '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' }
    }
  };
  const source = sources[layerName];
  if (!source) return;
  if (activeBaseLayer) map.removeLayer(activeBaseLayer);
  activeBaseLayer = L.tileLayer(source.url, source.options).addTo(map);
  activeBaseLayer.on("tileerror", () => {
    window.dispatchEvent(new CustomEvent("smartmap:toast", {
      detail: "Some map tiles could not load. Check your connection or choose another map style."
    }));
  });
}

export function addPoiMarker(lat, lon, title, category, details = "") {
  const icon = L.divIcon({
    className: "smartmap-marker-wrap",
    html: `<span class="smartmap-marker ${escapeHtml(category)}"><i class="fa-solid ${iconForCategory(category)}"></i></span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
  const marker = L.marker([lat, lon], { icon }).addTo(poiLayer);
  marker.bindPopup(`<strong>${escapeHtml(title)}</strong>${details ? `<br><small>${escapeHtml(details)}</small>` : ""}`);
  marker.on("click", () => {
    window.dispatchEvent(new CustomEvent("smartmap:place", {
      detail: { name: title, address: details, lat, lon }
    }));
  });
  return marker;
}

export function clearPoiMarkers() {
  if (poiLayer) poiLayer.clearLayers();
}

export function selectLocation(lat, lon, name = "Selected location", address = "") {
  if (!map) return;
  if (selectedMarker) map.removeLayer(selectedMarker);
  selectedMarker = L.marker([lat, lon]).addTo(map);
  selectedMarker.bindPopup(`<strong>${escapeHtml(name)}</strong>`).openPopup();
  window.dispatchEvent(new CustomEvent("smartmap:place", {
    detail: { name, address, lat, lon }
  }));
}

export function showSelectedCoordinates(lat, lon) {
  window.dispatchEvent(new CustomEvent("smartmap:place", {
    detail: { name: "Dropped pin", address: "Selected directly on the map", lat, lon }
  }));
}

export function setUserLocation(lat, lon) {
  if (!map) return;
  if (userMarker) map.removeLayer(userMarker);
  const icon = L.divIcon({
    className: "user-marker-wrap",
    html: '<span class="user-marker"><span></span></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  userMarker = L.marker([lat, lon], { icon, zIndexOffset: 1000 }).addTo(map);
  userMarker.bindPopup("Your approximate location");
  flyToLocation(lat, lon, 15);
}

export function zoomIn() { if (map) map.zoomIn(1); }
export function zoomOut() { if (map) map.zoomOut(1); }
export function resetView() { if (map) flyToLocation(DEFAULT_CENTER[0], DEFAULT_CENTER[1], 5); }
export function resetOrientation() {
  window.dispatchEvent(new CustomEvent("smartmap:toast", {
    detail: "The standard 2D map has no rotation. 3D orientation requires an advanced map engine."
  }));
}

export function makeMapLink(lat, lon, zoom = map?.getZoom() || 12) {
  return `${location.origin}${location.pathname}#map=${zoom}/${Number(lat).toFixed(5)}/${Number(lon).toFixed(5)}`;
}

export function readMapLink() {
  const match = location.hash.match(/map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (match && map) {
    map.setView([Number(match[2]), Number(match[3])], Number(match[1]));
  }
}

function iconForCategory(category) {
  const icons = {
    hospital: "fa-kit-medical", restaurant: "fa-utensils", school: "fa-graduation-cap",
    fuel: "fa-gas-pump", tourism: "fa-camera", park: "fa-tree", default: "fa-location-dot"
  };
  return icons[category] || icons.default;
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
