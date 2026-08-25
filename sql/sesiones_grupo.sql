-- PROGRAMAR UNA SESIÓN A UN GRUPO
--
-- De qué plantilla salió la copia que tiene un paciente.
--
-- Sin esto, volver a pasar el programador de grupos le crearía a cada paciente una
-- SEGUNDA copia con el mismo nombre, y no habría forma de saber cuál de las dos está
-- en sus citas. Con el enlace, la segunda pasada reconoce la que ya tiene y solo le
-- rellena las citas que le falten.
--
-- NO es lo mismo que `evolucion_de` (sql/sesiones_linaje.sql). Aquel dice de qué
-- VERSIÓN sale esta —el linaje de tandas—; este dice de qué MOLDE se sacó. Una sesión
-- puede tener los dos.
--
-- `on delete set null`: borrar la plantilla no puede llevarse por delante las sesiones
-- que ya está entrenando la gente. Se pierde el enlace, que es lo único prescindible.

alter table sesiones
  add column if not exists plantilla_id uuid references sesiones(id) on delete set null;

create index if not exists sesiones_plantilla_idx on sesiones(plantilla_id);
