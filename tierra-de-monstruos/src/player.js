// Jugador: movimiento, cámara 1ª/3ª persona, esquiva, ataques, acciones y habilidades
import * as THREE from 'three';
import { G, isNight } from './state.js';
import { input, took, keyLook } from './input.js';
import { CLASSES, WEAPONS, STATION_POS, WORLD } from './data.js';
import { buildHumanoid, setWeapon, animHumanoid, flash } from './models.js';
import { heightAt, collide, nearby, hitObject, isWater, waterDepth, merchant, objKindName } from './world.js';
import { enemies, damageEnemy, spawnArrow, burst, floatText } from './combat.js';
import { toast, openStation, openCamp, openBag } from './ui.js';
import { drink, eatBest } from './survival.js';
import { clamp, angDiff, rnd } from './noise.js';

export const cam = { yaw: 0, pitch: 0.42, dist: 7, fpPitch: 0 };
const C = () => CLASSES[G.P.cls];
let torch = null;

export function newPlayer(look, pos) {
  const cl = CLASSES[look.cls];
  return {
    x: pos.x, z: pos.z, y: 0, yaw: 0, name: look.name, cls: look.cls, skin: look.skin, outfit: look.outfit,
    hp: cl.hp, maxHp: cl.hp, stamina: 100, hunger: 85, thirst: 80, temp: 50, wet: 0,
    inv: { madera: 0, piedra: 0, liana: 0, fibra: 0, hierba: 0, obsidiana: 0, fruta: 3, carne: 0, asada: 1, piel: 0, venda: 1, antidoto: 0, botiquin: 0, flechas: 0, colmillo: 0 },
    jade: 5, weapons: ['punos'], weapon: 'punos', tools: {}, items: {}, water: 0,
    status: { veneno: 0, sangrado: 0 },
  };
}

// Parte "viva" (no se guarda): modelo, timers de combate...
export const R = { model: null, iframes: 0, roll: 0, rollX: 0, rollZ: 0, atk: null, charge: 0, cd: 0, lock: null, walk: 0, stDelay: 0,
  harvCd: 0, skillCd: 0, sprintT: 0, doubleT: 0, powerHit: false, hurtT: 0, ctx: null, moveX: 0, moveZ: 0, speed: 0 };

export function spawnPlayerModel() {
  const P = G.P;
  if (R.model) G.scene.remove(R.model.group);
  R.model = buildHumanoid({ skin: P.skin, outfit: P.outfit, hat: CLASSES[P.cls].hat });
  G.scene.add(R.model.group); setWeapon(R.model, P.weapon);
  if (!torch) { torch = new THREE.PointLight(0xffa040, 0, 16, 1.6); G.scene.add(torch); }
  Object.assign(R, { iframes: 0, roll: 0, atk: null, charge: 0, cd: 0, lock: null, skillCd: 0, sprintT: 0, doubleT: 0, powerHit: false });
  cam.yaw = Math.PI; // mira hacia +z al empezar
}

function camVectors() {
  return { fx: -Math.sin(cam.yaw), fz: -Math.cos(cam.yaw), rx: Math.cos(cam.yaw), rz: -Math.sin(cam.yaw) };
}

export function updatePlayer(dt) {
  const P = G.P, m = R.model, cl = C();
  keyLook(dt);
  // cámara (arrastre)
  cam.yaw -= input.lookX * 0.0065;
  if (G.camMode === 'first') cam.fpPitch = clamp(cam.fpPitch - input.lookY * 0.005, -1.2, 1.2);
  else cam.pitch = clamp(cam.pitch + input.lookY * 0.004, 0.08, 1.25);
  input.lookX = input.lookY = 0;

  // timers
  R.iframes -= dt; R.cd -= dt; R.harvCd -= dt; R.skillCd -= dt; R.sprintT -= dt; R.doubleT -= dt; R.hurtT -= dt; R.stDelay -= dt;
  if (R.stDelay <= 0) P.stamina = Math.min(100, P.stamina + 24 * dt * (P.temp < 25 ? 0.5 : 1));

  // fijar objetivo
  if (took('lock')) {
    if (R.lock) R.lock = null;
    else {
      let best = null, bd = 20; const { fx, fz } = camVectors();
      for (const e of enemies()) { const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz); const front = (dx * fx + dz * fz) / (d || 1); const score = d - front * 6; if (d < 20 && score < bd) { bd = score; best = e; } }
      R.lock = best; if (!best) toast('No hay enemigos cerca para fijar.');
    }
  }
  if (R.lock && (R.lock.dead || Math.hypot(R.lock.x - P.x, R.lock.z - P.z) > 26)) R.lock = null;
  if (R.lock && G.camMode === 'third') {
    const want = Math.atan2(P.x - R.lock.x, P.z - R.lock.z);
    cam.yaw += angDiff(cam.yaw, want) * Math.min(1, dt * 5);
  }

  // movimiento
  const { fx, fz, rx, rz } = camVectors();
  let mx = rx * input.mx + fx * -input.mz, mz = rz * input.mx + fz * -input.mz;
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const deep = waterDepth(P.x, P.z);
  let spd = 5.4 * cl.spd * (R.sprintT > 0 ? 1.7 : 1) * (deep > 0.4 ? 0.55 : 1) * (input.atk ? 0.55 : 1) * (R.atk ? 0.35 : 1);
  if (R.roll > 0) {
    R.roll -= dt; P.x += R.rollX * 12 * dt; P.z += R.rollZ * 12 * dt;
  } else { P.x += mx * spd * dt; P.z += mz * spd * dt; }
  collide(P, 0.4);
  P.y = heightAt(P.x, P.z);
  R.speed = R.roll > 0 ? 1 : Math.min(1, ml);
  if (ml > 0.05) R.walk += dt * spd * 1.6;

  // orientación
  if (G.camMode === 'first') P.yaw = Math.atan2(fx, fz);
  else if (R.lock) P.yaw = Math.atan2(R.lock.x - P.x, R.lock.z - P.z);
  else if (ml > 0.1 && !R.atk) P.yaw += angDiff(P.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 14);

  // esquiva
  if (took('dodge') && R.roll <= 0) {
    const cost = P.cls === 'explorador' ? 10 : 16;
    if (P.stamina >= cost) {
      P.stamina -= cost; R.stDelay = 0.7; R.roll = 0.42; R.iframes = 0.34; R.atk = null; R.charge = 0;
      if (ml > 0.1) { R.rollX = mx / ml; R.rollZ = mz / ml; } else { R.rollX = -Math.sin(P.yaw); R.rollZ = -Math.cos(P.yaw); }
      P.yaw = Math.atan2(R.rollX, R.rollZ);
    } else floatText(P, 'Sin energía', 'bad');
  }

  // ataque: mantener = cargar, soltar = golpear
  if (input.atk && R.roll <= 0) R.charge += dt;
  if (took('atkUp')) { startAttack(); R.charge = 0; }
  if (R.atk) updateAttack(dt);

  // acción (recoger, beber, abrir)
  R.ctx = context();
  if ((took('act') || input.act) && R.harvCd <= 0) doAction();
  if (took('skill')) useSkill();
  if (took('weapon')) cycleWeapon();
  if (took('cam')) { G.camMode = G.camMode === 'third' ? 'first' : 'third'; toast(G.camMode === 'first' ? 'Vista en 1ª persona' : 'Vista en 3ª persona'); }
  if (took('bag')) openBag();
  if (took('eat')) eatBest();

  // modelo
  m.group.position.set(P.x, P.y, P.z); m.group.rotation.y = P.yaw;
  m.group.visible = G.camMode === 'third';
  const atkP = R.atk ? R.atk.t / R.atk.dur : (input.atk && R.charge > 0.1 ? 0.35 : -1);
  animHumanoid(m, R.walk, R.speed, atkP, R.atk ? R.atk.heavy : R.charge > 0.45, R.roll > 0 ? 1 - R.roll / 0.42 : 0);
  flash(m, R.hurtT > 0 ? R.hurtT * 3 : (R.charge > 0.45 ? 0.25 + Math.sin(performance.now() / 60) * 0.15 : 0), R.charge > 0.45 && R.hurtT <= 0 ? 0xffc040 : 0xff3b2a);
  // antorcha
  const tOn = P.items.antorcha && (isNight() || G.weather.rain > 0.5);
  torch.intensity = tOn ? 2.2 + Math.sin(performance.now() / 90) * 0.3 : 0;
  torch.position.set(P.x + Math.sin(P.yaw) * 0.4, P.y + 2, P.z + Math.cos(P.yaw) * 0.4);
  updateCamera(dt);
}

function updateCamera(dt) {
  const P = G.P, c = G.camera;
  const sh = G.shake > 0 ? G.shake : 0, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
  if (G.camMode === 'first') {
    const { fx, fz } = camVectors(), cp = Math.cos(cam.fpPitch);
    c.position.set(P.x + ox * 0.3, P.y + 1.62 + oy * 0.3, P.z);
    c.lookAt(P.x + fx * cp, P.y + 1.62 + Math.sin(cam.fpPitch), P.z + fz * cp);
  } else {
    const want = G.boss && G.boss.active && !G.boss.dead ? 11.5 : 7;
    cam.dist += (want - cam.dist) * Math.min(1, dt * 2);
    const cp = Math.cos(cam.pitch), d = cam.dist;
    let x = P.x + Math.sin(cam.yaw) * cp * d, z = P.z + Math.cos(cam.yaw) * cp * d, y = P.y + 1.4 + Math.sin(cam.pitch) * d;
    y = Math.max(y, heightAt(x, z) + 0.6, WORLD.WATER_Y + 0.4);
    c.position.set(x + ox, y + oy, z);
    c.lookAt(P.x, P.y + 1.4 + (cam.dist - 7) * 0.25, P.z);
  }
}

/* ---------------- Combate del jugador ---------------- */
function startAttack() {
  const P = G.P, w = WEAPONS[P.weapon];
  if (R.cd > 0 || R.roll > 0 || R.atk) return;
  const heavy = R.charge > 0.45 && P.stamina >= 18;
  const cost = heavy ? 18 : 6;
  if (P.stamina < cost) { floatText(P, 'Sin energía', 'bad'); return; }
  P.stamina -= cost; R.stDelay = 0.6;
  // auto-apuntado suave hacia el enemigo más cercano en frente
  const tgt = R.lock || aimTarget(w.ranged ? 26 : w.reach + 3);
  if (tgt && G.camMode === 'third') P.yaw = Math.atan2(tgt.x - P.x, tgt.z - P.z);
  if (w.ranged) {
    if (P.inv.flechas <= 0) { toast('No te quedan flechas. Fabrícalas en la Mochila.', 'bad'); return; }
    P.inv.flechas--;
    const pw = clamp(0.6 + R.charge, 0.6, 1.6);
    let dx = Math.sin(P.yaw), dz = Math.cos(P.yaw), dy = 0.03;
    if (G.camMode === 'first') { const cp = Math.cos(cam.fpPitch); dx *= cp; dz *= cp; dy = Math.sin(cam.fpPitch) + 0.04; }
    else if (tgt) { const d = Math.hypot(tgt.x - P.x, tgt.z - P.z); dy = ((tgt.y || 0) + 1 - (P.y + 1.5)) / Math.max(d, 1) + d * 0.004; }
    spawnArrow({ x: P.x + dx * 0.6, y: P.y + 1.5, z: P.z + dz * 0.6 }, { x: dx, y: dy, z: dz }, w.dmg * C().dmg * pw * consumePower(), 34 * pw);
    R.atk = { t: 0, dur: 0.3, heavy: false, hit: true }; R.cd = w.cd; return;
  }
  R.atk = { t: 0, dur: heavy ? 0.5 : 0.3, heavy, hit: false };
  R.cd = w.cd + (heavy ? 0.15 : 0);
}
function consumePower() { if (R.powerHit) { R.powerHit = false; return 3; } return 1; }
function aimTarget(range) {
  const P = G.P; let best = null, bd = range;
  for (const e of enemies()) {
    const d = Math.hypot(e.x - P.x, e.z - P.z) - e.r;
    if (d < bd && Math.abs(angDiff(P.yaw, Math.atan2(e.x - P.x, e.z - P.z))) < 1.2) { bd = d; best = e; }
  }
  return best;
}
function updateAttack(dt) {
  const P = G.P, a = R.atk, w = WEAPONS[P.weapon];
  a.t += dt;
  if (!a.hit && a.t >= a.dur * 0.42) {
    a.hit = true; let any = false;
    const arc = a.heavy ? 1.2 : 0.85, reach = w.reach * (a.heavy ? 1.15 : 1);
    const mult = C().dmg * (a.heavy ? 2.2 : 1) * consumePower();
    for (const e of enemies()) {
      const d = Math.hypot(e.x - P.x, e.z - P.z) - e.r;
      if (d > reach) continue;
      if (Math.abs(angDiff(P.yaw, Math.atan2(e.x - P.x, e.z - P.z))) > arc && d > 0.4) continue;
      damageEnemy(e, w.dmg * mult * rnd(0.9, 1.1), P, { heavy: a.heavy, bleed: w.bleed }); any = true;
    }
    if (any) { G.hitstop = a.heavy ? 0.09 : 0.045; G.shake = Math.max(G.shake, a.heavy ? 0.35 : 0.15); }
  }
  if (a.t >= a.dur) R.atk = null;
}

/* ---------------- Acciones ---------------- */
const VERB = { arbol: 'Talar', gigante: 'Talar', banano: 'Coger fruta', helecho: 'Cortar', roca: 'Picar', obsidiana: 'Picar', venenosa: 'Arrancar' };
function context() {
  const P = G.P;
  if (merchant && Math.hypot(P.x - merchant.group.position.x, P.z - merchant.group.position.z) < 4.2) return { type: 'station', label: 'Mercado' };
  if (G.camp && Math.hypot(P.x - G.camp.x, P.z - G.camp.z) < 3.2) return { type: 'camp', label: 'Campa­mento' };
  let best = null, bd = 99;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  for (const o of nearby(P.x, P.z, 4)) {
    if (!o.alive || o.empty || o.kind === 'solid') continue;
    const d = Math.hypot(o.x - P.x, o.z - P.z) - o.r;
    const facing = ((o.x - P.x) * fx + (o.z - P.z) * fz) / (Math.hypot(o.x - P.x, o.z - P.z) || 1);
    const sc = d - facing * 0.6;
    if (d < 1.5 && sc < bd) { bd = sc; best = o; }
  }
  if (best) return { type: 'obj', o: best, label: VERB[best.kind] };
  if (isWater(P.x + fx * 1.4, P.z + fz * 1.4) || waterDepth(P.x, P.z) > 0.1) return { type: 'water', label: 'Beber' };
  return { type: null, label: '—' };
}
function doAction() {
  const c = R.ctx, P = G.P; if (!c || !c.type) return;
  if (c.type === 'station') { input.act = false; G.stats.visited = true; openStation(); return; }
  if (c.type === 'camp') { input.act = false; openCamp(); return; }
  if (c.type === 'water') { input.act = false; drink(); R.harvCd = 0.6; return; }
  R.harvCd = 0.38; P.yaw = Math.atan2(c.o.x - P.x, c.o.z - P.z);
  R.atk = { t: 0, dur: 0.3, heavy: false, hit: true };
  const res = hitObject(c.o, P.tools);
  burst({ x: c.o.x, y: P.y + 1, z: c.o.z }, c.o.kind === 'roca' ? '#9a958c' : c.o.kind === 'obsidiana' ? '#5a3f80' : '#6b4a2e', 5);
  if (!res) return;
  if (res.blocked) { toast('Necesitas un pico para extraer obsidiana.', 'bad'); input.act = false; return; }
  if (res.partial) return;
  const cl = C(), dbl = R.doubleT > 0 ? 2 : 1;
  let n = 1 + cl.yield;
  if ((res.give === 'madera' && P.tools.hacha) || ((res.give === 'piedra' || res.give === 'obsidiana') && P.tools.pico)) n *= 2;
  if (res.kind === 'gigante') n += 3;
  if (res.give === 'fruta') n += 1;
  if (res.give === 'fibra') n += Math.random() < 0.5 ? 1 : 0;
  n *= dbl;
  const got = [[res.give, n]];
  if ((res.kind === 'arbol' || res.kind === 'gigante') && Math.random() < 0.4) got.push(['liana', 1 * dbl]);
  if (res.kind === 'helecho' && Math.random() < 0.35) got.push(['hierba', 1 * dbl]);
  if (res.kind === 'venenosa') got[0][1] = 2 * dbl;
  for (const [k, v] of got) { P.inv[k] += v; G.stats.gathered += v; }
  floatText({ x: c.o.x, y: P.y + 1.5, z: c.o.z }, got.map(([k, v]) => `+${v} ${k}`).join('  '), 'good');
  if (res.poison && !(P.cls === 'superviviente' && Math.random() < 0.5)) { P.status.veneno = Math.max(P.status.veneno, 12); toast('¡Te has envenenado con la planta! Usa un antídoto.', 'bad'); }
}

function useSkill() {
  const P = G.P;
  if (R.skillCd > 0) { floatText(P, `Habilidad en ${Math.ceil(R.skillCd)} s`, 'bad'); return; }
  R.skillCd = 25;
  if (P.cls === 'cazador') { R.powerHit = true; toast('Golpe certero preparado: triple daño.', 'good'); }
  if (P.cls === 'explorador') { R.sprintT = 4; toast('¡Esprint!', 'good'); }
  if (P.cls === 'ingeniero') { R.doubleT = 12; toast('Doble cosecha durante 12 s.', 'good'); }
  if (P.cls === 'superviviente') { P.hp = Math.min(P.maxHp, P.hp + 40); P.status.veneno = P.status.sangrado = 0; toast('Segundo aliento: +40 de vida.', 'good'); }
}
export function cycleWeapon() {
  const P = G.P, i = P.weapons.indexOf(P.weapon);
  P.weapon = P.weapons[(i + 1) % P.weapons.length]; setWeapon(R.model, P.weapon);
  toast(`Arma: ${WEAPONS[P.weapon].n}${P.weapon === 'arco' ? ` (${P.inv.flechas} flechas)` : ''}`);
}
export function equip(id) { G.P.weapon = id; setWeapon(R.model, id); }

export function playerHurtFx() { R.hurtT = 0.3; }

export function respawn() {
  const P = G.P, at = G.camp || { x: STATION_POS.x + 2, z: STATION_POS.z - 3 };
  const lost = Math.floor(P.jade * 0.3);
  P.x = at.x + 1.5; P.z = at.z + 1.5; P.hp = P.maxHp * 0.6; P.hunger = Math.max(P.hunger, 50); P.thirst = Math.max(P.thirst, 50);
  P.temp = 50; P.status.veneno = P.status.sangrado = 0; P.jade -= lost;
  R.lock = null; R.atk = null; R.roll = 0;
  toast(`Has caído… Despiertas en ${G.camp ? 'tu campamento' : 'la estación'}${lost ? ` y has perdido ${lost} de jade` : ''}.`, 'bad', 5);
}
