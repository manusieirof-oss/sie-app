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
- **`tsconfig.tsbuildinfo` está en el repo.** Es un artefacto de compilación: ensucia el diff
  de cada commit y no aporta nada. Meterlo en `.gitignore` y sacarlo del índice.
