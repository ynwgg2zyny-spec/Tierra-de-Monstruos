// Fabricación y campamento nómada
import * as THREE from 'three';
import { G, isNight } from './state.js';
import { RECIPES, STRUCTS, STATION_POS, ARENA_POS } from './data.js';
import { heightAt, isWater, nearby, destroyObject } from './world.js';
import { mat } from './models.js';
import { equip } from './player.js';
import { toast } from './ui.js';
import { save } from './save.js';

let campGroup = null, fireLight = null, flame = null;

export function costOf(c) {
  if (G.P.cls !== 'ingeniero') return c;
  const o = {}; for (const k in c) o[k] = Math.max(1, Math.ceil(c[k] * 0.8)); return o;
}
export const hasAll = c => Object.entries(c).every(([k, v]) => (G.P.inv[k] || 0) >= v);
const pay = c => { for (const [k, v] of Object.entries(c)) G.P.inv[k] -= v; };
export const nearCamp = (r = 7) => G.camp && Math.hypot(G.P.x - G.camp.x, G.P.z - G.camp.z) < r;
export function needOk(need) { return !need || (nearCamp() && G.camp.parts[need]); }
export function owned(rc) {
  const P = G.P;
  return (rc.tool && P.tools[rc.tool]) || (rc.weapon && P.weapons.includes(rc.weapon)) || (rc.item && P.items[rc.item]);
}

export function craft(id) {
  const rc = RECIPES.find(r => r.id === id), P = G.P, c = costOf(rc.cost);
  if (owned(rc) || !hasAll(c) || !needOk(rc.need)) return false;
  pay(c);
  if (rc.tool) P.tools[rc.tool] = true;
  if (rc.weapon) { P.weapons.push(rc.weapon); equip(rc.weapon); }
  if (rc.item) { P.items[rc.item] = true; if (rc.item === 'cantimplora') P.water = 0; }
  if (rc.give) for (const [k, v] of Object.entries(rc.give)) P.inv[k] += v;
  toast(`Has fabricado: ${rc.n}`, 'good'); save();
  return true;
}

export function canPlaceCamp() {
  const P = G.P;
  if (Math.hypot(P.x - STATION_POS.x, P.z - STATION_POS.z) < 16) return 'Demasiado cerca de la estación.';
  if (Math.hypot(P.x - ARENA_POS.x, P.z - ARENA_POS.z) < 30) return 'No puedes acampar en las ruinas del Gorila.';
  if (isWater(P.x, P.z)) return 'No puedes acampar en el agua.';
  return null;
}
export function buildStruct(id) {
  const s = STRUCTS.find(x => x.id === id), c = costOf(s.cost), P = G.P;
  if (!hasAll(c)) return false;
  if (id === 'hoguera' && !G.camp) {
    const err = canPlaceCamp(); if (err) { toast(err, 'bad'); return false; }
    G.camp = { x: P.x + Math.sin(P.yaw) * 1.5, z: P.z + Math.cos(P.yaw) * 1.5, parts: {} };
    clearAround();
  } else if (!nearCamp()) { toast('Acércate a tu campamento para construir.', 'bad'); return false; }
  if (G.camp.parts[id]) return false;
  pay(c); G.camp.parts[id] = true; rebuildCamp();
  toast(id === 'hoguera' ? '¡Campamento montado! Junto al fuego te curas y los animales no se acercan.' : `${s.n} construido.`, 'good', 5);
  save(); return true;
}
export function moveCampHere() {
  const err = canPlaceCamp(); if (err) { toast(err, 'bad'); return; }
  const P = G.P; G.camp.x = P.x + Math.sin(P.yaw) * 1.5; G.camp.z = P.z + Math.cos(P.yaw) * 1.5;
  clearAround(); rebuildCamp(); toast('Has recogido el campamento y lo has montado aquí.', 'good'); save();
}
export function cook(all) {
  const P = G.P; if (!G.camp?.parts.hoguera || !nearCamp()) return;
  const n = all ? P.inv.carne : Math.min(1, P.inv.carne);
  P.inv.carne -= n; P.inv.asada += n; if (n) toast(`Has asado ${n} de carne.`, 'good');
}
export function sleep() {
  const P = G.P;
  if (!G.camp?.parts.refugio) return toast('Necesitas un refugio para dormir.', 'bad');
  if (!isNight()) return toast('Solo puedes dormir de noche.', 'bad');
  if (G.creatures.some(c => !c.dead && c.aggro && Math.hypot(c.x - P.x, c.z - P.z) < 20)) return toast('No puedes dormir con enemigos cerca.', 'bad');
  if (G.time > 0.5) G.day++;
  G.time = 0.26; P.hp = P.maxHp; P.hunger = Math.max(0, P.hunger - 18); P.thirst = Math.max(0, P.thirst - 22); P.temp = 52; P.wet = 0;
  toast(`Duermes hasta el amanecer. Día ${G.day}.`, 'good'); save();
}

// Despeja la vegetación donde se monta el campamento
function clearAround() {
  for (const o of nearby(G.camp.x, G.camp.z, 6)) if (o.kind !== 'solid' && Math.hypot(o.x - G.camp.x, o.z - G.camp.z) < 5) destroyObject(o, 99999);
}

/* ---------------- Aspecto del campamento ---------------- */
export function rebuildCamp() {
  if (campGroup) G.scene.remove(campGroup);
  campGroup = null; flame = null;
  if (!G.camp) { if (fireLight) fireLight.intensity = 0; return; }
  const g = new THREE.Group(), cp = G.camp.parts, y = heightAt(G.camp.x, G.camp.z);
  g.position.set(G.camp.x, y, G.camp.z);
  const add = (geo, m, x, yy, z, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, yy, z); me.rotation.set(0, ry, rz); me.castShadow = true; g.add(me); return me; };
  if (cp.hoguera) {
    const stone = mat('#8d8a82'), log = mat('#6b4a2e');
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; add(new THREE.DodecahedronGeometry(0.22, 0), stone, Math.cos(a) * 0.65, 0.12, Math.sin(a) * 0.65); }
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(0.08, 0.08, 1, 5), log, 0, 0.18, 0, i * 1.05, Math.PI / 2);
    flame = add(new THREE.ConeGeometry(0.35, 0.9, 5), new THREE.MeshBasicMaterial({ color: 0xffa030 }), 0, 0.6, 0);
    if (!fireLight) { fireLight = new THREE.PointLight(0xff8a30, 0, 18, 1.5); G.scene.add(fireLight); }
    fireLight.position.set(G.camp.x, y + 1.4, G.camp.z);
  }
  if (cp.refugio) {
    const leaf = mat('#4c8a3a'), wood = mat('#7a5230');
    add(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood, -3.2, 1.2, -1); add(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood, -3.2, 1.2, 1.8);
    add(new THREE.BoxGeometry(2.4, 0.08, 3.2), leaf, -3.9, 1.6, 0.4, 0, 0.8); add(new THREE.BoxGeometry(2.4, 0.08, 3.2), leaf, -2.5, 1.6, 0.4, 0, -0.8);
  }
  if (cp.mesa) {
    const wood = mat('#9a6a3a');
    add(new THREE.BoxGeometry(1.8, 0.12, 0.9), wood, 2.8, 0.9, -1.4);
    for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) add(new THREE.BoxGeometry(0.1, 0.9, 0.1), wood, 2.8 + x, 0.45, -1.4 + z);
    add(new THREE.BoxGeometry(0.4, 0.25, 0.3), mat('#8d8a82'), 2.5, 1.05, -1.4);
  }
  if (cp.empalizada) {
    const wood = mat('#7a5230');
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * 6.28; if (Math.abs(a - Math.PI / 2) < 0.25) continue; // entrada
      const x = Math.cos(a) * 8.5, z = Math.sin(a) * 8.5, hh = 1.6 + (i % 3) * 0.2;
      add(new THREE.CylinderGeometry(0.15, 0.18, hh, 5), wood, x, heightAt(G.camp.x + x, G.camp.z + z) - y + hh / 2, z);
    }
  }
  G.scene.add(campGroup = g);
}
export function updateCamp(dt) {
  if (!flame) return;
  const k = performance.now() / 1000;
  flame.scale.set(1 + Math.sin(k * 13) * 0.12, 1 + Math.sin(k * 9) * 0.2, 1 + Math.cos(k * 11) * 0.12);
  fireLight.intensity = 2.4 + Math.sin(k * 17) * 0.4 + Math.sin(k * 7) * 0.3;
}
