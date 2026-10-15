const DEFAULT_CENTER = [78.9629, 20.5937]; // MapLibre uses [longitude, latitude].

let map;
let poiMarkers = [];
let userMarker = null;
let selectedMarker = null;
let smoothMotion = true;
let labelPreference = localStorage.getItem("smartmap-label-language") || "local";
let activeStyle = "standard";

const MAP_STYLES = {
  standard: {
    url: "https://tiles.openfreemap.org/styles/liberty",
    label: "Standard"
  },
  voyager: {
    url: "https://tiles.openfreemap.org/styles/bright",
    label: "Voyager"
  },
  light: {
    url: "https://tiles.openfreemap.org/styles/positron",
    label: "Light"
  },
  dark: {
    url: "https://tiles.openfreemap.org/styles/dark",
    label: "Dark"
  }
};

export function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: MAP_STYLES[activeStyle].url,
    center: DEFAULT_CENTER,
    zoom: 5,
    minZoom: 2,
    maxZoom: 20,
    attributionControl: true,
    cooperativeGestures: false,
    pitchWithRotate: true,
    dragRotate: true,
    touchPitch: true
  });

  map.on("load", () => {
    applyLabelPreference();
    map.resize();
  });
  map.on("style.load", applyLabelPreference);
  map.on("error", event => {
    const message = event?.error?.message || "Map resources could not be loaded.";
    console.warn("SmartMap map resource error:", message);
    window.dispatchEvent(new CustomEvent("smartmap:maperror", { detail: message }));
  });

  map.on("click", event => {
    const { lat, lng } = event.lngLat;
    showSelectedCoordinates(lat, lng);
  });
  map.on("moveend", () => {
    const center = map.getCenter();
    window.dispatchEvent(new CustomEvent("smartmap:mapmove", {
      detail: { center, zoom: map.getZoom(), bounds: map.getBounds() }
    }));
  });
  map.on("zoomend", () => {
    window.dispatchEvent(new CustomEvent("smartmap:zoom", { detail: map.getZoom() }));
  });
  map.on("rotateend", () => {
    window.dispatchEvent(new CustomEvent("smartmap:rotation", { detail: map.getBearing() }));
  });
  return map;
}

export function getMap() { return map; }
export function getPoiLayer() { return poiMarkers; }

export function flyToLocation(lat, lon, zoom = 15) {
  if (!map) return;
  const options = { center: [Number(lon), Number(lat)], zoom, essential: true };
  if (smoothMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    map.flyTo({ ...options, speed: 1.25, curve: 1.35 });
  } else {
    map.jumpTo(options);
  }
}

export function setSmoothMotion(enabled) {
  smoothMotion = enabled;
  document.body.classList.toggle("reduce-motion", !enabled);
}

export function setLabelPreference(preference) {
  labelPreference = preference === "en" ? "en" : "local";
  if (map && map.isStyleLoaded()) applyLabelPreference();
  window.dispatchEvent(new CustomEvent("smartmap:labels", { detail: labelPreference }));
}

function applyLabelPreference() {
  if (!map || !map.isStyleLoaded()) return;
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (layer.type !== "symbol" || !layer.layout?.["text-field"]) continue;
    // Leave road shields and other non-name text (for example route numbers) untouched.
    if (!JSON.stringify(layer.layout["text-field"]).toLowerCase().includes("name")) continue;
    if (labelPreference === "en") {
      // Prefer English, then a Latin-script transliteration, then the original name.
      map.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", "name:en"],
        ["get", "name:latin"],
        ["get", "name"]
      ]);
    } else {
      // Restore the style's original label expression, which normally uses local names.
      const original = layer.metadata?.["smartmap:original-text-field"];
      if (original) map.setLayoutProperty(layer.id, "text-field", original);
      else map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name"], ["get", "name:en"], ["get", "name:latin"]]);
    }
  }
}

export function setMapLayer(layerName) {
  if (!map || !MAP_STYLES[layerName]) return;
  if (layerName === activeStyle) {
    if (map.isStyleLoaded()) applyLabelPreference();
    return;
  }
  activeStyle = layerName;
  const style = MAP_STYLES[layerName];
  map.setStyle(style.url);
  map.once("style.load", () => {
    applyLabelPreference();
    window.dispatchEvent(new CustomEvent("smartmap:stylechange", { detail: layerName }));
  });
}

export function addPoiMarker(lat, lon, title, category, details = "") {
  const element = document.createElement("div");
  element.className = `smartmap-marker ${escapeHtml(category)}`;
  element.setAttribute("role", "button");
  element.setAttribute("aria-label", title);
  element.innerHTML = `<i class="fa-solid ${iconForCategory(category)}"></i>`;
  const popup = new maplibregl.Popup({ offset: 18, closeButton: true }).setHTML(
    `<strong>${escapeHtml(title)}</strong>${details ? `<br><small>${escapeHtml(details)}</small>` : ""}`
  );
  const marker = new maplibregl.Marker({ element, anchor: "bottom" })
    .setLngLat([Number(lon), Number(lat)])
    .setPopup(popup)
    .addTo(map);
  element.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("smartmap:place", {
      detail: { name: title, address: details, lat: Number(lat), lon: Number(lon) }
    }));
  });
  poiMarkers.push(marker);
  return marker;
}

export function clearPoiMarkers() {
  poiMarkers.forEach(marker => marker.remove());
  poiMarkers = [];
}

export function selectLocation(lat, lon, name = "Selected location", address = "") {
  if (!map) return;
  if (selectedMarker) selectedMarker.remove();
  const element = document.createElement("div");
  element.className = "selected-location-marker";
  element.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
  selectedMarker = new maplibregl.Marker({ element, anchor: "bottom" })
    .setLngLat([Number(lon), Number(lat)])
    .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<strong>${escapeHtml(name)}</strong>`))
    .addTo(map);
  selectedMarker.togglePopup();
  window.dispatchEvent(new CustomEvent("smartmap:place", {
    detail: { name, address, lat: Number(lat), lon: Number(lon) }
  }));
}

export function showSelectedCoordinates(lat, lon) {
  window.dispatchEvent(new CustomEvent("smartmap:place", {
    detail: { name: "Dropped pin", address: "Selected directly on the map", lat, lon }
  }));
}

export function setUserLocation(lat, lon) {
  if (!map) return;
  if (userMarker) userMarker.remove();
  const element = document.createElement("div");
  element.className = "user-marker";
  element.innerHTML = "<span></span>";
  userMarker = new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([Number(lon), Number(lat)])
    .setPopup(new maplibregl.Popup({ offset: 14 }).setText("Your current location"))
    .addTo(map);
  flyToLocation(lat, lon, 15);
}

export function zoomIn() { if (map) map.zoomIn({ duration: smoothMotion ? 250 : 0 }); }
export function zoomOut() { if (map) map.zoomOut({ duration: smoothMotion ? 250 : 0 }); }
export function resetView() {
  if (map) {
    map.easeTo({ center: DEFAULT_CENTER, zoom: 5, bearing: 0, pitch: 0, duration: smoothMotion ? 700 : 0 });
  }
}
export function resetOrientation() {
  if (!map) return;
  map.easeTo({ bearing: 0, pitch: 0, duration: smoothMotion ? 400 : 0 });
  window.dispatchEvent(new CustomEvent("smartmap:toast", { detail: "Map orientation reset to north." }));
}

export function makeMapLink(lat, lon, zoom = map?.getZoom() || 12) {
  return `${location.origin}${location.pathname}#map=${zoom}/${Number(lat).toFixed(5)}/${Number(lon).toFixed(5)}`;
}

export function readMapLink() {
  const match = location.hash.match(/map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (match && map) {
    map.jumpTo({ center: [Number(match[3]), Number(match[2])], zoom: Number(match[1]) });
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