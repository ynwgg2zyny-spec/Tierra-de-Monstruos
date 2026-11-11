// Interfaz: HUD, avisos, hojas (mochila, campamento, estación, pausa) y minimapa
import { G, isNight } from './state.js';
import { RES, RECIPES, STRUCTS, WEAPONS, SHOP, SELL, OBJECTIVES, CLASSES, STATION_POS, ARENA_POS, WORLD } from './data.js';
import { R, equip, cam } from './player.js';
import { craft, buildStruct, costOf, hasAll, needOk, owned, nearCamp, moveCampHere, cook, sleep } from './crafting.js';
import { useItem, drinkCanteen, tempLabel, FOOD } from './survival.js';
import { minimapCanvas } from './world.js';
import { getTigerHomes } from './creatures.js';
import { save } from './save.js';
import { resetInput } from './input.js';

const $ = s => document.querySelector(s);
let sheetFn = null, tab = {}, hudT = 0, miniT = 0, onQuit = null, onQuality = null;

export function initUI(opts) {
  onQuit = opts.onQuit; onQuality = opts.onQuality;
  $('#sheetWrap').addEventListener('pointerdown', e => { if (e.target.id === 'sheetWrap') closeSheet(); });
  $('#sheet').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === 'close') return closeSheet();
    if (a === 'tab') { tab[sheetFn.name] = v; return refresh(); }
    if (a === 'craft') craft(v);
    if (a === 'struct') buildStruct(v);
    if (a === 'use') useItem(v);
    if (a === 'canteen') drinkCanteen();
    if (a === 'equip') equip(v);
    if (a === 'moveCamp') moveCampHere();
    if (a === 'cook') cook(v === 'all');
    if (a === 'sleep') { sleep(); }
    if (a === 'buy') buy(v);
    if (a === 'sell') sell(+v);
    if (a === 'quit') { closeSheet(); save(); onQuit(); return; }
    if (a === 'quality') { onQuality(); }
    if (a === 'resume') return closeSheet();
    refresh();
  });
}

/* ---------------- Avisos ---------------- */
export function toast(msg, kind = '', sec = 3) {
  const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
  const box = $('#toasts'); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), sec * 1000);
}
export function bossIntro() {
  const el = $('#bossIntro'); el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------------- Hojas ---------------- */
function openSheet(fn) { sheetFn = fn; G.paused = true; resetInput(); $('#sheetWrap').hidden = false; refresh(); }
export function closeSheet() { $('#sheetWrap').hidden = true; sheetFn = null; G.paused = false; save(); }
export const sheetOpen = () => !!sheetFn;
function refresh() { if (!sheetFn) return; const b = $('.sh-body'), sc = b ? b.scrollTop : 0; $('#sheet').innerHTML = sheetFn(); const nb = $('.sh-body'); if (nb) nb.scrollTop = sc; }
const head = (t, p) => `<div class="sh-head"><div><h2>${t}</h2>${p ? `<p>${p}</p>` : ''}</div><button class="x" data-a="close" aria-label="Cerrar">✕</button></div>`;
const tabs = (fn, list) => { const cur = tab[fn] || list[0][0]; return [cur, `<div class="tabs">${list.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div>`]; };
const costTxt = c => Object.entries(c).map(([k, v]) => `<span class="${(G.P.inv[k] || 0) >= v ? 'ok' : 'no'}">${v} ${RES[k].toLowerCase()} (${G.P.inv[k] || 0})</span>`).join(' · ');
const row = (t, d, btn) => `<div class="row"><div><div class="t">${t}</div><div class="d">${d}</div></div>${btn}</div>`;

/* Mochila */
export function openBag() { openSheet(bag); }
function bag() {
  const P = G.P, [cur, tb] = tabs('bag', [['inv', 'Inventario'], ['craft', 'Fabricar'], ['equip', 'Equipo']]);
  let h = head('Mochila', `${P.jade} de jade · Día ${G.day}`) + '<div class="sh-body">' + tb;
  if (cur === 'inv') {
    h += '<div class="sec">Recursos</div><div class="grid2">';
    for (const k of ['madera', 'piedra', 'liana', 'fibra', 'hierba', 'obsidiana', 'piel', 'flechas', 'colmillo']) h += `<div class="chip">${RES[k]}<b>${P.inv[k]}</b></div>`;
    h += '</div><div class="sec">Comida y curas</div>';
    for (const k of ['asada', 'fruta', 'carne']) if (P.inv[k]) h += row(`${RES[k]} ×${P.inv[k]}`, `+${FOOD[k]} de comida${k === 'carne' ? ' · puede envenenar' : ''}`, `<button class="btn" data-a="use" data-v="${k}">Comer</button>`);
    for (const k of ['venda', 'antidoto', 'botiquin']) if (P.inv[k]) h += row(`${RES[k]} ×${P.inv[k]}`, { venda: '+20 vida, cura sangrado', antidoto: 'Cura veneno', botiquin: '+50 vida' }[k], `<button class="btn" data-a="use" data-v="${k}">Usar</button>`);
    if (P.items.cantimplora) h += row(`Cantimplora ${P.water}/3`, 'Llénala en el río o bajo la lluvia.', `<button class="btn" data-a="canteen" ${P.water ? '' : 'disabled'}>Beber</button>`);
    if (!['asada', 'fruta', 'carne', 'venda', 'antidoto', 'botiquin'].some(k => P.inv[k]) && !P.items.cantimplora) h += '<p class="note">No llevas comida ni curas.</p>';
    h += '<div class="sec">Campamento</div>';
    if (!G.camp) h += `<p class="note">Aún no tienes campamento. Constrúyelo en la pestaña Fabricar (Hoguera).</p>`;
    else if (!nearCamp(9)) h += row('Trasladar campamento aquí', 'Campamento nómada: recoges todo lo construido y lo montas donde estás.', `<button class="btn" data-a="moveCamp">Trasladar</button>`);
    else h += '<p class="note">Estás en tu campamento.</p>';
  }
  if (cur === 'craft') {
    if (!G.camp) { const s = STRUCTS[0], c = costOf(s.cost); h += '<div class="sec">Campamento</div>' + row(s.n, `${s.d}<br>${costTxt(c)}`, `<button class="btn" data-a="struct" data-v="hoguera" ${hasAll(c) ? '' : 'disabled'}>Montar</button>`); }
    h += '<div class="sec">Fabricar</div>';
    for (const rc of RECIPES) {
      const c = costOf(rc.cost), own = owned(rc), nOk = needOk(rc.need);
      const needTxt = rc.need ? `<br><span class="${nOk ? 'ok' : 'no'}">Requiere ${rc.need === 'mesa' ? 'mesa de trabajo' : 'hoguera'} cerca</span>` : '';
      h += row(rc.n, `${rc.d}<br>${costTxt(c)}${needTxt}`, own ? '<span class="status" style="--c:#87ba6b">Tienes</span>' : `<button class="btn" data-a="craft" data-v="${rc.id}" ${hasAll(c) && nOk ? '' : 'disabled'}>Fabricar</button>`);
    }
  }
  if (cur === 'equip') {
    h += '<div class="sec">Armas</div>';
    for (const w of P.weapons) { const W = WEAPONS[w]; h += row(W.n, W.ranged ? `A distancia · daño ${W.dmg} · ${P.inv.flechas} flechas` : `Daño ${W.dmg} · alcance ${W.reach}${W.bleed ? ' · sangrado' : ''}`, P.weapon === w ? '<span class="status" style="--c:#e2a440">Equipada</span>' : `<button class="btn" data-a="equip" data-v="${w}">Equipar</button>`); }
    h += '<div class="sec">Herramientas y objetos</div><div class="grid2">';
    const list = [['hacha', 'Hacha', P.tools.hacha], ['pico', 'Pico', P.tools.pico], ['cantimplora', 'Cantimplora', P.items.cantimplora], ['antorcha', 'Antorcha', P.items.antorcha]];
    for (const [, n, has] of list) h += `<div class="chip">${n}<b>${has ? '✓' : '—'}</b></div>`;
    const cl = CLASSES[P.cls];
    h += `</div><div class="sec">${cl.n}</div><p class="note">${cl.d}<br><b>${cl.skill}:</b> ${cl.sd}</p>`;
  }
  return h + '</div>';
}

/* Campamento */
export function openCamp() { openSheet(campSheet); }
function campSheet() {
  const P = G.P, cp = G.camp.parts, [cur, tb] = tabs('camp', [['build', 'Construir'], ['cook', 'Cocina'], ['rest', 'Descanso']]);
  let h = head('Campamento', 'Tu base nómada en la jungla') + '<div class="sh-body">' + tb;
  if (cur === 'build') for (const s of STRUCTS) { const c = costOf(s.cost); h += row(s.n, `${s.d}${cp[s.id] ? '' : '<br>' + costTxt(c)}`, cp[s.id] ? '<span class="status" style="--c:#87ba6b">Construido</span>' : `<button class="btn" data-a="struct" data-v="${s.id}" ${hasAll(c) ? '' : 'disabled'}>Construir</button>`); }
  if (cur === 'cook') {
    if (!cp.hoguera) h += '<p class="note">Necesitas la hoguera.</p>';
    else h += row(`Asar carne (${P.inv.carne} cruda)`, 'La carne asada alimenta más y no envenena.', `<span><button class="btn" data-a="cook" data-v="one" ${P.inv.carne ? '' : 'disabled'}>Asar 1</button> <button class="btn" data-a="cook" data-v="all" ${P.inv.carne > 1 ? '' : 'disabled'}>Todo</button></span>`);
    const rc = RECIPES.find(r => r.id === 'antidoto'), c = costOf(rc.cost);
    h += row(rc.n, `${rc.d}<br>${costTxt(c)}`, `<button class="btn" data-a="craft" data-v="antidoto" ${hasAll(c) && cp.hoguera ? '' : 'disabled'}>Preparar</button>`);
  }
  if (cur === 'rest') {
    h += `<p class="note">Junto a la hoguera recuperas vida rápidamente y te secas. ${isNight() ? 'Es de noche.' : 'Es de día.'}</p>`;
    h += row('Dormir hasta el amanecer', cp.refugio ? 'Recuperas toda la vida. Gastas algo de comida y agua.' : 'Necesitas construir un refugio.', `<button class="btn solid" data-a="sleep" ${cp.refugio && isNight() ? '' : 'disabled'}>Dormir</button>`);
  }
  return h + '</div>';
}

/* Estación */
export function openStation() { openSheet(station); }
function buy(id) {
  const it = SHOP.find(s => s.id === id), P = G.P;
  if (P.jade < it.price) return;
  if (it.weapon && P.weapons.includes(it.weapon)) return;
  if (it.item && P.items[it.item]) return;
  P.jade -= it.price;
  if (it.give) for (const [k, v] of Object.entries(it.give)) P.inv[k] += v;
  if (it.weapon) { P.weapons.push(it.weapon); equip(it.weapon); }
  if (it.item) P.items[it.item] = true;
  toast(`Has comprado: ${it.n}`, 'good');
}
function sell(i) { const [k, n, price] = SELL[i], P = G.P; if (P.inv[k] < n) return; P.inv[k] -= n; P.jade += price; }
function station() {
  const P = G.P, [cur, tb] = tabs('station', [['buy', 'Comprar'], ['sell', 'Vender'], ['rail', 'Vías']]);
  let h = head('Estación de la Jungla', `Tienes <b style="color:#4fbf7a">${P.jade} de jade</b>`) + '<div class="sh-body">' + tb;
  if (cur === 'buy') for (const it of SHOP) {
    const has = (it.weapon && P.weapons.includes(it.weapon)) || (it.item && P.items[it.item]);
    h += row(it.n, it.d, has ? '<span class="status" style="--c:#87ba6b">Tienes</span>' : `<button class="btn" data-a="buy" data-v="${it.id}" ${P.jade >= it.price ? '' : 'disabled'}>${it.price} jade</button>`);
  }
  if (cur === 'sell') SELL.forEach(([k, n, p], i) => { h += row(`${n} × ${RES[k]}`, `Tienes ${P.inv[k]}`, `<button class="btn" data-a="sell" data-v="${i}" ${P.inv[k] >= n ? '' : 'disabled'}>+${p} jade</button>`); });
  if (cur === 'rail') {
    h += `<p class="note">Desde aquí partirán las vías hacia los otros cuatro territorios: Desierto, Montañas, Lagos y Cuevas.</p>`;
    h += G.defeated ? `<p class="note"><span class="status" style="--c:#87ba6b">Gorila gigante derrotado</span><br><br>La estación está lista para tender vías. Los demás territorios llegarán en las próximas versiones del juego.</p>`
      : `<p class="note"><span class="status">El Gorila gigante bloquea la línea</span><br><br>Derrota al guardián de las ruinas (al otro lado del río) para poder construir vías.</p>`;
  }
  return h + '</div>';
}

/* Pausa */
export function openPause() { openSheet(pause); }
function pause() {
  return head('Pausa', `${G.P.name} · ${CLASSES[G.P.cls].n} · Día ${G.day}`) + `<div class="sh-body">
    ${row('Calidad gráfica', `Ahora: ${G.quality === 'low' ? 'rendimiento (sin sombras)' : 'alta (con sombras)'}`, '<button class="btn" data-a="quality">Cambiar</button>')}
    <div class="sec">Controles</div>
    <p class="note"><b>Mover:</b> joystick en la mitad izquierda · <b>Cámara:</b> arrastra en la mitad derecha<br>
    <b>Atacar:</b> toca; mantén para golpe cargado · <b>Rodar:</b> esquiva con invulnerabilidad<br>
    <b>Fijar:</b> centra la cámara en un enemigo · <b>Acción:</b> talar, recoger, beber, abrir<br>
    Teclado: WASD, flechas, Espacio, Mayús, E, F, Q, R, C, I.</p>
    <div class="m-actions" style="margin-top:12px"><button class="big" data-a="resume">Seguir jugando</button><button class="big alt" data-a="quit">Guardar y salir al menú</button></div></div>`;
}

/* ---------------- HUD ---------------- */
const bar = (id, v, max) => { $(id).style.width = Math.max(0, v / max * 100) + '%'; };
export function updateHud(dt) {
  const P = G.P;
  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    bar('#hpI', P.hp, P.maxHp); $('#hpv').textContent = Math.ceil(Math.max(0, P.hp));
    bar('#stI', P.stamina, 100);
    bar('#foodI', P.hunger, 100); bar('#waterI', P.thirst, 100);
    $('#tempI').style.left = `calc(${P.temp}% - 1px)`; $('#tempv').textContent = tempLabel(P.temp) + (P.wet > 5 ? ' · empapado' : '');
    $('#jade').textContent = P.jade;
    const hour = Math.floor(G.time * 24), min = Math.floor((G.time * 24 % 1) * 60);
    $('#clock').textContent = `Día ${G.day} · ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}${G.weather.rain > 0.4 ? ' · lluvia' : ''}`;
    const st = []; if (P.status.veneno > 0) st.push('<span class="st poison">Veneno</span>'); if (P.status.sangrado > 0) st.push('<span class="st bleed">Sangrado</span>');
    if (R.sprintT > 0) st.push('<span class="st buff">Esprint</span>'); if (R.doubleT > 0) st.push('<span class="st buff">Doble cosecha</span>'); if (R.powerHit) st.push('<span class="st buff">Golpe certero</span>');
    $('#statuses').innerHTML = st.join('');
    const obj = OBJECTIVES.find(o => !o.ok(G));
    $('#objective').innerHTML = obj ? `<b>Objetivo</b><br>${obj.t}` : '<b>¡Jungla completada!</b><br>Pronto, nuevos territorios';
    $('#btnAct').textContent = R.ctx ? R.ctx.label : '—'; $('#btnAct').classList.toggle('dim', !R.ctx || !R.ctx.type);
    $('#btnSkill').style.setProperty('--cd', Math.max(0, R.skillCd / 25));
    $('#btnLock').classList.toggle('on', !!R.lock);
    $('#btnWeapon').textContent = WEAPONS[P.weapon].n.split(' ')[0];
    // jefe
    const b = G.boss, bb = $('#bossbar');
    if (b && b.active && !b.dead) { bb.hidden = false; $('#bossI').style.width = (b.hp / b.maxHp * 100) + '%'; $('#bossPhase').textContent = `Fase ${b.phase}`; } else bb.hidden = true;
    const tg = $('#target');
    if (R.lock && R.lock !== b) { tg.hidden = false; tg.querySelector('span').textContent = R.lock.name; tg.querySelector('i').style.width = (R.lock.hp / R.lock.maxHp * 100) + '%'; } else tg.hidden = true;
    // aviso de vida baja
    document.body.classList.toggle('lowhp', P.hp < P.maxHp * 0.25);
  }
  miniT -= dt; if (miniT <= 0) { miniT = 0.25; drawMini(); }
}

function drawMini() {
  const cv = $('#mini'), g = cv.getContext('2d'), P = G.P, S = cv.width, scale = S / 70; // 70 unidades de radio visible ~ 35
  g.save(); g.fillStyle = '#0b0e11'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2); g.rotate(cam.yaw); g.translate(-P.x * scale, -P.z * scale);
  const k = WORLD.SIZE / minimapCanvas.width;
  g.imageSmoothingEnabled = false;
  g.drawImage(minimapCanvas, -WORLD.HALF * scale, -WORLD.HALF * scale, minimapCanvas.width * k * scale, minimapCanvas.height * k * scale);
  const dot = (x, z, col, r = 4) => { g.fillStyle = col; g.beginPath(); g.arc(x * scale, z * scale, r, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); };
  dot(STATION_POS.x, STATION_POS.z, '#4fbf7a', 6);
  dot(ARENA_POS.x, ARENA_POS.z, G.defeated ? '#777' : '#d4573b', 7);
  if (G.camp) dot(G.camp.x, G.camp.z, '#e2a440', 5);
  for (const c of G.creatures) if (!c.dead && (c.type !== 'pantera' || c.alpha > 0.5) && Math.hypot(c.x - P.x, c.z - P.z) < 30) dot(c.x, c.z, c.def.dmg ? '#e98c74' : '#c9b48a', 2.5);
  g.restore();
  // jugador (siempre arriba = hacia donde mira la cámara)
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  const vx = fx * c - fz * s, vy = fx * s + fz * c;
  g.save(); g.translate(S / 2, S / 2); g.rotate(Math.atan2(vx, -vy));
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.restore();
}
