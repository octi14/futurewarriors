# Future Warriors — Arquitectura

Documento maestro del proyecto. **Solo Fase 0 está implementada.** Fases 1+ son especificación futura; se revisan tras playtest.

## Visión

MMO de mundo terrestre gigante (escala jugable candidata `WORLD_SCALE = 1/4`), persistente, con PvP como foco social, ítems procedurales casi infinitos (solo utilidad combate/locomoción/vitales), economía P2P, transporte avión/barco, voz por proximidad, amigos y banca (TBD).

No confundir: geografía física, representación visual, metros de juego, tiempos de viaje.

## Infra actual

- Sin servidores de juego en la nube.
- Todo en `localhost`.
- MongoDB Atlas opcional (aún no cableado en Fase 0).

## Stack Fase 0

- Vite + Three.js + TypeScript
- Cámara isométrica
- `src/sim/` = estado/combate/IA/inventario (desacoplado del render)
- `src/render/` = Three.js + HUD
- `src/shared/` = tipos + generador determinista de espadas por seed

## Fase 0 (implementada)

Mini mapa, 1 jugador, IA chase/attack, melee con stats de arma (reach/speed/damage), loot de espadas procedurales, inventario + equipar.

## Fases futuras (no codear hasta review-gate)

1. Chunks + multiplayer localhost autoritativo + más ítems + trade P2P
2. Transporte `Trip` avión/barco con timestamps
3. Amigos + voz proximidad
4. Geo terrestre + densidad + banca cuando esté diseñada
5. Escala CCU / sharding / LOD

Ver plan completo en Cursor: `mmo_planeta_fases`.
