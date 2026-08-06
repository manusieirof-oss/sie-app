# Propuesta · objetivos medibles

**Nada de esto está construido.** Es para revisarlo antes.

## El problema

Los objetivos actuales no se pueden cerrar. "Ganar fuerza y control cervical" no dice cuándo
está cumplido, así que nadie lo cierra nunca y la lista de objetivos abiertos crece hasta
que se deja de mirar.

Falta lo mismo en los tres sitios: **qué se mide, en qué movimiento, en qué lado y contra
qué**. Sin eso el objetivo es una intención.

---

## Lo que ya trae tu lista

La nomenclatura del otro programa ya resuelve la mitad, confirmado contigo:

| | Significado |
|---|---|
| **M** | Movilidad |
| **F** | Fuerza |
| **=** | Igualar |
| **+** | Mejorar |

Así que `Rotación interna hombro F=` es *igualar la fuerza de rotación interna entre lados*.
Eso no es una etiqueta: es **métrica × tipo de meta**, que es exactamente el modelo. Se usa
ese vocabulario y no se inventa otro.

## Tres familias, no una

Solo la primera lleva número. Forzar un porcentaje a las otras dos sería inventarse una
precisión que no existe.

**1 · Métricos.** Los M/F. Unos 40 movimientos × 4 variantes ≈ 160 fichas hoy.

**2 · Por fases.** Suelo pélvico F1-F4, Recuperar funcionalidad del hombro F1-F4, Escoliosis
funcional F1-F3, Trocanteritis F1-F3, Escápula alada F1-F4. Lo medible aquí es **en qué fase
está**, y se avanza por criterio clínico, no por un número.

**3 · De aprendizaje.** "Aprender a hacer el puente de glúteo", "Disociar hombro-trapecio".
Se cumplen o no.

---

## El modelo

### La biblioteca guarda el ESPACIO, no la combinación

Una ficha por **articulación × métrica**, no por movimiento:

> Fuerza de hombro · Movilidad de hombro · Fuerza de cadera · Movilidad de rodilla…

Unas 20 fichas en vez de 160. Cada una lleva sus **etiquetas** —articulación, y músculo si
aplica— reutilizando el árbol que ya existe. Con eso la pestaña se filtra por zona y se puede
contar cuántos pacientes tienen objetivos abiertos de hombro, que hoy no se sabe.

### El paciente guarda las METAS

Al asignar el espacio a un paciente se añaden una o varias metas. Cada meta es:

| Campo | Ejemplo |
|---|---|
| Movimiento | Rotación interna |
| Lado | Derecho |
| Tipo | Mejorar · Igualar lados · Igualar con su antagonista |
| Valor inicial | 20 kg |
| Meta | +20%, o 25 kg |
| De dónde sale | Test "Hombro · fuerza", ítem "Rotación interna" |

**Un solo objetivo con varias metas, no un objetivo por movimiento.** Es lo que pediste para
no acabar con miles: si el hombro tiene mal la rotación interna y la externa pero bien la
flexión, es *un* objetivo de fuerza de hombro con *dos* metas.

### Los tres tipos de meta

**Mejorar** — contra el valor inicial del propio paciente. `20 kg → +20% = 24 kg`.

**Igualar lados** — contra el lado contrario en la misma medición. Se cumple cuando la
diferencia baja de un umbral, que por defecto pongo en el 10%.

**Igualar con el antagonista** — contra el movimiento opuesto. Flexión contra extensión de
rodilla, rotación interna contra externa de hombro. Necesita una tabla de parejas, igual que
la que ya usa el informe de volumen para empuje contra tracción.

### Cómo se cierra

**Automático, y a mano si hace falta**, como acordamos.

La meta guarda de qué test y de qué ítem sale. Al registrar ese test, si el valor alcanza el
objetivo la meta se marca cumplida sola. El objetivo se cierra cuando lo están todas.

Esto es lo que hace que el modelo valga: sin el enlace al ítem del test, el número es
decoración y se vuelve a decidir a ojo. **La pieza ya está medio hecha** —desde hace dos días
`items_resultado` guarda unidad y valor por ítem—, así que lo que falta es el enlace.

Se puede cerrar a mano igual, como ya funcionan las vías de los objetivos.

---

## Lo que hay que tocar

**Base de datos**
- `objetivos`: añadir `metrica` ('fuerza' | 'movilidad' | null), `articulacion_id`, `tipo`
  ('metrico' | 'fases' | 'aprendizaje'), `fases` (para los F1-F4).
- Tabla nueva `objetivos_metas`: la meta concreta de un paciente, con su movimiento, lado,
  tipo, valores y el enlace al ítem del test.
- `pacientes_objetivos`: añadir `fase_actual` para la familia 2.

**Árbol de etiquetas.** Faltan los movimientos finos. Hoy hay "Rotación" pero no **rotación
interna** ni **externa**, que son la mitad de tu lista de VALD. Van como hijas de Rotación, y
ahora se pueden crear desde la pestaña sin tocar código.

**Los objetivos que sembré.** Los diez actuales son de la familia 1 mal hechos: sin métrica,
sin movimiento y sin lado. Se sustituyen.

---

## Decisiones que quedan

**El umbral de "igualado".** Propongo 10% de diferencia entre lados. Es lo que se usa
habitualmente para dar el alta deportiva, pero es tu criterio, no el mío.

**Qué pasa si no hay valor inicial.** Un objetivo de "+20%" necesita un punto de partida. Si
se asigna antes de haber hecho el test, la meta queda pendiente de la primera medición y hay
que decirlo en la ficha en vez de mostrar un porcentaje sobre cero.

**Las fases, ¿una ficha por fase o una con cuatro?** Hoy las tienes como cuatro fichas
distintas. Con `fase_actual` sería una sola y se ve el progreso; con cuatro, el historial
queda más literal. Me inclino por una sola.

**Duplicado detectado:** "Flexión lateral cuello" y "Flexión lateral cervical" son lo mismo y
están las dos, con sus cuatro variantes cada una.
