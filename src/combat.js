// Combate: daño, proyectiles, avisos en el suelo (telegrafiado), ondas, partículas y números flotantes
import * as THREE from 'three';
import { toonMat, addOutline, OUTLINE } from './toon.js';
import { G } from './state.js';
import { heightAt } from './world.js';
import { R, playerHurtFx, respawn } from './player.js';
import { rnd } from './noise.js';

const projs = [], teles = [], waves = [], parts = [], floats = [];
let partGeo = null; const partMats = new Map();

export function enemies() {
  const out = G.creatures.filter(c => !c.dead);
  if (G.boss && G.boss.active && !G.boss.dead) out.push(G.boss);
  return out;
}

export function damageEnemy(e, dmg, from, opts = {}) {
  if (e.dead) return;
  dmg = Math.round(dmg);
  e.hurt(dmg, from, opts);
  floatText({ x: e.x, y: (e.y || 0) + (e.h || 1.4), z: e.z }, String(dmg), opts.heavy ? 'crit' : 'dmg');
  burst({ x: e.x, y: (e.y || 0) + 1, z: e.z }, '#b0232a', opts.heavy ? 10 : 5);
}

export function hurtPlayer(dmg, from, opts = {}) {
  const P = G.P;
  if (R.iframes > 0) { if (R.roll > 0 && !opts.silent) floatText({ x: P.x, y: P.y + 2, z: P.z }, '¡Esquivado!', 'good'); return false; }
  dmg *= P.cls === 'superviviente' ? 0.85 : 1;
  P.hp -= dmg; R.iframes = 0.45; playerHurtFx();
  G.shake = Math.max(G.shake, Math.min(0.6, dmg / 30));
  floatText({ x: P.x, y: P.y + 2, z: P.z }, '-' + Math.round(dmg), 'bad');
  if (from && opts.kb !== 0) {
    const dx = P.x - from.x, dz = P.z - from.z, d = Math.hypot(dx, dz) || 1, kb = opts.kb ?? 1.2;
    P.x += dx / d * kb; P.z += dz / d * kb;
  }
  if (opts.bleed) { P.status.sangrado = Math.max(P.status.sangrado, 7); floatText({ x: P.x, y: P.y + 2.4, z: P.z }, 'Sangrado', 'bad'); }
  if (opts.poison) P.status.veneno = Math.max(P.status.veneno, opts.poison);
  if (P.hp <= 0) playerDied();
  return true;
}
export function playerDied() {
  for (const c of G.creatures) if (Math.hypot(c.x - G.P.x, c.z - G.P.z) < 30) c.remove = true;
  if (G.boss) G.boss.reset();
  clearCombat(); respawn();
}

/* ---------------- Proyectiles ---------------- */
const arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8), arrowMat = toonMat('#e9e2d0');
const rockGeo = new THREE.DodecahedronGeometry(0.8, 0), rockMat = toonMat('#8e8676');
export function spawnArrow(pos, dir, dmg, speed) {
  const m = new THREE.Mesh(arrowGeo, arrowMat); G.scene.add(m);
  const l = Math.hypot(dir.x, dir.y, dir.z);
  projs.push({ kind: 'arrow', m, x: pos.x, y: pos.y, z: pos.z, vx: dir.x / l * speed, vy: dir.y / l * speed, vz: dir.z / l * speed, dmg, life: 2.5 });
}
// Roca en parábola hacia un punto (lanzada por el jefe), con marca en el suelo
export function spawnRock(from, tx, tz, dmg, T = 1.15) {
  const m = new THREE.Mesh(rockGeo, rockMat); m.castShadow = true; addOutline(m, OUTLINE.thick); G.scene.add(m);
  const ty = heightAt(tx, tz);
  const vy = (ty - from.y + 0.5 * 14 * T * T) / T;
  const tele = telegraph({ x: tx, z: tz, r: 2.4, dur: T });
  projs.push({ kind: 'rock', m, x: from.x, y: from.y, z: from.z, vx: (tx - from.x) / T, vy, vz: (tz - from.z) / T, dmg, life: T, tele, tx, tz });
}

/* ---------------- Telegrafiado ---------------- */
const teleMat = () => new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.25, depthWrite: false });
// circle: {x,z,r,dur}  line: {x,z,len,w,ang,dur}
export function telegraph(o) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(o.len ? new THREE.PlaneGeometry(o.w, o.len) : new THREE.CircleGeometry(o.r, 28), teleMat());
  const inner = new THREE.Mesh(outer.geometry, teleMat()); inner.material.opacity = 0.45;
  outer.rotation.x = inner.rotation.x = -Math.PI / 2;
  if (o.len) { outer.position.z = inner.position.z = o.len / 2; g.rotation.y = o.ang; }
  g.add(outer, inner); g.position.set(o.x, heightAt(o.x, o.z) + 0.12, o.z); G.scene.add(g);
  const t = { ...o, g, inner, t: 0 }; teles.push(t); return t;
}
export function removeTele(t) { if (!t) return; t.dead = true; G.scene.remove(t.g); }

// Onda expansiva: hay que esquivarla rodando a través
const waveGeo = new THREE.RingGeometry(0.86, 1, 40);
export function shockwave(x, z, dmg, speed = 9, maxR = 16) {
  const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, heightAt(x, z) + 0.2, z); G.scene.add(m);
  waves.push({ m, x, z, r: 0.5, dmg, speed, maxR, hit: false });
}

/* ---------------- Partículas ---------------- */
export function burst(p, color, n = 6) {
  if (!partGeo) partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  let m = partMats.get(color); if (!m) { m = new THREE.MeshBasicMaterial({ color }); partMats.set(color, m); }
  for (let i = 0; i < n && parts.length < 160; i++) {
    const me = new THREE.Mesh(partGeo, m); me.position.set(p.x, p.y, p.z); G.scene.add(me);
    parts.push({ me, vx: rnd(-3, 3), vy: rnd(1.5, 5), vz: rnd(-3, 3), t: rnd(0.4, 0.8) });
  }
}

/* ---------------- Números flotantes ---------------- */
export function floatText(p, text, cls = '') {
  const el = document.createElement('div'); el.className = 'ft ' + cls; el.textContent = text;
  document.getElementById('floats').appendChild(el);
  floats.push({ el, x: p.x, y: (p.y || 0) + 0.2, z: p.z, t: 0 });
  if (floats.length > 24) { const f = floats.shift(); f.el.remove(); }
}

const v3 = new THREE.Vector3();
export function updateCombat(dt) {
  const P = G.P;
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.life -= dt;
    p.vy -= (p.kind === 'arrow' ? 4 : 14) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.m.position.set(p.x, p.y, p.z);
    let done = p.life <= 0;
    if (p.kind === 'arrow') {
      p.m.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      for (const e of enemies()) {
        const ey = (e.y || 0);
        if (Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.35 && p.y > ey - 0.2 && p.y < ey + (e.h || 1.4) + 0.5) {
          damageEnemy(e, p.dmg, { x: p.x - p.vx, z: p.z - p.vz }, {}); done = true; break;
        }
      }
      if (p.y < heightAt(p.x, p.z)) done = true;
    } else {
      p.m.rotation.x += dt * 5; p.m.rotation.z += dt * 3;
      if (done) {
        removeTele(p.tele); burst({ x: p.tx, y: heightAt(p.tx, p.tz) + 0.5, z: p.tz }, '#8e8676', 12); G.shake = Math.max(G.shake, 0.25);
        if (Math.hypot(P.x - p.tx, P.z - p.tz) < 2.4) hurtPlayer(p.dmg, { x: p.tx, z: p.tz }, { kb: 2 });
      }
    }
    if (done) { G.scene.remove(p.m); projs.splice(i, 1); }
  }
  for (let i = teles.length - 1; i >= 0; i--) {
    const t = teles[i]; if (t.dead) { teles.splice(i, 1); continue; }
    t.t += dt; const k = Math.min(1, t.t / t.dur);
    if (t.len) t.inner.scale.set(1, k, 1), t.inner.position.z = t.len * k / 2; else t.inner.scale.setScalar(Math.max(0.01, k));
    if (t.follow) { t.g.position.set(t.follow.x, heightAt(t.follow.x, t.follow.z) + 0.12, t.follow.z); }
    if (t.t >= t.dur) { removeTele(t); teles.splice(i, 1); t.onDone && t.onDone(); }
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i]; w.r += w.speed * dt; w.m.scale.setScalar(w.r); w.m.material.opacity = 0.85 * (1 - w.r / w.maxR);
    const d = Math.hypot(P.x - w.x, P.z - w.z);
    if (!w.hit && Math.abs(d - w.r) < 0.7) { if (hurtPlayer(w.dmg, w, { kb: 2.5, silent: false })) w.hit = true; }
    if (w.r >= w.maxR) { G.scene.remove(w.m); waves.splice(i, 1); }
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t -= dt; p.vy -= 14 * dt;
    p.me.position.x += p.vx * dt; p.me.position.y += p.vy * dt; p.me.position.z += p.vz * dt; p.me.rotation.x += dt * 8;
    if (p.t <= 0) { G.scene.remove(p.me); parts.splice(i, 1); }
  }
  const W = innerWidth, H = innerHeight;
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt;
    v3.set(f.x, f.y + 1 + f.t * 1.2, f.z).project(G.camera);
    if (f.t > 1.1 || v3.z > 1) { f.el.remove(); floats.splice(i, 1); continue; }
    f.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * W}px, ${(-v3.y * 0.5 + 0.5) * H}px) translate(-50%,-50%)`;
    f.el.style.opacity = f.t > 0.7 ? (1.1 - f.t) / 0.4 : 1;
  }
}
export function clearCombat() {
  for (const p of projs) { G.scene.remove(p.m); removeTele(p.tele); } projs.length = 0;
  for (const t of teles) G.scene.remove(t.g); teles.length = 0;
  for (const w of waves) G.scene.remove(w.m); waves.length = 0;
}
