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

### 1.3 · Objetivos: filtro previo por zona o similitud
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

### 1.4 · Marcar sesiones como realizadas
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
