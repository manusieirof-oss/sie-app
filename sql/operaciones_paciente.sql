-- OPERACIONES DEL PACIENTE: la tabla que faltaba.
--
-- Patologías, molestias, medicación, alergias, intolerancias y deportes tienen cada una su
-- tabla del paciente. Las operaciones no: se apuntaban en la valoración y acababan dentro
-- del JSON `estado_general` de `valoraciones`, que es texto en una sola casilla. Con eso no
-- se podía ni verlas en Salud, ni darlas de baja, ni preguntar quién tiene una prótesis.
--
-- Y una operación es del PACIENTE, no de la valoración en que se apuntó. Vivir dentro de un
-- acto fechado significaba que al hacer la segunda valoración había dos listas de
-- operaciones —la de marzo y la de octubre— sin forma de saber cuál manda.
--
-- Aditivo: no toca nada de lo que ya existe. Lo que quedó guardado en los JSON antiguos NO
-- se migra aquí (ver el final del fichero).

create table if not exists operaciones_paciente (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  nombre text not null,
  -- Año y no fecha completa: nadie recuerda el día en que le operaron el menisco, y una
  -- fecha exacta inventada se lee después como si fuera un dato fiable.
  anio text,
  lado text,
  observaciones text,
  -- Igual que en `patologias`: marca que existe informe, sin ser el informe. El fichero
  -- vive en `documentos`, con su bucket privado.
  tiene_informe boolean default false
);

create index if not exists idx_operaciones_paciente on operaciones_paciente(paciente_id);

alter table operaciones_paciente enable row level security;

drop policy if exists "operaciones_paciente todo" on operaciones_paciente;
create policy "operaciones_paciente todo" on operaciones_paciente
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';

-- LO QUE NO HACE ESTE FICHERO, A PROPÓSITO:
--
--   MIGRAR LAS OPERACIONES DE LOS JSON VIEJOS. Están en `valoraciones.estado_general` de
--   cada valoración ya hecha, y el mismo paciente puede tenerlas repetidas en varias. Una
--   migración a ciegas le duplicaría el menisco a todo el que tenga dos valoraciones.
--   Se hace desde la app, con una página de mantenimiento que lea, agrupe por paciente y
--   nombre, y solo inserte lo que no esté — la misma regla que los sembradores.
--
--   QUITARLAS DEL JSON. `estado_general` sigue guardándolas como foto de aquel día. Es
--   inofensivo mientras nadie las lea de ahí para decidir nada: la lista viva es esta tabla.
