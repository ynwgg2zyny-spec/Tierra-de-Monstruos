// Jefe de la Jungla: Gorila gigante con 3 fases
import { G } from './state.js';
import { ARENA_POS, BOSS } from './data.js';
import { buildGorilla, flash } from './models.js';
import { heightAt, collide, nearby, destroyObject } from './world.js';
import { hurtPlayer, telegraph, removeTele, shockwave, spawnRock, burst, floatText } from './combat.js';
import { summonMonkeys } from './creatures.js';
import { toast, bossIntro } from './ui.js';
import { save } from './save.js';
import { angDiff, rnd } from './noise.js';

const SCALE = 2.5;

class Boss {
  constructor() {
    this.model = buildGorilla(); this.model.group.scale.setScalar(SCALE); G.scene.add(this.model.group);
    this.r = 2.0; this.h = 5; this.maxHp = BOSS.hp; this.name = BOSS.n;
    this.reset();
    if (G.defeated) this.setDefeated();
  }
  reset() {
    removeTele(this.tele);
    Object.assign(this, { x: ARENA_POS.x, z: ARENA_POS.z, yaw: 0, hp: this.maxHp, active: false, phase: 1, state: 'sleep', t: 0, cd: 1.5, summonCd: 6, walk: 0, flashT: 0, jumpY: 0, combo: 0, inv: false });
    this.y = heightAt(this.x, this.z);
  }
  setDefeated() { flash(this.model, 0); this.dead = true; this.active = false; this.model.group.position.set(this.x, this.y - 0.6, this.z); this.model.group.rotation.z = Math.PI / 2; }

  hurt(dmg, from, opts) {
    if (this.inv) { floatText({ x: this.x, y: this.y + 6, z: this.z }, 'Inmune', 'bad'); return; }
    if (this.state === 'stun') dmg *= 1.5;
    this.hp -= dmg; this.flashT = 0.15;
    if (this.hp <= 0) return this.die();
    if (this.phase === 1 && this.hp < this.maxHp * 0.66) this.toPhase(2);
    else if (this.phase === 2 && this.hp < this.maxHp * 0.33) this.toPhase(3);
  }
  toPhase(n) {
    this.phase = n; this.go('roar', 1.8); this.inv = true; removeTele(this.tele);
    G.shake = 0.6;
    if (n === 2) toast('Fase 2: ¡el Gorila lanza rocas y llama a la manada!', 'bad', 5);
    if (n === 3) {
      toast('Fase 3: ¡FURIA! El Gorila destroza la jungla a su alrededor.', 'bad', 5);
      for (const o of nearby(ARENA_POS.x, ARENA_POS.z, 36)) if (o.kind === 'arbol' || o.kind === 'gigante') { if (Math.hypot(o.x - ARENA_POS.x, o.z - ARENA_POS.z) < 36) { destroyObject(o); burst({ x: o.x, y: o.y + 3, z: o.z }, '#3f7a34', 6); } }
    }
  }
  die() {
    this.dead = true; this.active = false; this.hp = 0; G.defeated = true; removeTele(this.tele); flash(this.model, 0);
    for (const c of G.creatures) if (c.summoned) c.remove = true;
    const P = G.P; P.jade += 60; P.inv.colmillo += 1; P.inv.piel += 4; P.inv.carne += 6;
    burst({ x: this.x, y: this.y + 3, z: this.z }, '#4fbf7a', 40); G.shake = 0.8;
    toast('¡Has derrotado al Gorila gigante! +60 jade, colmillo, pieles y carne.', 'good', 7);
    setTimeout(() => toast('La estación de la Jungla ya puede tender vías hacia otros territorios.', 'good', 6), 2500);
    this.deathT = 1.2; save();
  }
  go(state, t) { this.state = state; this.t = t; }

  update(dt) {
    const P = G.P, m = this.model;
    if (this.dead) {
      if (this.deathT > 0) { this.deathT -= dt; m.group.rotation.z = Math.min(Math.PI / 2, m.group.rotation.z + dt * 2); m.group.position.y = this.y - 0.6 * (1 - this.deathT / 1.2); }
      return;
    }
    const dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
    const dHome = Math.hypot(P.x - ARENA_POS.x, P.z - ARENA_POS.z);
    if (!this.active) {
      if (dHome < 19) { this.active = true; this.go('roar', 1.8); this.inv = true; bossIntro(); toast('¡El Gorila gigante despierta! Rueda para esquivar sus golpes.', 'bad', 5); }
      this.pose('sleep', dt); return;
    }
    if (dHome > 36) { this.reset(); toast('El Gorila vuelve a sus ruinas y recupera fuerzas.'); return; }
    this.t -= dt; this.flashT -= dt; this.cd -= dt; this.summonCd -= dt;
    const fury = this.phase === 3 ? 1.35 : 1, spd = 4.2 * fury;
    let move = 0;
    switch (this.state) {
      case 'roar':
        if (this.t <= 0) { this.inv = false; this.go('chase', 0); }
        break;
      case 'chase':
        this.yaw += angDiff(this.yaw, toP) * Math.min(1, dt * 4);
        if (d > 4) move = spd;
        if (this.cd <= 0) this.choose(d);
        break;
      case 'swipe':
        this.face(toP, dt, 3);
        if (this.t <= 0) {
          if (d < 4.6 + 0.4 && Math.abs(angDiff(this.yaw, toP)) < 1.2) hurtPlayer(16, this, { kb: 3 });
          burst({ x: this.x + Math.sin(this.yaw) * 3, y: this.y + 1, z: this.z + Math.cos(this.yaw) * 3 }, '#8e8676', 6);
          this.go('recover', 0.6);
        }
        break;
      case 'slam': {
        if (this.t <= 0) {
          G.shake = 0.5; burst({ x: this.x, y: this.y + 0.5, z: this.z }, '#8e8676', 14);
          if (Math.hypot(P.x - this.slamX, P.z - this.slamZ) < this.slamR) hurtPlayer(24, { x: this.slamX, z: this.slamZ }, { kb: 3 });
          if (this.phase >= 2 && this.combo === 0) shockwave(this.x, this.z, 14, 8, 11);
          if (this.combo > 0) { this.combo--; this.startSlam(3.6, 0.45); }
          else this.go('recover', this.phase === 3 ? 0.7 : 1.0);
        }
        break;
      }
      case 'chargeWind':
        if (this.tele) this.tele.g.rotation.y = this.yaw;
        this.face(toP, dt, 1.2);
        if (this.t <= 0) { removeTele(this.tele); this.go('charge', 1.05); this.hit = false; }
        break;
      case 'charge':
        this.x += Math.sin(this.yaw) * 18 * dt; this.z += Math.cos(this.yaw) * 18 * dt;
        if (!this.hit && d < this.r + 1.2) { this.hit = true; hurtPlayer(20, this, { kb: 5 }); }
        for (const o of nearby(this.x, this.z, 3)) if ((o.kind === 'arbol' || o.kind === 'gigante') && o.alive && Math.hypot(o.x - this.x, o.z - this.z) < 3) { destroyObject(o); burst({ x: o.x, y: o.y + 2, z: o.z }, '#6b4a2e', 8); G.shake = 0.4; }
        if (this.t <= 0) { this.go('stun', this.phase === 3 ? 0.9 : 1.5); floatText({ x: this.x, y: this.y + 6, z: this.z }, '¡Aturdido!', 'good'); }
        break;
      case 'rock':
        this.face(toP, dt, 4);
        if (this.t <= 0) {
          const n = this.phase === 3 ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const tx = P.x + (i ? rnd(-5, 5) : 0), tz = P.z + (i ? rnd(-5, 5) : 0);
            spawnRock({ x: this.x + Math.sin(this.yaw) * 2, y: this.y + 6, z: this.z + Math.cos(this.yaw) * 2 }, tx, tz, 18, 1.15 + i * 0.2);
          }
          this.go('recover', 0.8);
        }
        break;
      case 'summon':
        if (this.t <= 0) { summonMonkeys(this.x, this.z, 3); toast('¡Monos furiosos acuden en ayuda del Gorila!', 'bad'); this.go('recover', 0.5); }
        break;
      case 'jump': {
        const k = 1 - this.t / 1.0; this.jumpY = Math.sin(k * Math.PI) * 6;
        this.x += (this.jx - this.x) * Math.min(1, dt * 3); this.z += (this.jz - this.z) * Math.min(1, dt * 3);
        if (this.t <= 0) {
          this.jumpY = 0; removeTele(this.tele); G.shake = 0.7; burst({ x: this.x, y: this.y + 0.5, z: this.z }, '#8e8676', 18);
          if (d < 4) hurtPlayer(26, this, { kb: 4 });
          shockwave(this.x, this.z, 20, 10, 18);
          this.go('recover', 0.9);
        }
        break;
      }
      case 'stun': case 'recover':
        if (this.t <= 0) { this.go('chase', 0); this.cd = (this.phase === 3 ? 0.5 : 1.0) + rnd(0, 0.6); }
        break;
    }
    if (move) { this.x += Math.sin(this.yaw) * move * dt; this.z += Math.cos(this.yaw) * move * dt; this.walk += dt * move; }
    collide(this, this.r * 0.7);
    this.y = heightAt(this.x, this.z);
    this.pose(this.state, dt, move);
    flash(m, this.flashT > 0 ? 0.9 : this.state === 'stun' ? 0.3 + Math.sin(performance.now() / 80) * 0.2 : this.phase === 3 ? 0.25 : 0, this.flashT > 0 ? 0xffffff : this.state === 'stun' ? 0x40a0ff : 0xff2a10);
  }
  face(a, dt, k) { this.yaw += angDiff(this.yaw, a) * Math.min(1, dt * k); }
  startSlam(r, wind) {
    this.slamX = this.x + Math.sin(this.yaw) * 1.5; this.slamZ = this.z + Math.cos(this.yaw) * 1.5; this.slamR = r;
    this.tele = telegraph({ x: this.slamX, z: this.slamZ, r, dur: wind }); this.go('slam', wind);
  }
  choose(d) {
    const P = G.P, opts = [];
    if (d < 5) opts.push('swipe', 'swipe', 'slam');
    if (d >= 5 && d < 22) opts.push('charge');
    if (this.phase >= 2 && d > 6) opts.push('rock', 'rock');
    if (this.phase >= 2 && this.summonCd <= 0 && G.creatures.filter(c => c.summoned && !c.dead).length < 2) opts.push('summon', 'summon', 'summon');
    if (this.phase === 3) opts.push('jump', 'frenzy');
    if (!opts.length) opts.push('charge');
    const pick = opts[Math.floor(Math.random() * opts.length)];
    this.combo = 0;
    if (pick === 'swipe') this.go('swipe', 0.55);
    else if (pick === 'slam') this.startSlam(5, this.phase === 3 ? 0.7 : 0.95);
    else if (pick === 'frenzy') { this.combo = 2; this.startSlam(3.6, 0.5); }
    else if (pick === 'charge') { this.yaw = Math.atan2(P.x - this.x, P.z - this.z); this.tele = telegraph({ x: this.x, z: this.z, len: 19, w: 3.4, ang: this.yaw, dur: 0.85, follow: this }); this.go('chargeWind', 0.85); }
    else if (pick === 'rock') this.go('rock', 0.65);
    else if (pick === 'summon') { this.summonCd = 22; this.go('summon', 0.9); floatText({ x: this.x, y: this.y + 7, z: this.z }, '¡UUH-UUH!', 'bad'); }
    else if (pick === 'jump') { this.jx = P.x; this.jz = P.z; this.tele = telegraph({ x: P.x, z: P.z, r: 4, dur: 1.0 }); this.go('jump', 1.0); }
  }
  pose(state, dt, move = 0) {
    const m = this.model, g = m.group;
    g.position.set(this.x, this.y + (this.jumpY || 0), this.z); g.rotation.y = this.yaw;
    const s = Math.sin(this.walk * 1.2) * (move ? 0.6 : 0);
    let aL = s, aR = -s, bodyX = 0.35;
    if (state === 'sleep') { aL = aR = 0.3; bodyX = 0.6 + Math.sin(performance.now() / 700) * 0.05; }
    if (state === 'roar') { aL = aR = -2.6; bodyX = -0.1; }
    if (state === 'slam') { const k = this.t; aL = aR = k > 0.15 ? -2.8 : 0.4; }
    if (state === 'swipe') { aR = this.t > 0.15 ? -1.8 : 1.2; }
    if (state === 'rock') { aR = -2.9; }
    if (state === 'chargeWind') { bodyX = 0.9; aL = aR = 0.8; }
    if (state === 'charge') { bodyX = 0.9; aL = aR = Math.sin(this.walk * 3) * 1.2; this.walk += dt * 18; }
    if (state === 'stun') { bodyX = 0.15; aL = aR = 0.2; m.head.rotation.y = Math.sin(performance.now() / 120) * 0.4; } else m.head.rotation.y = 0;
    if (state === 'summon') { aL = aR = -2.4; bodyX = -0.15; }
    if (state === 'jump') { aL = aR = -2.6; }
    m.armL.rotation.x += (aL - m.armL.rotation.x) * Math.min(1, dt * 12);
    m.armR.rotation.x += (aR - m.armR.rotation.x) * Math.min(1, dt * 12);
    m.body.rotation.x += (bodyX - m.body.rotation.x) * Math.min(1, dt * 8);
    m.legL.rotation.x = s; m.legR.rotation.x = -s;
  }
}

export function initBoss() { if (G.boss) G.scene.remove(G.boss.model.group); G.boss = new Boss(); }
export function updateBoss(dt) { if (G.boss) G.boss.update(dt); }
