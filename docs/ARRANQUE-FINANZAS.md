# Arranque · Finanzas y Estadísticas

Mensaje para pegar al abrir el chat nuevo. Debajo del todo, la versión corta.

---

Voy a trabajar en **SIE App**, la aplicación de gestión de mi clínica de fitness y rehabilitación. Next.js 14 (App Router), TypeScript, React 18 y Supabase. Soy el único que la desarrolla. Hoy toca el pilar de **Finanzas** y el de **Estadísticas**.

## Cómo se trabaja aquí

- **Los cambios se hacen directamente en `~/Desktop/sie-app`.** Nada de pegarme código para que lo aplique yo.
- **Nunca ejecutes git.** Deja ficheros de bloqueo. Pásame el comando y lo lanzo yo.
- **No tienes acceso a mi Supabase**: `.env.local` solo tiene la clave anónima y las políticas RLS exigen sesión iniciada. Cualquier cambio de datos se hace con una página dentro de la app (los sembradores), no con un script.
- **El SQL me lo pegas en el mensaje, siempre.** Decir "ejecuta el SQL" sin pegarlo ya costó dos rondas de errores.
- **Verificación:** `npx tsc --noEmit`. Hay **17 errores preexistentes** de `implicit any` en ModalTareas (12), ListasTab (4), ajustes/page y ModalNuevaCita. Lo que importa es el **desglose por fichero**, nunca el total. Si aparecen errores en `.next/types`, es basura de compilación: se va con `rm -rf .next`.
- Respeta los tokens de `globals.css`. Iconos con `<Ic name="..."/>`. **Sin emojis.**
- Antes de un cambio grande, propónmelo. Si es visual, enséñame un boceto.
- **Respuestas cortas y filtradas.** No me des mil vueltas ni te inventes botones de más.
- Cuando toquemos algo, **revisa qué funciones afecta**.

## Reglas que rigen el diseño

Estas se han ganado a base de fallos, así que van en serio:

**Una sola verdad.** El problema que más ha costado: la misma regla escrita en varios sitios, divergiendo en silencio. Ya está centralizado en `lib/`: objetivos, sesiones, tests, metas, volumen, rotación, linaje, contraindicaciones, etiquetas, taller, asignarCita.

**Lo derivado no se guarda.** El modo de una sesión sale de sus partes, la versión sale de la cadena, el valor de una meta sale del último test. Guardar una copia es tener dos verdades que un día discreparán. *(Esto ya ha mordido: un contador de "sin sesión" congelado en un texto seguía diciendo que faltaba uno después de ponerla.)*

**Nada que borre trabajo hecho.** Ningún sembrador pisa un campo que ya tenga contenido. Si añado algo a mano, se respeta.

**El aviso va donde se toma la decisión**, no en un recibo posterior.

**Se avisa, no se impide.** Un bloqueo duro se esquiva por fuera de la app y entonces no queda registrado.

**Nada de fallos en silencio.** Si una consulta falla, que lo diga. Ya hemos tenido dos casos: un filtro que devolvía error y la pantalla decía "no hay citas", y otro que descartaba pacientes sin decir por qué.

**El IMC no se quiere en ningún sitio.**

## Lo que ya existe de estos dos pilares

### Finanzas — `src/app/finanzas/`

Página con control de acceso: solo `rol = 'admin'` o `permisos.finanzas === true` en la tabla `perfiles`. Cinco pestañas:

- **Resumen** (`ResumenTab`, 236 líneas)
- **Planes** (`PlanesTab`, 177) — por cada tipo de bono: pacientes activos e ingreso real con descuentos aplicados.
- **Gastos** (`GastosTab`, 202) — desglose en vivo a partir del total con IVA incluido.
- **Impuestos** (`ImpuestosTab`, 138) — por trimestres, precio final e IVA por tipo de bono.
- **Rentabilidad** (`RentabilidadTab`, 131) — foto del mes actual.

La lógica de bonos vive en **`src/lib/bonos.ts`**: `cargarBonosTipos`, `cambiarEstadoPago`, `precioConDescuento` y `renovarCuotas` (con modo de prueba). Hay un `AvisoRenovacion` en la raíz de la app.

Tablas que toca: `bonos`, `planes`, `gastos`, `pacientes`, `perfiles`, `recuperaciones`.

### Estadísticas — `src/app/estadisticas/page.tsx`

Un solo fichero de **539 líneas** con tres pestañas: `actividad`, `pacientes`, `clinico`. Lee de `citas`, `pacientes`, `sesiones`, `resultados_tests`, `objetivos`, `pacientes_objetivos`, `patologias`, `molestias`.

## Contexto de otros pilares que puede hacer falta

- La **agenda** manda sobre las citas: quién viene, a qué hora, en qué sala y **el estado de la cita** (vino, no vino, canceló). Eso se pone solo ahí.
- Una **cita** tiene `sesion_id`. El taller, la agenda y Planificación escriben ese campo por igual.
- El **cron** `api/cron/actualizar-citas` marca como `realizada` toda cita pasada que siguiera en `programada`. Ojo con esto para cualquier estadística de asistencia: hoy el que no viene queda como que vino salvo que se marque a mano.
- El resumen de volumen (`lib/volumen.ts`) cuenta atravesando `citas → sesiones.partes`, y solo las citas en estado `realizada`.

Hay más contexto en `docs/ESTADO.md` y la lista de pendientes en `docs/PENDIENTES.md`, organizada por Pilar y pestaña.

## Por dónde quiero empezar

*(Rellena esto tú antes de enviarlo, o déjalo y que te pregunte.)*

---

## Versión corta

> Trabajo en SIE App (Next.js 14 + TypeScript + Supabase), la gestión de mi clínica de fitness y rehabilitación. Hoy toca **Finanzas** y **Estadísticas**.
>
> Cómo trabajamos: editas directamente en `~/Desktop/sie-app`, **nunca ejecutas git** (me pasas el comando), **no tienes acceso a mi Supabase** —cualquier cambio de datos va en una página dentro de la app— y **el SQL me lo pegas siempre en el mensaje**. Verificas con `npx tsc --noEmit`: hay 17 errores preexistentes de `implicit any`, mira el desglose por fichero y no el total. Respeta los tokens de `globals.css`, iconos con `<Ic name="..."/>`, sin emojis. Respuestas cortas.
>
> Reglas de diseño que ya están asentadas: **una sola verdad** (las reglas viven en `lib/`, no repetidas por las pantallas), **lo derivado no se guarda**, **nada borra trabajo hecho a mano**, **el aviso va donde se toma la decisión**, **se avisa pero no se impide**, y **nada de fallos en silencio**. El IMC no se quiere en ningún sitio.
>
> Ya existe `src/app/finanzas/` con cinco pestañas (resumen, planes, gastos, impuestos, rentabilidad), protegida por `perfiles.rol = 'admin'` o `permisos.finanzas`, apoyada en `src/lib/bonos.ts`. Y `src/app/estadisticas/page.tsx`, 539 líneas en un solo fichero, con tres pestañas: actividad, pacientes y clínico.
>
> Antes de tocar nada, léete `docs/ARRANQUE-FINANZAS.md`, `docs/ESTADO.md` y `docs/PENDIENTES.md`, y dime qué ves.
