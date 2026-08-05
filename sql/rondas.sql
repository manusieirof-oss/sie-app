-- RONDAS DE PREGUNTAS: "¿a quién le hemos preguntado ya?"
--
-- El caso real: hay que preguntar a cien pacientes qué horario quieren en septiembre. Se
-- pregunta por la mañana, por WhatsApp, cuando se cruzan en la puerta. Acaba siempre en
-- una hoja de Excel con un tick, y la hoja se pierde o se queda desactualizada.
--
-- NO SE LLAMA "EVENTO" a propósito. Ya existe `eventos_paciente`, que es la cronología
-- clínica del paciente, y dos cosas con el mismo nombre y distinto significado se pagan
-- a los seis meses, cuando alguien lea "evento" y tenga que preguntar cuál de los dos.
--
-- Tampoco es una tarea ni una alerta: una tarea se hace una vez, y esto es la misma
-- pregunta a cien personas con cien respuestas distintas.

create table if not exists rondas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nombre text not null,
  -- Contexto opcional: "para cerrar la agenda antes del 20 de agosto".
  descripcion text,
  estado text default 'abierta' check (estado in ('abierta','cerrada')),
  cerrada_at timestamptz
);

-- Una fila por paciente al que YA se le ha hecho algo. Su ausencia significa pendiente.
--
-- La alternativa era crear cien filas al abrir la ronda, y es peor: habría que decidir
-- qué pasa con el paciente que se da de alta a mitad —o se queda fuera para siempre, o
-- hace falta un proceso que rellene huecos— y el 90% de las filas serían "pendiente",
-- que es justo la información que no hace falta guardar.
create table if not exists rondas_respuestas (
  id uuid default gen_random_uuid() primary key,
  ronda_id uuid references rondas(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete cascade,
  -- 'preguntado'  = se le preguntó y no contestó todavía
  -- 'respondido'  = contestó, y lo que dijo está en `respuesta`
  -- 'no_procede'  = no hay que preguntarle (se va, no le aplica...)
  estado text default 'preguntado' check (estado in ('preguntado','respondido','no_procede')),
  respuesta text,
  updated_at timestamptz default now(),
  unique (ronda_id, paciente_id)
);

create index if not exists idx_rondas_respuestas_ronda on rondas_respuestas(ronda_id);

alter table rondas enable row level security;
alter table rondas_respuestas enable row level security;

drop policy if exists "rondas todo" on rondas;
create policy "rondas todo" on rondas for all to authenticated using (true) with check (true);

drop policy if exists "rondas_respuestas todo" on rondas_respuestas;
create policy "rondas_respuestas todo" on rondas_respuestas for all to authenticated using (true) with check (true);

-- Fuera queda, a propósito:
--
--   A QUIÉN INCLUYE LA RONDA. No se guarda una lista de participantes: son los pacientes
--   activos en el momento de mirar. Congelar la lista al crearla dejaría fuera a quien
--   entre en agosto, que es precisamente a quien más falta hace preguntarle el horario.
--
--   CERRAR NO BORRA. La ronda cerrada conserva sus respuestas: el septiembre siguiente se
--   quiere ver qué dijo cada uno el año anterior.
