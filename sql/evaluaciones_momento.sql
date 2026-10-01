-- Evaluacion AL EMPEZAR una fase, ademas de la de salida.
--
-- Cada fase tenia una sola evaluacion: la de salida, que dice si se pasa a la
-- siguiente. Pero hay tests que hoy no se pueden hacer por como esta el paciente
-- y que tienen sentido justo al empezar una fase posterior. Sin un sitio donde
-- dejarlo programado, ese "medir antes de la fase 2" se quedaba en la cabeza.
--
-- La inicial NO decide nada: no cierra objetivos ni mueve la fase. Es el punto de
-- partida. Por eso es la misma tabla con una columna que dice cual de las dos es,
-- y no otra tabla: la lista de tests, los dias por test y la atribucion de
-- resultados funcionan igual en las dos.
--
-- Lo existente es todo de salida: el default lo deja asi sin tocar filas.

alter table evaluaciones
  add column if not exists momento text not null default 'final'
  check (momento in ('inicial', 'final'));

-- Una de cada por fase, en vez de una por fase. Se busca y se quita la unica que
-- hubiera sobre (asignacion_id, fase_id), sea restriccion o indice, sin depender
-- de su nombre.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'evaluaciones'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike 'UNIQUE (asignacion_id, fase_id)'
  loop
    execute format('alter table evaluaciones drop constraint %I', r.conname);
  end loop;
  for r in
    select indexname from pg_indexes
    where tablename = 'evaluaciones' and indexdef ilike '%unique%'
      and indexdef ilike '%(asignacion_id, fase_id)%'
  loop
    execute format('drop index if exists %I', r.indexname);
  end loop;
end $$;

create unique index if not exists evaluaciones_asig_fase_momento
  on evaluaciones (asignacion_id, fase_id, momento);
