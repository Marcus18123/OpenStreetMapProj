import {
  getMap, zoomIn, zoomOut, resetView, resetOrientation, setUserLocation,
  setLabelPreference, setSmoothMotion, setMapLayer, makeMapLink, readMapLink
} from "./map.js";

const translations = {
  en: {
    weather: "Weather", discover: "DISCOVER", exploreMap: "Explore map", explore: "Explore",
    nearbyPlaces: "Nearby places", mapLayers: "Map layers", quickExplore: "QUICK EXPLORE",
    clear: "Clear", hospitals: "Hospitals", food: "Food", schools: "Schools", fuel: "Fuel",
    tourism: "Tourism", parks: "Parks", preferences: "PREFERENCES",
    interfaceLanguage: "Interface language", mapLabels: "Map labels", smoothMotion: "Smooth motion",
    localWeather: "LOCAL WEATHER", selectedLocation: "SELECTED LOCATION", share: "Share", copyLink: "Copy map link"
  },
  hi: {
    weather: "मौसम", discover: "खोजें", exploreMap: "मानचित्र देखें", explore: "खोजें",
    nearbyPlaces: "आस-पास के स्थान", mapLayers: "मानचित्र परतें", quickExplore: "जल्दी खोजें",
    clear: "साफ़ करें", hospitals: "अस्पताल", food: "भोजन", schools: "स्कूल", fuel: "ईंधन",
    tourism: "पर्यटन", parks: "पार्क", preferences: "प्राथमिकताएँ",
    interfaceLanguage: "इंटरफ़ेस भाषा", mapLabels: "मानचित्र नाम", smoothMotion: "सहज गति",
    localWeather: "स्थानीय मौसम", selectedLocation: "चुना गया स्थान", share: "साझा करें", copyLink: "मानचित्र लिंक कॉपी करें"
  },
  ml: {
    weather: "കാലാവസ്ഥ", discover: "കണ്ടെത്തുക", exploreMap: "മാപ്പ് പര്യവേക്ഷണം", explore: "പര്യവേക്ഷണം",
    nearbyPlaces: "സമീപ സ്ഥലങ്ങൾ", mapLayers: "മാപ്പ് ലെയറുകൾ", quickExplore: "വേഗത്തിലുള്ള തിരച്ചിൽ",
    clear: "മായ്ക്കുക", hospitals: "ആശുപത്രികൾ", food: "ഭക്ഷണം", schools: "സ്കൂളുകൾ", fuel: "ഇന്ധനം",
    tourism: "വിനോദസഞ്ചാരം", parks: "പാർക്കുകൾ", preferences: "മുൻഗണനകൾ",
    interfaceLanguage: "ഇന്റർഫേസ് ഭാഷ", mapLabels: "മാപ്പ് ലേബലുകൾ", smoothMotion: "സുഗമമായ ചലനം",
    localWeather: "പ്രാദേശിക കാലാവസ്ഥ", selectedLocation: "തിരഞ്ഞെടുത്ത സ്ഥലം", share: "പങ്കിടുക", copyLink: "മാപ്പ് ലിങ്ക് പകർത്തുക"
  }
};

let toastTimer;
let currentPlace = null;

export function initUI(showToast, setLoading) {
  document.querySelector("#zoom-in").addEventListener("click", zoomIn);
  document.querySelector("#zoom-out").addEventListener("click", zoomOut);
  document.querySelector("#reset-view").addEventListener("click", resetView);
  document.querySelector("#compass-button").addEventListener("click", resetOrientation);

  document.querySelector("#locate-button").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by this browser.");
      return;
    }
    setLoading(true, "Finding your location…");
    navigator.geolocation.getCurrentPosition(
      position => {
        setUserLocation(position.coords.latitude, position.coords.longitude);
        setLoading(false);
        showToast("Map centered on your location.");
      },
      error => {
        setLoading(false);
        const message = error.code === 1 ? "Location permission was denied." : "Could not determine your location.";
        showToast(message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
      const panel = button.dataset.panel;
      if (panel === "weather") {
        const card = document.querySelector("#weather-card");
        if (card.classList.contains("hidden")) document.querySelector("#weather-toggle").click();
        else card.classList.add("hidden");
      } else if (panel === "layers") {
        document.querySelector("#map-style").focus();
        document.querySelector("#map-style").scrollIntoView({ block: "nearest", behavior: "smooth" });
        showToast("Choose a map style under Preferences. The map will reload in that style.");
      } else if (panel === "places") {
        document.querySelector("[data-category='restaurant']").scrollIntoView({ block: "nearest", behavior: "smooth" });
        showToast("Choose a category under Quick Explore.");
      } else {
        showToast("Explore the map, search for a place or choose a category.");
      }
      closeMobileSidebar();
    });
  });

  document.querySelector("#ui-language").addEventListener("change", event => {
    applyLanguage(event.target.value);
    localStorage.setItem("smartmap-ui-language", event.target.value);
    showToast("Interface language updated.");
  });
  document.querySelector("#label-language").addEventListener("change", event => {
    localStorage.setItem("smartmap-label-language", event.target.value);
    setLabelPreference(event.target.value);
    showToast(event.target.value === "en"
      ? "English-first map labels enabled. Some places may still use local names when English data is unavailable."
      : "Local map labels enabled.");
  });
  document.querySelector("#map-style").addEventListener("change", event => {
    setMapLayer(event.target.value);
    localStorage.setItem("smartmap-map-style", event.target.value);
  });
  document.querySelector("#motion-toggle").addEventListener("change", event => {
    setSmoothMotion(event.target.checked);
    localStorage.setItem("smartmap-smooth-motion", String(event.target.checked));
    showToast(event.target.checked ? "Smooth motion enabled." : "Reduced motion enabled.");
  });

  document.querySelector("#place-close").addEventListener("click", () => document.querySelector("#place-card").classList.add("hidden"));
  document.querySelector("#copy-coordinates").addEventListener("click", async () => {
    if (!currentPlace) return;
    await copyText(`${currentPlace.lat.toFixed(6)}, ${currentPlace.lon.toFixed(6)}`, showToast);
  });
  document.querySelector("#copy-link").addEventListener("click", async () => {
    if (!currentPlace) return;
    await copyText(makeMapLink(currentPlace.lat, currentPlace.lon), showToast);
  });
  document.querySelector("#share-place").addEventListener("click", async () => {
    if (!currentPlace) return;
    const url = makeMapLink(currentPlace.lat, currentPlace.lon);
    const shareData = { title: currentPlace.name, text: currentPlace.address || "Explore this location on SmartMap", url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyText(url, showToast);
      }
    } catch (error) {
      if (error.name !== "AbortError") showToast("Sharing was not available. Try copying the map link.");
    }
  });

  document.querySelector("#menu-toggle").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#sidebar-close").addEventListener("click", closeMobileSidebar);
  document.querySelector("#map").addEventListener("contextmenu", event => {
    // MapLibre handles map gestures. Prevent the browser menu on the map surface.
    event.preventDefault();
    showToast("Click the map to select a location and view its coordinates.");
  });

  window.addEventListener("smartmap:place", event => showPlace(event.detail));
  window.addEventListener("smartmap:toast", event => showToast(event.detail));
  window.addEventListener("resize", () => {
    const map = getMap();
    if (map) setTimeout(() => map.resize(), 100);
  });

  const savedLanguage = localStorage.getItem("smartmap-ui-language") || "en";
  document.querySelector("#ui-language").value = savedLanguage;
  applyLanguage(savedLanguage);
  const savedLabelLanguage = localStorage.getItem("smartmap-label-language") || "local";
  document.querySelector("#label-language").value = savedLabelLanguage;
  setLabelPreference(savedLabelLanguage);
  const savedMapStyle = localStorage.getItem("smartmap-map-style") || "standard";
  document.querySelector("#map-style").value = savedMapStyle;
  setMapLayer(savedMapStyle);
  const savedMotion = localStorage.getItem("smartmap-smooth-motion");
  const motionEnabled = savedMotion === null ? true : savedMotion === "true";
  document.querySelector("#motion-toggle").checked = motionEnabled;
  setSmoothMotion(motionEnabled);
  readMapLink();
}

function showPlace(place) {
  currentPlace = place;
  document.querySelector("#place-name").textContent = place.name || "Selected location";
  document.querySelector("#place-address").textContent = place.address || "No additional address information is available.";
  document.querySelector("#place-coordinates").textContent = `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`;
  document.querySelector("#place-feedback").textContent = "";
  document.querySelector("#place-card").classList.remove("hidden");
  document.querySelector("#place-card").animate(
    [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: document.body.classList.contains("reduce-motion") ? 1 : 220, easing: "ease-out" }
  );
}

async function copyText(value, showToast) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("Copy failed");
    }
    showToast("Copied to clipboard.");
  } catch {
    showToast("Could not copy automatically. Select and copy the text manually.");
  }
}

function applyLanguage(language) {
  const dictionary = translations[language] || translations.en;
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    if (dictionary[key]) element.textContent = dictionary[key];
  });
}
function closeMobileSidebar() {
  document.querySelector("#sidebar").classList.remove("open");
}

export function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

export function setLoading(isLoading, message = "Loading…") {
  const indicator = document.querySelector("#loading-indicator");
  document.querySelector("#loading-text").textContent = message;
  indicator.classList.toggle("hidden", !isLoading);
}