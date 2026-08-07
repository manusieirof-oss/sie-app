# Valorar y entrenar a alguien que ha tenido un ictus

Propuesta completa: etiquetas, tests, objetivos, ejercicios y sesiones. Ya está todo
escrito en las semillas. Falta pasarlas y decidir tres cosas que son tuyas.

---

## Lo primero, porque cambia el resto

**La app no tenía nada de neurología.** El árbol de etiquetas tiene 21 patologías y las 21
son musculoesqueléticas. Los 113 ejercicios dan por hecho a alguien que se pone de pie
solo y que puede repetir el gesto que se le enseña. Los 49 tests buscan una estructura que
duele.

Tras un ictus el músculo puede estar entero y no responder. Eso no es "un test más": es un
tipo de paciente que la app no sabía representar. Por eso esto toca las cinco semillas y no
una.

**Segundo aviso, y este es de encargo, no de programación.** Parte de lo que se recoge en
la primera visita no se entrena: se deriva. Atragantarse con líquidos, una crisis
epiléptica reciente o una tensión sin control médico no son datos de contexto, son motivo
de parar. El test de cribado está montado para que eso salte antes de tocar nada, y **no
abre ningún objetivo a propósito** — el mismo criterio que ya usábamos con los meniscos:
colgarle un objetivo haría que la ficha propusiera entrenar una disfagia.

---

## 1. Etiquetas nuevas — 5

Categoría `patologia`, todas a nivel raíz:

    Ictus · Hemiparesia · Espasticidad · Riesgo de caída · Subluxación de hombro

Van sueltas y no colgando de "Ictus" a propósito. La hemiparesia, la espasticidad y el
riesgo de caída también vienen de un traumatismo, de una esclerosis o simplemente de la
edad. Colgarlas del ictus obligaría a duplicarlas el día que entre el primer Parkinson.

"Riesgo de caída" no es un diagnóstico, pero es la etiqueta que hace falta para que un test
positivo pueda desaconsejar los saltos y el equilibrio sin apoyo.

Las crea el **sembrador de objetivos**, igual que ya creaba los movimientos que faltaban.

---

## 2. Tests nuevos — 6

Ninguno mide una articulación. Eso ya lo hacen los 20 tests de medición que tienes, y son
justo los que alimentan las metas de **igualar lados**, que es literalmente el problema de
una hemiparesia. Estos seis miden **lo que la persona consigue hacer**.

Son escalas conocidas, no inventadas para la ocasión: tienen puntos de corte publicados y,
sobre todo, las entiende cualquier fisio o neurólogo al que haya que mandarle un informe.

| Test | Lado | Qué aporta |
|---|---|---|
| **Ictus · cribado inicial** | bilateral | 15 ítems. Hemicuerpo afecto, negligencia, campo visual, disfagia, sensibilidad, hombro, anticoagulación, caídas. **No abre objetivos.** |
| **Ashworth modificada · espasticidad** | lateral | 6 grupos musculares, 0 a 4. El 1+ se anota 1,5. |
| **Berg · equilibrio** | bilateral | Las 14 tareas + el total sobre 56. Menos de 45, riesgo de caída. |
| **Marcha · velocidad, giro y resistencia** | bilateral | 10 metros, Timed up and go, 5 sentadas, 6 minutos. |
| **Miembro superior · función tras ictus** | lateral | Bloques, agarre, alcance, y qué gestos consigue. Se pasa en los dos lados: el sano da la referencia. |
| **Control de tronco y transferencias** | bilateral | Voltear, incorporarse, sentarse al borde, levantarse. Dice si la sesión se hace en camilla o de pie. |

### Puntos de corte que conviene tener a mano

- **10 metros:** por debajo de 0,4 m/s solo anda por casa · 0,4 a 0,8 sale acompañado ·
  por encima de 0,8 anda por la calle.
- **Timed up and go:** por encima de 13,5 s, riesgo de caída.
- **Berg:** menos de 45 riesgo de caída · menos de 20, marcha de silla.

### Etiquetas que desaconsejan

Estos tests **sí traen `etiquetas_bloquea` rellenas**, y son los primeros que lo hacen. Los
49 anteriores lo tenían vacío, así que el aviso no saltaba nunca.

- Cribado y Berg positivos → desaconsejan **Salto, Unipodal, Bosu, Barra, Kettlebell,
  Barra de dominadas**.
- Ashworth positivo → desaconseja **Salto**.

Se avisa, no se impide, como siempre.

---

## 3. Objetivos nuevos — 5

**Dos por fases**, y separados a propósito: avanzan a velocidades muy distintas y casi
nunca a la vez. Lo normal es alguien que ya camina por la calle y sigue sin poder abrir la
mano. Con un solo objetivo por fases habría que elegir cuál de las dos verdades se enseña.

**Recuperar la marcha tras el ictus** — 5 fases

    Control de tronco y sedestación → Bipedestación y transferencias → Marcha asistida
    → Marcha autónoma en interior → Marcha en comunidad y escaleras

**Recuperar el miembro superior tras el ictus** — 5 fases

    Movilidad pasiva y cuidado del hombro → Movimiento activo asistido
    → Movimiento activo contra gravedad → Agarre y manipulación → Uso en tareas cotidianas

La primera fase del brazo **no entrena**: protege el hombro y mantiene el recorrido. Una
vez que el hombro duele, se acabó la rehabilitación del brazo.

**Tres cualitativos**

- *Aprender las transferencias con seguridad* — es lo que decide si vive solo.
- *Usar el lado afecto en el día a día* — contra el no-uso aprendido: si el brazo cuesta se
  deja de usar, y el que no se usa pierde más.
- *Cuidar el hombro del lado afecto* — con el deltoides sin tono, el peso del brazo separa
  la cabeza humeral.

**Métricos: no hay ninguno nuevo.** Se usan los 20 espacios que ya existen (Hombro·fuerza,
Cadera·fuerza, Tobillo·movilidad…) con metas de tipo **igualar lados**. Para eso se diseñó
ese tipo de meta y este es el paciente que lo justifica.

---

## 4. Ejercicios nuevos — 13

Los 113 que había no cubren la mitad de lo que hay que entrenar aquí, porque nadie sano
necesita entrenar voltearse en la cama.

    Volteo en la camilla
    Incorporarse a sentado
    Sedestación al borde de la camilla
    Alcance funcional sentado
    Traslado de peso en bipedestación
    Levantarse y sentarse con apoyo
    Paso lateral con apoyo
    Subir y bajar un escalón con barandilla
    Marcha con obstáculos y giros
    Autoasistido de hombro con bastón
    Deslizamiento de la mano sobre la mesa
    Agarrar y soltar objetos
    Estiramiento mantenido de muñeca y dedos

Todos con descripción, criterios de ejecución, feedbacks, etiquetas y variantes (43 en
total). **Sin imagen**: los nombres de archivo ya están puestos, así que en cuanto tengas
las fotos se sueltan en la carpeta con ese nombre y aparecen solas.

Casi todos van medidos **en tiempo** aunque se cuenten repeticiones. La dosis aquí no la
pone el peso: la pone cuánto rato sale el gesto antes de empezar a salir compensado.

---

## 5. Sesiones nuevas — 2

**Ictus · control de tronco y transferencias** — la primera. Se hace en camilla y en una
silla. Cuatro partes: cuidado del hombro, tronco en camilla, sentado, de pie.

**Ictus · marcha y miembro superior** — para quien ya se pone de pie solo. La pierna se
entrena andando y subiendo, no en máquina, porque lo que falla no es la fuerza sino el
control. El bloque de brazo va **al final a propósito**: es el que más se abandona y el
primero que se cae cuando falta tiempo, así que si se cae, que se caiga habiéndolo hecho.

---

## 6. Un fallo que salió por el camino, y ya está arreglado

`mejorar` solo sabía subir: comparaba siempre `actual >= objetivo`.

Con eso, **ninguna** de las medidas de este paciente podía tener meta. El Timed up and go,
los 10 metros, el Ashworth y cualquier escala de dolor mejoran **bajando**. Una meta de
"bajar el TUG de 22 a 14 segundos" se quedaba abierta para siempre por muy bien que fuera,
y la barra de progreso marcaba cero.

Ahora el sentido sale de comparar el objetivo con el punto de partida: si la meta está por
debajo de donde empezó, se baja. No hace falta preguntarlo ni guardarlo en una columna —
eso sería una segunda verdad que podría contradecir a los dos números.

Comprobado con ocho casos, subiendo y bajando, incluida la barra de progreso.

**Unidades nuevas:** `puntos`, `metros` y `meses`. Sin ellas habría que anotar un Ashworth
en "repeticiones", que no es un apaño: es un dato falso que luego se pinta como "3 reps" en
el historial.

---

## Lo que tienes que decidir tú

**1. El umbral de igualdad del 10%.** Está en código (`lib/metas.ts`, `UMBRAL_IGUALDAD`) y
vale para todos. En una hemiparesia el lado afecto puede estar al 40% del sano: pedirle un
10% de diferencia no es una meta, es una meta imposible durante el primer año, y un
objetivo que no se puede cerrar es exactamente lo que criticaste del modelo antiguo.

Las opciones: dejarlo, subirlo para todos, o que el umbral se pueda poner por meta. Lo
tercero es lo correcto pero es trabajo; dímelo y lo hago.

**2. El alcance.** Un ictus no lo lleva nadie solo. ¿Quién más está encima —neurólogo,
fisio, logopeda— y qué esperas que haga la app respecto a ellos? Ahora mismo el cribado
recoge lo que obliga a derivar, pero no hay ningún sitio donde conste a quién se derivó.

**3. Las escalas.** He puesto Ashworth y Berg porque son las estándar y son gratis. Si en
la clínica usáis otras (Fugl-Meyer, Tinetti), dímelo y las cambio: lo que no quiero es que
midas con una cosa y la app registre otra.

---

## Cómo se pasa

**Ha cambiado el orden de los sembradores.** Ahora los objetivos van antes que los tests,
porque los tests nuevos enganchan objetivos que crea el sembrador de objetivos:

    1 ejercicios  →  2 sesiones  →  4 objetivos  →  3 tests

En Ajustes → Mantenimiento. Ninguno pisa nada que ya tenga contenido, así que se pueden
relanzar sin miedo. Si lo pasas en el orden viejo, el sembrador de tests te avisará por
escrito de qué objetivos no ha encontrado; con volver a lanzarlo después basta.

Nada de esto necesita SQL.
