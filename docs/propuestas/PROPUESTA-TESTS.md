# Propuesta · catálogo de tests

Mapa de las ~80 entradas del otro programa a la estructura de la app. **Nada de esto está
sembrado todavía**: es para revisarlo antes.

## El criterio

Su programa modela cada maniobra como un test independiente. Aquí un test tiene **ítems**, y
la lógica (`cualquiera` / `todos`) decide si el conjunto sale positivo.

Se agrupa **por estructura explorada**, no por región anatómica a secas. "Rodilla" no es un
test: son cinco, porque una rótula que roza y un menisco que duele en la interlínea no abren
el mismo objetivo ni se entrenan igual. Agrupar por región daría un test enorme cuyo positivo
no diría nada; dejarlos sueltos daría ochenta fichas y ochenta fechas de revisión.

La **unidad va por ítem**: en el mismo test conviven una casilla de sí/no y un número en
grados, centímetros o kilos.

---

## Tobillo y pie · 12 entradas → 4 tests

**Tobillo · dorsiflexión (lunge)** — *ya existe, se amplía*
Hoy tiene un solo ítem en cm. Tu lista trae las tres variantes, que no son lo mismo: con la
rodilla en el suelo se quita el gastrocnemio de la ecuación y queda el sóleo solo, y con alza
se ve si el problema es de longitud o de tope articular.
- En bipedestación · cm — En el suelo · cm — Con alza · cm
- El talón se levanta antes de tocar — La rodilla se desvía hacia dentro

**Tobillo · pronación y supinación**
- Movilidad de pronación · grados — Movilidad de supinación · grados
- No resiste la supinación forzada

**Tobillo y pie · fuerza**
- Pronación · kg — Supinación · kg — Flexión · kg — Dedos del pie · kg

**Pie · test de Jack**
- El arco no se forma al extender el dedo gordo — Dolor en la fascia al extender

Sin ubicar: **"Tobillo - fuera de extensión"** (nº 131). No sé qué explora.

---

## Rodilla · 31 entradas → 6 tests

Es donde más se nota el agrupado: de treinta y una maniobras a seis fichas.

**Rodilla · rótula**
Fondo de saco suprarrotuliano aumentado · Cambios de temperatura o rugosidades · Choque
rotuliano · Roce rotuliano · Dolor en polo superior (cuadricipital) · Dolor en polo inferior
(rotuliano) · Zohlen · Signo de aprensión · Rótula desplazada

**Rodilla · meniscos**
Dolor en interlínea medial · Dolor en interlínea intermedia · Dolor en interlínea lateral ·
McMurray medial · McMurray lateral · Apley en compresión

**Rodilla · ligamentos**
Valgo forzado (LLI) · Varo forzado (LLE) · Dolor en ligamento interno · Cajón anterior ·
Cajón posterior · Apley en tracción

**Rodilla · movilidad**
Flexión · grados — Extensión · grados — Dolor al apoyar sobre la rodilla

**Rodilla · inserciones y sobrecarga**
Pata de ganso · Cóndilo femoral lateral · Sobrecarga de cuádriceps

**Rodilla · fuerza**
Cuádriceps · kg — Isquiotibial · kg

Absorbido: **"Rodilla - ligamentos y meniscos"** (nº 135) parece el grupo, no una maniobra.
Sin ubicar: **"Rodilla - Información - rótula"** (nº 130), suena a campo de notas.
Corregido: **"Cadera - Interlíneas mediales de la rodilla"** (nº 13) está en cadera pero
explora rodilla; va a meniscos.

---

## Cadera · 10 entradas → 2 tests nuevos

Ya existen **Thomas** y **Ober**, que cubren los flexores y el tensor de la fascia lata con
sus ítems propios. Lo demás:

**Cadera · movilidad**
Straight leg raise · grados — Movilidad abductora · grados — Rotación interna · grados —
Rotación externa · grados — Bloqueo de cadera

**Cadera · fuerza**
Glúteo · kg — Abductor · kg — Aductor · kg — Psoas · kg

---

## Tronco y lumbar · 9 entradas → 4 tests

**Lumbar · Schober**
Flexión · cm — Extensión · cm
*(Se mide el incremento sobre los 10 cm marcados; menos de 5 cm en flexión es restricción.)*

**Dorsal · OTT**
Flexión · cm — Extensión · cm

**Tronco · simetría y control**
Inclinación lateral asimétrica · Control motor y fascias de espalda
*Este segundo lo dejo tal cual porque no sé qué criterio usas para darlo por positivo.*

**Tronco · fuerza**
Abdominal · Sahrmann (nivel alcanzado, 1-5) · Lumbar · segundos

---

## Cervical · 11 entradas → 3 tests

**Cervical · movilidad y función**
Rotación · grados — Función cervical — Bloqueo cervical

**Cervical · provocación**
Soto-Hall: dolor en nuca · Soto-Hall: tirantez · O'Donoghue: manipulación de cabeza ·
O'Donoghue: manipulación contrariada · Daño cervical

**Cervical · fuerza y control**
Fuerza · kg — Control motor cervical

Pendiente de ti: **"Shoto-Hall"** creo que es **Soto-Hall** y **"O Don"** creo que es
**O'Donoghue**; confírmalo. Y **"Presión arterial en cervical"** (nº 65) no lo conozco: si es
el test de arteria vertebral, va aparte y con aviso, porque un positivo ahí no abre un
objetivo de entrenamiento, es una derivación.

---

## Hombro · 1 entrada

**"Fuerza - Hombro y movilidad"** (nº 67) se reparte: la fuerza en kg va como ítem nuevo del
test de pinzamiento que ya existe, y la movilidad ya la cubre "mano a la espalda".

---

## Patrones · 2 entradas

Ya existe **Sentadilla profunda con brazos arriba** (nº 69). Nuevo:

**Sentadilla unipodal**
Profundidad alcanzada · cm — La rodilla cae hacia dentro — Pierde el equilibrio — La cadera
desciende del lado libre (Trendelenburg)

---

## Senior Fitness Test · 1 entrada

Ya existe el **sentarse-levantarse en 30 s**, que es una de sus seis pruebas. La batería
completa daría un test con seis ítems medidos: flexión de codo · reps, sentarse y alcanzar ·
cm, juntar las manos tras la espalda · cm, levantarse y caminar 2,4 m · segundos, y 2 minutos
de marcha en el sitio · pasos.

**Decidir:** ¿la batería entera como un test, o dejar el sentarse-levantarse suelto como está?
Como batería se compara con los baremos por edad, que es su gracia; suelto se hace en un
minuto sin montar la sesión de valoración entera.

---

## Lo que falta

La lista viene cortada: empieza en el 6 y salta del 71 al 124 y del 136 al 154. **Faltan unos
setenta números por el medio** — es de suponer que hombro, codo, muñeca y buena parte de
columna, que están claramente infrarrepresentados aquí.
