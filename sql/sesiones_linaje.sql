-- LINAJE DE SESIONES: de qué versión viene cada sesión.
--
-- El problema: al cabo de unos meses un paciente tiene ocho sesiones llamadas casi
-- igual y no hay forma de saber cuál sustituyó a cuál, ni desde cuándo. La ficha las
-- lista por fecha de creación, que dice cuándo se escribió pero no qué reemplazó.
--
-- UNA COLUMNA. `evolucion_de` apunta a la sesión de la que esta es la siguiente
-- versión. Null = es la primera de su cadena.
--
-- Por qué no se guarda el NÚMERO de versión:
--   Sería una segunda verdad. Si alguien borra una versión intermedia, el número
--   guardado miente y la cadena no. Se cuenta recorriendo `evolucion_de` hacia atrás
--   —`versionDe()` en src/lib/linaje.ts—, igual que el modo de la sesión se calcula de
--   sus partes en vez de guardarse.
--
-- Por qué la sesión nueva es una COPIA y no una edición de la anterior:
--   Las citas pasadas apuntan a la sesión que se hizo ese día. Si se editara en sitio,
--   el historial de febrero pasaría a decir que se hizo el entrenamiento de mayo, y el
--   resumen de volumen —que lee `citas.sesion_id` hacia atrás— dejaría de ser cierto.
--   Copiar cuesta una fila; editar cuesta el historial.
--
-- `on delete set null`: borrar una versión vieja no puede llevarse por delante la
-- nueva. La cadena se rompe y la versión pasa a contarse desde ahí, que es
-- exactamente lo que ha pasado.

alter table sesiones add column if not exists evolucion_de uuid
  references sesiones(id) on delete set null;

-- Se consulta siempre en el mismo sentido: "¿qué sesión evolucionó de esta?", para
-- saber si una versión es la última de su cadena.
create index if not exists idx_sesiones_evolucion_de on sesiones(evolucion_de);

-- SESIONES FIJAS: las que no entran en la tanda nueva.
--
-- El caso real: una sesión de descarga de gemelo que al paciente le va bien y se repite
-- tal cual mes tras mes. Versionarla cada vez crearía copias idénticas y ensuciaría el
-- linaje con seis versiones que nunca cambiaron.
--
-- Se marca lo que se queda FIJO, no lo que se versiona. Lo normal es que todo evolucione
-- y la excepción es esta; si hubiera que marcar las versionables, cada tanda habría que
-- volver a marcar cuatro sesiones para conseguir el comportamiento por defecto, y la que
-- se olvide se queda congelada sin que nadie se entere.
alter table sesiones add column if not exists fija boolean default false;

-- Fuera queda, a propósito:
--
--   PLANTILLA DE ORIGEN. De qué plantilla salió una sesión no es linaje: la plantilla
--   es un molde, no una versión anterior del programa de ESE paciente. Mezclarlas haría
--   que todas las sesiones de la clínica colgaran de diez raíces comunes y "v4" pasaría
--   a significar "la cuarta persona que usó esta plantilla".
--
--   FECHA DE VIGENCIA. Desde cuándo manda cada versión ya está en las citas: la primera
--   cita futura que la lleva. Una columna de fechas sería otra verdad que puede
--   contradecir a la agenda.
