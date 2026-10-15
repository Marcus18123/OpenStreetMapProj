import { flyToLocation, selectLocation } from "./map.js";

let debounceTimer;
let currentResults = [];
let activeIndex = -1;

const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const suggestions = document.querySelector("#search-suggestions");

export function initSearch(showToast, setLoading) {
  input.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (query.length < 3) {
      closeSuggestions();
      return;
    }
    debounceTimer = window.setTimeout(() => fetchSuggestions(query, showToast, setLoading), 350);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && currentResults.length) {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      highlightSuggestion();
    } else if (event.key === "ArrowUp" && currentResults.length) {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightSuggestion();
    } else if (event.key === "Escape") {
      closeSuggestions();
      input.blur();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      input.setCustomValidity("Enter a place or address to search.");
      input.reportValidity();
      showToast("Please enter a location to search.");
      return;
    }
    input.setCustomValidity("");
    if (currentResults.length && activeIndex >= 0) {
      chooseResult(currentResults[activeIndex]);
      return;
    }
    setLoading(true, "Searching locations…");
    try {
      const results = await searchLocations(query);
      if (!results.length) {
        showToast("No matching locations found. Try a more specific search.");
        closeSuggestions();
        return;
      }
      currentResults = results;
      renderSuggestions(results);
      chooseResult(results[0]);
    } catch (error) {
      showToast(error.message || "Search is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  });

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) closeSuggestions();
  });
}

async function fetchSuggestions(query, showToast, setLoading) {
  try {
    setLoading(true, "Finding suggestions…");
    currentResults = await searchLocations(query);
    activeIndex = -1;
    renderSuggestions(currentResults);
    if (!currentResults.length) {
      suggestions.innerHTML = '<div class="suggestion-item"><i class="fa-solid fa-circle-info"></i><span><strong>No suggestions found</strong><small>Try another spelling or a nearby landmark.</small></span></div>';
      suggestions.classList.remove("hidden");
    }
  } catch (error) {
    closeSuggestions();
    showToast("Could not load suggestions. Check your connection and try again.");
  } finally {
    setLoading(false);
  }
}

async function searchLocations(query) {
  // Photon supports location autocomplete. Requests are debounced to reduce traffic.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=en`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Search service returned ${response.status}.`);
  const data = await response.json();
  return (data.features || []).map(feature => {
    const p = feature.properties || {};
    const coords = feature.geometry?.coordinates || [];
    return {
      name: [p.name, p.locality, p.city, p.state, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(", ") || "Unnamed location",
      address: [p.street, p.housenumber, p.district, p.city, p.state, p.country].filter(Boolean).join(", "),
      lat: Number(coords[1]), lon: Number(coords[0])
    };
  }).filter(result => Number.isFinite(result.lat) && Number.isFinite(result.lon));
}

function renderSuggestions(results) {
  currentResults = results;
  suggestions.innerHTML = "";
  results.forEach((result, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.setAttribute("role", "option");
    button.dataset.index = String(index);
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-location-dot";
    const text = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = result.name;
    const subtitle = document.createElement("small");
    subtitle.textContent = result.address || "Location result";
    text.append(title, subtitle);
    button.append(icon, text);
    button.addEventListener("click", () => chooseResult(result));
    suggestions.append(button);
  });
  suggestions.classList.toggle("hidden", results.length === 0);
}

function chooseResult(result) {
  if (!result) return;
  flyToLocation(result.lat, result.lon, 15);
  selectLocation(result.lat, result.lon, result.name, result.address);
  input.value = result.name;
  closeSuggestions();
}

function highlightSuggestion() {
  [...suggestions.querySelectorAll(".suggestion-item")].forEach((item, index) => {
    item.classList.toggle("active", index === activeIndex);
    if (index === activeIndex) item.scrollIntoView({ block: "nearest" });
  });
}
function closeSuggestions() {
  suggestions.classList.add("hidden");
  activeIndex = -1;
}
