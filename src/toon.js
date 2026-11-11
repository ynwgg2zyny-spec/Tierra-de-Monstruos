// Estilo "cel-shading": sombras en 2 tonos y contornos negros (técnica del casco invertido)
import * as THREE from 'three';

// Rampa de luz de 2 tonos: lado en sombra / lado iluminado
const ramp = new THREE.DataTexture(new Uint8Array([105, 255]), 2, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
export const TOON_RAMP = ramp;

const tmp = new THREE.Color();
// Material toon con colores algo más vivos
export function toonMat(color, extra = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap: ramp, ...extra });
  if (color !== undefined) { tmp.set(color); tmp.offsetHSL(0, 0.1, 0.02); m.color.copy(tmp); }
  m.flatShading = extra.flatShading ?? true;
  return m;
}

// Grosor de contorno (en metros, cerca de la cámara)
export const OUTLINE = { thick: 0.045, boss: 0.07, fine: 0.022 };
const INK = new THREE.Color('#15100c');

const VS = /* glsl */`
attribute vec3 oNormal;
uniform float thickness;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec3 p = position; vec3 n = oNormal;
  #ifdef USE_INSTANCING
    p = (instanceMatrix * vec4(p, 1.0)).xyz; n = mat3(instanceMatrix) * n;
  #endif
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vec3 vn = normalize(normalMatrix * n);
  mvPosition.xyz += vn * thickness * clamp(-mvPosition.z * 0.07, 1.0, 3.5);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FS = /* glsl */`
uniform vec3 color; uniform float opacity;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(color, opacity);
  #include <fog_fragment>
}`;

const shared = new Map();
export function outlineMat(thickness, own = false) {
  if (!own && shared.has(thickness)) return shared.get(thickness);
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { thickness: { value: thickness }, color: { value: INK.clone() }, opacity: { value: 1 } }]),
    vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, fog: true,
  });
  if (!own) shared.set(thickness, m);
  return m;
}

// Normales "suavizadas" (promedio por posición) para que el contorno no se abra en las esquinas
function prepGeo(geo) {
  if (geo.attributes.oNormal) return;
  const pos = geo.attributes.position, nor = geo.attributes.normal, map = new Map(), out = new Float32Array(pos.count * 3);
  const k = i => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
  for (let i = 0; i < pos.count; i++) {
    const key = k(i); let a = map.get(key); if (!a) map.set(key, a = [0, 0, 0]);
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(k(i)), l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('oNormal', new THREE.BufferAttribute(out, 3));
}

// Añade contorno a todas las piezas toon de un modelo. Devuelve el material usado.
export function addOutline(root, thickness = OUTLINE.thick, own = false) {
  const om = outlineMat(thickness, own), list = [];
  root.traverse(o => { if (o.isMesh && !o.userData.isOutline && o.material?.isMeshToonMaterial) list.push(o); });
  for (const me of list) {
    prepGeo(me.geometry);
    const ol = new THREE.Mesh(me.geometry, om);
    ol.userData.isOutline = true; ol.castShadow = false; ol.receiveShadow = false; ol.raycast = () => {};
    me.add(ol);
  }
  return om;
}

// Contorno para vegetación instanciada (comparte las posiciones de cada copia)
export function instancedOutline(im, thickness = OUTLINE.fine) {
  prepGeo(im.geometry);
  const ol = new THREE.InstancedMesh(im.geometry, outlineMat(thickness), im.instanceMatrix.count);
  ol.instanceMatrix = im.instanceMatrix; ol.frustumCulled = im.frustumCulled; ol.castShadow = false;
  return ol;
}
