-- =====================================================================
--  DOCUMENTOS DEL PACIENTE  ·  ejecutar en el SQL Editor de Supabase
-- =====================================================================
--  Informes médicos, pruebas de imagen, consentimientos. Son datos de
--  salud, así que el bucket va PRIVADO y se sirven con URL firmada.
-- =====================================================================

-- 1) TABLA -------------------------------------------------------------
create table if not exists documentos_paciente (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  paciente_id   uuid not null references pacientes(id) on delete cascade,
  -- Opcional: ata el documento a una patología ("informe de la lumbalgia").
  patologia_id  uuid references patologias(id) on delete set null,
  nombre        text not null,
  tipo          text default 'informe',   -- informe | imagen | consentimiento | otro
  -- OJO: se guarda la RUTA dentro del bucket, no una URL.
  -- Las URLs firmadas caducan, así que guardarlas dejaría enlaces muertos.
  ruta          text not null,
  mime          text,
  tamano_bytes  int,
  fecha         date default current_date,
  notas         text
);

create index if not exists idx_documentos_paciente on documentos_paciente(paciente_id);

alter table documentos_paciente enable row level security;

drop policy if exists "Autenticados pueden todo en documentos_paciente" on documentos_paciente;
create policy "Autenticados pueden todo en documentos_paciente"
  on documentos_paciente for all to authenticated
  using (true) with check (true);


-- 2) BUCKET PRIVADO ----------------------------------------------------
-- El tercer parámetro (public) va en FALSE. Esta es la diferencia con
-- el bucket 'fotos', que es público y por eso no vale para informes.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do update set public = false;


-- 3) PERMISOS SOBRE EL BUCKET -----------------------------------------
-- Solo usuarios con sesión iniciada. Sin esto, ni la propia app puede leer.
drop policy if exists "Autenticados leen documentos"     on storage.objects;
drop policy if exists "Autenticados suben documentos"    on storage.objects;
drop policy if exists "Autenticados borran documentos"   on storage.objects;

create policy "Autenticados leen documentos" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');

create policy "Autenticados suben documentos" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

create policy "Autenticados borran documentos" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');


-- 4) LIMPIEZA ----------------------------------------------------------
-- patologias.informe_url guardaba el texto literal 'pendiente' y nunca
-- apuntó a ningún fichero. Ahora la relación va por documentos_paciente.
-- Descomenta si quieres borrar ese resto:
-- update patologias set informe_url = null where informe_url = 'pendiente';
