// Supervivencia: día/noche, lluvia, temperatura, hambre, sed, estados, comer y beber
import * as THREE from 'three';
import { G, isNight } from './state.js';
import { DAY_LEN, CLASSES } from './data.js';
import { waterDepth } from './world.js';
import { hurtPlayer, floatText, playerDied } from './combat.js';
import { toast } from './ui.js';
import { clamp, lerp, rnd } from './noise.js';

let sun, hemi, rain, rainPos, fogDay = new THREE.Color('#9cc7b4'), fogNight = new THREE.Color('#0d1622'), fogDusk = new THREE.Color('#d98a5a'), fogRain = new THREE.Color('#5d6f6a');
const tmpC = new THREE.Color();
let warnT = 0;

export function initSky(scene) {
  hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2d4a22, 0.9); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1d6, 1.6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0015; scene.add(sun); scene.add(sun.target);
  scene.fog = new THREE.Fog(fogDay, 25, 95); scene.background = fogDay.clone();
  // lluvia: segmentos que caen alrededor de la cámara
  const N = 900; rainPos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const x = rnd(-25, 25), y = rnd(0, 22), z = rnd(-25, 25); rainPos.set([x, y, z, x + 0.05, y - 0.7, z], i * 6); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfd8e6, transparent: true, opacity: 0.5 }));
  rain.frustumCulled = false; scene.add(rain);
}

function updateSky(dt) {
  const P = G.P, t = G.time, w = G.weather;
  const ang = (t - 0.25) * Math.PI * 2; // 0 al amanecer, PI/2 al mediodía
  const elev = Math.sin(ang), day = clamp(elev * 3 + 0.3, 0, 1);
  sun.position.set(P.x + Math.cos(ang) * 50, P.y + Math.max(8, elev * 60), P.z + 25);
  sun.target.position.set(P.x, P.y, P.z);
  sun.intensity = lerp(0.08, 1.6, day) * (1 - w.rain * 0.55);
  sun.color.setHSL(0.1, 0.6, lerp(0.6, 0.92, clamp(elev * 2, 0, 1)));
  hemi.intensity = lerp(0.22, 0.95, day) * (1 - w.rain * 0.3);
  const dusk = clamp(1 - Math.abs(elev) * 4, 0, 1) * 0.6;
  tmpC.copy(fogNight).lerp(fogDay, day).lerp(fogDusk, dusk * day).lerp(fogRain, w.rain * 0.7 * Math.max(day, 0.3));
  G.scene.fog.color.copy(tmpC); G.scene.background.copy(tmpC);
  G.scene.fog.near = lerp(25, 10, w.rain); G.scene.fog.far = lerp(isNight() ? 60 : 95, 45, w.rain);
  // lluvia
  rain.visible = w.rain > 0.05; rain.material.opacity = w.rain * 0.55;
  if (rain.visible) {
    const cam = G.camera.position; rain.position.set(cam.x, cam.y - 10, cam.z);
    for (let i = 0; i < rainPos.length; i += 6) {
      rainPos[i + 1] -= 26 * dt; rainPos[i + 4] -= 26 * dt;
      if (rainPos[i + 1] < 0) { rainPos[i + 1] += 22; rainPos[i + 4] += 22; }
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
}

function updateWeather(dt) {
  const w = G.weather; w.t -= dt;
  if (w.t <= 0) {
    const raining = w.target > 0.5;
    w.target = raining ? 0 : (Math.random() < 0.45 ? 1 : 0);
    w.t = w.target ? rnd(50, 90) : rnd(80, 160);
    if (w.target && !raining) toast('Se acerca una tormenta tropical. Busca refugio o una hoguera.', '', 4);
  }
  w.rain += (w.target - w.rain) * Math.min(1, dt * 0.15);
}

export const inCampFire = () => G.camp && G.camp.parts.hoguera && Math.hypot(G.P.x - G.camp.x, G.P.z - G.camp.z) < 5;
export const underRoof = () => G.camp && G.camp.parts.refugio && Math.hypot(G.P.x - G.camp.x, G.P.z - G.camp.z) < 5;

function updateNeeds(dt) {
  const P = G.P, cl = CLASSES[P.cls], w = G.weather;
  const fire = inCampFire(), roof = underRoof();
  // mojado
  if ((w.rain > 0.4 && !roof) || waterDepth(P.x, P.z) > 0.4) P.wet = Math.min(30, P.wet + dt * 3);
  else P.wet = Math.max(0, P.wet - dt * (fire ? 6 : 1));
  // temperatura corporal (50 = cómoda)
  const elev = Math.sin((G.time - 0.25) * Math.PI * 2);
  let target = 50 + elev * 20 - (roof ? 0 : w.rain * 14) - Math.min(14, P.wet * 0.6);
  if (fire) target = Math.max(target, 55);
  P.temp += (target - P.temp) * Math.min(1, dt * 0.08);
  // necesidades
  const hot = P.temp > 66 ? 1.6 : 1;
  P.hunger = Math.max(0, P.hunger - dt * 0.2 * cl.need);
  P.thirst = Math.max(0, P.thirst - dt * 0.3 * cl.need * hot * (w.rain > 0.5 ? 0.5 : 1));
  // llenar cantimplora con la lluvia
  if (P.items.cantimplora && w.rain > 0.6 && P.water < 3) { P.waterRain = (P.waterRain || 0) + dt; if (P.waterRain > 8) { P.waterRain = 0; P.water++; floatText(P, '+1 trago (lluvia)', 'good'); } }
  // daño y regeneración
  let dmg = 0;
  if (P.hunger <= 0) dmg += 1;
  if (P.thirst <= 0) dmg += 1.5;
  if (P.temp < 24) dmg += 0.8;
  if (P.temp > 80) dmg += 0.6;
  if (P.status.veneno > 0) { P.status.veneno -= dt; dmg += P.cls === 'superviviente' ? 0.8 : 1.5; }
  if (P.status.sangrado > 0) { P.status.sangrado -= dt; dmg += 2; }
  if (dmg > 0) { P.hp -= dmg * dt; if (P.hp <= 0) { playerDied(); return; } }
  else if (P.hunger > 40 && P.thirst > 40) P.hp = Math.min(P.maxHp, P.hp + dt * (fire ? 3 : 0.5));
  // avisos
  warnT -= dt;
  if (warnT <= 0) {
    if (P.thirst < 20) { toast('Tienes mucha sed. Bebe del río o de tu cantimplora.', 'bad'); warnT = 25; }
    else if (P.hunger < 20) { toast('Tienes hambre. Come fruta o carne asada.', 'bad'); warnT = 25; }
    else if (P.temp < 30) { toast('Estás helado y empapado. Acércate a una hoguera.', 'bad'); warnT = 25; }
  }
}

export function updateSurvival(dt) {
  const before = G.time;
  G.time += dt / DAY_LEN; if (G.time >= 1) { G.time -= 1; G.day++; }
  if (before < 0.77 && G.time >= 0.77) toast('Cae la noche. Las panteras salen a cazar…', 'bad', 4);
  if (before < 0.25 && G.time >= 0.25) toast(`Amanece el día ${G.day}.`, 'good');
  updateWeather(dt); updateNeeds(dt); updateSky(dt);
}

/* ---------------- Comer / beber / curar ---------------- */
export function drink() {
  const P = G.P;
  if (P.thirst >= 98 && !(P.items.cantimplora && P.water < 3)) { floatText(P, 'No tienes sed'); return; }
  P.thirst = Math.min(100, P.thirst + 30);
  if (P.items.cantimplora && P.water < 3) { P.water = 3; toast('Bebes y llenas la cantimplora (3 tragos).', 'good'); }
  else floatText(P, '+30 sed', 'good');
  if (Math.random() < 0.08 && P.cls !== 'superviviente') { P.status.veneno = Math.max(P.status.veneno, 8); toast('El agua del río no estaba limpia… estás envenenado.', 'bad'); }
}
export function drinkCanteen() {
  const P = G.P; if (P.water <= 0) { toast('La cantimplora está vacía.', 'bad'); return; }
  P.water--; P.thirst = Math.min(100, P.thirst + 30); floatText(P, '+30 sed', 'good');
}
export const FOOD = { asada: 32, fruta: 14, carne: 12 };
export function eat(k) {
  const P = G.P; if (!P.inv[k]) return;
  P.inv[k]--; P.hunger = Math.min(100, P.hunger + FOOD[k]);
  if (k === 'fruta') P.thirst = Math.min(100, P.thirst + 6);
  floatText(P, `+${FOOD[k]} comida`, 'good');
  if (k === 'carne' && Math.random() < 0.35) { P.status.veneno = Math.max(P.status.veneno, 10); toast('La carne cruda te ha sentado mal: veneno. Ásala en la hoguera.', 'bad'); }
}
export function eatBest() {
  const P = G.P;
  if (P.hunger > 95) { if (P.thirst < 90 && P.water > 0) return drinkCanteen(); floatText(P, 'No tienes hambre'); return; }
  for (const k of ['asada', 'fruta', 'carne']) if (P.inv[k] > 0) return eat(k);
  if (P.water > 0) return drinkCanteen();
  toast('No tienes comida. Recoge fruta o caza.', 'bad');
}
export function useItem(k) {
  const P = G.P; if (!P.inv[k]) return;
  if (k === 'venda') { P.inv.venda--; P.hp = Math.min(P.maxHp, P.hp + 20); P.status.sangrado = 0; toast('Te vendas la herida.', 'good'); }
  if (k === 'antidoto') { P.inv.antidoto--; P.status.veneno = 0; toast('El veneno desaparece.', 'good'); }
  if (k === 'botiquin') { P.inv.botiquin--; P.hp = Math.min(P.maxHp, P.hp + 50); P.status.sangrado = 0; toast('+50 de vida.', 'good'); }
  if (k in FOOD) eat(k);
}
export function tempLabel(t) { return t < 24 ? 'Helado' : t < 38 ? 'Frío' : t < 62 ? 'Templado' : t < 75 ? 'Caluroso' : 'Sofocante'; }
