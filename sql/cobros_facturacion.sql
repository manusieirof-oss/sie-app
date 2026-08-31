-- ===========================================================================
-- PILAR COBROS · fichero único. Ejecutar entero, de una vez.
-- ===========================================================================
-- Aditivo e idempotente: no borra nada y se puede volver a ejecutar.
--
-- 1. EL COBRO ES EL ACTO, LA FACTURA ES EL DOCUMENTO. Un cobro lleva varias
--    líneas y genera como mucho una factura.
-- 2. LA FACTURA SE CONGELA ENTERA. Excepción consciente a "lo derivado no se
--    guarda": nombre, NIF y domicilio de las dos partes van copiados dentro.
-- 3. UNA FACTURA EMITIDA NO SE EDITA NI SE BORRA. Hay triggers que lo impiden.
--    Para corregir, rectificativa. Es lo que exigirá Verifactu en julio de 2027.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · COLUMNAS QUE FALTABAN
-- ---------------------------------------------------------------------------
alter table pacientes add column if not exists direccion     text;
alter table pacientes add column if not exists codigo_postal text;
alter table pacientes add column if not exists localidad     text;
alter table pacientes add column if not exists provincia     text;

-- Pausa con fecha de vuelta: vacaciones o descanso. Sigue pagando y vuelve solo.
alter table pacientes add column if not exists pausa_desde  date;
alter table pacientes add column if not exists pausa_hasta  date;
alter table pacientes add column if not exists pausa_motivo text;

insert into ajustes (clave, valor) values
  ('fiscal_nombre',''), ('fiscal_nif',''), ('fiscal_direccion',''),
  ('fiscal_cp',''), ('fiscal_localidad',''), ('fiscal_provincia','')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2 · SERIES Y NUMERACIÓN
-- ---------------------------------------------------------------------------
create table if not exists factura_series (
  serie       text primary key,
  descripcion text,
  ultimo      int not null default 0,
  activa      boolean not null default true
);

insert into factura_series (serie, descripcion) values
  ('F', 'Facturas completas'),
  ('S', 'Facturas simplificadas (tiques)'),
  ('R', 'Facturas rectificativas')
on conflict (serie) do nothing;

-- Reserva el siguiente número bajo bloqueo de fila: dos cobros simultáneos no
-- pueden llevarse el mismo. Si se pide un número, se gasta.
create or replace function siguiente_numero_factura(p_serie text)
returns int language plpgsql as $$
declare n int;
begin
  update factura_series set ultimo = ultimo + 1
   where serie = p_serie and activa
  returning ultimo into n;
  if n is null then
    raise exception 'La serie de factura "%" no existe o está desactivada', p_serie;
  end if;
  return n;
end; $$;

-- ---------------------------------------------------------------------------
-- 3 · COBROS Y LÍNEAS
-- ---------------------------------------------------------------------------
create table if not exists cobros (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  paciente_id uuid not null references pacientes(id) on delete restrict,
  fecha       date not null default current_date,
  forma_pago  text not null default 'efectivo'
              check (forma_pago in ('efectivo','tarjeta','transferencia','domiciliacion','otro')),
  notas       text,
  anulado        boolean not null default false,
  anulado_motivo text,
  anulado_en     timestamptz
);

create table if not exists cobro_lineas (
  id        uuid primary key default gen_random_uuid(),
  cobro_id  uuid not null references cobros(id) on delete cascade,
  orden     int  not null default 0,
  concepto  text not null,
  bono_id   uuid references bonos(id) on delete set null,
  cantidad  numeric(10,2) not null default 1,
  base      numeric(10,2) not null,
  iva_pct   numeric(5,2)  not null default 21,
  cuota_iva numeric(10,2) not null,
  total     numeric(10,2) not null,
  exencion  text
);

create index if not exists idx_cobro_lineas_cobro on cobro_lineas(cobro_id);
create index if not exists idx_cobro_lineas_bono  on cobro_lineas(bono_id);
create index if not exists idx_cobros_paciente    on cobros(paciente_id);
create index if not exists idx_cobros_fecha       on cobros(fecha);

-- ---------------------------------------------------------------------------
-- 4 · FACTURAS
-- ---------------------------------------------------------------------------
create table if not exists facturas (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cobro_id   uuid not null references cobros(id) on delete restrict,
  serie      text not null references factura_series(serie),
  numero     int  not null,
  fecha_expedicion date not null default current_date,
  fecha_operacion  date,
  tipo       text not null check (tipo in ('completa','simplificada','rectificativa')),
  rectifica_a      uuid references facturas(id),
  rectifica_motivo text,
  emisor_nombre    text not null,
  emisor_nif       text not null,
  emisor_direccion text,
  receptor_nombre    text,
  receptor_nif       text,
  receptor_direccion text,
  base_total  numeric(10,2) not null,
  cuota_total numeric(10,2) not null,
  total       numeric(10,2) not null,
  unique (serie, numero)
);

create index if not exists idx_facturas_cobro on facturas(cobro_id);
create index if not exists idx_facturas_fecha on facturas(fecha_expedicion);

alter table facturas drop constraint if exists chk_rectificativa;
alter table facturas add constraint chk_rectificativa check (
  (tipo = 'rectificativa' and rectifica_a is not null)
  or (tipo <> 'rectificativa' and rectifica_a is null)
);

-- ---------------------------------------------------------------------------
-- 5 · INMUTABILIDAD
-- ---------------------------------------------------------------------------
create or replace function factura_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception
    'Una factura emitida no se modifica ni se borra (% % %). Para corregirla, emite una rectificativa.',
    old.serie, old.numero, tg_op;
end; $$;

drop trigger if exists trg_factura_no_update on facturas;
create trigger trg_factura_no_update before update on facturas
  for each row execute function factura_inmutable();

drop trigger if exists trg_factura_no_delete on facturas;
create trigger trg_factura_no_delete before delete on facturas
  for each row execute function factura_inmutable();

create or replace function linea_bloqueada_si_facturada()
returns trigger language plpgsql as $$
declare v_cobro uuid;
begin
  v_cobro := coalesce(new.cobro_id, old.cobro_id);
  if exists (select 1 from facturas where cobro_id = v_cobro) then
    raise exception 'Este cobro ya está facturado: sus líneas no se pueden cambiar.';
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists trg_linea_bloqueada on cobro_lineas;
create trigger trg_linea_bloqueada
  before insert or update or delete on cobro_lineas
  for each row execute function linea_bloqueada_si_facturada();

-- ---------------------------------------------------------------------------
-- 6 · VISTAS
-- ---------------------------------------------------------------------------
-- ¿ESTÁ PAGADO? Es una pregunta de SALDO, no de existencia.
--
-- Esto era "¿hay algún cobro apuntando a este bono?", y aguantó hasta la
-- primera rectificativa. Rectificar crea un SEGUNDO cobro con las líneas en
-- negativo, y los dos apuntan al mismo bono: la vista veía dos cobros, decía
-- "pagado", y el bono desaparecía de Cobros para siempre sin que se hubiera
-- ingresado un euro. +63 y −63 suman cero.
--
-- Los dos cobros se quedan, y es lo correcto: el primero ocurrió y la
-- rectificativa es la forma legal de deshacerlo. Lo que no puede es contarse
-- como un cobro cada uno.
--
-- Las columnas van en el orden original y `neto_cobrado` al final: `create or
-- replace view` no admite reordenar ni renombrar.
create or replace view v_bonos_pago as
select
  b.id as bono_id, b.paciente_id, b.mes, b.anio,
  (coalesce(n.neto, 0) > 0) as pagado,
  c.id as cobro_id, c.fecha as fecha_cobro,
  b.estado_pago as estado_pago_legacy,
  coalesce(n.neto, 0) as neto_cobrado
from bonos b
left join lateral (
  select sum(cl.total) as neto
    from cobro_lineas cl
    join cobros co on co.id = cl.cobro_id
   where cl.bono_id = b.id and co.anulado = false
) n on true
-- El cobro que se enseña es el último POSITIVO: es el que tiene detrás la
-- factura vigente. Enseñar aquí la rectificativa llevaría a abrir el documento
-- que anula en vez del que cobra.
left join lateral (
  select co.id, co.fecha
    from cobro_lineas cl
    join cobros co on co.id = cl.cobro_id
   where cl.bono_id = b.id and co.anulado = false and cl.total > 0
   order by co.fecha desc, co.id desc
   limit 1
) c on true;

create or replace view v_listado_gestoria as
select
  f.serie, f.numero, f.fecha_expedicion as fecha,
  coalesce(f.receptor_nombre, p.nombre || ' ' || p.apellidos) as cliente,
  coalesce(f.receptor_nif, p.dni) as nif,
  f.base_total as base, f.cuota_total as iva,
  0::numeric(10,2) as retencion,
  f.total, f.tipo, co.forma_pago,
  (select string_agg(cl.concepto, ' · ' order by cl.orden)
     from cobro_lineas cl where cl.cobro_id = co.id) as servicios
from facturas f
join cobros co   on co.id = f.cobro_id
join pacientes p on p.id  = co.paciente_id
order by f.fecha_expedicion, f.serie, f.numero;

-- ---------------------------------------------------------------------------
-- 7 · EMITIR · todo o nada
-- ---------------------------------------------------------------------------
create or replace function emitir_cobro(
  p_paciente_id uuid, p_fecha date, p_forma_pago text,
  p_notas text, p_tipo text, p_lineas jsonb
)
returns table (cobro_id uuid, factura_id uuid, serie text, numero int)
language plpgsql as $$
declare
  v_cobro uuid; v_fact uuid; v_serie text; v_num int;
  v_base numeric(10,2); v_cuota numeric(10,2); v_total numeric(10,2);
  v_p record; v_a jsonb;
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que cobrar.';
  end if;

  select * into v_p from pacientes where id = p_paciente_id;
  if not found then raise exception 'El paciente no existe.'; end if;

  -- Completa solo si hay con qué. Sin NIF no puede serlo, así que sale tique.
  v_serie := case when p_tipo = 'completa' and coalesce(v_p.dni,'') <> '' then 'F' else 'S' end;

  insert into cobros (paciente_id, fecha, forma_pago, notas)
  values (p_paciente_id, p_fecha, p_forma_pago, p_notas)
  returning id into v_cobro;

  for v_a in select * from jsonb_array_elements(p_lineas) loop
    insert into cobro_lineas (cobro_id, orden, concepto, bono_id, cantidad, base, iva_pct, cuota_iva, total, exencion)
    values (v_cobro,
      coalesce((v_a->>'orden')::int, 0), v_a->>'concepto', nullif(v_a->>'bono_id','')::uuid,
      coalesce((v_a->>'cantidad')::numeric, 1), (v_a->>'base')::numeric,
      coalesce((v_a->>'iva_pct')::numeric, 21), (v_a->>'cuota_iva')::numeric,
      (v_a->>'total')::numeric, v_a->>'exencion');
  end loop;

  -- `cobro_lineas.cobro_id` con la tabla delante: la función devuelve una
  -- columna que también se llama `cobro_id`, y sin cualificar Postgres no sabe
  -- a cuál de las dos te refieres.
  select sum(cl.base), sum(cl.cuota_iva), sum(cl.total) into v_base, v_cuota, v_total
    from cobro_lineas cl where cl.cobro_id = v_cobro;

  v_num := siguiente_numero_factura(v_serie);

  insert into facturas (
    cobro_id, serie, numero, fecha_expedicion, tipo,
    emisor_nombre, emisor_nif, emisor_direccion,
    receptor_nombre, receptor_nif, receptor_direccion,
    base_total, cuota_total, total)
  values (
    v_cobro, v_serie, v_num, p_fecha,
    case when v_serie = 'F' then 'completa' else 'simplificada' end,
    coalesce((select valor from ajustes where clave='fiscal_nombre'),''),
    coalesce((select valor from ajustes where clave='fiscal_nif'),''),
    concat_ws(' · ',
      (select valor from ajustes where clave='fiscal_direccion'),
      concat_ws(' ', (select valor from ajustes where clave='fiscal_cp'),
                     (select valor from ajustes where clave='fiscal_localidad'))),
    case when v_serie='F' then v_p.nombre || ' ' || v_p.apellidos end,
    case when v_serie='F' then v_p.dni end,
    case when v_serie='F' then concat_ws(' · ', v_p.direccion,
      concat_ws(' ', v_p.codigo_postal, v_p.localidad)) end,
    v_base, v_cuota, v_total)
  returning id into v_fact;

  return query select v_cobro, v_fact, v_serie, v_num;
end; $$;

create or replace function emitir_rectificativa(
  p_factura_id uuid, p_motivo text, p_lineas jsonb
)
returns table (cobro_id uuid, factura_id uuid, serie text, numero int)
language plpgsql as $$
declare
  v_orig record; v_cobro uuid; v_fact uuid; v_num int;
  v_base numeric(10,2); v_cuota numeric(10,2); v_total numeric(10,2); v_a jsonb;
begin
  select * into v_orig from facturas where id = p_factura_id;
  if not found then raise exception 'La factura que quieres rectificar no existe.'; end if;
  if v_orig.tipo = 'rectificativa' then
    raise exception 'Una rectificativa no se rectifica: emite otra sobre la original.';
  end if;

  insert into cobros (paciente_id, fecha, forma_pago, notas)
  select co.paciente_id, current_date, co.forma_pago, 'Rectificación: ' || p_motivo
    from cobros co where co.id = v_orig.cobro_id
  returning id into v_cobro;

  for v_a in select * from jsonb_array_elements(p_lineas) loop
    insert into cobro_lineas (cobro_id, orden, concepto, bono_id, cantidad, base, iva_pct, cuota_iva, total, exencion)
    values (v_cobro,
      coalesce((v_a->>'orden')::int, 0), v_a->>'concepto', nullif(v_a->>'bono_id','')::uuid,
      coalesce((v_a->>'cantidad')::numeric, 1), (v_a->>'base')::numeric,
      coalesce((v_a->>'iva_pct')::numeric, 21), (v_a->>'cuota_iva')::numeric,
      (v_a->>'total')::numeric, v_a->>'exencion');
  end loop;

  -- `cobro_lineas.cobro_id` con la tabla delante: la función devuelve una
  -- columna que también se llama `cobro_id`, y sin cualificar Postgres no sabe
  -- a cuál de las dos te refieres.
  select sum(cl.base), sum(cl.cuota_iva), sum(cl.total) into v_base, v_cuota, v_total
    from cobro_lineas cl where cl.cobro_id = v_cobro;

  v_num := siguiente_numero_factura('R');

  insert into facturas (
    cobro_id, serie, numero, fecha_expedicion, tipo, rectifica_a, rectifica_motivo,
    emisor_nombre, emisor_nif, emisor_direccion,
    receptor_nombre, receptor_nif, receptor_direccion,
    base_total, cuota_total, total)
  values (
    v_cobro, 'R', v_num, current_date, 'rectificativa', p_factura_id, p_motivo,
    v_orig.emisor_nombre, v_orig.emisor_nif, v_orig.emisor_direccion,
    v_orig.receptor_nombre, v_orig.receptor_nif, v_orig.receptor_direccion,
    v_base, v_cuota, v_total)
  returning id into v_fact;

  return query select v_cobro, v_fact, 'R'::text, v_num;
end; $$;

-- ---------------------------------------------------------------------------
-- 8 · PAUSA · vuelta automática y cancelación de citas
-- ---------------------------------------------------------------------------
-- Las citas del periodo se CANCELAN, no se borran. Una cancelada no entra en
-- "realizadas" ni en el resumen de volumen, que es lo que se busca, pero deja
-- rastro de que el hueco existió. Borrarlas haría imposible saber, dentro de
-- tres meses, si a alguien le faltan citas por vacaciones o por un olvido.
create or replace function pausar_paciente(
  p_paciente_id uuid, p_desde date, p_hasta date, p_motivo text default null
)
returns int language plpgsql as $$
declare n int;
begin
  update pacientes
     set estado = 'pausa', pausa_desde = p_desde, pausa_hasta = p_hasta, pausa_motivo = p_motivo
   where id = p_paciente_id;

  update citas
     set estado = 'cancelada'
   where paciente_id = p_paciente_id
     and fecha between p_desde and p_hasta
     and estado = 'programada';
  get diagnostics n = row_count;
  return n;  -- citas canceladas
end; $$;

-- Devuelve a activo a quien ya ha vuelto. Lo llama el cron diario.
create or replace function reactivar_pausas()
returns int language plpgsql as $$
declare n int;
begin
  update pacientes
     set estado = 'activo', pausa_desde = null, pausa_hasta = null, pausa_motivo = null
   where estado = 'pausa' and pausa_hasta is not null and pausa_hasta < current_date;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ---------------------------------------------------------------------------
-- 9 · PERMISOS
-- ---------------------------------------------------------------------------
alter table cobros         enable row level security;
alter table cobro_lineas   enable row level security;
alter table facturas       enable row level security;
alter table factura_series enable row level security;

drop policy if exists p_cobros         on cobros;
drop policy if exists p_cobro_lineas   on cobro_lineas;
drop policy if exists p_facturas       on facturas;
drop policy if exists p_factura_series on factura_series;

create policy p_cobros         on cobros         for all to authenticated using (true) with check (true);
create policy p_cobro_lineas   on cobro_lineas   for all to authenticated using (true) with check (true);
create policy p_facturas       on facturas       for all to authenticated using (true) with check (true);
create policy p_factura_series on factura_series for all to authenticated using (true) with check (true);
