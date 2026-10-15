import { getMap, clearPoiMarkers, addPoiMarker, flyToLocation } from "./map.js";

const categoryQueries = {
  hospital: 'node["amenity"="hospital"];way["amenity"="hospital"];relation["amenity"="hospital"];',
  restaurant: 'node["amenity"="restaurant"];way["amenity"="restaurant"];relation["amenity"="restaurant"];',
  school: 'node["amenity"="school"];way["amenity"="school"];relation["amenity"="school"];',
  fuel: 'node["amenity"="fuel"];way["amenity"="fuel"];relation["amenity"="fuel"];',
  tourism: 'node["tourism"~"attraction|museum|viewpoint|gallery"];way["tourism"~"attraction|museum|viewpoint|gallery"];',
  park: 'node["leisure"="park"];way["leisure"="park"];relation["leisure"="park"];'
};
const categoryNames = {
  hospital: "Hospital", restaurant: "Restaurant", school: "School",
  fuel: "Fuel station", tourism: "Tourist attraction", park: "Park"
};
let activeCategory = null;
let lastRequestController = null;

export function initPlaces(showToast, setLoading) {
  document.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", async () => {
      const category = button.dataset.category;
      if (activeCategory === category) {
        activeCategory = null;
        document.querySelectorAll("[data-category]").forEach(item => item.classList.remove("active"));
        clearPoiMarkers();
        setStatus("Choose a category to find places nearby.");
        return;
      }
      activeCategory = category;
      document.querySelectorAll("[data-category]").forEach(item => item.classList.toggle("active", item === button));
      await loadPlaces(category, showToast, setLoading);
    });
  });

  document.querySelector("#clear-pois").addEventListener("click", () => {
    activeCategory = null;
    clearPoiMarkers();
    document.querySelectorAll("[data-category]").forEach(item => item.classList.remove("active"));
    setStatus("Filters cleared. Choose a category to explore nearby places.");
  });

  window.addEventListener("smartmap:mapmove", () => {
    // We deliberately do not auto-query on every map movement; this avoids excessive public API traffic.
    if (activeCategory) setStatus(`${categoryNames[activeCategory]} filter selected. Tap the category again to refresh nearby results.`);
  });
}

async function loadPlaces(category, showToast, setLoading) {
  const map = getMap();
  if (!map) return;
  const center = map.getCenter();
  const radius = Math.min(5000, Math.round(5000 / Math.max(1, map.getZoom() / 7)));
  const query = `[out:json][timeout:20];(${categoryQueries[category]})(around:${radius},${center.lat},${center.lng});out center 40;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  if (lastRequestController) lastRequestController.abort();
  lastRequestController = new AbortController();
  setLoading(true, `Finding ${categoryNames[category].toLowerCase()}s…`);
  setStatus("Searching OpenStreetMap data…");
  try {
    let data;
    let lastError;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: `data=${encodeURIComponent(query)}`,
          signal: lastRequestController.signal
        });
        if (!response.ok) throw new Error(`Map data service returned ${response.status}.`);
        data = await response.json();
        break;
      } catch (error) {
        lastError = error;
        if (error.name === "AbortError") throw error;
      }
    }
    if (!data) throw lastError || new Error("Map data service is unavailable.");
    clearPoiMarkers();
    const elements = data.elements || [];
    let shown = 0;
    elements.forEach(element => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const name = element.tags?.name || categoryNames[category];
      const address = [
        element.tags?.["addr:street"], element.tags?.["addr:city"]
      ].filter(Boolean).join(", ");
      addPoiMarker(lat, lon, name, category, address);
      shown++;
    });
    if (!shown) {
      setStatus(`No ${categoryNames[category].toLowerCase()}s found in this area. Zoom out or move the map.`);
      showToast("No matching places were found in this area.");
    } else {
      setStatus(`${shown} place${shown === 1 ? "" : "s"} found nearby.`);
      if (shown === 1) showToast("1 place found.");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus("Places could not be loaded. The service may be busy.");
      showToast("Could not load nearby places. Please try again in a moment.");
    }
  } finally {
    setLoading(false);
  }
}
function setStatus(message) {
  const status = document.querySelector("#poi-status");
  if (status) status.textContent = message;
}
