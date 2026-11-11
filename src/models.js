// Modelos low-poly construidos por código
import * as THREE from 'three';

export function mat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z); me.castShadow = true; return me;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }

// Fija color de destello (golpe) en todos los materiales de un modelo
export function flash(model, amount, color = 0xff3b2a) {
  for (const m of model.mats) { m.emissive.setHex(color); m.emissiveIntensity = amount; }
}

/* ---------------- Humano ---------------- */
export function buildHumanoid({ skin, outfit, hat, pants = '#3a3027' }) {
  const g = new THREE.Group();
  const mSkin = mat(skin), mOut = mat(outfit), mPants = mat(pants), mHat = mat(hat || '#6b4a2b'), mBoot = mat('#2a211b');
  const mats = [mSkin, mOut, mPants, mHat, mBoot];
  const body = pivot(g, 0, 0, 0);
  const torso = box(0.56, 0.62, 0.32, mOut, 0, 1.18, 0); body.add(torso);
  body.add(box(0.58, 0.1, 0.34, mat('#5a4330'), 0, 0.88, 0)); // cinturón
  const head = pivot(body, 0, 1.55, 0);
  head.add(box(0.36, 0.36, 0.34, mSkin, 0, 0.12, 0));
  head.add(box(0.08, 0.06, 0.02, mat('#1b1410'), -0.08, 0.15, 0.175));
  head.add(box(0.08, 0.06, 0.02, mat('#1b1410'), 0.08, 0.15, 0.175));
  const hatG = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 8), mHat); hatG.position.y = 0.32; head.add(hatG);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 8), mHat); crown.position.y = 0.42; head.add(crown);
  const mk = (side) => {
    const sh = pivot(body, side * 0.37, 1.44, 0);
    sh.add(box(0.17, 0.5, 0.18, mOut, 0, -0.2, 0));
    sh.add(box(0.15, 0.2, 0.16, mSkin, 0, -0.52, 0));
    const hand = pivot(sh, 0, -0.6, 0.02);
    return { sh, hand };
  };
  const L = mk(-1), R = mk(1);
  const leg = (side) => {
    const hp = pivot(body, side * 0.15, 0.86, 0);
    hp.add(box(0.2, 0.62, 0.22, mPants, 0, -0.3, 0));
    hp.add(box(0.22, 0.18, 0.3, mBoot, 0, -0.72, 0.04));
    return hp;
  };
  const legL = leg(-1), legR = leg(1);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, body, torso, head, armL: L.sh, armR: R.sh, handR: R.hand, handL: L.hand, legL, legR, mats, weapon: null };
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

// a: fase de paso, sp: 0..1 velocidad, atk: 0..1 progreso de golpe (o -1), heavy: bool
export function animHumanoid(m, a, sp, atk, heavy, roll) {
  const s = Math.sin(a) * 0.8 * sp;
  m.legL.rotation.x = s; m.legR.rotation.x = -s;
  m.armL.rotation.x = -s * 0.8; m.armR.rotation.x = s * 0.8;
  m.armR.rotation.z = 0; m.body.rotation.x = 0; m.body.position.y = Math.abs(Math.sin(a)) * 0.06 * sp;
  if (atk >= 0) {
    // levantar (0-.4) y descargar (.4-1)
    const up = heavy ? -2.8 : -2.2;
    const r = atk < 0.4 ? up * (atk / 0.4) : up + (up * -1 + 0.9) * ((atk - 0.4) / 0.6);
    m.armR.rotation.x = r; m.body.rotation.y = (atk < 0.4 ? -0.3 : 0.4) * (heavy ? 1.4 : 1);
  } else m.body.rotation.y = 0;
  if (roll > 0) { m.body.rotation.x = roll * Math.PI * 2; m.body.position.y = 0.3 * Math.sin(roll * Math.PI); }
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
  return { group: g, body, head, legs, tail, mats, quad: true };
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
  return { group: g, body, head, legs, tail, mats, quad: false };
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
  return { group: g, body, head, armL, armR, legL, legR, mats };
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
