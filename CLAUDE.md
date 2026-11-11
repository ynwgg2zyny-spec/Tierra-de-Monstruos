# Tierra de Monstruos

Juego de supervivencia 3D low-poly en el navegador (Three.js 0.160 vía importmap, sin build). Pensado sobre todo para móvil/tablet (controles táctiles), también teclado.

## Visión (notas originales del autor)
Cinco territorios, cada uno con fauna, jefe y moneda propia: Desierto (Momia gigante), Montañas (Yeti), Lagos (Monstruo del Lago), Jungla (Gorila gigante), Cuevas (Murciélago gigante humanoide). Campamento nómada, 1ª/3ª persona, editor de personaje, clases, comprar/vender, clima. Objetivo: conectar los territorios con vías de tren. Multijugador cooperativo más adelante.

## Estado
- Capítulo 1 (Jungla) completo: combate (golpe rápido/cargado, rodar, fijar, arco), monos/panteras/tigres, Gorila con 3 fases, hambre/sed/temperatura/lluvia, 11 recetas, campamento (hoguera, refugio, mesa, empalizada), mercado con jade.
- Siguiente: ajustar según pruebas del autor en iPad; luego replicar el patrón en los otros biomas y las vías.

## Código
`src/`: data.js (todo el diseño: clases, armas, recetas, criaturas, tienda), world.js (terreno, vegetación instanciada, estación, ruinas), player.js, creatures.js, boss.js, combat.js, survival.js, crafting.js, ui.js, input.js, main.js, save.js (localStorage). `toon.js` = estilo cel-shading (material toon de 2 tonos + contornos de casco invertido: gruesos en criaturas/jefe, finos en árboles/rocas; cielo de caricatura en survival.js). `state.js` = estado compartido (pensado para sincronizar en cooperativo).

## Ejecutar y publicar
- Local: `node server.mjs` → http://localhost:8642 (el panel del navegador de la app no puede servir el Escritorio por sí mismo; lanzar el servidor desde Bash en segundo plano).
- Publicado en GitHub Pages desde `main`: https://ynwgg2zyny-spec.github.io/Tierra-de-Monstruos/
- Subir (commit + push) solo cuando el autor lo pida ("súbelo").
- El autor no es programador: explicar en español y con pasos sencillos.
