// Fauna de la Jungla: monos ladrones, panteras al acecho y tigres territoriales
import { G, isNight } from './state.js';
import { CREATURES, STATION_POS, ARENA_POS } from './data.js';
import { buildCat, buildMonkey, animCreature, flash } from './models.js';
import { heightAt, collide, isWater } from './world.js';
import { hurtPlayer, floatText, telegraph, removeTele } from './combat.js';
import { toast } from './ui.js';
import { mulberry32, angDiff, irnd, rnd } from './noise.js';

let spawnT = 0, tigerHomes = [];

class Creature {
  constructor(type, x, z, extra = {}) {
    this.type = type; this.def = CREATURES[type]; Object.assign(this, extra);
    this.x = x; this.z = z; this.y = heightAt(x, z); this.yaw = Math.random() * 6.28;
    this.r = this.def.r; this.h = type === 'tigre' ? 1.3 : type === 'pantera' ? 1.1 : 0.9;
    this.hp = this.maxHp = this.def.hp; this.state = 'wander'; this.t = 0; this.walk = 0;
    this.wx = x; this.wz = z; this.flashT = 0; this.bleed = 0; this.kx = 0; this.kz = 0; this.aggro = false; this.alpha = 1;
    this.model = type === 'mono' || type === 'monoFurioso' ? buildMonkey(this.def.color, this.def.face, type === 'monoFurioso' ? 1.05 : 0.9) : buildCat(type);
    if (type === 'pantera') for (const m of this.model.mats) m.transparent = true;
    G.scene.add(this.model.group);
  }
  get name() { return this.def.n; }
  hurt(dmg, from, opts) {
    this.hp -= dmg; this.flashT = 0.18; this.aggro = true;
    const dx = this.x - from.x, dz = this.z - from.z, d = Math.hypot(dx, dz) || 1, kb = opts.heavy ? 7 : 3.5;
    this.kx = dx / d * kb; this.kz = dz / d * kb;
    if (opts.bleed) this.bleed = 5;
    if (this.def.beh === 'thief') { this.state = 'flee'; this.t = 6; }
    else if (this.state === 'wander' || this.state === 'stalk' || this.state === 'home') { this.state = 'chase'; }
    if (opts.heavy && this.state === 'wind') { this.state = 'recover'; this.t = 0.8; removeTele(this.tele); } // el golpe cargado interrumpe
    if (this.hp <= 0) this.die();
  }
  die() {
    this.dead = true; this.deadT = 1.2; removeTele(this.tele);
    const P = G.P, d = this.def; let txt = [];
    for (const [k, v] of Object.entries(d.drops)) { P.inv[k] += v; txt.push(`+${v} ${k}`); }
    const j = Math.round(irnd(d.jade[0], d.jade[1]) * (P.cls === 'cazador' ? 1.5 : 1));
    if (j) { P.jade += j; txt.push(`+${j} jade`); }
    G.stats.kills++;
    if (txt.length) floatText({ x: this.x, y: this.y + 1.2, z: this.z }, txt.join('  '), 'good');
    if (this.home) this.home.respawn = 150;
  }
  update(dt) {
    const P = G.P, m = this.model;
    if (this.dead) {
      this.deadT -= dt; m.group.rotation.z = Math.min(Math.PI / 2, m.group.rotation.z + dt * 6);
      m.group.position.y -= dt * 0.3; if (this.deadT <= 0) this.remove = true; return;
    }
    this.flashT -= dt; this.t -= dt;
    if (this.bleed > 0) { this.bleed -= dt; this.hp -= 3 * dt; if (this.hp <= 0) return this.die(); }
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const night = isNight();
    let tx = null, tz = null, spd = 0, pose = null;
    const torchOn = P.items.antorcha && (night || G.weather.rain > 0.5);
    const beh = this.def.beh;

    // evitar campamento (hoguera / empalizada)
    if (G.camp && !this.summoned) {
      const cd = Math.hypot(this.x - G.camp.x, this.z - G.camp.z);
      if (cd < 8 && G.camp.parts.hoguera && this.state !== 'flee') { this.state = 'flee'; this.t = 3; }
      if (G.camp.parts.empalizada && cd < 9) { this.x = G.camp.x + (this.x - G.camp.x) / cd * 9; this.z = G.camp.z + (this.z - G.camp.z) / cd * 9; }
    }

    switch (this.state) {
      case 'wander':
        if (this.t <= 0 || Math.hypot(this.wx - this.x, this.wz - this.z) < 1) { this.t = rnd(2, 6); const a = rnd(0, 6.28), rr = rnd(3, 10); this.wx = this.x + Math.cos(a) * rr; this.wz = this.z + Math.sin(a) * rr; if (this.home) { this.wx = this.home.x + Math.cos(a) * 8; this.wz = this.home.z + Math.sin(a) * 8; } }
        tx = this.wx; tz = this.wz; spd = this.def.spd * 0.3;
        if (beh === 'thief' && P.inv.fruta > 0 && d < 11 && !(this.stoleCd > 0)) this.state = 'steal';
        if (beh === 'aggr' && d < 18) this.state = 'chase';
        if (beh === 'stalker') { if (night && d < 30 && !torchOn) this.state = 'stalk'; else if (d < 6) this.state = 'chase'; }
        if (beh === 'terr' && Math.hypot(P.x - this.home.x, P.z - this.home.z) < 13) { this.state = 'roar'; this.t = 0.9; floatText({ x: this.x, y: this.y + 1.8, z: this.z }, '¡GRRR!', 'bad'); }
        break;
      case 'steal':
        tx = P.x; tz = P.z; spd = this.def.spd;
        if (d < 1.3) {
          if (P.inv.fruta > 0) { P.inv.fruta--; toast('¡Un mono te ha robado una fruta!', 'bad'); }
          this.state = 'flee'; this.t = 8; this.stoleCd = 40;
        } else if (d > 16 || P.inv.fruta <= 0) this.state = 'wander';
        break;
      case 'flee':
        tx = this.x - dx; tz = this.z - dz; spd = this.def.spd * 1.1;
        if (G.camp && Math.hypot(this.x - G.camp.x, this.z - G.camp.z) < 9) { tx = this.x + (this.x - G.camp.x); tz = this.z + (this.z - G.camp.z); }
        if (this.t <= 0) this.state = this.aggro && beh !== 'thief' ? 'chase' : 'wander';
        break;
      case 'stalk': // pantera: se acerca despacio y casi invisible
        tx = P.x; tz = P.z; spd = this.def.spd * 0.45;
        if (d < 9 && !torchOn) { this.state = 'wind'; this.t = 0.6; this.pounce = true; this.tele = telegraph({ x: this.x, z: this.z, len: 11, w: 1.2, ang: toP, dur: 0.6 }); }
        if (!night || d > 34 || torchOn) this.state = 'wander';
        break;
      case 'roar':
        pose = 'wind'; this.yaw = toP; if (this.t <= 0) this.state = 'chase';
        break;
      case 'chase':
        tx = P.x; tz = P.z; spd = this.def.spd;
        if (this.home && Math.hypot(P.x - this.home.x, P.z - this.home.z) > 26) { this.state = 'home'; break; }
        if (beh === 'stalker' && !this.aggro && d > 20) { this.state = 'wander'; break; }
        if (d < this.def.range + this.r) { this.state = 'wind'; this.t = this.def.windup; this.pounce = false; }
        break;
      case 'wind':
        pose = 'wind'; this.yaw += angDiff(this.yaw, toP) * Math.min(1, dt * (this.pounce ? 2 : 6));
        if (this.tele && this.pounce) { this.tele.g.rotation.y = this.yaw; this.tele.g.position.x = this.x; this.tele.g.position.z = this.z; }
        if (this.t <= 0) {
          if (this.pounce) { this.state = 'leap'; this.t = 0.45; this.hitDone = false; }
          else {
            if (d < this.def.range + this.r + 0.5 && Math.abs(angDiff(this.yaw, toP)) < 1.1) hurtPlayer(this.def.dmg, this, { bleed: this.def.bleed });
            this.state = 'recover'; this.t = 0.7;
          }
        }
        break;
      case 'leap':
        pose = 'leap'; this.x += Math.sin(this.yaw) * 14 * dt; this.z += Math.cos(this.yaw) * 14 * dt;
        if (!this.hitDone && d < this.r + 0.9) { this.hitDone = true; hurtPlayer(this.def.dmg * 1.4, this, { kb: 2 }); }
        if (this.t <= 0) { this.state = 'recover'; this.t = 1.1; this.aggro = true; }
        break;
      case 'recover':
        tx = this.x - dx; tz = this.z - dz; spd = this.def.spd * 0.25;
        if (this.t <= 0) this.state = 'chase';
        break;
      case 'home':
        tx = this.home.x; tz = this.home.z; spd = this.def.spd * 0.8; this.hp = Math.min(this.maxHp, this.hp + 8 * dt);
        if (Math.hypot(this.x - tx, this.z - tz) < 2) { this.state = 'wander'; this.aggro = false; }
        break;
    }
    if (this.stoleCd > 0) this.stoleCd -= dt;
    // movimiento
    if (tx !== null && spd > 0) {
      const a = Math.atan2(tx - this.x, tz - this.z);
      if (this.state !== 'wind') this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * 8);
      let nx = this.x + Math.sin(this.yaw) * spd * dt, nz = this.z + Math.cos(this.yaw) * spd * dt;
      if (!isWater(nx, nz) || this.state === 'chase') { this.x = nx; this.z = nz; } else this.t = 0;
      this.walk += dt * spd * 2.2;
    }
    this.x += this.kx * dt; this.z += this.kz * dt; this.kx *= 1 - dt * 8; this.kz *= 1 - dt * 8;
    collide(this, this.r * 0.8);
    this.y = heightAt(this.x, this.z);
    // aspecto
    m.group.position.set(this.x, this.y + (pose === 'leap' ? Math.sin((0.45 - this.t) / 0.45 * Math.PI) * 1.2 : 0), this.z);
    m.group.rotation.y = this.yaw;
    animCreature(m, this.walk, Math.min(1, spd / 3), pose);
    flash(m, this.flashT > 0 ? 1 : pose === 'wind' ? 0.45 : 0, this.flashT > 0 ? 0xffffff : 0xff6a20);
    if (this.type === 'pantera') {
      const want = this.state === 'stalk' ? Math.max(0.12, Math.min(1, (16 - d) / 14)) : 1;
      this.alpha += (want - this.alpha) * Math.min(1, dt * 4);
      for (const mt of m.mats) mt.opacity = this.alpha;
    }
  }
  dispose() { G.scene.remove(this.model.group); removeTele(this.tele); }
}

export function initCreatures(seed) {
  const r = mulberry32(seed + 404); tigerHomes = [];
  while (tigerHomes.length < 3) {
    const x = (r() - 0.5) * 190, z = (r() - 0.5) * 190;
    if (Math.hypot(x - STATION_POS.x, z - STATION_POS.z) < 40 || Math.hypot(x - ARENA_POS.x, z - ARENA_POS.z) < 35 || isWater(x, z)) continue;
    if (tigerHomes.some(h => Math.hypot(h.x - x, h.z - z) < 50)) continue;
    tigerHomes.push({ x, z, alive: false, respawn: 0 });
  }
}
export const getTigerHomes = () => tigerHomes;

export function summonMonkeys(x, z, n) {
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28, c = new Creature('monoFurioso', x + Math.cos(a) * 4, z + Math.sin(a) * 4, { summoned: true });
    c.state = 'chase'; c.aggro = true; G.creatures.push(c);
  }
}

function spawnSpot(P) {
  for (let k = 0; k < 8; k++) {
    const a = rnd(0, 6.28), d = rnd(28, 42), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    if (Math.abs(x) > 110 || Math.abs(z) > 110 || isWater(x, z)) continue;
    if (Math.hypot(x - STATION_POS.x, z - STATION_POS.z) < 22 || Math.hypot(x - ARENA_POS.x, z - ARENA_POS.z) < 28) continue;
    if (G.camp && Math.hypot(x - G.camp.x, z - G.camp.z) < 14) continue;
    return { x, z };
  }
  return null;
}

export function updateCreatures(dt) {
  const P = G.P;
  spawnT -= dt;
  if (spawnT <= 0) {
    spawnT = 1.5;
    const count = t => G.creatures.filter(c => c.type === t && !c.dead).length;
    const want = { mono: 6, pantera: isNight() ? 3 : 1 };
    for (const [t, n] of Object.entries(want)) if (count(t) < n) { const s = spawnSpot(P); if (s) G.creatures.push(new Creature(t, s.x, s.z)); }
    for (const h of tigerHomes) {
      if (h.respawn > 0) { h.respawn -= 1.5; continue; }
      const alive = G.creatures.some(c => c.home === h && !c.dead);
      if (!alive && Math.hypot(P.x - h.x, P.z - h.z) < 55 && Math.hypot(P.x - h.x, P.z - h.z) > 20) G.creatures.push(new Creature('tigre', h.x, h.z, { home: h }));
    }
  }
  for (const c of G.creatures) {
    c.update(dt);
    const d = Math.hypot(c.x - P.x, c.z - P.z);
    if (!c.summoned && d > 70) c.remove = true;
  }
  for (let i = G.creatures.length - 1; i >= 0; i--) if (G.creatures[i].remove) { G.creatures[i].dispose(); G.creatures.splice(i, 1); }
}
export function clearCreatures() { for (const c of G.creatures) c.dispose(); G.creatures.length = 0; }
