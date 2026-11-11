// Arranque, menú y bucle principal
import * as THREE from 'three';
import { G } from './state.js';
import { CLASSES, SKINS, OUTFITS, STATION_POS } from './data.js';
import { buildWorld, updateWorld, heightAt, merchant } from './world.js';
import { initInput, took, resetInput } from './input.js';
import { newPlayer, spawnPlayerModel, updatePlayer, cam } from './player.js';
import { updateCombat, clearCombat } from './combat.js';
import { initCreatures, updateCreatures, clearCreatures } from './creatures.js';
import { initBoss, updateBoss } from './boss.js';
import { initSky, updateSurvival } from './survival.js';
import { rebuildCamp, updateCamp } from './crafting.js';
import { initUI, updateHud, toast, openPause, sheetOpen } from './ui.js';
import { save, loadSave, loadLook, saveLook } from './save.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1, 0.1, 160);
Object.assign(G, { renderer, scene, camera });
try { G.quality = localStorage.getItem('tdm3d-quality') || (matchMedia('(pointer:coarse)').matches ? 'low' : 'high'); } catch (e) { G.quality = 'high'; }

function applyQuality() {
  renderer.shadowMap.enabled = G.quality === 'high'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, G.quality === 'high' ? 2 : 1.25));
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  resize();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

/* ---------------- Mundo ---------------- */
let worldSeed = null;
function ensureWorld(seed) {
  if (worldSeed === seed) return;
  if (worldSeed !== null) { location.reload(); return; } // nuevo mundo: recargar para liberar memoria
  worldSeed = seed; G.seed = seed;
  buildWorld(scene, seed); initSky(scene); initCreatures(seed);
}

function startNew() {
  const seed = (Math.random() * 1e9) | 0;
  if (worldSeed !== null && worldSeed !== seed) { try { sessionStorage.setItem('tdm3d-new', JSON.stringify(G.look)); } catch (e) { } location.reload(); return; }
  ensureWorld(seed);
  G.P = newPlayer(G.look, { x: STATION_POS.x + 2, z: STATION_POS.z + 6 });
  Object.assign(G, { camp: null, time: 0.3, day: 1, weather: { rain: 0, target: 0, t: 120 }, defeated: false, stats: { gathered: 0, visited: false, kills: 0 }, camMode: 'third' });
  begin();
  toast('Bienvenido a la Jungla. Habla con el mercader de la estación o empieza a recolectar.', '', 6);
  setTimeout(() => toast('Mantén Acción junto a árboles y rocas para recoger recursos.', '', 6), 4000);
  save();
}
function startContinue() {
  const s = loadSave(); if (!s) return startNew();
  ensureWorld(s.seed);
  Object.assign(G, { P: s.P, camp: s.camp, time: s.time, day: s.day, weather: s.weather, defeated: s.defeated, stats: s.stats, camMode: s.camMode || 'third' });
  begin();
  toast(`Continúas en el día ${G.day}.`, 'good');
}
function begin() {
  clearCreatures(); clearCombat(); resetInput();
  spawnPlayerModel(); rebuildCamp(); initBoss();
  cam.yaw = 0; G.P.yaw = Math.PI; // de cara a la estación
  G.mode = 'play'; G.paused = false;
  $('#menu').hidden = true; $('#hud').hidden = false;
  $('#btnSkill').innerHTML = CLASSES[G.P.cls].skill.replace(' ', '<br>');
  applyQuality();
}
function quitToMenu() {
  G.mode = 'menu'; G.paused = true; $('#hud').hidden = true; $('#menu').hidden = false; refreshMenu();
}

/* ---------------- Menú ---------------- */
function refreshMenu() {
  const L = G.look;
  $('#nameIn').value = L.name;
  $('#classes').innerHTML = Object.entries(CLASSES).map(([k, c]) => `<button class="cls ${L.cls === k ? 'on' : ''}" data-cls="${k}"><b>${c.n}</b><span>${c.d}</span><em>${c.skill}</em></button>`).join('');
  $('#swSkin').innerHTML = SKINS.map(c => `<button style="--c:${c}" data-skin="${c}" class="${L.skin === c ? 'on' : ''}" aria-label="Piel"></button>`).join('');
  $('#swOutfit').innerHTML = OUTFITS.map(c => `<button style="--c:${c}" data-outfit="${c}" class="${L.outfit === c ? 'on' : ''}" aria-label="Ropa"></button>`).join('');
  $('#btnCont').hidden = !loadSave();
  drawPreview();
}
function drawPreview() {
  const cv = $('#prev'), g = cv.getContext('2d'), L = G.look, acc = CLASSES[L.cls].hat;
  g.clearRect(0, 0, 208, 208); g.save(); g.translate(104, 14); g.scale(1.05, 1.05);
  g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = '#15100c';
  const poly = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.stroke(); };
  const rect = (c, x, y, w, h, line = true) => { g.fillStyle = c; g.fillRect(x - w / 2, y, w, h); if (line) g.strokeRect(x - w / 2, y, w, h); };
  // pelo largo por detrás
  poly('#1a1512', [[-30, 20], [-40, 62], [-26, 52], [-22, 74], [-10, 58], [0, 78], [10, 58], [22, 74], [26, 52], [40, 62], [30, 20]]);
  // piernas y botas
  poly('#3a3027', [[-26, 120], [-4, 120], [-6, 170], [-22, 170]]); poly('#3a3027', [[4, 120], [26, 120], [22, 170], [6, 170]]);
  rect('#2a211b', -14, 168, 22, 10); rect('#2a211b', 14, 168, 22, 10);
  // brazos
  poly(L.outfit, [[-34, 70], [-48, 76], [-50, 92], [-38, 92]]); poly(L.outfit, [[34, 70], [48, 76], [50, 92], [38, 92]]);
  poly(L.skin, [[-49, 92], [-39, 92], [-40, 124], [-50, 124]]); poly(L.skin, [[49, 92], [39, 92], [40, 124], [50, 124]]);
  rect(acc, -45, 114, 12, 6); rect(acc, 45, 114, 12, 6);
  // torso en V
  poly(L.outfit, [[-36, 68], [36, 68], [24, 116], [-24, 116]]);
  poly('#2a2a30', [[-10, 68], [10, 68], [0, 84]]);
  rect(acc, 0, 110, 52, 9); poly(acc, [[10, 118], [18, 118], [16, 140], [9, 138]]);
  // cuello y cabeza
  rect(L.skin, 0, 56, 14, 14);
  poly(L.skin, [[-24, 18], [24, 18], [24, 42], [12, 58], [-12, 58], [-24, 42]]);
  g.lineWidth = 0;
  rect('#f7f3ea', -10, 34, 12, 8, false); rect('#f7f3ea', 10, 34, 12, 8, false);
  rect('#15100c', -9, 34, 6, 8, false); rect('#15100c', 9, 34, 6, 8, false);
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-17, 28); g.lineTo(-4, 31); g.moveTo(17, 28); g.lineTo(4, 31); g.moveTo(-5, 50); g.lineTo(6, 49); g.stroke();
  g.strokeStyle = '#a24a3c'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, 40); g.lineTo(-12, 47); g.moveTo(-20, 47); g.lineTo(-13, 40); g.stroke();
  g.strokeStyle = '#15100c'; g.lineWidth = 3;
  // pelo de punta y cinta
  poly('#1a1512', [[-28, 24], [-34, 4], [-24, 8], [-26, -14], [-12, -2], [-6, -20], [4, -4], [14, -20], [16, -2], [30, -12], [26, 8], [34, 6], [28, 24], [20, 18], [14, 28], [8, 18], [0, 28], [-8, 18], [-14, 28], [-20, 18]]);
  rect(acc, 0, 12, 52, 7); poly(acc, [[24, 14], [38, 24], [34, 28], [22, 19]]);
  g.restore();
}
function initMenu() {
  const saved = loadLook(); if (saved) Object.assign(G.look, saved);
  $('#menu').addEventListener('click', e => {
    const c = e.target.closest('[data-cls]'), s = e.target.closest('[data-skin]'), o = e.target.closest('[data-outfit]');
    if (c) G.look.cls = c.dataset.cls; if (s) G.look.skin = s.dataset.skin; if (o) G.look.outfit = o.dataset.outfit;
    if (c || s || o) { saveLook(G.look); refreshMenu(); }
  });
  $('#nameIn').addEventListener('input', e => { G.look.name = e.target.value.trim() || 'Explorador'; saveLook(G.look); });
  $('#btnNew').addEventListener('click', () => { if (loadSave() && !confirm('¿Empezar una partida nueva? Se perderá la actual.')) return; startNew(); });
  $('#btnCont').addEventListener('click', startContinue);
  refreshMenu();
}

/* ---------------- Bucle ---------------- */
let last = performance.now(), saveT = 20, worldT = 0, menuA = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.mode === 'play') {
    if (took('menu') && !sheetOpen()) openPause();
    if (!G.paused) {
      let wdt = dt; if (G.hitstop > 0) { G.hitstop -= dt; wdt = dt * 0.08; }
      updatePlayer(wdt); updateCreatures(wdt); updateBoss(wdt); updateCombat(wdt); updateSurvival(wdt); updateCamp(wdt);
      worldT -= dt; if (worldT <= 0) { worldT = 0.5; updateWorld(0.5); }
      G.shake = Math.max(0, G.shake - dt * 2.2);
      saveT -= dt; if (saveT <= 0) { saveT = 20; save(); }
      updateHud(dt);
    }
  } else if (worldSeed !== null) {
    menuA += dt * 0.05; const x = STATION_POS.x + Math.cos(menuA) * 26, z = STATION_POS.z + Math.sin(menuA) * 26;
    camera.position.set(x, heightAt(x, z) + 9, z); camera.lookAt(STATION_POS.x, heightAt(STATION_POS.x, STATION_POS.z) + 2, STATION_POS.z);
  }
  if (worldSeed !== null) renderer.render(scene, camera);
}

/* ---------------- Inicio ---------------- */
initInput(canvas); initMenu();
initUI({ onQuit: quitToMenu, onQuality: () => { G.quality = G.quality === 'high' ? 'low' : 'high'; try { localStorage.setItem('tdm3d-quality', G.quality); } catch (e) { } applyQuality(); } });
resize();
// mundo de fondo para el menú (o partida nueva tras recargar)
let pendingNew = null; try { pendingNew = JSON.parse(sessionStorage.getItem('tdm3d-new') || 'null'); sessionStorage.removeItem('tdm3d-new'); } catch (e) { }
const s0 = loadSave();
if (pendingNew) { Object.assign(G.look, pendingNew); startNew(); }
else { ensureWorld(s0 ? s0.seed : 12345); applyQuality(); }
requestAnimationFrame(frame);
$('#loading').hidden = true;
window.__tdm = { G, R: (await import('./player.js')).R }; // ayuda de depuración
