import { initMap, readMapLink } from "./map.js";
import { initSearch } from "./search.js";
import { initPlaces } from "./places.js";
import { initWeather } from "./weather.js";
import { initUI, showToast, setLoading } from "./ui.js";

window.addEventListener("load", () => {
  try {
    initMap();
    initUI(showToast, setLoading);
    initSearch(showToast, setLoading);
    initPlaces(showToast, setLoading);
    initWeather(showToast, setLoading);
    readMapLink();
    window.addEventListener("online", () => showToast("Connection restored."));
    window.addEventListener("offline", () => showToast("You are offline. Live map data may not load."));
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        document.querySelector("#search-input").focus();
      }
    });
  } catch (error) {
    console.error("SmartMap initialization failed:", error);
    showToast("SmartMap could not start. Refresh the page and try again.");
  }
});
