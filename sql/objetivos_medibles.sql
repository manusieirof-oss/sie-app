-- OBJETIVOS MEDIBLES
--
-- El problema: "Ganar fuerza y control cervical" no se puede cerrar. No dice qué se mide,
-- en qué movimiento, en qué lado ni contra qué, así que nadie lo cierra nunca y la lista
-- de objetivos abiertos crece hasta que se deja de mirar.
--
-- TRES FAMILIAS, Y SOLO UNA LLEVA NÚMERO:
--
--   metrico     Fuerza o movilidad, con movimiento, lado y meta. Lo cierra una medición.
--   fase        Progresión de una tanda del programa a la siguiente. La avanza el
--               entrenador al montar la tanda nueva, no un número.
--   cualitativo "Aprender a hacer el puente de glúteo". Se cumple o no.
--
-- Forzar un porcentaje a "conciencia y activación básica" sería inventarse una precisión
-- que no existe, y por eso la familia va en el objetivo y no todos llevan meta.
--
-- SIN "+" NI "=" EN LOS NOMBRES. En el programa anterior el tipo de meta iba pegado al
-- nombre —"Rotación interna hombro F="— porque no había dónde guardarlo. Aquí es un campo,
-- y el objetivo se lee en castellano.

-- ── La biblioteca guarda el ESPACIO, no la combinación ──────────────────────
--
-- Una ficha por articulación × métrica —"Fuerza de hombro"—, no una por movimiento. Son
-- unas 20 en vez de las 160 combinaciones del otro programa, y el movimiento y el lado se
-- eligen al asignarla: si un hombro tiene mal la rotación interna y la externa pero bien la
-- flexión, es UN objetivo de fuerza de hombro con DOS metas.

alter table objetivos add column if not exists tipo text default 'cualitativo'
  check (tipo in ('metrico','fase','cualitativo'));

-- Solo en los métricos. Decide qué unidad tiene sentido y con qué ítem de test se cruza.
alter table objetivos add column if not exists metrica text
  check (metrica is null or metrica in ('fuerza','movilidad'));

-- La articulación o zona, del árbol de etiquetas que ya existe. Sirve para filtrar la
-- pestaña por zona y para contar cuántos pacientes tienen objetivos de hombro abiertos,
-- que hoy no se sabe. Se reutiliza el árbol en vez de crear una segunda taxonomía.
alter table objetivos add column if not exists articulacion_id uuid references etiquetas(id) on delete set null;

-- Cuántas fases tiene, solo en los de tipo 'fase'. Antes eran cuatro fichas distintas
-- —"Suelo pélvico F1", "F2"…—; así es una sola y el progreso se ve de un vistazo.
alter table objetivos add column if not exists fases int;

-- ── El paciente guarda las METAS ────────────────────────────────────────────

alter table pacientes_objetivos add column if not exists fase_actual int;

create table if not exists objetivos_metas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  objetivo_id uuid references objetivos(id) on delete cascade,

  -- Qué movimiento, del árbol de etiquetas. Faltan los finos: hoy hay "Rotación" pero no
  -- rotación interna ni externa, que son media lista. Se crean desde Biblioteca.
  movimiento_id uuid references etiquetas(id) on delete set null,
  lado text default 'bilateral' check (lado in ('izquierdo','derecho','bilateral')),

  -- mejorar            contra el valor inicial del propio paciente
  -- igualar_lados      contra el lado contrario en la misma medición
  -- igualar_par        contra el movimiento antagonista (flexión vs extensión de rodilla)
  tipo text default 'mejorar' check (tipo in ('mejorar','igualar_lados','igualar_par')),

  unidad text,
  -- De dónde parte. Sin esto, un "+20%" no tiene sobre qué calcularse: la meta queda
  -- pendiente de la primera medición y hay que decirlo, no enseñar un porcentaje de cero.
  valor_inicial numeric,
  -- Una de las dos, no las dos: porcentaje sobre el inicial, o valor absoluto a alcanzar.
  meta_pct numeric,
  meta_valor numeric,

  -- EL ENLACE QUE HACE QUE ESTO VALGA. Sin decir de qué medición sale, el número es
  -- decoración y se vuelve a decidir a ojo. `item_indice` es la posición dentro de
  -- `tests.items`; `item_par_indice` solo en igualar_par, el ítem del antagonista.
  test_id uuid references tests(id) on delete set null,
  item_indice int,
  item_par_indice int,

  cumplida boolean default false,
  fecha_cumplida date,
  -- Cerrada a mano en vez de por una medición. Se guarda para poder distinguirlas después.
  cerrada_a_mano boolean default false,
  nota text
);

create index if not exists idx_objetivos_metas_paciente on objetivos_metas(paciente_id, objetivo_id);

alter table objetivos_metas enable row level security;
drop policy if exists "objetivos_metas todo" on objetivos_metas;
create policy "objetivos_metas todo" on objetivos_metas for all to authenticated using (true) with check (true);

-- Fuera queda, a propósito:
--
--   EL UMBRAL DE "IGUALADO". Va en código (10% de diferencia, lo habitual para dar el alta
--   deportiva) y no como columna por meta: si cada meta pudiera llevar el suyo, dos metas
--   iguales de dos pacientes se cerrarían con criterios distintos sin que nadie lo notara.
--   Si algún día hace falta cambiarlo, se cambia en un sitio.
--
--   LAS PAREJAS AGONISTA/ANTAGONISTA. Flexión contra extensión, rotación interna contra
--   externa. Van en código como las parejas de patrón del informe de volumen: son anatomía,
--   no configuración de la clínica.
--
--   EL VALOR ACTUAL. No se guarda en la meta: se lee del último resultado del test. Copiarlo
--   aquí sería una segunda verdad que empezaría a discrepar en cuanto se corrija un test.
