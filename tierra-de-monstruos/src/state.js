// Estado compartido del juego. Pensado para serializarse (guardado) y,
// más adelante, sincronizarse en cooperativo: todo lo "de partida" vive aquí.
export const G = {
  scene: null, camera: null, renderer: null,
  mode: 'menu',          // 'menu' | 'play'
  paused: true,
  seed: 1,
  P: null,               // jugador
  creatures: [],
  boss: null,
  defeated: false,
  camp: null,            // {x,z,parts:{hoguera,refugio,mesa,empalizada}}
  time: 0.3,             // 0 medianoche, .25 amanecer, .5 mediodía, .75 atardecer
  day: 1,
  weather: { rain: 0, target: 0, t: 90 },
  camMode: 'third',
  look: { name: 'Pedro', cls: 'cazador', skin: '#e2b28b', outfit: '#b5523b' },
  stats: { gathered: 0, visited: false, kills: 0 },
  shake: 0,
  hitstop: 0,
};
export const isNight = () => G.time < 0.23 || G.time > 0.77;
