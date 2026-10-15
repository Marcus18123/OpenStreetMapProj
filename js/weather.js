import { getMap } from "./map.js";

let activeEffect = "off";
let animationId = null;
let particles = [];
let ctx;
let canvas;
let lastFrame = 0;
let weatherData = null;

const codeDescriptions = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Drizzle",
  55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Rain showers",
  81: "Moderate showers", 82: "Heavy showers", 95: "Thunderstorm"
};

export function initWeather(showToast, setLoading) {
  canvas = document.querySelector("#weather-canvas");
  ctx = canvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  document.querySelector("#weather-toggle").addEventListener("click", () => {
    const card = document.querySelector("#weather-card");
    card.classList.toggle("hidden");
    if (!card.classList.contains("hidden")) fetchWeather(showToast, setLoading);
    else setEffect("off");
  });
  document.querySelector("#weather-close").addEventListener("click", () => {
    document.querySelector("#weather-card").classList.add("hidden");
    setEffect("off");
  });

  document.querySelectorAll("[data-weather-effect]").forEach(button => {
    button.addEventListener("click", () => {
      const effect = button.dataset.weatherEffect;
      setEffect(effect);
      if (effect === "rain" && weatherData && (weatherData.current.precipitation || 0) < 0.1) {
        showToast("Current data reports little or no precipitation; rain animation is disabled.");
        setEffect("off");
      } else if (effect !== "off" && !weatherData) {
        showToast("Load weather data before enabling an overlay.");
        setEffect("off");
      }
    });
  });

  window.addEventListener("smartmap:mapmove", () => {
    if (!document.querySelector("#weather-card").classList.contains("hidden")) {
      window.clearTimeout(window.__smartMapWeatherTimer);
      window.__smartMapWeatherTimer = window.setTimeout(() => fetchWeather(showToast, setLoading), 650);
    }
  });
}

export async function fetchWeather(showToast, setLoading) {
  const map = getMap();
  if (!map) return;
  const center = map.getCenter();
  setLoading(true, "Fetching local weather…");
  document.querySelector("#weather-note").textContent = "Loading current weather data…";
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
    const data = await response.json();
    if (!data.current) throw new Error("Weather information was not included in the response.");
    weatherData = data;
    const current = data.current;
    document.querySelector("#weather-place").textContent = `${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}`;
    document.querySelector("#weather-temperature").textContent = `${Math.round(current.temperature_2m)}°`;
    document.querySelector("#weather-description").textContent = codeDescriptions[current.weather_code] || "Current conditions";
    document.querySelector("#weather-wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    document.querySelector("#weather-rain").textContent = `${Number(current.precipitation || 0).toFixed(1)} mm`;
    document.querySelector("#weather-direction").textContent = `${Math.round(current.wind_direction_10m)}°`;
    document.querySelector("#weather-icon").className = `fa-solid ${weatherIcon(current.weather_code, current.is_day)}`;
    document.querySelector("#weather-note").textContent = `Updated from Open-Meteo · ${current.time || "Current conditions"}`;
    if (activeEffect === "rain" && (current.precipitation || 0) < 0.1) setEffect("off");
  } catch (error) {
    document.querySelector("#weather-description").textContent = "Weather unavailable";
    document.querySelector("#weather-note").textContent = "Check your connection and try again.";
    showToast(error.message || "Unable to retrieve weather data.");
  } finally {
    setLoading(false);
  }
}

function weatherIcon(code, isDay) {
  if ([0, 1].includes(code)) return isDay ? "fa-sun" : "fa-moon";
  if ([2, 3, 45, 48].includes(code)) return "fa-cloud";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95].includes(code)) return "fa-cloud-rain";
  if ([71, 73, 75].includes(code)) return "fa-snowflake";
  return "fa-cloud-sun";
}

function setEffect(effect) {
  activeEffect = effect;
  document.querySelectorAll("[data-weather-effect]").forEach(button => {
    button.classList.toggle("active", button.dataset.weatherEffect === effect);
  });
  canvas.classList.toggle("active", effect !== "off");
  if (effect === "off") {
    stopAnimation();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  seedParticles(effect === "wind" ? 75 : 100);
  if (animationId === null) animationId = requestAnimationFrame(animate);
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedParticles(activeEffect === "wind" ? 75 : 100);
}

function seedParticles(count) {
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    length: activeEffect === "wind" ? 12 + Math.random() * 22 : 2 + Math.random() * 8,
    speed: activeEffect === "wind" ? 0.4 + Math.random() * 1.4 : 2 + Math.random() * 5,
    alpha: 0.2 + Math.random() * 0.45
  }));
}

function animate(timestamp) {
  animationId = null;
  if (activeEffect === "off" || document.hidden) return;
  if (timestamp - lastFrame < 32) {
    animationId = requestAnimationFrame(animate);
    return;
  }
  lastFrame = timestamp;
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);
  const windDirection = ((weatherData?.current?.wind_direction_10m || 240) + 180) * Math.PI / 180;
  particles.forEach(particle => {
    ctx.beginPath();
    if (activeEffect === "wind") {
      const dx = Math.cos(windDirection) * particle.length;
      const dy = Math.sin(windDirection) * particle.length;
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x + dx, particle.y + dy);
      ctx.strokeStyle = `rgba(154,255,226,${particle.alpha})`;
      ctx.lineWidth = 1.25;
      ctx.stroke();
      particle.x += Math.cos(windDirection) * particle.speed;
      particle.y += Math.sin(windDirection) * particle.speed;
      if (particle.x < -30 || particle.x > width + 30 || particle.y < -30 || particle.y > height + 30) {
        particle.x = Math.random() * width;
        particle.y = Math.random() * height;
      }
    } else {
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x - 3, particle.y + particle.length);
      ctx.strokeStyle = `rgba(157,211,255,${particle.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      particle.y += particle.speed;
      particle.x -= 0.5;
      if (particle.y > height) { particle.y = -10; particle.x = Math.random() * width; }
    }
  });
  animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAnimation();
  else if (activeEffect !== "off" && animationId === null) animationId = requestAnimationFrame(animate);
});
