// Modelos low-poly construidos por código
import * as THREE from 'three';
import { toonMat, addOutline, OUTLINE } from './toon.js';

export function mat(color, extra = {}) { return toonMat(color, extra); }
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); me.castShadow = true; return me;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

// Fija color de destello (golpe) en todos los materiales de un modelo
export function flash(model, amount, color = 0xff3b2a) {
  for (const m of model.mats) { m.emissive.setHex(color); m.emissiveIntensity = amount; }
}

/* ---------------- Humano (protagonista estilizado) ---------------- */
const UP = new THREE.Vector3(0, 1, 0);
function cyl(rt, rb, h, m, seg = 7) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.castShadow = true; return me; }
function at(parent, me, x = 0, y = 0, z = 0) { me.position.set(x, y, z); parent.add(me); return me; }
function detail(me) { me.userData.noOutline = true; me.castShadow = false; return me; }
// Tronco de 6 caras con frente plano y algo aplanado
function torsoGeo(rt, rb, h, flat = 0.62) { const g = new THREE.CylinderGeometry(rt, rb, h, 6); g.rotateY(Math.PI / 6); g.scale(1, 1, flat); return g; }

export function buildHumanoid({ skin, outfit, hat, pants = '#3a3027', hair = '#1a1512', headwear = 'band' }) {
  const g = new THREE.Group();
  const accent = hat || '#c4473a';
  const mSkin = mat(skin), mOut = mat(outfit), mPants = mat(pants), mAcc = mat(accent), mBoot = mat('#2a211b'), mHair = mat(hair);
  const mats = [mSkin, mOut, mPants, mAcc, mBoot, mHair];
  const ink = mat('#17110d'), white = mat('#f7f3ea'), under = mat('#2a2a30');

  // cadera (pivote principal del cuerpo)
  const HIP = 0.95, body = pivot(g, 0, HIP, 0);
  at(body, new THREE.Mesh(torsoGeo(0.21, 0.19, 0.2, 0.72), mPants), 0, 0, 0).castShadow = true;
  // columna y torso en V
  const spine = pivot(body, 0, 0.06, 0);
  at(spine, new THREE.Mesh(torsoGeo(0.3, 0.2, 0.48), mOut), 0, 0.34, 0).castShadow = true;
  at(spine, new THREE.Mesh(torsoGeo(0.2, 0.2, 0.14), mOut), 0, 0.06, 0);
  const vneck = detail(at(spine, new THREE.Mesh(new THREE.CircleGeometry(0.1, 3), under), 0, 0.51, 0.158)); vneck.rotation.z = -Math.PI / 2; vneck.scale.set(1.1, 0.8, 1);
  // fajín con colas
  at(spine, new THREE.Mesh(torsoGeo(0.215, 0.215, 0.08, 0.66), mAcc), 0, 0.0, 0);
  const sash = pivot(spine, 0.12, -0.02, 0.1);
  at(sash, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.02), mAcc), 0, -0.1, 0);
  at(sash, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.02), mAcc), 0.05, -0.08, 0.01).rotation.z = 0.25;
  // cuello y cabeza
  at(spine, cyl(0.06, 0.07, 0.14, mSkin), 0, 0.62, 0);
  const head = pivot(spine, 0, 0.66, 0); head.scale.setScalar(1.1);
  const sk = new THREE.SphereGeometry(0.2, 12, 9), sp = sk.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const y = sp.getY(i), k = y < 0 ? 1 + y * 1.6 : 1;
    sp.setX(i, sp.getX(i) * k * 0.92); sp.setZ(i, sp.getZ(i) * (y < 0 ? 1 + y * 0.7 : 1)); sp.setY(i, y * 1.12);
  }
  sk.computeVertexNormals();
  at(head, new THREE.Mesh(sk, mSkin), 0, 0.2, 0).castShadow = true;
  // cara
  for (const s of [-1, 1]) {
    detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.03), white), s * 0.077, 0.195, 0.176));
    detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.066, 0.02), ink), s * 0.068, 0.192, 0.188));
    detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.01), white), s * 0.058, 0.21, 0.2));
    const brow = detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.03), mHair), s * 0.078, 0.258, 0.172)); brow.rotation.z = s * -0.22;
    at(head, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.055), mSkin), s * 0.178, 0.19, -0.01).castShadow = true; // orejas
  }
  const nose = detail(at(head, new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 4), mSkin), 0, 0.155, 0.2)); nose.rotation.x = -0.35;
  const mouth = detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.013, 0.02), ink), 0.008, 0.085, 0.178)); mouth.rotation.z = 0.12;
  const scar = mat('#a24a3c');
  detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.011, 0.01), scar), -0.1, 0.14, 0.168)).rotation.set(0, -0.5, 0.7);
  detail(at(head, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.011, 0.01), scar), -0.1, 0.14, 0.169)).rotation.set(0, -0.5, -0.7);
  // pelo: rapado por los lados y detrás, algo de pelo arriba
  const skullCap = (theta, tilt, grow) => {
    const geo = new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, theta); geo.rotateX(tilt);
    const q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) { // misma forma que el cráneo
      const y = q.getY(i), k = y < 0 ? 1 + y * 1.6 : 1;
      q.setX(i, q.getX(i) * k * 0.92 * grow); q.setZ(i, q.getZ(i) * (y < 0 ? 1 + y * 0.7 : 1) * grow); q.setY(i, y * 1.12 * grow);
    }
    geo.computeVertexNormals(); return geo;
  };
  at(head, new THREE.Mesh(skullCap(1.9, -0.55, 1.06), mHair), 0, 0.2, 0).castShadow = true;
  const hairBack = pivot(head, 0, 0.26, -0.14);
  // pelo de anime: grandes puntas hacia arriba y a los lados, mechones sobre la frente
  const spike = (par, theta, phi, len, rad, bend) => {
    const d = new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    const axis = d.clone().add(bend).normalize();
    const me = new THREE.Mesh(new THREE.ConeGeometry(rad * 1.35, len * (len > 0.15 ? 0.35 : 1), 5), mHair); me.castShadow = true;
    me.quaternion.setFromUnitVectors(UP, axis);
    me.position.set(d.x * 0.17, d.y * 0.2 + 0.2, d.z * 0.18).addScaledVector(axis, len * (len > 0.15 ? 0.35 : 1) * 0.38);
    if (par !== head) me.position.sub(par.position);
    par.add(me); return me;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  spike(head, -0.2, 0.5, 0.13, 0.06, V(-0.2, -1.5, 0.7));      // un mechón en la frente
  for (const th of [0.9, -0.9]) spike(head, th, 0.55, 0.36, 0.1, V(Math.sign(th) * 0.4, 0.9, -0.1));   // delante arriba
  for (const th of [0.35, -0.35, Math.PI]) spike(head, th, 0.15, 0.42, 0.11, V(0, 0.6, -0.5));         // coronilla
  for (const th of [1.7, -1.7]) spike(head, th, 0.45, 0.4, 0.1, V(Math.sign(th) * 0.5, 0.6, -0.3));    // arriba a los lados
  for (const th of [1.45, -1.45]) spike(head, th, 1.0, 0.34, 0.095, V(Math.sign(th) * 0.4, 0.15, -0.25)); // lados
  for (const th of [2.4, -2.4]) spike(head, th, 0.7, 0.38, 0.1, V(Math.sign(th) * 0.3, 0.4, -0.6));    // detrás arriba
  for (const o of [-0.5, 0, 0.5]) spike(hairBack, Math.PI + o, 1.1, 0.3, 0.095, V(o * 0.6, -0.3, -0.7)); // nuca
  // sombrero (solo el mercader)
  let tails = null;
  if (headwear === 'hat') {
    at(head, new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.05, 10), mAcc), 0, 0.4, 0);
    at(head, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10), mAcc), 0, 0.49, 0);
  }
  // brazos con codo
  const arm = (side) => {
    const sh = pivot(spine, side * 0.33, 0.5, 0);
    at(sh, new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), mOut));
    at(sh, cyl(0.088, 0.075, 0.16, mOut), 0, -0.07, 0);
    at(sh, cyl(0.066, 0.058, 0.2, mSkin), 0, -0.2, 0);
    const el = pivot(sh, 0, -0.3, 0);
    at(el, cyl(0.058, 0.05, 0.24, mSkin), 0, -0.11, 0);
    at(el, cyl(0.064, 0.064, 0.06, mAcc), 0, -0.2, 0);
    const hand = pivot(el, 0, -0.27, 0.01);
    at(hand, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.1), mSkin), 0, -0.02, 0);
    return { sh, el, hand };
  };
  const L = arm(-1), R = arm(1);
  // piernas con rodilla
  const leg = (side) => {
    const hp = pivot(body, side * 0.11, -0.05, 0);
    at(hp, cyl(0.105, 0.085, 0.42, mPants), 0, -0.2, 0);
    const kn = pivot(hp, 0, -0.42, 0);
    at(kn, cyl(0.088, 0.068, 0.36, mPants), 0, -0.17, 0);
    const an = pivot(kn, 0, -0.38, 0);
    at(an, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.25), mBoot), 0, -0.035, 0.045);
    return { hp, kn, an };
  };
  const LL = leg(-1), LR = leg(1);
  g.traverse(o => { if (o.isMesh && !o.userData.noOutline) o.castShadow = true; });
  const outline = addOutline(g, OUTLINE.hero, true);
  return {
    group: g, body, torso: spine, spine, head, hairBack, tails, sash, HIP,
    armL: L.sh, armR: R.sh, elbowL: L.el, elbowR: R.el, handR: R.hand, handL: L.hand,
    legL: LL.hp, legR: LR.hp, kneeL: LL.kn, kneeR: LR.kn, ankleL: LL.an, ankleR: LR.an,
    mats, weapon: null, outline, sw: { hair: 0, hairV: 0, tail: 0, tailV: 0 },
  };
}

export function buildWeapon(id) {
  const g = new THREE.Group();
  const wood = mat('#8a5a2b'), dark = mat('#2a2233', { emissive: 0x2a1a44, emissiveIntensity: 0.3 }), stone = mat('#8d8d86');
  if (id === 'garrote') { g.add(box(0.08, 0.9, 0.08, wood, 0, 0.35, 0)); g.add(box(0.18, 0.3, 0.18, mat('#6a4524'), 0, 0.8, 0)); }
  else if (id === 'lanza') { g.add(box(0.06, 1.8, 0.06, wood, 0, 0.6, 0)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), stone); tip.position.y = 1.62; g.add(tip); }
  else if (id === 'machete') { g.add(box(0.06, 0.22, 0.08, wood, 0, 0.05, 0)); g.add(box(0.03, 0.75, 0.14, dark, 0, 0.55, 0.02)); }
  else if (id === 'arco') {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 4, 10, Math.PI * 0.9), wood);
    c.rotation.z = Math.PI / 2 + Math.PI * 0.05; c.position.y = 0.1; g.add(c);
    g.add(box(0.01, 1.05, 0.01, mat('#e9e2d0'), -0.0, 0.1, 0));
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  addOutline(g, OUTLINE.hero);
  g.rotation.x = Math.PI / 2; // apunta hacia delante desde la mano
  return g;
}

export function setWeapon(model, id) {
  if (model.weapon) { model.weapon.parent.remove(model.weapon); model.weapon = null; }
  if (id && id !== 'punos') {
    model.weapon = buildWeapon(id);
    if (id === 'arco') { model.weapon.rotation.set(0, 0, 0); model.handL.add(model.weapon); model.weapon.userData.left = true; }
    else model.handR.add(model.weapon);
  }
}

// a: fase de paso, sp: 0..1 velocidad, atk: 0..1 progreso de golpe (o -1), heavy: bool, roll: 0..1
const easeIn = x => x * x, easeOut = x => 1 - (1 - x) * (1 - x) * (1 - x);
function spring(sw, k, target, dt, stiff = 60, damp = 7) {
  sw[k + 'V'] += ((target - sw[k]) * stiff - sw[k + 'V'] * damp) * dt; sw[k] += sw[k + 'V'] * dt;
}
export function animHumanoid(m, a, sp, atk, heavy, roll) {
  const now = performance.now() / 1000, dt = Math.min(0.05, now - (m._last || now)); m._last = now;
  const run = Math.min(1, sp), s = Math.sin(a), c = Math.cos(a), idle = 1 - run, br = Math.sin(now * 2.1);
  // --- carrera / reposo ---
  let bodyY = m.HIP + (Math.abs(c) * 0.07 - 0.045) * run - br * 0.004 * idle;
  let bodyRX = 0, bodyRY = -s * 0.12 * run;
  let spX = 0.2 * run + br * 0.015 * idle, spY = s * 0.28 * run, spZ = 0;
  let legL = s * 0.85 * run, legR = -s * 0.85 * run;
  let knL = (Math.max(0, -c) * 1.25 + 0.15) * run + 0.06 * idle, knR = (Math.max(0, c) * 1.25 + 0.15) * run + 0.06 * idle;
  let anL = -0.2 * run * Math.max(0, s), anR = -0.2 * run * Math.max(0, -s);
  let aLX = -s * 0.9 * run + br * 0.03 * idle, aRX = s * 0.9 * run - br * 0.03 * idle;
  let aLZ = -0.12 - 0.05 * idle, aRZ = 0.12 + 0.05 * idle;
  let eL = -(0.25 + 1.05 * run) - Math.max(0, -s) * 0.3 * run, eR = -(0.25 + 1.05 * run) - Math.max(0, s) * 0.3 * run;
  let headX = -spX * 0.6, headY = -spY * 0.5;
  // --- ataque ---
  const bow = m.weapon && m.weapon.userData.left;
  if (atk >= 0 && bow) {
    const p = Math.min(1, atk / 0.25);
    aLX = -1.55 * p; aLZ = -0.05; eL = -0.05;
    aRX = -1.5 * p; aRZ = 0.25; eR = -1.6 * p; spY = -0.35 * p; headY = 0.3 * p;
  } else if (atk >= 0) {
    const k = heavy ? 1.35 : 1, w = Math.min(1, atk / 0.4), st = atk < 0.4 ? 0 : easeOut((atk - 0.4) / 0.6);
    const up = heavy ? -2.9 : -2.3;
    aRX = atk < 0.4 ? up * easeIn(w) : up + (0.55 - up) * st;
    aRZ = 0.12 + 0.35 * (atk < 0.4 ? w : 1 - st);
    eR = atk < 0.4 ? -0.9 * w : -0.9 + 0.75 * st;
    spY = atk < 0.4 ? 0.45 * k * w : (0.45 - 1.0 * st) * k;
    spX = atk < 0.4 ? -0.08 * w : -0.08 + 0.38 * st * k;
    spZ = atk < 0.4 ? -0.08 * w : 0.06 * st;
    if (heavy) { aLX = aRX * 0.8; aLZ = -0.1; eL = eR; }
    else { aLX = -0.55 + 0.25 * st; eL = -1.5; aLZ = -0.25; }
    if (run < 0.3) {
      legR = -0.45 * (atk < 0.4 ? w * 0.4 : 0.4 + 0.6 * st); legL = 0.35 * (atk < 0.4 ? w * 0.3 : 0.3 + 0.7 * st);
      knR = 0.25 + 0.3 * st; knL = 0.2 + (heavy ? 0.5 : 0.25) * st;
      bodyY -= (heavy ? 0.12 : 0.05) * st;
    }
    headY = -spY * 0.6; headX = -spX * 0.5;
  }
  // --- voltereta ---
  if (roll > 0) {
    const tuck = Math.sin(roll * Math.PI);
    bodyRX = roll * Math.PI * 2; bodyY = m.HIP - 0.4 * tuck;
    legL = legR = -1.3 * tuck; knL = knR = 2.0 * tuck; spX = 0.6 * tuck;
    aLX = aRX = -0.9 * tuck; eL = eR = -1.6 * tuck; headX = 0.4 * tuck;
  }
  m.body.position.y = bodyY; m.body.rotation.set(bodyRX, bodyRY, 0);
  m.spine.rotation.set(spX, spY, spZ);
  m.head.rotation.set(headX, headY, 0);
  m.legL.rotation.x = legL; m.legR.rotation.x = legR; m.kneeL.rotation.x = knL; m.kneeR.rotation.x = knR;
  m.ankleL.rotation.x = anL; m.ankleR.rotation.x = anR;
  m.armL.rotation.set(aLX, 0, aLZ); m.armR.rotation.set(aRX, 0, aRZ);
  m.elbowL.rotation.x = eL; m.elbowR.rotation.x = eR;
  // --- pelo y telas con inercia ---
  const sw = m.sw;
  spring(sw, 'hair', 0.15 + 0.75 * run + Math.abs(c) * 0.15 * run + (roll > 0 ? 0.6 : 0) + br * 0.03 * idle, dt);
  spring(sw, 'tail', 0.2 + 1.0 * run + Math.abs(s) * 0.25 * run + (atk >= 0 ? 0.4 : 0), dt, 45, 5);
  m.hairBack.rotation.set(Math.max(-0.2, sw.hair), 0, s * 0.08 * run);
  if (m.tails) m.tails.rotation.set(Math.max(0, sw.tail), s * 0.3 * run, 0);
  m.sash.rotation.set(-Math.max(0, sw.tail) * 0.6, 0, s * 0.15 * run);
}

/* ---------------- Felinos ---------------- */
export function buildCat(kind) {
  const g = new THREE.Group(), tiger = kind === 'tigre';
  const sc = tiger ? 1.25 : 1;
  const base = mat(tiger ? '#d9822b' : '#1c1c22'), belly = mat(tiger ? '#f2e3c8' : '#2a2a32'), stripe = mat('#22160f');
  const eye = mat('#f5d33a', { emissive: 0xf5d33a, emissiveIntensity: 0.9 });
  const mats = [base, belly];
  const body = pivot(g, 0, 0.62 * sc, 0);
  body.add(box(0.55 * sc, 0.5 * sc, 1.3 * sc, base));
  body.add(box(0.45 * sc, 0.12 * sc, 1.1 * sc, belly, 0, -0.25 * sc, 0));
  if (tiger) for (let i = -2; i <= 2; i++) body.add(box(0.57 * sc, 0.08 * sc, 0.08 * sc, stripe, 0, 0.12 * sc, i * 0.22 * sc));
  const head = pivot(body, 0, 0.2 * sc, 0.75 * sc);
  head.add(box(0.46 * sc, 0.4 * sc, 0.42 * sc, base));
  head.add(box(0.26 * sc, 0.18 * sc, 0.16 * sc, belly, 0, -0.08 * sc, 0.25 * sc));
  head.add(box(0.08 * sc, 0.06 * sc, 0.02 * sc, eye, -0.12 * sc, 0.06 * sc, 0.22 * sc));
  head.add(box(0.08 * sc, 0.06 * sc, 0.02 * sc, eye, 0.12 * sc, 0.06 * sc, 0.22 * sc));
  const earM = tiger ? base : base;
  head.add(box(0.1 * sc, 0.12 * sc, 0.06 * sc, earM, -0.16 * sc, 0.24 * sc, -0.05));
  head.add(box(0.1 * sc, 0.12 * sc, 0.06 * sc, earM, 0.16 * sc, 0.24 * sc, -0.05));
  const legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const p = pivot(body, x * 0.18 * sc, -0.15 * sc, z * 0.48 * sc);
    p.add(box(0.15 * sc, 0.55 * sc, 0.16 * sc, base, 0, -0.27 * sc, 0)); legs.push(p);
  }
  const tail = pivot(body, 0, 0.12 * sc, -0.65 * sc);
  const t1 = box(0.08 * sc, 0.08 * sc, 0.8 * sc, base, 0, 0, -0.4 * sc); tail.add(t1); tail.rotation.x = 0.5;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, head, legs, tail, mats, quad: true, outline: addOutline(g, OUTLINE.thick, true) };
}

/* ---------------- Mono ---------------- */
export function buildMonkey(color = '#7a5233', face = '#d9b48a', sc = 1) {
  const g = new THREE.Group();
  const base = mat(color), fm = mat(face), mats = [base, fm];
  const body = pivot(g, 0, 0.55 * sc, 0);
  body.add(box(0.42 * sc, 0.5 * sc, 0.34 * sc, base)); body.rotation.x = 0.35;
  const head = pivot(body, 0, 0.42 * sc, 0.06);
  head.add(box(0.34 * sc, 0.32 * sc, 0.3 * sc, base));
  head.add(box(0.24 * sc, 0.2 * sc, 0.06 * sc, fm, 0, -0.02, 0.15 * sc));
  head.add(box(0.1 * sc, 0.12 * sc, 0.04 * sc, fm, -0.2 * sc, 0.02, 0));
  head.add(box(0.1 * sc, 0.12 * sc, 0.04 * sc, fm, 0.2 * sc, 0.02, 0));
  const arm = s => { const p = pivot(body, s * 0.26 * sc, 0.18 * sc, 0); p.add(box(0.11 * sc, 0.6 * sc, 0.12 * sc, base, 0, -0.28 * sc, 0)); return p; };
  const leg = s => { const p = pivot(body, s * 0.13 * sc, -0.24 * sc, 0); p.add(box(0.13 * sc, 0.34 * sc, 0.14 * sc, base, 0, -0.16 * sc, 0)); return p; };
  const legs = [arm(-1), arm(1), leg(-1), leg(1)];
  const tail = pivot(body, 0, -0.2 * sc, -0.18 * sc);
  tail.add(box(0.06 * sc, 0.06 * sc, 0.6 * sc, base, 0, 0, -0.3 * sc)); tail.rotation.x = -0.9;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, head, legs, tail, mats, quad: false, outline: addOutline(g, OUTLINE.thick, true) };
}

/* ---------------- Gorila gigante ---------------- */
export function buildGorilla() {
  const g = new THREE.Group();
  const fur = mat('#2b2a2e'), skin = mat('#4d4448'), chest = mat('#5f5559'), eye = mat('#ff5a2a', { emissive: 0xff3a1a, emissiveIntensity: 1 });
  const mats = [fur, skin, chest];
  const body = pivot(g, 0, 1.0, 0);
  const torso = box(1.3, 1.1, 0.9, fur, 0, 0.45, 0); body.add(torso);
  body.add(box(0.9, 0.7, 0.1, chest, 0, 0.45, 0.46));
  body.rotation.x = 0.35;
  const head = pivot(body, 0, 1.15, 0.25);
  head.add(box(0.6, 0.55, 0.55, fur));
  head.add(box(0.5, 0.3, 0.2, skin, 0, -0.08, 0.3));
  head.add(box(0.56, 0.1, 0.12, fur, 0, 0.14, 0.3));
  head.add(box(0.1, 0.06, 0.03, eye, -0.13, 0.06, 0.37));
  head.add(box(0.1, 0.06, 0.03, eye, 0.13, 0.06, 0.37));
  const arm = s => {
    const p = pivot(body, s * 0.82, 0.85, 0.05);
    p.add(box(0.42, 0.9, 0.42, fur, 0, -0.42, 0));
    p.add(box(0.38, 0.75, 0.38, fur, 0, -1.15, 0.05));
    p.add(box(0.46, 0.25, 0.5, skin, 0, -1.6, 0.08));
    return p;
  };
  const leg = s => { const p = pivot(body, s * 0.38, -0.05, -0.1); p.add(box(0.42, 0.75, 0.45, fur, 0, -0.35, 0)); p.add(box(0.44, 0.15, 0.6, skin, 0, -0.75, 0.08)); return p; };
  const armL = arm(-1), armR = arm(1), legL = leg(-1), legR = leg(1);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, head, armL, armR, legL, legR, mats, outline: addOutline(g, OUTLINE.boss, true) };
}

// Animación genérica para criaturas
export function animCreature(m, a, sp, pose) {
  if (m.quad) {
    const s = Math.sin(a) * 0.7 * sp;
    m.legs[0].rotation.x = s; m.legs[3].rotation.x = s; m.legs[1].rotation.x = -s; m.legs[2].rotation.x = -s;
    m.tail.rotation.y = Math.sin(a * 0.5) * 0.4;
    m.body.rotation.x = pose === 'wind' ? -0.25 : pose === 'leap' ? -0.4 : 0;
    m.body.position.y = (m.body.userData.y0 ??= m.body.position.y) - (pose === 'wind' ? 0.15 : 0);
  } else {
    const s = Math.sin(a) * 0.9 * sp;
    m.legs[0].rotation.x = s; m.legs[1].rotation.x = -s; m.legs[2].rotation.x = -s; m.legs[3].rotation.x = s;
    if (pose === 'wind') { m.legs[0].rotation.x = -2.4; m.legs[1].rotation.x = -2.4; }
    m.tail.rotation.y = Math.sin(a * 0.4) * 0.5;
  }
}
