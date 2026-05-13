-- ══════════════════════════════════════════
-- SIE · Esquema de base de datos
-- Ejecutar en Supabase → SQL Editor
-- ══════════════════════════════════════════

-- PACIENTES
create table if not exists pacientes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nombre text not null,
  apellidos text not null,
  dni text,
  fecha_nacimiento date,
  telefono text,
  email text,
  altura_cm int,
  peso_kg numeric(5,2),
  como_nos_conocio text,
  tipo_clase text check (tipo_clase in ('entrenamiento','pilates','rehabilitacion')),
  estado text default 'activo' check (estado in ('activo','baja','pausa')),
  notas text,
  foto_url text
);

-- BONOS
create table if not exists bonos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  tipo text not null check (tipo in ('esencial','progreso','avanzado','avanzado_mas1')),
  dias_semana int not null check (dias_semana between 1 and 5),
  estado_pago text default 'pendiente' check (estado_pago in ('pagado','pendiente','impago')),
  mes int,
  anio int,
  fecha_inicio date,
  activo boolean default true
);

-- CITAS
create table if not exists citas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  fecha date not null,
  hora time not null,
  sala text not null check (sala in ('A','B')),
  tipo text default 'clase' check (tipo in ('clase','individual','valoracion','revaloracion')),
  duracion_min int default 50,
  estado text default 'programada' check (estado in ('programada','realizada','cancelada','falta')),
  notas text,
  serie_id uuid
);

-- EJERCICIOS (biblioteca)
create table if not exists ejercicios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nombre text not null,
  descripcion text,
  video_url text,
  imagen_url text,
  etiquetas jsonb default '[]'
);

-- SESIONES DE ENTRENAMIENTO
create table if not exists sesiones (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  cita_id uuid references citas(id) on delete set null,
  nombre text not null,
  descripcion text,
  duracion_min int default 50,
  estado text default 'borrador' check (estado in ('borrador','lista','realizada')),
  partes jsonb default '[]'
);

-- TESTS
create table if not exists tests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  nombre text not null,
  descripcion text,
  video_url text,
  etiquetas_bloquea jsonb default '[]',
  frecuencia_meses int default 3,
  personalizado boolean default false
);

-- RESULTADOS DE TESTS (por paciente)
create table if not exists resultados_tests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  test_id uuid references tests(id),
  paciente_id uuid references pacientes(id) on delete cascade,
  fecha date not null,
  resultado text check (resultado in ('positivo','negativo','sin_realizar')),
  observaciones text,
  fecha_repeticion date
);

-- VALORACIONES
create table if not exists valoraciones (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  fecha date not null,
  tipo text default 'inicial' check (tipo in ('inicial','revaloracion')),
  anamnesis text,
  trabajo text,
  tipo_jornada text,
  objetivos jsonb default '[]',
  deseo text,
  borg int check (borg between 0 and 10),
  estres int check (estres between 0 and 10),
  estado_general text
);

-- MOLESTIAS
create table if not exists molestias (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  zona text not null,
  tipo text check (tipo in ('molestia','dolor_agudo','dolor_cronico','rigidez')),
  eva int check (eva between 0 and 10),
  sensacion text,
  observaciones text,
  activa boolean default true
);

-- PATOLOGÍAS
create table if not exists patologias (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  nombre text not null,
  estado text default 'activa' check (estado in ('activa','cronica','resuelta')),
  descripcion text,
  informe_url text
);

-- MEDICAMENTOS
create table if not exists medicamentos (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  nombre text not null,
  frecuencia text,
  observaciones text
);

-- ESCALAS (Borg y estrés histórico)
create table if not exists escalas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  fecha date not null,
  borg int check (borg between 0 and 10),
  estres int check (estres between 0 and 10)
);

-- NOTAS
create table if not exists notas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  paciente_id uuid references pacientes(id) on delete cascade,
  texto text not null,
  tipo text default 'info' check (tipo in ('urgente','info','trabajadores')),
  visible_agenda boolean default false,
  fecha date default current_date
);

-- ROW LEVEL SECURITY (solo usuarios autenticados acceden)
alter table pacientes enable row level security;
alter table bonos enable row level security;
alter table citas enable row level security;
alter table ejercicios enable row level security;
alter table sesiones enable row level security;
alter table tests enable row level security;
alter table resultados_tests enable row level security;
alter table valoraciones enable row level security;
alter table molestias enable row level security;
alter table patologias enable row level security;
alter table medicamentos enable row level security;
alter table escalas enable row level security;
alter table notas enable row level security;

-- POLÍTICAS: solo usuarios autenticados pueden leer y escribir
create policy "Autenticados pueden todo en pacientes" on pacientes for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en bonos" on bonos for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en citas" on citas for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en ejercicios" on ejercicios for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en sesiones" on sesiones for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en tests" on tests for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en resultados_tests" on resultados_tests for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en valoraciones" on valoraciones for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en molestias" on molestias for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en patologias" on patologias for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en medicamentos" on medicamentos for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en escalas" on escalas for all to authenticated using (true) with check (true);
create policy "Autenticados pueden todo en notas" on notas for all to authenticated using (true) with check (true);

-- DATOS INICIALES: tests básicos del método SIE
insert into tests (nombre, descripcion, etiquetas_bloquea, frecuencia_meses) values
('Test de Thomas', 'Evalúa acortamiento de psoas ilíaco y recto femoral. Paciente en decúbito supino, flexión máxima de una rodilla al pecho.', '["Arrodillado","Psoas","Extensión activa cadera"]', 3),
('Test Trendelenburg', 'Evalúa fuerza del glúteo medio. Paciente de pie sobre una pierna, se observa si la pelvis cae.', '[]', 3),
('Test de Ober', 'Evalúa acortamiento del tensor de la fascia lata. Paciente en decúbito lateral.', '["TFL","Cintilla iliotibial"]', 3),
('Test de movilidad cervical', 'Evalúa rangos activos de movilidad cervical en todos los planos.', '[]', 6),
('Test SIE · Control motor lumbar', 'Test propio del método SIE. Evalúa estabilidad y control motor lumbar bajo carga.', '["Carga axial alta","Hiperflexión lumbar"]', 3);
