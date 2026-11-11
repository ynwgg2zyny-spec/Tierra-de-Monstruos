// Mundo de la Jungla: terreno, río, vegetación recolectable, estación y ruinas
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, hash, mulberry32, lerp, smooth, clamp } from './noise.js';
import { WORLD, STATION_POS, ARENA_POS } from './data.js';
import { mat, buildHumanoid, animHumanoid } from './models.js';
import { toonMat, addOutline, instancedOutline, OUTLINE } from './toon.js';

const STEP = 2, N = WORLD.SIZE / STEP; // 130 celdas
let seed = 1, heights = null;
export const objects = [];
const grid = new Map(), CELL = 8;
const kinds = {};
export let minimapCanvas = null, merchant = null;

export const riverX = z => 14 * Math.sin(z * 0.019 + seed % 7) + 7 * Math.sin(z * 0.051 + 1.3);
const ZONES = [
  { ...STATION_POS, r: 15, h: 1.6 },
  { ...ARENA_POS, r: 22, h: 1.0 },
];

function rawH(x, z) {
  let h = (fbm(x * 0.011, z * 0.011, seed) - 0.5) * 16 + (fbm(x * 0.045, z * 0.045, seed + 3) - 0.5) * 3.5 + 2.4;
  const rd = Math.abs(x - riverX(z));
  h = lerp(-2.3, h, smooth(2.5, 10, rd));
  for (const zn of ZONES) { const d = Math.hypot(x - zn.x, z - zn.z); h = lerp(zn.h, h, smooth(zn.r, zn.r + 12, d)); }
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 104) h += Math.pow(e - 104, 1.5) * 0.7;
  return h;
}

export function heightAt(x, z) {
  const gx = clamp((x + WORLD.HALF) / STEP, 0, N - 0.001), gz = clamp((z + WORLD.HALF) / STEP, 0, N - 0.001);
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, R = N + 1;
  const a = heights[iz * R + ix], b = heights[iz * R + ix + 1], c = heights[(iz + 1) * R + ix], d = heights[(iz + 1) * R + ix + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
export const isWater = (x, z) => heightAt(x, z) < WORLD.WATER_Y - 0.05;
export const waterDepth = (x, z) => Math.max(0, WORLD.WATER_Y - heightAt(x, z));

/* ---------------- Rejilla espacial ---------------- */
const key = (cx, cz) => cx * 1000 + cz;
function addToGrid(o) { const k = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); }
export function nearby(x, z, rad) {
  const out = [], c0 = Math.floor((x - rad) / CELL), c1 = Math.floor((x + rad) / CELL), r0 = Math.floor((z - rad) / CELL), r1 = Math.floor((z + rad) / CELL);
  for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) { const l = grid.get(key(cx, cz)); if (l) for (const o of l) out.push(o); }
  return out;
}
// Empuja un círculo fuera de obstáculos sólidos
export function collide(pos, r) {
  for (const o of nearby(pos.x, pos.z, r + 2)) {
    if (!o.alive || !o.r) continue;
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
    if (d < m && d > 1e-4) { pos.x = o.x + dx / d * m; pos.z = o.z + dz / d * m; }
  }
  const L = WORLD.LIMIT; pos.x = clamp(pos.x, -L, L); pos.z = clamp(pos.z, -L, L);
}

/* ---------------- Tipos de vegetación ---------------- */
function g(geo, f) { f(geo); return geo; }
function defineKinds() {
  const leaf = mat('#ffffff'), bark = mat('#6b4a2e'), bark2 = mat('#8a7a64');
  const merge = list => mergeGeometries(list.map(x => x.index ? x.toNonIndexed() : x));
  kinds.arbol = { n: 620, r: 0.55, hp: 4, give: 'madera', parts: [
    [g(new THREE.CylinderGeometry(0.32, 0.55, 6, 6), x => x.translate(0, 3, 0)), bark],
    [g(new THREE.IcosahedronGeometry(2.6, 0), x => { x.scale(1, 0.55, 1); x.translate(0, 6.4, 0); }), leaf, 'leaf'],
    [g(new THREE.IcosahedronGeometry(1.8, 0), x => { x.scale(1, 0.6, 1); x.translate(1, 7.5, 0.4); }), leaf, 'leaf2']] };
  kinds.gigante = { n: 110, r: 1.0, hp: 7, give: 'madera', parts: [
    [g(new THREE.CylinderGeometry(0.55, 1.1, 11, 7), x => x.translate(0, 5.5, 0)), bark2],
    [merge([g(new THREE.CylinderGeometry(0.15, 0.15, 3, 4), x => { x.rotateZ(1.1); x.translate(1.2, 8, 0); }), g(new THREE.CylinderGeometry(0.15, 0.15, 3, 4), x => { x.rotateZ(-1.1); x.translate(-1.2, 9, 0); })]), bark2],
    [g(new THREE.IcosahedronGeometry(4.2, 0), x => { x.scale(1, 0.32, 1); x.translate(0, 11.3, 0); }), leaf, 'leaf']] };
  kinds.banano = { n: 260, r: 0, hp: 1, give: 'fruta', regrow: 70, keep: true, parts: [
    [g(new THREE.CylinderGeometry(0.12, 0.2, 1.7, 5), x => x.translate(0, 0.85, 0)), mat('#5f8a3a')],
    [merge([0, 1, 2, 3, 4].map(i => g(new THREE.BoxGeometry(0.35, 0.05, 1.6), x => { x.translate(0, 0, 0.8); x.rotateX(-0.45); x.rotateY(i * 1.26); x.translate(0, 1.7, 0); }))), mat('#4fa83f')],
    [g(new THREE.IcosahedronGeometry(0.28, 0), x => { x.scale(1, 1.4, 1); x.translate(0.18, 1.3, 0.1); }), mat('#f1cf3a'), 'fruit']] };
  kinds.helecho = { n: 900, r: 0, hp: 1, give: 'fibra', regrow: 80, parts: [
    [merge([0, 1, 2, 3, 4, 5].map(i => g(new THREE.ConeGeometry(0.18, 1.3, 3), x => { x.rotateX(1.0); x.translate(0, 0.35, 0.45); x.rotateY(i * 1.05); }))), leaf, 'fern']] };
  kinds.roca = { n: 260, r: 0.9, hp: 3, give: 'piedra', parts: [
    [g(new THREE.DodecahedronGeometry(1, 0), x => { x.scale(1, 0.7, 1); x.translate(0, 0.3, 0); }), mat('#ffffff'), 'rock']] };
  kinds.obsidiana = { n: 55, r: 0.7, hp: 4, give: 'obsidiana', needs: 'pico', parts: [
    [merge([g(new THREE.OctahedronGeometry(0.6, 0), x => { x.scale(1, 1.8, 1); x.translate(0, 0.8, 0); }), g(new THREE.OctahedronGeometry(0.45, 0), x => { x.scale(1, 1.6, 1); x.rotateZ(0.4); x.translate(0.5, 0.6, 0.2); })]),
      mat('#2c2338', { emissive: 0x3a1f5c, emissiveIntensity: 0.35 })]] };
  kinds.venenosa = { n: 130, r: 0, hp: 1, give: 'hierba', poison: true, regrow: 90, parts: [
    [merge([0, 1, 2, 3, 4, 5, 6].map(i => g(new THREE.ConeGeometry(0.09, 0.9, 4), x => { x.rotateX(0.35); x.translate(0, 0.45, 0.12); x.rotateY(i * 0.9); }))), mat('#9b3fd1', { emissive: 0x5a1a80, emissiveIntensity: 0.3 })],
    [g(new THREE.IcosahedronGeometry(0.16, 0), x => x.translate(0, 0.95, 0)), mat('#ff5fd0', { emissive: 0xff2fb0, emissiveIntensity: 0.6 })]] };
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function setObjVisible(o, vis) {
  const k = kinds[o.kind];
  tmpM.compose(tmpP.set(o.x, o.y, o.z), tmpQ.setFromAxisAngle(Y, o.rot), tmpS.setScalar(o.s));
  k.meshes.forEach((m, pi) => {
    const tag = k.parts[pi][2];
    const show = vis === true || (vis === 'empty' && tag !== 'fruit');
    m.setMatrixAt(o.idx, show ? tmpM : ZERO); m.instanceMatrix.needsUpdate = true;
  });
}

function placeVegetation(scene) {
  const r = mulberry32(seed * 7 + 3);
  const col = new THREE.Color();
  for (const [name, k] of Object.entries(kinds)) {
    k.meshes = k.parts.map(([geo, m]) => {
      const im = new THREE.InstancedMesh(geo, m, k.n); im.castShadow = name !== 'helecho'; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
      if (name !== 'helecho' && name !== 'venenosa') { im.userData.outline = instancedOutline(im, name === 'gigante' ? OUTLINE.fine * 1.4 : OUTLINE.fine); scene.add(im.userData.outline); }
      return im;
    });
    let placed = 0, tries = 0;
    while (placed < k.n && tries < k.n * 20) {
      tries++;
      const x = (r() - 0.5) * 222, z = (r() - 0.5) * 222, h = heightAt(x, z);
      if (h < WORLD.WATER_Y + 0.25) continue;
      if (ZONES.some(zn => Math.hypot(x - zn.x, z - zn.z) < zn.r + (name === 'helecho' ? 0 : 3))) continue;
      const dens = fbm(x * 0.03, z * 0.03, seed + 50);
      if ((name === 'arbol' || name === 'gigante') && dens < 0.38) continue;
      if (name === 'obsidiana' && hash(Math.floor(x / 30), Math.floor(z / 30), seed) < 0.55) continue;
      const s = name === 'roca' ? 0.6 + r() * 0.9 : name === 'helecho' ? 0.7 + r() * 0.7 : 0.8 + r() * 0.45;
      const o = { kind: name, x, z, y: h - 0.05, s, rot: r() * 6.28, r: k.r * s, hp: k.hp, maxHp: k.hp, alive: true, idx: placed, regrow: 0, empty: false };
      objects.push(o); addToGrid(o); setObjVisible(o, true);
      k.parts.forEach(([, , tag], pi) => {
        if (tag === 'leaf') col.setHSL(0.26 + r() * 0.08, 0.62 + r() * 0.2, 0.3 + r() * 0.1);
        else if (tag === 'leaf2') col.setHSL(0.22 + r() * 0.08, 0.7, 0.38 + r() * 0.08);
        else if (tag === 'fern') col.setHSL(0.29 + r() * 0.06, 0.68, 0.34 + r() * 0.1);
        else if (tag === 'rock') col.setHSL(0.1, 0.05 + r() * 0.08, 0.42 + r() * 0.12);
        else return;
        k.meshes[pi].setColorAt(placed, col);
      });
      placed++;
    }
    k.count = placed; k.meshes.forEach(m => { m.count = placed; if (m.userData.outline) m.userData.outline.count = placed; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
}

/* ---------------- Terreno y agua ---------------- */
let waterTex = null;
// Agua de dibujo animado: azul turquesa con ondas blancas
function cartoonWaterTexture() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), r = mulberry32(99);
  g.fillStyle = '#1fa3b8'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#2bb7c9';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(r() * S, r() * S, 30 + r() * 30, 12 + r() * 10, 0, 0, 6.28); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const x = r() * S, y = r() * S, w = 14 + r() * 16;
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
      g.beginPath(); g.arc(x + ox, y + oy, w / 2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(x + ox + w * 0.9, y + oy + 1, w / 3, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}
function buildTerrain(scene) {
  const R = N + 1; heights = new Float32Array(R * R);
  for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) heights[j * R + i] = rawH(-WORLD.HALF + i * STEP, -WORLD.HALF + j * STEP);
  const geo = new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) pos.setY(v, heightAt(pos.getX(v), pos.getZ(v)));
  geo.computeVertexNormals(); // normales suaves: bandas de luz limpias
  const ng = geo.toNonIndexed(), p = ng.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let t = 0; t < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, slope = Math.abs(p.getY(t) - p.getY(t + 1)) + Math.abs(p.getY(t) - p.getY(t + 2));
    const n = fbm(cx * 0.08, cz * 0.08, seed + 9);
    if (cy < WORLD.WATER_Y + 0.4) c.set('#e8d39a');
    else if (Math.hypot(cx - ARENA_POS.x, cz - ARENA_POS.z) < 19 + n * 4) c.setHSL(0.1, 0.12, 0.38 + n * 0.1);
    else if (Math.hypot(cx - STATION_POS.x, cz - STATION_POS.z) < 11 + n * 4) c.set('#c79a5e');
    else if (slope > 2.2 || cy > 9) c.setHSL(0.08, 0.06, 0.36 + n * 0.1);
    else c.setHSL(0.24 + n * 0.07, 0.62, 0.3 + n * 0.1);
    for (let k = 0; k < 3; k++) { cols[(t + k) * 3] = c.r; cols[(t + k) * 3 + 1] = c.g; cols[(t + k) * 3 + 2] = c.b; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(ng, toonMat(undefined, { vertexColors: true, flatShading: false }));
  terrain.receiveShadow = true; scene.add(terrain);
  waterTex = cartoonWaterTexture();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.SIZE, WORLD.SIZE, 1, 1).rotateX(-Math.PI / 2),
    toonMat(undefined, { color: '#ffffff', map: waterTex, transparent: true, opacity: 0.9, flatShading: false }));
  water.position.y = WORLD.WATER_Y; scene.add(water);
  // minimapa
  minimapCanvas = document.createElement('canvas'); minimapCanvas.width = minimapCanvas.height = R;
  const mg = minimapCanvas.getContext('2d'), im = mg.createImageData(R, R);
  for (let k = 0; k < R * R; k++) {
    const h = heights[k]; let rgb = h < WORLD.WATER_Y ? [47, 125, 134] : h > 9 ? [110, 104, 96] : [52 + h * 3, 104 + h * 3, 48];
    im.data[k * 4] = rgb[0]; im.data[k * 4 + 1] = rgb[1]; im.data[k * 4 + 2] = rgb[2]; im.data[k * 4 + 3] = 255;
  }
  mg.putImageData(im, 0, 0);
}

/* ---------------- Estación y ruinas ---------------- */
function solid(x, z, r) { const o = { kind: 'solid', x, z, r, alive: true }; addToGrid(o); }
function buildStation(scene) {
  const g = new THREE.Group(), { x, z } = STATION_POS, y = heightAt(x, z); g.position.set(x, y, z);
  const wood = mat('#8a5a33'), dark = mat('#5a3a22'), roof = mat('#c9673a'), metal = mat('#7d868c'), jade = mat('#4fbf7a', { emissive: 0x1f6a3a, emissiveIntensity: 0.4 });
  const add = (geo, m, px, py, pz, ry = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.rotation.y = ry; me.castShadow = me.receiveShadow = true; g.add(me); return me; };
  add(new THREE.BoxGeometry(14, 0.5, 6), wood, 0, 0.25, 0);
  for (const [px, pz] of [[-6, -2.5], [6, -2.5], [-6, 2.5], [6, 2.5]]) add(new THREE.BoxGeometry(0.4, 4, 0.4), dark, px, 2.2, pz);
  add(new THREE.ConeGeometry(9, 2.4, 4), roof, 0, 5.2, 0, Math.PI / 4).scale.set(1, 1, 0.5);
  add(new THREE.BoxGeometry(3.4, 1.1, 1), dark, 2, 1.05, 1.6);              // mostrador
  add(new THREE.BoxGeometry(2.4, 1.2, 0.15), jade, -3, 3.4, 2.6);           // cartel
  // vías hacia el borde (las futuras conexiones)
  for (let i = 0; i < 40; i++) add(new THREE.BoxGeometry(0.4, 0.15, 2.6), dark, 8 - i * 1.1, 0.08, -4.5);
  for (const o of [-0.6, 0.6]) add(new THREE.BoxGeometry(44, 0.15, 0.12), metal, -13.5, 0.2, -4.5 + o);
  addOutline(g, OUTLINE.fine); scene.add(g);
  solid(x + 2, z + 1.6, 1.2); solid(x + 0.5, z + 1.6, 1.2); solid(x + 3.5, z + 1.6, 1.2);
  merchant = buildHumanoid({ skin: '#c68a5e', outfit: '#3f8a5a', hat: '#e2a440', hair: '#5a5550', headwear: 'hat' });
  merchant.group.position.set(x + 2, y + 0.5, z + 0.6);
  scene.add(merchant.group);
}
function buildRuins(scene) {
  const stone = mat('#8e8676'), moss = mat('#5d7d3a'), { x, z } = ARENA_POS, r = mulberry32(seed + 77);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.1, px = x + Math.cos(a) * 20, pz = z + Math.sin(a) * 20, hgt = 2 + r() * 5;
    const me = new THREE.Mesh(new THREE.BoxGeometry(1.6, hgt, 1.6), stone); me.position.set(px, heightAt(px, pz) + hgt / 2 - 0.2, pz); me.rotation.y = a; me.rotation.z = (r() - 0.5) * 0.2;
    me.castShadow = me.receiveShadow = true; addOutline(me, OUTLINE.fine); scene.add(me);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), moss); cap.position.set(px, me.position.y + hgt / 2, pz); addOutline(cap, OUTLINE.fine); scene.add(cap);
    solid(px, pz, 1.1);
  }
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(3, 0), stone); head.position.set(x, heightAt(x, z - 26) + 2, z - 27); head.castShadow = true; addOutline(head, OUTLINE.fine); scene.add(head);
}

export function buildWorld(scene, sd) {
  seed = sd; objects.length = 0; grid.clear();
  buildTerrain(scene); defineKinds(); placeVegetation(scene); buildStation(scene); buildRuins(scene);
}

// Recolectar: devuelve {give, n, poison} o null
export function hitObject(o, tools) {
  const k = kinds[o.kind];
  if (!o.alive || o.empty) return null;
  if (k.needs && !tools[k.needs]) return { blocked: k.needs };
  o.hp--;
  if (o.hp > 0) return { partial: true };
  if (k.keep) { o.empty = true; setObjVisible(o, 'empty'); }
  else { o.alive = false; setObjVisible(o, false); }
  o.regrow = k.regrow || (o.kind === 'roca' || o.kind === 'obsidiana' ? 240 : 180);
  return { give: k.give, poison: !!k.poison, kind: o.kind };
}
export function destroyObject(o, regrow = 200) { if (o.alive && o.kind !== 'solid') { o.alive = false; o.regrow = regrow; setObjVisible(o, false); } }
export function updateWorld(dt) {
  if (merchant) animHumanoid(merchant, 0, 0, -1, false, 0);
  if (waterTex) { const k = performance.now() / 1000; waterTex.offset.set(k * 0.012, Math.sin(k * 0.3) * 0.02); }
  for (const o of objects) {
    if (o.regrow > 0 && (!o.alive || o.empty)) {
      o.regrow -= dt;
      if (o.regrow <= 0) { o.alive = true; o.empty = false; o.hp = o.maxHp; setObjVisible(o, true); }
    }
  }
}
export function objKindName(o) { return { arbol: 'Árbol', gigante: 'Ceiba gigante', banano: 'Banano', helecho: 'Helecho', roca: 'Roca', obsidiana: 'Obsidiana', venenosa: 'Planta venenosa' }[o.kind]; }
