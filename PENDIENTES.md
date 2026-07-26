# Pendientes · App SIE

Lista única de cosas aparcadas. Al cerrar una, se borra de aquí.

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

### 1.2 · Registrar sesiones en el historial
El filtro "Entreno" del historial existe pero **nadie escribe nunca el tipo `entrenamiento`**,
así que marca siempre 0. Se decide al revisar la pestaña Entrenamiento.

Contexto: las sesiones (`sesiones`) se crean desde `EntrenoTab` (nueva y duplicar) y desde el
Pilar Taller (duplicar). Tienen `estado` borrador/lista/realizada pero **nada las marca como
realizada**: el cron `api/cron/actualizar-citas` solo marca *citas*.

Propuesta sobre la mesa: registrar la **asignación** de sesión, no la asistencia. Enganchar el
evento a las citas realizadas metería 2-3 eventos por semana y por paciente y ahogaría la
cronología; la asistencia ya está medida en Resultados.

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

### 3.2 · Preferencias horarias vs horas reales
Cruzar `valoraciones.dias_asistencia` y `valoraciones.franja` con las horas que el paciente
tiene realmente asignadas en `citas`, para detectar a quién se podría recolocar y repartir
mejor las clases. **Va en el Pilar Agenda, no en la ficha.**

### 3.3 · Perfil completo del paciente
Indicador de datos que faltan. **Descartado en el listado** (desvirtúa la naturaleza de la
lista). Sin decidir si tiene sentido dentro de la ficha.

Si se retoma, quedó sin cerrar:
- Qué campos son obligatorios de verdad frente a opcionales. Un contador crudo tipo "17 de 23"
  trata igual el DNI que "cómo nos conoció", y en 200 filas deja de mirarse.
- Dónde vive la firma. Hay `firma_canvas` en el flujo de valoración pero no en `pacientes`.

### 3.4 · Compresión de fotos al subir
`subirFoto` en `pacientes/[id]/page.tsx` ya convierte HEIC con `heic2any` pero **sube el
original**. Una foto de iPhone son 2-4 MB para pintarse a 84px. Añadir un paso de canvas
(máx. 600px, JPEG 0.8) antes del upload la deja en ~60 KB.

El listado ya no carga fotos, así que esto solo afecta al avatar de la ficha.

---

## 4. Deuda técnica

- **21 errores de TypeScript preexistentes**, todos `implicit any`, en `ModalTareas` (12),
  `ListasTab` (4), `ModalNuevaCita`, `ajustes/page.tsx`, `CatalogoTab`, `MolestiasBibTab` y
  `PatologiasTab`. No rompen nada, pero enmascaran errores nuevos: la forma fiable de detectar
  una regresión es comparar el **desglose por fichero**, no el total.
- **Tratamiento visual por pestaña.** Ficha e Historial ya usan `.panel`, secciones sin caja y
  texto 13/12px. Salud, Entrenamiento y Resultados siguen con `.card` y 11/10/9px. Se va
  arreglando a medida que se toca cada pestaña, no en una pasada aparte.
