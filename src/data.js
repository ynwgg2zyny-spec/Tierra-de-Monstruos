// Datos de diseño: clases, armas, recursos, recetas, criaturas, tienda
export const WORLD = { SIZE: 260, HALF: 130, LIMIT: 116, WATER_Y: -0.9 };
export const STATION_POS = { x: -78, z: 66 };
export const ARENA_POS = { x: 82, z: -72 };
export const DAY_LEN = 420; // segundos por día completo
export const SAVE_KEY = 'tdm3d-v1';

export const CLASSES = {
  cazador: { n: 'Cazador', d: '+30 % de daño. Las presas sueltan más jade.', dmg: 1.3, spd: 1, hp: 100, need: 1, yield: 0, skill: 'Golpe certero', sd: 'El siguiente golpe hace triple daño.', hat: '#6b4a2b', weapon: 'arco' },
  explorador: { n: 'Explorador', d: '+20 % de velocidad y gasta menos energía al esquivar.', dmg: 1, spd: 1.2, hp: 100, need: 1, yield: 0, skill: 'Esprint', sd: 'Corre muy rápido durante 4 s.', hat: '#c9a46a', weapon: 'hacha' },
  ingeniero: { n: 'Ingeniero', d: 'Recoge +1 de cada recurso. Fabricar cuesta menos.', dmg: 1, spd: 1, hp: 100, need: 1, yield: 1, skill: 'Doble cosecha', sd: 'Recoge el doble durante 12 s.', hat: '#e8c33a', weapon: 'pala' },
  superviviente: { n: 'Superviviente', d: '130 de vida, menos hambre y sed, resiste el veneno.', dmg: 1, spd: 1, hp: 130, need: 0.7, yield: 0, skill: 'Segundo aliento', sd: 'Recupera 40 de vida y cura estados.', hat: '#c4473a', weapon: 'lanza' },
};
export const SKINS = ['#f3d5b5', '#e2b28b', '#c68a5e', '#9b6541', '#6c4529', '#4a2e1c'];
export const OUTFITS = ['#b5523b', '#3f6e8c', '#5d7d3a', '#8a5aa8', '#d29a2e', '#41474d'];

export const WEAPONS = {
  punos: { n: 'Puños', dmg: 5, reach: 1.7, cd: 0.38, color: null },
  garrote: { n: 'Garrote', dmg: 10, reach: 2.1, cd: 0.5, color: '#7a5230' },
  hacha: { n: 'Hacha', dmg: 12, reach: 2.2, cd: 0.5, color: '#8d8d86' },
  pala: { n: 'Pala', dmg: 11, reach: 2.4, cd: 0.48, color: '#7d868c' },
  lanza: { n: 'Lanza', dmg: 13, reach: 2.9, cd: 0.55, color: '#a07a48' },
  machete: { n: 'Machete de obsidiana', dmg: 19, reach: 2.2, cd: 0.42, color: '#2a2233', bleed: true },
  arco: { n: 'Arco', dmg: 15, reach: 30, cd: 0.6, color: '#8a5a2b', ranged: true },
};

export const RES = {
  madera: 'Madera', piedra: 'Piedra', liana: 'Liana', fibra: 'Fibra', hierba: 'Hierba medicinal',
  obsidiana: 'Obsidiana', fruta: 'Fruta', carne: 'Carne cruda', asada: 'Carne asada', piel: 'Piel',
  venda: 'Venda', antidoto: 'Antídoto', botiquin: 'Botiquín', flechas: 'Flechas', colmillo: 'Colmillo de Gorila',
};

// cost: recursos; out: lo que da; need: 'mesa' | 'hoguera' (estructura del campamento cercana)
export const RECIPES = [
  { id: 'hacha', n: 'Hacha de piedra', d: 'Herramienta: doble de madera al talar.', cost: { madera: 3, piedra: 2, liana: 1 }, tool: 'hacha' },
  { id: 'pico', n: 'Pico de piedra', d: 'Herramienta: doble de piedra y permite extraer obsidiana.', cost: { madera: 3, piedra: 3, liana: 1 }, tool: 'pico' },
  { id: 'garrote', n: 'Garrote', d: 'Arma · daño 10.', cost: { madera: 4 }, weapon: 'garrote' },
  { id: 'lanza', n: 'Lanza', d: 'Arma · daño 13 · gran alcance.', cost: { madera: 3, piedra: 1, liana: 2 }, weapon: 'lanza' },
  { id: 'arco', n: 'Arco', d: 'Arma a distancia · daño 15. Usa flechas.', cost: { madera: 4, liana: 3, fibra: 3 }, weapon: 'arco', need: 'mesa' },
  { id: 'flechas', n: 'Flechas ×6', d: 'Munición para el arco.', cost: { madera: 2, piedra: 1, fibra: 2 }, give: { flechas: 6 } },
  { id: 'machete', n: 'Machete de obsidiana', d: 'Arma · daño 19 · provoca sangrado.', cost: { madera: 2, obsidiana: 4, liana: 2 }, weapon: 'machete', need: 'mesa' },
  { id: 'venda', n: 'Venda', d: 'Recupera 20 de vida y detiene el sangrado.', cost: { fibra: 3 }, give: { venda: 1 } },
  { id: 'antidoto', n: 'Antídoto', d: 'Cura el veneno.', cost: { hierba: 3, fruta: 1 }, give: { antidoto: 1 }, need: 'hoguera' },
  { id: 'cantimplora', n: 'Cantimplora', d: 'Guarda 3 tragos de agua. Se llena en el río o con lluvia.', cost: { piel: 1, liana: 1 }, item: 'cantimplora' },
  { id: 'antorcha', n: 'Antorcha', d: 'Ilumina a tu alrededor y aleja a las panteras.', cost: { madera: 1, fibra: 2 }, item: 'antorcha' },
];

export const STRUCTS = [
  { id: 'hoguera', n: 'Hoguera', d: 'Crea tu campamento aquí. Cura, calienta, asa carne y ahuyenta animales.', cost: { madera: 5, piedra: 3 } },
  { id: 'refugio', n: 'Refugio de hojas', d: 'Te protege de la lluvia. Permite dormir hasta el amanecer.', cost: { madera: 8, fibra: 6, liana: 3 } },
  { id: 'mesa', n: 'Mesa de trabajo', d: 'Desbloquea arco y machete.', cost: { madera: 6, piedra: 4 } },
  { id: 'empalizada', n: 'Empalizada', d: 'Ningún animal entra en el campamento.', cost: { madera: 14, liana: 5 } },
];

export const CREATURES = {
  mono: { n: 'Mono', hp: 18, dmg: 0, spd: 4.4, beh: 'thief', r: 0.45, drops: { carne: 1 }, jade: [1, 2], color: '#7a5233', face: '#d9b48a' },
  monoFurioso: { n: 'Mono furioso', hp: 16, dmg: 5, spd: 5, beh: 'aggr', r: 0.45, drops: {}, jade: [0, 1], color: '#5b3a22', face: '#e08a6a', windup: 0.35, range: 1.5 },
  pantera: { n: 'Pantera', hp: 45, dmg: 11, spd: 5.3, beh: 'stalker', r: 0.6, drops: { carne: 2, piel: 1 }, jade: [2, 4], color: '#1c1c22', windup: 0.5, range: 2 },
  tigre: { n: 'Tigre', hp: 85, dmg: 16, spd: 4.7, beh: 'terr', r: 0.75, drops: { carne: 3, piel: 2 }, jade: [4, 6], color: '#d9822b', windup: 0.45, range: 2.3, bleed: true },
};

export const BOSS = { n: 'Gorila gigante', hp: 900, dmg: 22 };

export const SHOP = [
  { id: 'botiquin', n: 'Botiquín', d: 'Recupera 50 de vida.', price: 8, give: { botiquin: 1 } },
  { id: 'flechas', n: 'Flechas ×10', d: 'Munición.', price: 6, give: { flechas: 10 } },
  { id: 'antidoto', n: 'Antídoto', d: 'Cura el veneno.', price: 6, give: { antidoto: 1 } },
  { id: 'carne', n: 'Carne asada ×2', d: 'Comida lista.', price: 4, give: { asada: 2 } },
  { id: 'arco', n: 'Arco', d: 'Arma a distancia.', price: 20, weapon: 'arco' },
  { id: 'cantimplora', n: 'Cantimplora', d: 'Lleva agua contigo.', price: 6, item: 'cantimplora' },
];
export const SELL = [['madera', 4, 1], ['piedra', 4, 1], ['fibra', 4, 1], ['fruta', 3, 1], ['carne', 1, 1], ['piel', 1, 3], ['obsidiana', 1, 3]];

export const OBJECTIVES = [
  { t: 'Recoge madera y piedra', ok: g => g.stats.gathered >= 6 },
  { t: 'Fabrica un hacha (Mochila › Fabricar)', ok: g => g.P.tools.hacha },
  { t: 'Monta una hoguera para tu campamento', ok: g => !!g.camp },
  { t: 'Visita la estación de la Jungla', ok: g => g.stats.visited },
  { t: 'Fabrica o compra un arma', ok: g => g.P.weapons.length > 1 },
  { t: 'Derrota al Gorila gigante en las ruinas', ok: g => g.defeated },
];
