# Notas del usuario para tener en cuenta


# Cosas a incorporar sí o si

- Más armas: bate de béisbol, palo de madera, caño de metal, gancho tipo half life, gomera, boleadora, nunchaku, etc.
- Más animaciones de ataque y mejor realizadas.
- Que realmente se note el material de cada armadura. actualmente tenemos metalness, roughness y texturas, lo que hace que haya diversidad y se noten un poco los materiales, pero se necesita crear más materiales: malla de cadenas, cuero, pulóver tejido, etc.
- mejoras en la ux, sobre todo los menúes: menú de personaje debe dar más información (bonus totales a daño, desagregado por elemento también, bonus a velocidad, puntos que se compraron de cada stat)
- tipo de item por nivel de rareza: no tiene sentido que una armadura de malla pueda ser común y tener la misma frecuencia que un buzo o una remera. lo mismo pasa en todos los items. debemos armar un esquema acorde para que los items que en la vida real ofrecen menor protección y bonus aparezcan en un rango bajo de rareza, y no más arriba, y que lo más valioso solo caiga a partir de cierto nivel de rareza.


# Cosas a modificar:

- animación de running: menos zancada, no llevar los codos hacia adentro del cuerpo.
- animación de tirar arco: actualmente parece que tira la flecha con la mano.
- Arreglar un salto que existe en la cámara cuando se realiza el ataque especial.
- límites de velocidad: con varios bonus acumulados, la velocidad es excesiva.
- aceleración de los fotogramas de la animación de correr según el bonus. lo mismo para caminar. que empiecen desde más lento ambos.
- valores de los bonus: actualmente los bonus son multiplicadores (velocidad x1.04, etc), lo que hace que se acumulen y termine siendo monstruoso. lo que se tiene que hacer es colocarlos por porcentaje (velocidad +4%), pero además no se multiplicarían en fila. es decir, si una armadura da velocidad +4% y un anillo da +1%, cada porcentaje no se aplica a un subtotal (es decir, no haríamos velocidad * 1.04 * 1.01), sino que sumaríamos primero los porcentajes y recién ahí multiplicaríamos (haríamos velocidad * 1.05).
- lo mismo con los valores de daño elemental: daño de fuego +2%, etc.
- mejorar las animaciones de daño elemental