// Guardado en este navegador (localStorage)
import { G } from './state.js';
import { SAVE_KEY } from './data.js';

export function save() {
  if (!G.P) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, seed: G.seed, P: G.P, camp: G.camp, time: G.time, day: G.day, weather: G.weather,
      defeated: G.defeated, stats: G.stats, camMode: G.camMode, look: G.look,
    }));
  } catch (e) { /* almacenamiento no disponible */ }
}
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; }
}
export function loadLook() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY + '-look') || 'null'); } catch (e) { return null; }
}
export function saveLook(look) { try { localStorage.setItem(SAVE_KEY + '-look', JSON.stringify(look)); } catch (e) { } }
