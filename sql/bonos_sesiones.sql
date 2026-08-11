-- ===========================================================================
-- BONOS POR SESIONES
-- ===========================================================================
-- Aditivo e idempotente. No toca nada de lo que ya hay.
--
-- Hasta ahora todos los bonos eran CUOTA MENSUAL: se renuevan el día 1 y dan
-- derecho a venir todo el mes. Ahora hay un segundo tipo, el BONO DE SESIONES:
-- se compran 4, 8 o 12, se gastan viniendo y se acaban.
--
-- LA REGLA QUE RIGE TODO ESTO: el consumo NO SE GUARDA, SE CUENTA.
--
-- Nada de un contador `sesiones_restantes` que se va restando. Un contador así
-- acaba diciendo 3 cuando quedan 5 —alguien cambió una cita, se marcó dos
-- veces, el cron metió la mano— y no hay forma de saber cuál de los dos números
-- miente. Aquí las restantes son las compradas menos las citas que las han
-- gastado, y eso se recalcula siempre. Si mañana cambias una cita de "realizada"
-- a "canceló", el bono se corrige solo.
--
-- Es la misma decisión que ya tomamos con el estado de pago, que sale de si
-- existe un cobro y no de un campo que alguien escribe.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · MODALIDAD DEL TIPO DE BONO
-- ---------------------------------------------------------------------------
-- `mensual` se renueva cada mes; `sesiones` se agota. La distinción va en el
-- TIPO y no en cada bono: si un tipo es de sesiones, lo es siempre.
alter table bonos_tipos add column if not exists modalidad text not null default 'mensual';
alter table bonos_tipos drop constraint if exists bonos_tipos_modalidad_check;
alter table bonos_tipos add constraint bonos_tipos_modalidad_check
  check (modalidad in ('mensual','sesiones'));

-- Cuántas sesiones trae el bono (4, 8, 12...). Solo tiene sentido en `sesiones`.
alter table bonos_tipos add column if not exists sesiones int;

-- Meses de validez desde la compra. Null = no caduca.
alter table bonos_tipos add column if not exists caduca_meses int;

alter table bonos_tipos drop constraint if exists chk_sesiones_coherente;
alter table bonos_tipos add constraint chk_sesiones_coherente check (
  (modalidad = 'sesiones' and sesiones is not null and sesiones > 0)
  or (modalidad = 'mensual' and sesiones is null)
);

-- ---------------------------------------------------------------------------
-- 2 · EL BONO COMPRADO
-- ---------------------------------------------------------------------------
-- Las sesiones y la caducidad se COPIAN al bono al comprarlo, no se leen del
-- tipo. Si mañana cambias el bono de 8 a 10 sesiones, el que compró 8 tiene 8.
-- Mismo criterio que congelar los datos dentro de la factura.
alter table bonos add column if not exists sesiones_totales int;
alter table bonos add column if not exists caduca date;

-- ---------------------------------------------------------------------------
-- 3 · DE QUÉ BONO TIRA CADA CITA
-- ---------------------------------------------------------------------------
-- Un paciente puede tener a la vez cuota mensual de clases y un bono de
-- sesiones individuales. Deducir de cuál tira una cita por la fecha no basta:
-- hay que apuntarlo.
--
-- Se queda en null para las citas de cuota mensual, que no consumen nada.
alter table citas add column if not exists bono_id uuid references bonos(id) on delete set null;
create index if not exists idx_citas_bono on citas(bono_id);

-- ---------------------------------------------------------------------------
-- 4 · EL CONSUMO, DERIVADO
-- ---------------------------------------------------------------------------
-- QUÉ GASTA UNA SESIÓN, decidido contigo:
--   realizada  → gasta. Vino.
--   falta      → gasta. No avisó y el hueco se quedó vacío.
--   cancelada  → NO gasta. Avisó con tiempo y se le guarda.
--   programada → NO gasta todavía, pero se enseña aparte como reservada, que es
--                lo que evita prometer sesiones que ya están comprometidas.
create or replace view v_bonos_sesiones as
select
  b.id                       as bono_id,
  b.paciente_id,
  b.tipo,
  b.sesiones_totales,
  b.caduca,
  b.fecha_inicio,
  coalesce(c.gastadas, 0)    as gastadas,
  coalesce(c.reservadas, 0)  as reservadas,
  b.sesiones_totales - coalesce(c.gastadas, 0)                        as restantes,
  b.sesiones_totales - coalesce(c.gastadas, 0) - coalesce(c.reservadas, 0) as libres,
  (b.caduca is not null and b.caduca < current_date)                  as caducado,
  c.ultima
from bonos b
left join lateral (
  select
    count(*) filter (where ci.estado in ('realizada','falta'))  as gastadas,
    count(*) filter (where ci.estado = 'programada')            as reservadas,
    max(ci.fecha) filter (where ci.estado in ('realizada','falta')) as ultima
  from citas ci
  where ci.bono_id = b.id
) c on true
where b.sesiones_totales is not null;

-- ---------------------------------------------------------------------------
-- 5 · A QUÉ BONO ATAR UNA CITA NUEVA
-- ---------------------------------------------------------------------------
-- Devuelve el bono de sesiones del paciente que debería consumir una cita en esa
-- fecha: el más antiguo que aún tenga sesiones libres y no haya caducado. Así se
-- gasta primero el que se compró antes, que es lo que espera cualquiera.
--
-- Devuelve null si no tiene ninguno, y entonces la cita va sin bono: es de
-- cuota mensual, o se le ha acabado. No se impide crear la cita, solo se avisa.
create or replace function bono_sesiones_para(p_paciente_id uuid, p_fecha date default current_date)
returns uuid language sql stable as $$
  select v.bono_id
    from v_bonos_sesiones v
    join bonos b on b.id = v.bono_id
   where v.paciente_id = p_paciente_id
     and b.activo
     and v.libres > 0
     and (v.caduca is null or v.caduca >= p_fecha)
   order by b.fecha_inicio, b.created_at
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 6 · QUIÉN ESTÁ A PUNTO DE QUEDARSE SIN SESIONES
-- ---------------------------------------------------------------------------
-- Para avisar antes de que se acabe, no después. Un paciente que se queda a
-- cero sin saberlo es una renovación que no se ofrece a tiempo.
create or replace view v_sesiones_por_agotar as
select
  v.*,
  p.nombre, p.apellidos, p.estado as estado_paciente,
  bt.nombre as bono_nombre
from v_bonos_sesiones v
join bonos b     on b.id = v.bono_id and b.activo
join pacientes p on p.id = v.paciente_id
left join bonos_tipos bt on bt.id = v.tipo
where p.estado in ('activo','pausa')
  and (v.restantes <= 2 or v.caducado)
order by v.restantes, v.caduca;

-- ---------------------------------------------------------------------------
-- 7 · PERMISOS
-- ---------------------------------------------------------------------------
-- Las vistas heredan el RLS de las tablas de las que leen, así que no hace
-- falta política propia.
