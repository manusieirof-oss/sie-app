# Pendientes · App SIE

Lista única de cosas aparcadas. Al cerrar una, se borra de aquí.

**Cómo se ordena a partir de ahora:** por **Pilar** y, dentro, por **pestaña**. Las secciones
numeradas de abajo son de antes de acordar esto y se van migrando a medida que se toque cada
pilar; no se reordenan de golpe, que solo serviría para perder el rastro de lo decidido.

---

# Pilar Biblioteca

## Tests

### Registro de resultados ✅ HECHO
`lib/tests.ts` es el único sitio que registra el resultado de un test. Guardar la fila, dejar
el evento y mover los objetivos van en la misma función, como en `lib/objetivos.ts` y
`lib/alertas.ts`, para que no se pueda hacer una cosa sin la otra.

Estaba escrito en cuatro sitios y los cuatro hacían cosas distintas:

- **La valoración solo guardaba la fila.** Ni evento ni objetivos. Un positivo detectado en la
  valoración inicial —que es cuando se detectan— no abría nada, y como la fila sí se guardaba
  nadie se enteraba. Era el peor de los cuatro.
- **La ficha, al registrar un negativo, no cerraba la vía del test.** Se quedaba abierta para
  siempre; solo la cerraba el botón "resolver" de Salud, que era otro camino aparte.
- **`PasoTests` tenía su propia copia del cálculo** y ya divergía: exigía `items.length>0` y la
  de la ficha no, así que un test sin ítems daba resultados distintos según dónde se registrara.
- **`registrarTestAntiguo`** era código muerto en la ficha. Borrado.

Dos decisiones que conviene no deshacer:

- **"Sin realizar" no se pisa.** Un test con ítems y ninguno marcado podría calcularse como
  negativo, pero "no se lo hice" y "se lo hice y salió limpio" no son lo mismo: lo segundo es un
  hallazgo y lo primero un hueco. La valoración deja marcar una u otra a propósito.
- **El evento se registra también cuando el test sale negativo.** Que un test diera negativo en
  marzo es información clínica, no ausencia de ella.

### Catálogo inicial de 10 tests ✅ HECHO
`lib/semillaTests.ts` + `/entrenamiento/sembrar-tests`. Diez tests de los cuatro perfiles de
la clínica, con sus diez objetivos y el enlace a las sesiones que los trabajan.

**La unidad va por ÍTEM.** `tiene_grados` era un booleano y el `°` estaba escrito a mano en
ocho sitios, así que media biblioteca no se podía escribir: el lunge de tobillo se mide en
centímetros, el equilibrio en segundos y el sentarse-levantarse en repeticiones. Ahora hay
`UNIDADES` en `lib/tests.ts` y lo guardado con el booleano antiguo se sigue leyendo como
grados. La unidad se **congela con el resultado**, igual que la sesión congela el nombre del
ejercicio: si el test cambia de unidad, el registro de marzo sigue diciendo lo que se anotó.

**Algunos ítems abren su propio objetivo**, no el del test. Si en la sentadilla profunda se
levantan los talones, eso abre "ganar dorsiflexión de tobillo" aunque el test vaya de
sentadilla. Es lo que hace que un test global sirva para algo más que decir "algo va mal".

Cuatro sesiones nuevas en `semillaSesiones.ts` porque los objetivos las necesitaban: Cadera ·
movilidad y control, Tobillo y pie, Equilibrio y marcha, y Suelo pélvico y pared abdominal.
Esta última **no lleva plancha ni rueda abdominal a propósito**: en una pared abdominal que
todavía se abomba, la antiextensión empuja justo donde no aguanta.

### Tests del otro programa · lo que falta por resolver
Sembrados 29 tests (ver `PROPUESTA-TESTS.md` para el mapa entrada por entrada). Pendiente:

- **Tres que no sé qué exploran** y quedaron fuera: "Tobillo - fuera de extensión",
  "Rodilla - Información - rótula" y "Cervical - Presión arterial en cervical". Este último,
  si es el test de arteria vertebral, no debería abrir objetivo de entrenamiento sino avisar
  y derivar.
- **Dos nombres leídos a mi criterio:** "Shoto-Hall" → Soto-Hall, "O Don" → O'Donoghue.
  Confirmar. Los dos ítems de O'Donoghue los interpreté como pasivo y resistido.
- **"Control motor y fascias de espalda"**: sembrado como ítem cualitativo, sin criterio de
  positivo. Falta saber qué se observa.
- **La lista venía cortada**: del 71 al 124 y del 136 al 154 faltan ~70 entradas. Hombro,
  codo y muñeca están claramente infrarrepresentados.
- **Senior Fitness Test**: hoy solo existe el sentarse-levantarse en 30 s. Decidir si se monta
  la batería completa (6 ítems medidos) para poder comparar con los baremos por edad.
- **VALD**: los tests de fuerza con dinamómetro se miden en su aplicación. Decidir si el
  número se copia a mano aquí o si en la app solo consta el positivo/negativo.

**Los tests de exploración no abren objetivo, a propósito.** Meniscos, ligamentos y
provocación cervical no son un déficit que se entrene: son información para decidir la carga
y, a veces, para derivar. Colgarles un objetivo haría que la ficha propusiera entrenar una
rotura. Ese dato es el que alimentará el bloqueo por etiquetas de aquí abajo.

---

## Objetivos medibles

Ver `docs/propuestas/PROPUESTA-OBJETIVOS.md` para el modelo completo.

### Base y evaluación ✅ HECHO
`sql/objetivos_medibles.sql` y `lib/metas.ts`. **Todavía no hay interfaz: nada de esto se ve
en la app.** El SQL es aditivo y se puede ejecutar sin romper nada.

Decisiones tomadas contigo:

- **Tres familias y solo una lleva número.** `metrico` lo cierra una medición; `fase` la
  avanza el entrenador al montar la tanda nueva; `cualitativo` se cumple o no. Forzar un
  porcentaje a "conciencia y activación básica" sería inventarse precisión.
- **Sin "+" ni "=" en los nombres.** En el otro programa el tipo de meta iba pegado al
  nombre porque no había dónde guardarlo. Aquí es un campo.
- **La biblioteca guarda el espacio, el paciente las metas.** ~20 fichas ("Fuerza de
  hombro") en vez de 160 combinaciones. Un hombro con la rotación interna y la externa
  flojas es UN objetivo con DOS metas.
- **Umbral de igualdad: 10%**, en código y no por meta, para que dos metas idénticas de dos
  pacientes no se cierren con criterios distintos.
- **El valor actual no se guarda**, se lee del último resultado. Copiarlo sería una segunda
  verdad que discreparía en cuanto se corrija un test.

Probada la evaluación con los tres tipos de meta, el umbral, los huecos sin medir, el
resultado más reciente y el campo `grados` antiguo.

### Catálogo y biblioteca ✅ HECHO
`lib/semillaObjetivos.ts` + `/entrenamiento/sembrar-objetivos` (paso 4 de Mantenimiento).
Las ~160 fichas métricas del otro programa quedan en **20 espacios** (articulación ×
métrica) con sus movimientos dentro; los de fases, de 30 fichas a 9 con las fases escritas;
más 7 cualitativos. El sembrador crea antes las etiquetas de movimiento que faltaban:
rotación interna y externa, flexión lateral, flexión plantar, dorsiflexión y las
desviaciones radial y cubital.

`ObjetivosTab` distingue las tres familias, filtra por zona en orden anatómico y dice
**cuántos pacientes tienen cada objetivo abierto**, que es lo que revela si una ficha sobra.

### Metas en la ficha ✅ HECHO
`MetasObjetivo` dentro de `FichaTab`. Los objetivos métricos muestran sus metas con el
progreso, y se crean eligiendo movimiento, lado, tipo, punto de partida y meta.

**Toda meta nace atada a un ítem de test, y el selector es obligatorio.** Una meta que nadie
mide es una intención con un número al lado. Solo se ofrecen ítems con unidad: una casilla de
sí/no no puede cerrar un "+20%".

Dos detalles que evitan errores: el punto de partida se propone con lo último medido en ese
ítem y lado —teclearlo a mano teniendo el dato delante es pedir una errata—, y en las metas
de antagonista se sugiere el ítem contrario buscando por el nombre del movimiento opuesto.

La barra de progreso solo aparece si hay con qué calcularla: una barra a cero cuando aún no
se ha medido nada diría algo falso.

### Cierre del objetivo y fases ✅ HECHO
**El objetivo métrico se cierra cuando no le queda ninguna meta abierta**, y se reabre si
alguna vuelve a abrirse. Antes solo se cerraba la meta y el objetivo se quedaba en activos
para siempre: era el problema de partida resuelto a medias. Se recalcula al registrar un
test y también al crear, borrar o cerrar a mano una meta —crear una meta sobre una medición
que ya la cumple tiene que cerrarla en el momento, no esperar al siguiente test.

**La barra de fases se pulsa para cambiar de fase.** Antes era un indicador que no se podía
mover. La última fase **no cierra el objetivo sola**: "mantenimiento y prevención" no se
acaba nunca, así que cerrarlo es una decisión y no una consecuencia. Al montar la tanda
nueva, el recibo recuerda qué objetivos por fases pueden avanzar.

### Lo que falta — PENDIENTE
- **Clasificar los diez objetivos "sin clasificar"**, los que se sembraron con los tests.
  **No borrarlos**: son los que abren los tests al dar positivo (`objetivos.test_id`), y si
  desaparecen los tests dejan de abrir nada en silencio. Hay que ponerles familia.
- **Proponer objetivos por patología.** El dato ya está —las fases y los cualitativos llevan
  su etiqueta de patología—; falta que al registrarle una patología a un paciente se le
  ofrezcan.
- **VALD**: decidir si el número se copia a mano o si en la app solo consta el resultado.
5. **Sustituir los diez objetivos sembrados**, que son de la familia métrica mal hechos: sin
   métrica, sin movimiento y sin lado.
6. **VALD**: decidir si el número se copia a mano o solo consta el positivo/negativo.
7. Duplicado en la lista de origen: "Flexión lateral cuello" y "Flexión lateral cervical".

---

# Pilar Biblioteca (continuación)

## Tests

### Bloqueo de ejercicios por test positivo ✅ HECHO
`lib/contraindicaciones.ts`. `tests.etiquetas_bloquea` existía desde el primer día y no la
leía nadie; ahora se edita en el test ("Si sale positivo, desaconseja") y **avisa en el
editor de sesión** con una píldora ámbar en el ejercicio: qué etiqueta, qué test y de cuándo.

**Avisa, no impide.** Hay motivos para prescribirlo igual —carga baja, rango parcial,
isométrico— y un bloqueo duro se acaba esquivando por fuera de la app, que es peor porque
entonces no queda registrado.

**Un negativo posterior lo levanta solo.** Manda el resultado más reciente de cada test y
lado. Sin esa regla el paciente acumularía contraindicaciones para siempre y a los seis
meses el aviso saldría en todo y se dejaría de leer.

**Alcanza a las subetiquetas**: bloquear "Hombro" cubre "Manguito rotador". Enumerarlas una
a una habría dejado fuera la primera que se añadiera al árbol.

Probado: positivo bloquea, negativo no, negativo posterior levanta, positivo posterior
vuelve a bloquear, un lado no levanta el otro, y "sin realizar" no bloquea.

**Pendiente aquí:** el aviso está en el editor de sesión pero no en el explorador al elegir
el ejercicio, que sería el momento más temprano.

### Bloqueo de ejercicios · lo que quedó fuera
**`tests.etiquetas_bloquea` existe desde el principio y no la lee nadie.** Cero usos en toda la
app. La idea era clara: un test positivo bloquea ciertas etiquetas de ejercicio. Hoy nada
impide meter en una sesión un ejercicio contraindicado por un test que dio positivo la semana
pasada.

Ahora por fin se puede hacer de verdad, porque la biblioteca ya está etiquetada. Sin decidir:

- **Bloquear o avisar.** Impedir el ejercicio es tentador y probablemente equivocado: hay
  motivos para prescribirlo igual y un bloqueo duro se acaba esquivando por fuera de la app.
  Apuesta: avisar en el editor de sesión, con el nombre del test y su fecha, y dejar decidir.
- **Cuándo caduca.** Un positivo de hace un año no debería bloquear nada. ¿Vale hasta que haya
  un negativo posterior, o hasta la `fecha_repeticion`?
- **Dónde se ve.** En el editor de sesión al elegir el ejercicio, seguro. ¿También como filtro
  en el explorador, que esconda lo contraindicado de ese paciente?

Ojo al cruce con el Pilar Taller: si el bloqueo se aplica al prescribir, el taller tiene que
poder ejecutar igualmente lo ya prescrito. Bloquear lo que ya está en marcha deja la sesión a
medias con el paciente delante.

### Avisos de reevaluación — PENDIENTE
`resultados_tests.fecha_repeticion` se calcula sola con `frecuencia_meses` y **solo se pinta**
en la ficha. Nada te dice a quién le toca reevaluar.

Va con el punto 3.1 de más abajo, que es el mismo problema para las revaloraciones: calcularlo
derivado, sin tabla de pendientes. Sin decidir dónde se ve — la apuesta sigue siendo la franja
"Requiere atención" de la ficha, y que el taller avise al abrir al paciente.

### Repaso de la pestaña — PENDIENTE
`TestsTab`: crear y editar tests, ítems, lógica, lados. Sigue con `.card` y tipografía
11/10/9px, así que le toca el tratamiento visual pendiente (ver 4).

Y `supabase-schema.sql` se quedó atrás: la tabla `tests` real tiene `items`, `logica`,
`tipo_lado`, `etiquetas_relacionadas` e `imagen_url`, y `resultados_tests` tiene `lado` e
`items_resultado`. El fichero no los recoge.

---

# Pilar Valoración

## Firma ✅ HECHO

`FirmaCanvas` tiene dos lienzos y **un solo dato**: el hueco embebido (200 px, antes 130) y uno
a pantalla completa que se abre con "Ampliar". El grande no es otro campo, es el mismo escrito
con más sitio — en la tablet el hueco pequeño obligaba a firmar apretado.

Tres detalles que no conviene deshacer:

- **El lienzo grande trabaja sobre un borrador** y solo "Hecho" lo sube. Cerrar sin querer una
  pantalla completa no puede llevarse por delante una firma que ya estaba.
- **La firma se escala sin deformar** al pasar de un lienzo a otro: tienen proporciones
  distintas y una firma estirada a lo ancho no es la firma de nadie.
- **El grosor del trazo va con la resolución del lienzo.** Fijarlo en 2 px dejaba un hilo
  invisible en un canvas de pantalla completa.

Lo usa también `ModalConsentimientos` desde la ficha, que es el mismo componente.

## Revaloración ✅ HECHO

Dos pestañas en `/valoracion`, un solo `finalizar`. Son el mismo acto —anamnesis, tests, y lo
que salga mueve objetivos— en dos momentos, así que partirlo en dos páginas habría duplicado
justo la parte que importa. Lo que cambia es de dónde se parte:

- **Inicial**: Paciente · Anamnesis · Historial · Tests · Plan · Resumen. El paciente puede no
  existir; hay que crearlo, firmar y elegir bono.
- **Revaloración**: Paciente · Anamnesis · Completar · Tests · Resumen. Ya está todo; se
  pregunta qué ha cambiado.

Decisiones tomadas:

- **Se traen los tests con último resultado POSITIVO, por test y por lado** (`testsPositivosDe`
  en `lib/tests.ts`). Un positivo no se cierra solo: deja vías de objetivo abiertas y etiquetas
  desaconsejadas hasta que otro test lo levante, así que es exactamente lo que hay que repetir.
  Mirarlo por test y no por lado haría desaparecer una rodilla según cuál se registrara después.
- **Se cargan en blanco, con la nota de cuándo dieron positivo.** Copiar el resultado anterior
  como resultado de hoy sería inventarse una exploración.
- **Un test traído y no pasado no se registra.** `sin_realizar` no dice nada y ensucia el
  historial; el Resumen avisa de cuántos quedan antes de guardar, no después.
- **Ni bono ni consentimientos.** `finalizar` abría un bono nuevo también en revaloración, en
  paralelo al que el paciente ya pagaba, y volvía a pedir una firma vigente. Los dos atados
  ahora al modo inicial.
- **El paso Completar solo añade.** Lo que ya está se enseña en gris **dentro de cada
  buscador** —el momento en que hace falta saber que la artrosis ya está apuntada es justo
  antes de volver a apuntarla, no en el resumen— y los deportes que ya practica ni se ofrecen.
  Editar o dar de baja se hace en la ficha: un segundo camino para lo mismo acabaría
  discrepando.
- **Cambiar de pestaña vacía lo escrito**, con confirmación. Media valoración inicial
  arrastrada a una revaloración es peor que volver a empezar, porque no se ve.

Nada de esto necesitó esquema nuevo.

## Resumen e informe de valoración ✅ HECHO

El resumen se había quedado con las cajas grises y la tipografía 9/10/11 px de antes, mientras
Ficha, Historial y Salud ya usaban `.panel` y 13/12. Rehecho con el tratamiento nuevo, y de paso
la revaloración deja de enseñar los huecos de lo que no le aplica.

**El contenido se define UNA VEZ.** `secciones()` dice qué se enseña y en qué orden; la pantalla
lo pinta con las clases de la app y el informe lo pinta como HTML para imprimir. Tenerlo dos
veces acabaría en un informe que dice algo distinto de lo que había en pantalla, y eso no lo nota
nadie hasta que el papel está en manos del paciente.

**Informe en PDF** con el membrete de la clínica: nombre y logo salen de Ajustes → Clínica
(`clinica_nombre` y `clinica_logo`). El logo se sube al bucket `fotos`, que es público a
propósito —el informe se abre en una ventana suelta para imprimir y una URL firmada caducaría—.
Se genera con `window.print()`, igual que el informe de la ficha: sin librerías y el navegador
ya ofrece "Guardar como PDF".

**El aviso del pie es un borrador**, como los textos de `textosLegales.ts`: dice que el
documento recoge mediciones y observaciones de la clínica, que sirve para el programa de
entrenamiento y que no es un informe médico ni tiene validez oficial fuera. Conviene que lo lea
la gestoría antes de darle papel a nadie.

## Elegir tests ✅ HECHO

`components/ExploradorTests.tsx`, compartido por la biblioteca y la valoración. Misma idea que
`ExploradorEjercicios`: una vista, distintas acciones —`onAbrir` en la biblioteca,
`seleccion` + `onAlternar` en la valoración—.

Era **la tercera copia del mismo buscador y la peor**. La valoración metía el catálogo entero
en una caja de 220 px con scroll, que con 49 tests enseñaba cuatro, y filtraba por TODAS las
etiquetas del test mezcladas —músculos, patologías, articulaciones—, así que el filtro estorbaba
más de lo que ayudaba. La biblioteca ya hacía lo correcto y nadie lo estaba aprovechando.

Lo que queda, para las dos:

- **Filtro por zona, solo etiquetas de categoría `articulacion`**, en orden anatómico de
  `lib/anatomia.ts`. Un criterio único para recorrer la app, igual que en etiquetas y objetivos.
- **La búsqueda entra en los ítems.** "McMurray" vive dentro de "Rodilla · meniscos": buscar por
  el nombre de la maniobra es lo natural en la camilla, y es la única forma de encontrar las 31
  maniobras de rodilla que están agrupadas en 6 fichas.
- **Chip "Sin zona"**, con su contador. Un test sin etiqueta de articulación desaparecería al
  filtrar; así se ve que existe y, de paso, que le falta etiquetar.
- **En la valoración se elige a pantalla completa**, con selección múltiple y "Añadir N". Los
  que ya están se ven apagados con "Ya añadido" en vez de desaparecer: si desaparecen, se
  buscan dos veces.

Fuera queda la columna "Tests relacionados" que había a la derecha del paso: sugería por
etiquetas compartidas y ocupaba 200 px de ancho. Con un filtro por zona que funciona, sobra.

## Pasar el test ✅ HECHO

`components/ModalRealizarTest.tsx`. Era un acordeón dentro del paso 4: el test se desplegaba
bajo su fila con la letra a 9-11 px y los ítems en cajas de 8 px. Con el paciente en la camilla
y la tablet en la mano, ilegible.

Ahora es **la ficha de la biblioteca con los ítems convertidos en casillas**: a la izquierda qué
es el test —imagen de 240 px, descripción a 13 px, frecuencia, lados, vídeo—, a la derecha qué
salió. El paso 4 se queda solo con la lista de lo que llevas, que es lo único que hay que ver
de un vistazo mientras se trabaja.

**No guarda nada**: devuelve el estado y decide quien lo abre. La valoración lo acumula hasta el
final y la ficha lo registra en el momento. Que el formulario escribiera por su cuenta sería un
segundo camino de escritura.

**La ficha ya usa lo mismo.** Tenía su propio formulario —95 líneas en `pacientes/[id]/page.tsx`,
con un desplegable de los 49 tests— y era la cuarta copia. Ahora elige con `ExploradorTests` y
lo pasa con `ModalRealizarTest`, cambiando solo la botonera: aquí se guarda en el momento y en
la valoración se acumula hasta el final.

De paso se arregló algo que se perdía en silencio: la ficha registraba **solo un lado**, el que
estuviera seleccionado. Ahora guarda todos los que tengan resultado, así que pasar izquierdo y
derecho de una vez ya no pierde uno de los dos.

## Citar al terminar la valoración ✅ HECHO

`lib/citas.ts` es el único sitio que crea citas. Estaba escrito a mano dentro del botón de
guardar de `agenda/page.tsx` —recorrer días, montar filas, trocear de 50 en 50— mezclado con
la validación del formulario. **El plan se calcula aparte de escribirlo** (`planDeFechas` /
`crearCitas`), igual que en `lib/rotacion.ts`, para que la previsualización salga de la misma
función que ejecuta.

**No se puede agendar durante la valoración**: si el paciente es nuevo no existe hasta que se
guarda, así que no hay `paciente_id` al que colgar la cita. Por eso el encadenado va al final:
la pantalla de guardado ofrece *ponerle las citas* —lleva a la agenda con el modal abierto y el
paciente puesto—, *asignarle las sesiones* —a su pestaña de entreno, donde ya está "Repartir en
las citas"— o *ahora no*.

**No hay lista de pendientes ni pestaña nueva en el taller.** Se valoró y se descartó: un
paciente está pendiente por definición mientras no tenga citas por delante, así que el aviso se
calcula y sale como píldora en la lista de pacientes, donde ya se mira. Un flag manual habría
que acordarse de quitarlo al citarle desde la agenda, y una lista que miente se deja de mirar.
Mismo criterio que el punto 3.1.

**La píldora dice `citas/con sesión`** —`24/24`— y se pone en rojo con `CITAS_POCAS` (5) o
menos, o "Sin citas" si no tiene ninguna. Sale de las citas `programada` futuras, así que
cambiar, cancelar o anular una lo recalcula solo, y las pasadas se descuentan cuando el cron las
marca como realizadas. Solo se avisa de los pacientes **activos**: quien está en pausa no es que
se haya quedado sin citas.

**Los festivos siguen sin tenerse en cuenta** — PENDIENTE. `lib/festivos.ts` sabe qué días son
fiesta y `planDeFechas` no lo consulta, así que marcar tres meses de lunes mete cita el 25 de
diciembre. Se dejó como estaba a propósito para no cambiar de paso el comportamiento de la
agenda; cuando se decida, se decide dentro de `planDeFechas` y vale para las dos.

## Escalas sin respuesta ✅ HECHO

`components/EscalaSlider.tsx` para bienestar, estrés y el EVA de las molestias.

El problema no era que faltara una casilla: **el slider arrancaba en 5**, así que el paciente
que no contestaba quedaba registrado con un 5 indistinguible de un 5 dicho de verdad, y ese 5
inventado entraba en la gráfica, en la media y en el informe.

Es la misma distinción que en los tests entre `negativo` y `sin_realizar`: "salió limpio" es un
hallazgo y "no se lo hice" es un hueco. Aquí el hueco es `null`, que las tres columnas ya
admitían — **no hizo falta SQL**.

- **El slider sigue arrancando en 5**, decidido así: preguntar es lo normal y no contestar la
  excepción, y es la excepción la que se marca. Al marcarla el slider se apaga en vez de
  desaparecer, para que no parezca que el dato se ha perdido.
- **Un solo estado.** No se distingue "no sabe" de "no quiere": ni la gráfica, ni la media, ni
  el informe hacen nada distinto según el motivo.
- **Donde se pinta, se dice.** "Sin respuesta" en las fichas, "—" en tablas e informe, la barra
  a cero pero con el guion al lado, y **la molestia sin EVA sale en gris** en vez de en verde —
  pintarla de verde diría "leve", que es justo lo que no sabemos.
- **Sin las dos escalas no se abre fila** en `escalas`: un registro con los dos huecos vacíos no
  dice nada y mete un punto muerto en la evolución.

## Alergias, intolerancias y operaciones ✅ HECHO

Salió al construir el paso Completar, y el primer diagnóstico fue **equivocado**: se anotó que
las tres carecían de tabla. Lo real eran dos problemas distintos.

**Alergias e intolerancias: la valoración escribía donde nadie mira.** `alergias_paciente` e
`intolerancias_paciente` existen desde el principio y son lo que lee Salud. La valoración no
insertaba en ellas: metía la lista dentro del JSON `estado_general` de `valoraciones` y ahí se
quedaba. Una alergia apuntada en la valoración inicial **no aparecía en la ficha**. Guardada,
pero fuera de circulación.

**Operaciones: no había tabla.** Solo `operaciones_biblioteca`, el catálogo. Lo que se apuntaba
del paciente vivía únicamente en ese JSON: no se podía ver en Salud, ni dar de baja, ni
preguntar quién lleva prótesis. `sql/operaciones_paciente.sql` la crea.

`lib/listasPaciente.ts` es ahora el único sitio que escribe en las tres. Fila y evento en la
misma función, como en `lib/tests.ts`. Migradas la valoración y `SaludTab`, que tenía su propia
copia — copia que la valoración no compartía, y de ahí venía todo.

Decisiones:

- **No duplica.** Lo que ya consta con el mismo nombre se devuelve como `repetidas` y no se
  toca. Misma regla que los sembradores: rellenar huecos, nunca deshacer. Importa el doble
  aquí, porque la revaloración vuelve a pasar por el mismo formulario que la inicial.
- **Una alergia es del PACIENTE, no de la valoración en que se apuntó.** Guardarla dentro de un
  acto fechado es el mismo error que guardar el valor actual de una meta: con dos valoraciones
  hay dos listas y ninguna manda.
- **Las operaciones se ven en Problemas, no en Contexto.** Una prótesis condiciona la carga
  igual que una patología activa.
- **`estado_general` las sigue guardando** como foto de aquel día. Es inofensivo mientras nadie
  las lea de ahí para decidir: la lista viva es la tabla. El `yaTiene` de la revaloración ya
  lee de las tablas.

### Migrar los JSON viejos — DESCARTADO

Las valoraciones anteriores al arreglo guardan esas tres listas solo dentro de
`estado_general`. **No se migran: todo lo de antes son datos de prueba.** Montar un sembrador
para rescatar pacientes inventados es trabajo que solo sirve para tener otro sembrador que
mantener.

A partir de aquí cada valoración escribe en las tablas, así que el hueco no vuelve a crecer.
Si algún día aparece un paciente real de aquella época, se le añaden a mano desde Salud, que es
más rápido que la migración.

---

## 0. Consentimientos ✅ CERRADO

Se guardan en `consentimientos` con firma, fecha, versión del texto y **el texto literal**,
más nombre y DNI congelados al firmar. `abrirDocumentoFirmado()` reconstruye el documento
desde esa fila, no desde `textosLegales.ts`, así que no cambia si los textos cambian.

Se pueden firmar desde la valoración y desde la ficha (`ModalConsentimientos`). Al volver a
firmar se añade una fila nueva, nunca se sobrescribe: la ficha muestra la más reciente de cada
tipo y el histórico queda entero.

**Pendiente de tu gestoría:** los tres textos de `textosLegales.ts` son borradores. El fichero
ya lo avisaba antes de que empezáramos. Ojo especialmente al plazo de conservación, que en
documentación clínica tiene reglas propias. Si se cambian, subir `VERSION_TEXTOS`.

---

## 1. Decisiones sin tomar

### 1.1 · `notas` vs alertas
La tabla `notas` solo se escribe desde `agenda/components/PanelDatos.tsx`, en dos variantes:
nota `tipo:'info'` y aviso `tipo:'urgente'` con fecha y `visible_agenda:true`.

Las alertas (`alertas_paciente`) nacieron después y cubren lo mismo: marcar algo a tener en
cuenta de un paciente. **Decidir si la nota rápida se retira o se le da un uso propio.**

- Si se retira → quitar el filtro "Notas" del historial (`TimelineTab`), que hoy marca siempre 0.
- Si se mantiene → registrar evento `nota` al crearla, para que aparezca en el historial.

No confundir con `pacientes.notas_fijas` (el "viene en silla de ruedas" de la ficha) ni con
`citas.notas`. Son tres cosas distintas con nombres parecidos.

### 1.2 · Taller: partir de la agenda y modos de sesión

1. **Arrancar de la agenda — HECHO.** `lib/taller.ts` es el único sitio que sabe quién viene:
   `pacientesDelDia(fecha, sala)` devuelve las citas del día con el paciente y la sesión ya
   resuelta. La regla de qué sesión toca está aparte en `sesionQueToca` para poder probarla
   sola (7 casos, incluidas ramas de linaje): manda la de la cita; si no hay, la única
   vigente; si tiene varias, ninguna y se elige. Botón "Traer de la agenda" en Modo Clase,
   con selector de sala leído de Ajustes. **Es un merge, no un reemplazo**: no puede borrar
   a nadie que ya esté en la lista con datos escritos, y el que viene sin cita se sigue
   añadiendo a mano. Cambiar la sesión sobre la marcha se guarda en `citas.sesion_id`, para
   que mañana la agenda diga qué se entrenó de verdad.

   Pendiente de ver en uso: si conviene que se traiga solo al abrir la pestaña en vez de con
   el botón.
2. **Modo de sesión como propiedad de la sesión** — el DATO ya está hecho (`sql/sesiones_modo.sql`:
   el modo vive en la PARTE, no en la sesión, para que lo mixto salga solo). Falta que el taller
   lo PINTE: hoy sigue habiendo una pestaña "fuerza" y las partes en circuito se ejecutan como
   si fueran series sueltas.
   - `ejercicio` — todas las series de un ejercicio y se pasa al siguiente. Es lo actual.
   - `circuito` — N ejercicios repetidos X vueltas. Mismo esquema; "serie 3" pasa a significar
     "vuelta 3".
   - `fases` — **no entra con los otros dos.** La fase es estado del *paciente*, sobrevive a la
     sesión que la generó (esta semana está en fase 2, la que viene sigue o sube). Necesita su
     propio dato; deducirla del último registro sería repetir el error que ya arreglamos.
   - Los modos van en código, no en Ajustes: cada uno necesita su propia pantalla. Es la
     excepción consciente a la regla de "las listas mandan desde Ajustes".
3. **El taller solo ejecuta; se edita desde la ficha.** Hoy `ModalEditarSesion` se abre
   también desde el taller. Hay que quitarlo de ahí.

   El motivo no es de orden sino de dato: si editas el plan mientras lo ejecutas,
   pierdes la diferencia entre lo prescrito y lo que pasó, que es justo lo que quieres
   medir. Que hoy no pudiera con 40 y hiciera 30 no es un error del plan: es
   información. El taller tiene que poder anotar una ejecución distinta de lo prescrito
   **sin tocar la sesión**; luego en la ficha se ve "prescrito 40, hizo 30 tres sesiones
   seguidas" y se ajusta el plan ahí.

4. **Series explícitas (pirámides y descendentes).** Pendiente, acordado el enfoque:
   el ejercicio sigue siendo "3 series de 10 con 40kg" para el caso normal, y cuando
   haga falta se despliega en series explícitas, una línea por serie con sus reps y su
   peso. Aditivo: lo ya guardado sigue igual, y el taller pinta las series explícitas
   si están y repite la misma N veces si no.

   Ojo a la distinción: una pirámide **prescrita** (planeo 12-10-8-6) es plan y va en la
   sesión; una pirámide **ejecutada** (salió así) es registro y va en el taller. Hacen
   falta las dos.

5. **Tests en las citas: descartado.** `resultados_tests.fecha_repeticion` ya dice a quién toca
   reevaluar. Convertirlo en asignación manual quita el automatismo que ya existe. En su lugar,
   que el taller avise al abrir al paciente ("toca reevaluar Thomas"). Ver 3.1.

### 1.3 · Avisos de asistencia: falta mucho / lleva sin venir
Detectar al paciente que se está yendo **antes** de que se haya ido. Dos señales
distintas: falta a las citas que tiene, o directamente lleva sin pisar la clínica.

**El sitio donde marcarlo ya existe** (hecho con 1.2): en Modo Clase, con los pacientes del
día delante, cada uno tiene "Vino / No vino" y escribe `citas.estado`. Volver a pulsar
desmarca, porque el que llega tarde tiene que poder volver a la lista.

**Queda el cron.** `api/cron/actualizar-citas` sigue marcando como `realizada` toda cita
pasada que siguiera en `programada`, así que pisa la ausencia de marca con un "vino" falso.
Hay que decidir qué hace ahora: dejarlas en `programada` (y que "sin marcar" signifique
justo eso), o marcarlas solo si hubo registros de ejercicio ese día. Hasta que se decida,
las reglas de "falta mucho" seguirán sin poder saltar.

**Diseño acordado:**

- **Reglas en Ajustes**, una clave en `ajustes` como los tipos de clase o los festivos,
  cada regla con su número y su interruptor: faltas seguidas (2), cancelaciones al mes
  (4), días sin venir (21). Configurable sin tocar código.
- **No es un aviso suelto, es una alerta real.** Se abre en `alertas_paciente` con
  `lib/alertas.ts`, que ya escribe la fila y el evento en la misma función. Con eso sale
  en la franja de atención de la ficha, en el historial clínico y en la agenda junto a
  su próxima cita. Y se cierra al hablar con el paciente, como cualquier otra.
- **En el historial, el aviso sí; cada falta no.** Dos eventos por semana ahogarían la
  cronología. Misma regla que con los objetivos: se registra el cambio de estado.
- **Nunca en pausa ni en baja.** Quien está en pausa no falta. Si el aviso salta ahí, en
  dos semanas dejas de mirarlo.
- **Lo calcula el cron**, que ya corre a diario y es el único que ve pasar el tiempo.
  Comprobando que no haya ya una alerta abierta del mismo tipo, para no duplicar.

### 1.4 · Objetivos: filtro previo por zona o similitud
El selector del editor de sesión ya no pinta el catálogo entero (solo los elegidos, más
un buscador), así que aguanta. Pero buscar por nombre no basta cuando haya cientos:
hace falta acotar antes, por zona anatómica o por parecido, como ya se hace con las
etiquetas de los ejercicios.

**Falta el dato.** `objetivos` guarda hoy nombre, descripción, color y `test_id`; no
tiene ni zona ni etiquetas. Antes de tocar el selector hay que decidir cuál de las dos:

- **Etiquetas**, reutilizando la tabla `etiquetas` que ya usan los ejercicios. Permite
  cruzarlos ("objetivos de hombro" y "ejercicios de hombro" comparten vocabulario).
- **Zona**, reutilizando `lib/anatomia.ts`. Más simple, pero solo sirve para objetivos
  localizables: "mejorar la adherencia" no tiene zona.

Va con el Pilar Biblioteca, junto al resto de decisiones de `*_biblioteca` (ver 3.2).

### 1.5 · Marcar sesiones como realizadas
Las sesiones tienen `estado` borrador/lista/realizada pero **nada las marca como realizada**.
El cron `api/cron/actualizar-citas` solo marca *citas*. Se decide al llegar al Pilar Taller,
que es quien sabe si una sesión se ejecutó.

---

## 1bis. Objetivos ✅ CERRADO

`lib/objetivos.ts` es el único sitio que decide si un objetivo está logrado y el único que
puede escribir en `pacientes_objetivos`. La regla estaba repetida siete veces en cinco
ficheros y ya divergía (dos copias hacían `.every()` sin comprobar longitud, y `[].every()`
devuelve `true`). Migrados taller/page, taller/ModoClase, SaludTab y las dos ramas de
`registrarTest`.

Lograr o reabrir un objetivo deja evento en el historial, con el contexto de dónde vino.
Solo se registra el **cambio de estado**, no cada retoque de una vía.

En la ficha las vías se pulsan para resolver o reabrir a mano, y los logrados se apartan a
un desplegable "Logrados · N". Los objetivos antiguos **sin ninguna vía** no podían cerrarse
nunca (la regla exige al menos una); tienen un botón "Dar por logrado" que crea una vía de
cierre manual, en vez de tocar el campo `logrado` directamente.

**Sesiones en el historial:** se registra el plan (`tipo: 'sesion'`), no la asistencia.
Enganchar el evento a las citas realizadas metería 2-3 eventos por semana y por paciente y
ahogaría la cronología; la asistencia ya está medida en Resultados.

---

## 2. Eventos de historial ✅ CERRADO

Todas las acciones de `SaludTab` registran ya su evento en `eventos_paciente`: molestias,
patologías, medicación (alta y baja), alergias, intolerancias, deportes, plantillas, escalas y
tests. Verificado función por función.

Patrón a mantener al añadir acciones nuevas, como en `lib/alertas.ts`: la escritura y el evento
van en la misma función, para que no se pueda hacer una cosa sin la otra.

---

## 3. Funcionalidad

### 3.1 · Próximos / pendientes por fecha
Avisar de lo que toca: revisión de test, revaloración a los N meses.

El dato ya existe, no hace falta esquema nuevo:
- `resultados_tests.fecha_repeticion`, que se rellena solo con `frecuencia_meses` del test.
- `valoraciones.fecha` + `tipo` ('inicial' | 'revaloracion').

**Enfoque acordado:** calcularlo derivado, no crear tabla de pendientes. Se materializa cuando
el Pilar Taller necesite registrar la ejecución. La lógica se escribe como una función que
devuelve una lista de pendientes, así cambiar de dónde salen las filas no rompe la UI.

Sin decidir:
- Dónde se ve. Apuesta: la franja "Requiere atención" de la ficha. ¿También en el listado?
- El plazo de revaloración, ¿fijo a 3 meses o configurable por tipo de clase en Ajustes, como
  ya se hace con `frecuencia_meses` de los tests?

### 3.2 · Mapa corporal: zonas sin localizar
Se ve al abrir Salud → vista Mapa. Todo lo que no encuentre coordenada se lista bajo el
cuerpo en "Sin localizar", así que esa lista **es** el checklist de lo que falta.

**Se resuelve al llegar al Pilar Biblioteca**, junto con las tablas `*_biblioteca`.

Dos cosas distintas:

1. **Zonas de molestias sin mapear.** `lib/anatomia.ts` cubre unas 40 zonas anatómicas
   típicas, pero las buenas son las de `molestias_biblioteca`. Hay que cotejar ambas listas
   y añadir las que falten con su `x`, `y` y su `cara` (ant / post / lat).

2. **Las patologías no guardan zona.** `patologias_biblioteca` sí la tiene, pero al
   asignar una patología a un paciente no se copia: la tabla `patologias` solo guarda
   nombre, lado, estado, descripción e informe. Ahora se intenta deducir del nombre y
   falla a menudo. El arreglo es añadir la columna `zona` a `patologias` y rellenarla en
   `guardarPatologia` desde la biblioteca (el `patConfig` ya la lleva preparada).

Idea a valorar entonces: en vez de mantener el mapa en código, meter `zona_x`, `zona_y` y
`cara` en las propias tablas `*_biblioteca` y editarlas desde Biblioteca. Así se pueden
añadir zonas nuevas sin tocar código, que es el mismo criterio que seguimos con los tipos
de clase en Ajustes.

### 3.3 · Preferencias horarias vs horas reales
Cruzar `valoraciones.dias_asistencia` y `valoraciones.franja` con las horas que el paciente
tiene realmente asignadas en `citas`, para detectar a quién se podría recolocar y repartir
mejor las clases. **Va en el Pilar Agenda, no en la ficha.**

### 3.4 · Perfil completo del paciente
Indicador de datos que faltan. **Descartado en el listado** (desvirtúa la naturaleza de la
lista). Sin decidir si tiene sentido dentro de la ficha.

Si se retoma, quedó sin cerrar:
- Qué campos son obligatorios de verdad frente a opcionales. Un contador crudo tipo "17 de 23"
  trata igual el DNI que "cómo nos conoció", y en 200 filas deja de mirarse.
- Dónde vive la firma. Hay `firma_canvas` en el flujo de valoración pero no en `pacientes`.

### 3.5 · Privacidad de ficheros ✅ HECHO

- **Documentos clínicos** → bucket privado `documentos` + URL firmada (5 min). Ver
  `sql/documentos.sql` y `lib/documentos.ts`.
- **Fotos de pacientes** → bucket privado `pacientes-fotos` + URL firmada (1 h). Ver
  `lib/fotos.ts`. En `pacientes.foto_url` se guarda ahora la **ruta**, no una URL;
  `urlFotoPaciente()` acepta también las URL antiguas para no romper lo ya subido.
- **El bucket `fotos` se queda público a propósito**: ahí viven las imágenes de
  ejercicios y de tests, que son biblioteca y no datos personales.
- Compresión al subir: fotos de paciente a 600px, documentos a 1600px.

Lo que sigue sin cubrir, por si algún día crece el equipo: las políticas son
`to authenticated using (true)`, así que **cualquier usuario con sesión ve los ficheros de
todos los pacientes**. Es el mismo modelo que el resto de la base. Si se dan cuentas con
alcance limitado, habrá que revisar todas las políticas, no solo estas.

---

## 4. Deuda técnica

- **21 errores de TypeScript preexistentes**, todos `implicit any`, en `ModalTareas` (12),
  `ListasTab` (4), `ModalNuevaCita`, `ajustes/page.tsx`, `CatalogoTab`, `MolestiasBibTab` y
  `PatologiasTab`. No rompen nada, pero enmascaran errores nuevos: la forma fiable de detectar
  una regresión es comparar el **desglose por fichero**, no el total.
- **Tratamiento visual por pestaña.** Ficha, Historial y Salud ya usan `.panel`, secciones sin
  caja y texto 13/12px. **Faltan Entrenamiento y Resultados**, que siguen con `.card` y
  11/10/9px. Se va arreglando a medida que se toca cada pestaña, no en una pasada aparte.
- **Rejilla de ejercicios duplicada.** `ExploradorEjercicios` (buscador, filtros por
  categoría y rejilla de tarjetas) se usa ya al montar una sesión, pero `BibliotecaTab`
  mantiene su propia copia de lo mismo. **Migrarla al llegar al Pilar Biblioteca**: si no,
  en unos meses habrán divergido y estaremos donde empezamos.

---

## 5. Biblioteca de imágenes

### Para qué son las imágenes (decide el resto)

Además de ilustrar la ficha del ejercicio, la idea es que **sirvan para mandar tablas de
ejercicios a casa del paciente**. Eso cambia el listón: la imagen no la va a interpretar
un profesional al lado del paciente, sino el paciente solo en su salón. Tiene que
entenderse el gesto sin explicación.

Consecuencias que hay que respetar al pedirlas:

- El gesto manda sobre el detalle. Si hay que elegir entre postura clara y material
  bonito, postura clara.
- Se leen a dos tamaños muy distintos: **104 px** en la tarjeta de la biblioteca y a
  media página en la tabla impresa. Lo que no se lea a 104 px no vale.
- Nada de texto dentro de la imagen: la tabla llevará su propio texto, y una imagen con
  letra no se puede reutilizar ni traducir.

**Pendiente de construir:** la tabla de ejercicios para casa (selección de ejercicios →
PDF con imagen, series, repeticiones y notas). Aún sin diseñar.

### Cómo se piden

- **En tandas de 10.** Más de diez y la herramienta empieza a repetirse y a mezclar
  posturas entre ejercicios.
- **Musculatura resaltada: de momento no.** Está decidido que si se hace, se hace en
  TODAS —una biblioteca a medias se ve descuidada— y con tres reglas: un solo músculo, el
  principal; tinte suave, no el dorado de acento, porque a 104 px compite con la línea; y
  zona amplia, no anatomía fina, porque un "vasto interno" mal dibujado en una app
  clínica es peor que nada. El texto para pedirlo está al final de
  `ENCARGO-IMAGENES-CUADRICEPS.md`.

### Lo que la IA no dibuja bien

Comprobado en las dos primeras tandas:

- **Sentadilla sissy.** Seis intentos, ninguno válido. La IA no entiende "cadera extendida
  con rodillas adelante": siempre acaba flexionando la cadera y dibujando a alguien
  apoyado en un poste. Si se reintenta, hay que describir la postura por la **línea del
  cuerpo** ("una línea recta desde las rodillas hasta los hombros, inclinada hacia atrás")
  y no por las articulaciones.
- **Ejercicios cuyo sentido está en el movimiento, no en la postura** (deslizadores,
  saltos). Una foto fija de una zancada con deslizador es indistinguible de una zancada
  normal salvo por el disco bajo el pie. Salen, pero comunican poco.

---

## 6. Programa de entrenamiento

Que crear la siguiente tanda de sesiones deje de ser trabajo manual. Se hace por partes,
en este orden, porque cada una decide sobre la anterior.

### 6.1 · Trabajo por zonas y patrones ✅ HECHO
`lib/volumen.ts` + `ResumenVolumen`, en Pacientes → Resultados. Cuenta lo **asistido**, no lo
prescrito, y mide en **series**. Un ejercicio cuenta entero en cada zona que trabaja, así que
los totales por zona no suman el total de series. Va primero porque todo lo demás decide
sobre estos números.

**Es el examen del etiquetado.** Si los números chirrían, el problema está en cómo están
etiquetados los ejercicios, no en el informe.

**Mapa de calor corporal: descartado por ahora.** La lista ya dice lo que hay que saber.

### 6.2 · Linaje de sesiones ✅ HECHO
`sesiones.evolucion_de` y `sesiones.fija` (ver `sql/sesiones_linaje.sql`) y `lib/linaje.ts`.

**El número no se guarda, se cuenta, y cuenta cuántas van en el linaje**, no saltos de cadena.
La diferencia importa porque se puede partir de cualquier tanda: si vas por la 6ª y decides
retomar desde la 1ª, lo que sale es la **7ª** —la séptima que existe—, no la 2ª. Contar saltos
diría 2ª y no significaría nada.

Se llama **tanda** y no versión a propósito: un número junto al nombre se lee como un nivel, y
que suba no dice que el paciente haya progresado, dice que se le montó una programación nueva.
El progreso lo miden 6.1 y los objetivos.

**Las tandas anteriores son de solo lectura.** Editar una reescribiría lo que dicen las citas ya
pasadas y con ellas el informe de 6.1. Para avanzar desde una antigua está "Partir de esta"
(`evolucionarDesde`), que la deja intacta y crea la siguiente del linaje.

**Sesiones fijas** (`fija`): las que no entran en la tanda nueva, como una descarga de gemelo
que se repite igual mes tras mes. Se marca **la excepción, no la norma**: si hubiera que marcar
las versionables, cada tanda habría que volver a marcar cuatro sesiones para conseguir el
comportamiento por defecto, y la que se olvidara quedaría congelada sin que nadie se entere.

**La unidad que evoluciona es el programa, no la sesión.** `evolucionarPrograma()` copia todas
las sesiones que están en la agenda futura y repunta esas citas a las copias. El orden —qué
toca el lunes y qué el miércoles— se conserva solo, porque cada cita mantiene su hueco y solo
cambia a qué versión apunta. Las citas pasadas no se tocan nunca: son lo que hace que 6.1
siga siendo cierto meses después.

Dónde se ve: botón "Nueva tanda" en Pacientes → Entrenamiento → Sesiones, y la chincheta de
cada tarjeta para fijarla. Las tandas viejas se pliegan tras la vigente; en el taller salen
apagadas y con su número; en los desplegables de elegir sesión no salen (`soloVigentes`).

**Vigente = la última creada del linaje**, no "de la que nadie ha evolucionado": al poder
partir de cualquier tanda hay ramas, y con la definición vieja habría dos vigentes a la vez.

### 6.2bis · Repartir sesiones en las citas ✅ HECHO
`lib/rotacion.ts` + `ModalRepartir`. Botón "Repartir en las citas" en Entrenamiento → Sesiones.

**Los 2, 3, 4 o 5 días no se modelan.** No son cuatro reglas sino una: se cogen las citas
futuras en orden de fecha y se reparten las sesiones en bucle. Que a uno le toque una cada
tres días naturales y a otro una cada dos ya lo decide la agenda, que es la única que sabe qué
días viene cada uno. Por eso **no hay un ajuste de "frecuencia" en el paciente**: sería un
tercer sitio donde guardar algo que la agenda ya sabe y la contradiría al primer cambio de día.

`cicloDe` deduce la rotación en curso de las citas ya asignadas ([A,B,A,B,A] → [A,B]), así que
añadir tres meses de citas y rellenarlas es abrir y dar a repartir. Si la secuencia no es
periódica devuelve la secuencia entera en vez de inventarse un ciclo.

El plan se calcula aparte de escribirlo (`planDeReparto` / `aplicarReparto`) para que la
previsualización salga de la misma función que ejecuta y no pueda mentir.

### 6.3 · Propuesta de cambio ejercicio a ejercicio — PENDIENTE
Que al crear la tanda nueva se propongan sustituciones **con el motivo escrito al lado**
("tracción vertical a cero", "lleva ocho semanas con este"), y se acepten o rechacen una a una.

**Faltan dos datos que hoy no existen:**

- **Favorito del paciente.** Qué ejercicios no se le tocan porque le funcionan o le gustan.
- **Partes intocables.** Qué bloques no entran en el cambio automático. Ojo: no es lo mismo
  que `sesiones.fija`, que deja fuera la sesión ENTERA de la tanda. Esto es más fino, dentro
  de una sesión que sí evoluciona.

El tercero que faltaba —la vigencia de cada versión— ya está resuelto por 6.2: lo dicen las
citas, no hace falta columna.

### 6.4 · Cambio masivo — PENDIENTE, y solo accesorios
El botón de "cámbiame todos los ejercicios". Limitado a accesorios a propósito: si el bloque
principal se cambia solo, deja de ser un programa.

### 6.5 · Fusionar sesiones — probablemente nunca
La que menos aporta y la que más puede romper.

### 6.6 · Grupos de perfil — SIN DECIDIR
Pilates, recuperación, embarazadas. Antes de tocar nada hay que decidir si son una etiqueta
del paciente o algo con entidad propia, y esa decisión condiciona el resto.
