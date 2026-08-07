# Estado de la app · agosto 2026

Resumen para arrancar una conversación nueva. Lo que hay que saber para no romper nada y
para no volver a discutir decisiones ya tomadas.

---

## Cómo se trabaja aquí

- **Los cambios se hacen directamente en `~/Desktop/sie-app`.** Nada de pegar código para
  que lo apliques tú.
- **Nunca ejecutar git desde el asistente**: deja `index.lock`. Se te pasa el comando.
- **No hay acceso a tu Supabase desde el asistente.** Cualquier cambio de datos se hace con
  una página dentro de la app (los sembradores), porque `.env.local` solo tiene la clave
  anónima y las políticas RLS exigen sesión iniciada.
- **El SQL se pega en el mensaje, siempre.** Decir "ejecuta el SQL" sin pegarlo ya costó dos
  rondas de errores.
- **Verificación:** `npx tsc --noEmit`. Hay **17 errores preexistentes** (`implicit any`) en
  ModalTareas (12), ListasTab (4), ajustes/page y ModalNuevaCita. Lo que importa es el
  **desglose por fichero**, nunca el total.
- Respetar los tokens de `globals.css`. Iconos con `<Ic name="..."/>`. Sin emojis.
- **El IMC no se quiere en ningún sitio.**

## Reglas que rigen el diseño

**Una sola verdad.** El patrón que más ha costado: la misma regla escrita en varios sitios,
divergiendo en silencio. Ya centralizado en `lib/`: objetivos, sesiones, tests, metas,
volumen, rotación, linaje, contraindicaciones, etiquetas.

**Ningún sembrador pisa lo que ya tiene contenido.** Solo rellenan huecos. Un sembrador que
deshaga trabajo hecho a mano es una trampa.

**El aviso va donde se toma la decisión**, no en el recibo de después.

**Lo derivado no se guarda.** El modo de una sesión sale de sus partes, la versión sale de
la cadena, el valor actual de una meta sale del último test. Guardar una copia es tener dos
verdades que discreparán.

**Se avisa, no se impide.** Un bloqueo duro se esquiva por fuera de la app y entonces no
queda registrado.

---

## Lo construido, por pilares

### Biblioteca · Ejercicios
113 ejercicios con 309 variantes, descripción, criterios, feedbacks, etiquetas e imagen.
La rejilla es `ExploradorEjercicios`, compartida con el editor de sesión.

### Biblioteca · Etiquetas
Árbol editable: renombrar, mover, fusionar, borrar y cambiar de categoría, con **contador de
usos** por etiqueta. Orden anatómico por segmentos (cabeza y cuello → tronco → miembro
superior → miembro inferior), de `lib/anatomia.ts`. El sembrador de etiquetas **se retiró**:
llevaba instrucciones de MOVER/FUSIONAR que deshacían los cambios hechos a mano.

### Biblioteca · Tests
49 tests. 29 de exploración agrupados **por estructura** —las 31 maniobras de rodilla en 6
fichas— más 20 de medición que **espejan** los espacios métricos de objetivos, generados del
mismo mapa de movimientos para que no puedan divergir.

La **unidad va por ítem** (grados, cm, segundos, repeticiones, kg), no por test, y se congela
con el resultado. `lib/tests.ts` es el único sitio que registra un resultado: guarda la fila,
deja el evento y mueve los objetivos.

`etiquetas_bloquea` ya funciona: un test positivo desaconseja etiquetas de ejercicio y avisa
en el editor de sesión. Un negativo posterior lo levanta. **Están todas vacías: hay que
marcarlas a mano** en cada test.

### Biblioteca · Objetivos
Tres familias y **solo una lleva número**:
- `metrico` — lo cierra una medición. La biblioteca guarda el **espacio** (articulación ×
  métrica, 20 fichas); el movimiento, el lado y la meta se eligen por paciente.
- `fase` — progresión de una tanda a la siguiente. La avanza el entrenador.
- `cualitativo` — se cumple o no.

Metas: mejorar, igualar lados o igualar con el antagonista. Umbral de igualdad **10%**, en
código. Toda meta nace atada a un ítem de test. El objetivo se cierra solo cuando no le queda
ninguna meta abierta.

### Biblioteca · Clínico
Las seis listas —patologías, molestias, medicamentos, alergias, intolerancias, operaciones—
en **un solo componente**, con alta, edición, descripción y las mismas etiquetas que todo lo
demás. Avisa de las zonas que el mapa corporal no sabe colocar.

### Pacientes · Sesiones y programa
**Tandas**: `evolucionar` copia las sesiones de la agenda futura y repunta esas citas. Las
citas pasadas nunca se tocan. El número cuenta cuántas van en el linaje, no saltos de cadena.
Se puede **partir de cualquier tanda anterior**. Sesiones **fijas** quedan fuera.

**Repartir en las citas**: rotación en bucle sobre las citas futuras en orden. Los 2, 3, 4 o
5 días no se modelan — ya lo sabe la agenda.

**Resumen de trabajo por zonas y patrones** en Resultados: cuenta lo asistido, no lo
prescrito, y mide en series.

### Pacientes · Rondas
Preguntar lo mismo a todos y saber a quién falta. Columna en la lista, con respuesta escrita
y contador de pendientes. Se abre y cierra desde Ajustes.

---

## Orden de los sembradores

**Ajustes → Mantenimiento.** Cada uno se apoya en el anterior:

    1 ejercicios → 2 sesiones → 3 tests → 4 objetivos

---

## Lo que queda pendiente

Ver `docs/PENDIENTES.md`, organizado por Pilar y pestaña. Lo gordo:

- **Tabla de ejercicios para casa** — lo que justifica las 117 imágenes. Sin diseñar.
- **Propuesta de cambio de ejercicios** al crear la tanda. Faltan dos datos: el **favorito
  del paciente** y las **partes intocables**.
- **Avisos de asistencia**. Antes hay que arreglar que el cron marca como "realizada" toda
  cita pasada, así que hoy nadie falta nunca.
- **El taller no lee la agenda**: los pacientes del día se teclean a mano.
- **VALD** — decidir si el número se copia a mano o solo consta el resultado.
- **Grupos de perfil** (Pilates, recuperación, embarazadas) — sin decidir si son una etiqueta
  del paciente o algo con entidad propia.
