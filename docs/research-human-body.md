# Investigación: cuerpo humano simple (Fase 0)

Fecha: 2026-11-18

## Conclusión

Las **metaballs / Marching Cubes** no son el método correcto para un humano jugable:
- Generan “triangle soup” sin edge loops → mala deformación y silueta blanda.
- Fusionan todo (webbing entre piernas/brazos); Spore las usó para *criaturas*, no anatomía limpia.
- Alternativa recomendada en papers/prácticas: **esqueleto + cápsulas/loft (estilo B-Mesh / Skin Modifier)** o **blockout de primitivas** con proporciones fijas.

## Método simple que sí se usa

1. **Proporciones primero** (cánon ~7.5–8 cabezas, altura ~1.7–1.8 m).
2. **Blockout** con cubos/cápsulas/esferas (torso, cabeza, brazos, piernas).
3. Joints claros (hombro, codo, cadera, rodilla, tobillo).
4. Cara: landmarks (ojos a media cabeza, nariz, boca) en un cráneo con **profundidad**, no planchas.

Fuentes: tutoriales low-poly game-ready (blockout → loops), guías 8-head, research Spore vs B-Mesh (metaballs = robustez topológica, mala topología final).

## Decisión práctica (2026-11-18)

Un humano creíble **no se improvisa con primitivas/IA de código** en un rato.
Fase 0 usa mesh skinned CC0: `public/models/HumanMale.glb` (Quaternius Smooth Male)
+ MeshoptDecoder, clips Man_Idle / Man_Walk / Man_SwordSlash.

`playerBody.ts` queda como experimento procedural descartado para el héroe jugable.
