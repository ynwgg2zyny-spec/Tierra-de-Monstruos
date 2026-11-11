// Entrada: joystick táctil (mitad izquierda), arrastre de cámara (mitad derecha),
// botones HTML con data-btn, y teclado/ratón como alternativa.
export const input = { mx: 0, mz: 0, lookX: 0, lookY: 0, atk: false, act: false, taps: new Set() };
const keys = {};
let joy = null, look = null;

export const took = name => { if (input.taps.has(name)) { input.taps.delete(name); return true; } return false; };

export function initInput(canvas) {
  const base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const left = e.clientX < window.innerWidth * 0.45 && e.pointerType !== 'mouse';
    if (left && !joy) {
      joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      base.hidden = false; base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
      knob.style.transform = 'translate(-50%,-50%)';
    } else if (!look) look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (joy && e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), R = 56;
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      input.mx = dx / R; input.mz = dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (look && e.pointerId === look.id) {
      input.lookX += e.clientX - look.x; input.lookY += e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
    }
  });
  const end = e => {
    if (joy && e.pointerId === joy.id) { joy = null; input.mx = input.mz = 0; base.hidden = true; }
    if (look && e.pointerId === look.id) look = null;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  // Botones de pantalla
  document.querySelectorAll('[data-btn]').forEach(b => {
    const name = b.dataset.btn;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); b.classList.add('on');
      if (name === 'atk') input.atk = true; else if (name === 'act') { input.act = true; input.taps.add('act'); } else input.taps.add(name);
    });
    const up = () => { b.classList.remove('on'); if (name === 'atk' && input.atk) { input.atk = false; input.taps.add('atkUp'); } if (name === 'act') input.act = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  // Teclado
  const map = { ShiftLeft: 'dodge', KeyF: 'skill', KeyQ: 'lock', KeyR: 'weapon', KeyC: 'cam', KeyI: 'bag', KeyB: 'bag', KeyT: 'eat', Escape: 'menu' };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (keys[e.code]) return; keys[e.code] = true;
    if (e.code === 'Space') { input.atk = true; e.preventDefault(); }
    if (e.code === 'KeyE') { input.act = true; input.taps.add('act'); }
    if (map[e.code]) input.taps.add(map[e.code]);
    updKeys();
  });
  addEventListener('keyup', e => {
    keys[e.code] = false;
    if (e.code === 'Space' && input.atk) { input.atk = false; input.taps.add('atkUp'); }
    if (e.code === 'KeyE') input.act = false;
    updKeys();
  });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.atk = false; input.act = false; updKeys(); });
}
function updKeys() {
  if (joy) return;
  input.mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  input.mz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
  const l = Math.hypot(input.mx, input.mz); if (l > 1) { input.mx /= l; input.mz /= l; }
}
export function keyLook(dt) { // flechas para girar cámara
  if (keys.ArrowLeft) input.lookX -= 300 * dt; if (keys.ArrowRight) input.lookX += 300 * dt;
  if (keys.ArrowUp) input.lookY -= 200 * dt; if (keys.ArrowDown) input.lookY += 200 * dt;
}
export function resetInput() { joy = null; look = null; input.mx = input.mz = 0; input.atk = input.act = false; input.taps.clear(); const b = document.getElementById('joyBase'); if (b) b.hidden = true; }
