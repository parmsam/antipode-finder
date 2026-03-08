'use strict';

// ===== State =====
const state = {
  origin: { lat: null, lng: null, name: '' },
  antipode: { lat: null, lng: null, name: '' },
};

// ===== Antipode Math =====
function calcAntipode(lat, lng) {
  return {
    lat: -lat,
    lng: lng <= 0 ? lng + 180 : lng - 180,
  };
}

function fmtCoords(lat, lng) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

// ===== Map Setup =====
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_OPTS = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 18,
};

const mapOrigin = L.map('map-origin', { zoomControl: true }).setView([20, 0], 2);
const mapAntipode = L.map('map-antipode', { zoomControl: true }).setView([20, 0], 2);

L.tileLayer(TILE_URL, TILE_OPTS).addTo(mapOrigin);
L.tileLayer(TILE_URL, TILE_OPTS).addTo(mapAntipode);

// ===== Markers =====
const ICON_ORIGIN = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const ICON_ANTIPODE = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#f97316;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const originMarker = L.marker([20, 0], { icon: ICON_ORIGIN, draggable: true }).addTo(mapOrigin);
const antipodeMarker = L.marker([20, 0], { icon: ICON_ANTIPODE, draggable: true }).addTo(mapAntipode);

// Hide markers initially until a point is set
originMarker.setOpacity(0);
antipodeMarker.setOpacity(0);

// ===== Core: setPoint =====
function setPoint(lat, lng) {
  lat = parseFloat(lat.toFixed(6));
  lng = parseFloat(lng.toFixed(6));

  const anti = calcAntipode(lat, lng);

  state.origin.lat = lat;
  state.origin.lng = lng;
  state.antipode.lat = anti.lat;
  state.antipode.lng = anti.lng;

  // Update markers
  updateMarker(mapOrigin, originMarker, lat, lng);
  updateMarker(mapAntipode, antipodeMarker, anti.lat, anti.lng);

  // Update coordinate display
  document.getElementById('origin-coords').textContent = fmtCoords(lat, lng);
  document.getElementById('antipode-coords').textContent = fmtCoords(anti.lat, anti.lng);

  // Show facts panel
  document.getElementById('facts').hidden = false;

  // Reverse geocode both points
  reverseGeocode(lat, lng, 'origin');
  reverseGeocode(anti.lat, anti.lng, 'antipode');

  // Update URL hash (no history push)
  updateHash(lat, lng);
}

function updateMarker(map, marker, lat, lng) {
  marker.setLatLng([lat, lng]);
  marker.setOpacity(1);
  map.flyTo([lat, lng], Math.max(map.getZoom(), 4), { animate: true, duration: 0.6 });
}

// ===== Reverse Geocoding =====
async function reverseGeocode(lat, lng, side) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();
    const name = buildPlaceName(data);

    if (side === 'origin') {
      state.origin.name = name;
      document.getElementById('origin-place').textContent = name;
    } else {
      state.antipode.name = name;
      document.getElementById('antipode-place').textContent = name;
      updateOceanFact(data);
    }
  } catch (_) {
    // Silently fail — coords are still shown
  }
}

function buildPlaceName(data) {
  if (!data || data.error) return 'Unknown location';
  const a = data.address || {};
  const parts = [
    a.city || a.town || a.village || a.county,
    a.country,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : (data.display_name || 'Unknown location').split(',').slice(0, 2).join(',').trim();
}

function updateOceanFact(data) {
  const icon = document.getElementById('fact-ocean-icon');
  const text = document.getElementById('fact-ocean-text');

  if (!data || data.error) {
    text.textContent = 'an unknown location';
    icon.textContent = '🌐';
    return;
  }

  const displayName = (data.display_name || '').toLowerCase();
  const type = (data.type || '').toLowerCase();
  const cls = (data.class || '').toLowerCase();

  const isWater =
    cls === 'natural' && (type === 'water' || type === 'bay' || type === 'strait') ||
    displayName.includes('ocean') ||
    displayName.includes(' sea') ||
    displayName.includes('gulf of') ||
    displayName.includes('bay of') ||
    type === 'water';

  if (isWater) {
    icon.textContent = '🌊';
    const name = data.display_name ? data.display_name.split(',')[0].trim() : 'the ocean';
    text.textContent = `in the water (${name})`;
  } else {
    icon.textContent = '🏔️';
    const a = data.address || {};
    const country = a.country || 'land';
    text.textContent = `on land (${country})`;
  }
}

// ===== Place Search =====
let searchDebounceTimer = null;

function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => fn(...args), delay);
  };
}

async function searchPlace(query, side) {
  if (!query || query.trim().length < 2) return;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const results = await res.json();
    if (!results.length) {
      showToast('No results found for "' + query + '"');
      return;
    }

    const { lat, lon } = results[0];
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lon);

    if (side === 'origin') {
      setPoint(parsedLat, parsedLng);
    } else {
      // User searched the antipode side — reverse-antipode to get the origin
      const origin = calcAntipode(parsedLat, parsedLng);
      setPoint(origin.lat, origin.lng);
    }
  } catch (_) {
    showToast('Search failed. Check your connection.');
  }
}

const debouncedSearch = debounce(searchPlace, 500);

// ===== URL Hash =====
function updateHash(lat, lng) {
  const hash = `#lat=${lat}&lng=${lng}`;
  history.replaceState(null, '', hash);
}

function loadFromHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const lat = parseFloat(params.get('lat'));
  const lng = parseFloat(params.get('lng'));
  if (!isNaN(lat) && !isNaN(lng)) {
    setPoint(lat, lng);
  }
}

// ===== Share =====
function shareLocation() {
  if (!state.origin.lat) {
    showToast('Pick a location first!');
    return;
  }
  const url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied to clipboard!');
    }).catch(() => {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  showToast('Link copied to clipboard!');
}

// ===== Toast =====
let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ===== Event Handlers =====

// Click on either map to set origin
mapOrigin.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng));

mapAntipode.on('click', (e) => {
  // Clicking antipode map: reverse-antipode → becomes origin
  const origin = calcAntipode(e.latlng.lat, e.latlng.lng);
  setPoint(origin.lat, origin.lng);
});

// Dragging origin marker
originMarker.on('dragend', (e) => {
  const { lat, lng } = e.target.getLatLng();
  setPoint(lat, lng);
});

// Dragging antipode marker → reverse-antipode to get origin
antipodeMarker.on('dragend', (e) => {
  const { lat, lng } = e.target.getLatLng();
  const origin = calcAntipode(lat, lng);
  setPoint(origin.lat, origin.lng);
});

// GPS
document.getElementById('btn-geolocate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported by your browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => setPoint(pos.coords.latitude, pos.coords.longitude),
    () => showToast('Could not get your location. Check permissions.'),
    { timeout: 8000 }
  );
});

// Share
document.getElementById('btn-share').addEventListener('click', shareLocation);

// Search inputs
document.getElementById('search-origin').addEventListener('input', (e) => {
  debouncedSearch(e.target.value, 'origin');
});

document.getElementById('search-origin').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchDebounceTimer);
    searchPlace(e.target.value, 'origin');
  }
});

document.getElementById('search-antipode').addEventListener('input', (e) => {
  debouncedSearch(e.target.value, 'antipode');
});

document.getElementById('search-antipode').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchDebounceTimer);
    searchPlace(e.target.value, 'antipode');
  }
});

// ===== Init =====
if (window.location.protocol === 'file:') {
  showToast('Open via a local server (python3 -m http.server) for search to work');
}
loadFromHash();
