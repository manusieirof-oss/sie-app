# Pendientes · App SIE

Lista única de cosas aparcadas. Al cerrar una, se borra de aquí.

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
**El eslabón que falta en la cadena.** El taller **no lee `citas` en ningún sitio** — comprobado
en `taller/page.tsx` y `ModoClase.tsx`. Así que la sesión que se asigna en Planificación no le
llega: en Modo Clase se teclean los pacientes a mano ("Añade los pacientes que vienen hoy")
cuando la agenda ya sabe quién viene a esa hora y a esa sala, y la sesión asignada no aparece
preseleccionada en el desplegable.

**Cambio acordado**, para cuando toque el Pilar Taller:

1. El taller arranca de fecha + sala: trae los pacientes con cita y cada uno con su sesión ya
   cargada. Si no tiene, se elige de las suyas; si hay un problema, se cambia sobre la marcha.
2. **Modo de sesión como propiedad de la sesión**, no como pestaña del taller. Hoy "fuerza" es
   una pestaña, y es un modo de trabajar, no un tipo de paciente. La sesión declara cómo se
   ejecuta y el taller la pinta en consecuencia.
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

**Antes hay que arreglar el dato.** `api/cron/actualizar-citas` marca como `realizada`
toda cita pasada que siguiera en `programada`. Una falta solo existe si alguien la
marca a mano, así que hoy el que no viene queda registrado como que vino y ninguna
regla saltaría nunca. Se resuelve cuando el taller arranque de la agenda (ver 1.2):
con los pacientes del día delante, marcar quién no apareció es un toque.

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

### 6.3 · Propuesta de cambio ejercicio a ejercicio — PENDIENTE
Que al crear la tanda nueva se propongan sustituciones **con el motivo escrito al lado**
("tracción vertical a cero", "lleva ocho semanas con este"), y se acepten o rechacen una a una.

**Faltan tres datos que hoy no existen:**

- **Favorito del paciente.** Qué ejercicios no se le tocan porque le funcionan o le gustan.
- **Partes intocables.** Qué bloques no entran en el cambio automático.
- El tercero, la vigencia de cada versión, ya está resuelto por 6.2: lo dicen las citas.

### 6.4 · Cambio masivo — PENDIENTE, y solo accesorios
El botón de "cámbiame todos los ejercicios". Limitado a accesorios a propósito: si el bloque
principal se cambia solo, deja de ser un programa.

### 6.5 · Fusionar sesiones — probablemente nunca
La que menos aporta y la que más puede romper.

### 6.6 · Grupos de perfil — SIN DECIDIR
Pilates, recuperación, embarazadas. Antes de tocar nada hay que decidir si son una etiqueta
del paciente o algo con entidad propia, y esa decisión condiciona el resto.
