-- ===========================================================================
-- CAMBIOS DE ESTADO PROGRAMADOS
-- ===========================================================================
-- Aditivo e idempotente. No toca nada de lo que ya hay.
--
-- EL PROBLEMA: cuando alguien avisa el 10 de septiembre de que lo deja a final
-- de mes, no había forma de anotarlo. Marcarlo de baja ya lo sacaba de la
-- agenda —y todavía tiene quince clases por dar— y dejarlo para el día 30
-- significaba acordarse el día 30.
--
-- LA SOLUCIÓN: se apunta el estado futuro y su fecha. El paciente sigue activo,
-- con sus citas y su cuota, hasta que llega el día. Entonces el cron lo aplica.
--
-- De paso resuelve algo que no se podía saber: cuántas bajas hay firmadas para
-- el mes que viene. Antes eso solo estaba en la cabeza de quien lo había
-- hablado con el cliente.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0 · EL ESTADO NUEVO
-- ---------------------------------------------------------------------------
-- `pacientes.estado` SÍ tiene un check, aunque no estuviera en esta carpeta, y
-- rechazaba 'puede_volver' con un error que no dice nada útil al usuario.
--
-- Rehacerlo con los cuatro valores no invalida ninguna fila: los únicos valores
-- que existían eran activo, pausa y baja.
alter table pacientes drop constraint if exists pacientes_estado_check;
alter table pacientes add constraint pacientes_estado_check
  check (estado in ('activo','pausa','puede_volver','baja'));

-- ---------------------------------------------------------------------------
-- 1 · QUÉ SE PROGRAMA
-- ---------------------------------------------------------------------------
-- El estado al que pasará y desde cuándo. Null en las dos = no hay nada
-- programado, que es el caso normal.
alter table pacientes add column if not exists estado_programado text;
alter table pacientes add column if not exists estado_programado_desde date;
alter table pacientes add column if not exists estado_programado_motivo text;

-- Salidas Y VUELTAS. Lo de la vuelta se añadió después: alguien dice en agosto
-- que se reincorpora el 1 de octubre, y hasta entonces no debe contar como
-- cliente ni generar cuota. La pausa no sirve para eso porque la pausa cobra.
alter table pacientes drop constraint if exists chk_estado_programado;
alter table pacientes add constraint chk_estado_programado check (
  estado_programado is null
  or estado_programado in ('baja','puede_volver','activo')
);

-- DESDE CUÁNDO ESTÁ EN SU ESTADO ACTUAL.
--
-- No es un derivado: es la fecha en que ocurrió el cambio, un hecho. Sirve para
-- marcar como "reciente" a quien acaba de volver, que es justo a quien hay que
-- mirar de cerca las primeras semanas.
--
-- Se queda en null en las filas antiguas, y eso significa "no se sabe", no
-- "hace mucho". Quien lo pinte tiene que distinguir esos dos casos.
alter table pacientes add column if not exists estado_desde date;

-- Las dos columnas van juntas o no van. Un estado sin fecha no se aplicaría
-- nunca y una fecha sin estado no diría a qué.
alter table pacientes drop constraint if exists chk_estado_programado_completo;
alter table pacientes add constraint chk_estado_programado_completo check (
  (estado_programado is null and estado_programado_desde is null)
  or (estado_programado is not null and estado_programado_desde is not null)
);

create index if not exists idx_pacientes_estado_prog
  on pacientes(estado_programado_desde)
  where estado_programado is not null;

-- ---------------------------------------------------------------------------
-- 2 · APLICARLOS
-- ---------------------------------------------------------------------------
-- Lo llama el cron una vez al día, junto a `reactivar_pausas`.
--
-- LAS CITAS SE CANCELAN, NO SE BORRAN. Un proceso automático que borra filas
-- sin que nadie mire es la peor combinación posible: si la fecha estaba mal
-- puesta, no hay vuelta atrás. Cancelada deja el rastro de que ese día había
-- clase y no se dio, que además es la verdad.
--
-- Solo se tocan las citas POSTERIORES a la fecha de efecto: quien se da de baja
-- el 30 de septiembre da sus clases hasta el 30.
create or replace function aplicar_estados_programados()
returns table(paciente_id uuid, estado text, citas_canceladas int)
language plpgsql as $$
declare
  r record;
  n int;
begin
  for r in
    select p.id, p.estado_programado, p.estado_programado_desde
      from pacientes p
     where p.estado_programado is not null
       and p.estado_programado_desde <= current_date
       -- Si alguien ya está en ese estado, no hay nada que hacer: se limpia la
       -- programación y punto, sin registrar un cambio que no ha ocurrido.
       and p.estado is distinct from p.estado_programado
  loop
    -- Solo se cancelan citas al SALIR. Al volver no hay nada que cancelar, y
    -- borrarle las citas a quien se reincorpora sería justo lo contrario.
    if r.estado_programado = 'activo' then
      n := 0;
    else
      update citas c
         set estado = 'cancelada'
       where c.paciente_id = r.id
         and c.fecha >= r.estado_programado_desde
         and c.estado = 'programada';
      get diagnostics n = row_count;
    end if;

    update pacientes p
       set estado = r.estado_programado,
           estado_desde = r.estado_programado_desde,
           -- Las fechas de pausa se limpian: una fecha de vuelta apuntando a
           -- alguien que se ha ido haría que `reactivar_pausas` lo resucitara.
           pausa_desde = null, pausa_hasta = null, pausa_motivo = null,
           estado_programado = null,
           estado_programado_desde = null,
           estado_programado_motivo = null
     where p.id = r.id;

    insert into eventos_paciente (paciente_id, tipo, titulo, descripcion, fecha)
    values (r.id, 'baja',
      case r.estado_programado
        when 'baja'   then 'Baja (programada)'
        when 'activo' then 'Reincorporación (programada)'
        else 'Puede volver (programado)' end,
      'Aplicado automáticamente en la fecha prevista.'
        || case when n > 0 then ' ' || n || ' citas posteriores canceladas.' else '' end,
      current_date);

    paciente_id := r.id;
    estado := r.estado_programado;
    citas_canceladas := n;
    return next;
  end loop;
end; $$;

-- Los que ya estaban en el estado programado: se limpia la marca para que no
-- se queden colgando en la lista de "previstas" para siempre.
create or replace function limpiar_estados_programados_cumplidos()
returns int language plpgsql as $$
declare n int;
begin
  update pacientes
     set estado_programado = null, estado_programado_desde = null, estado_programado_motivo = null
   where estado_programado is not null
     and estado_programado_desde <= current_date
     and estado = estado_programado;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ---------------------------------------------------------------------------
-- 3 · LO QUE VIENE
-- ---------------------------------------------------------------------------
-- Para saber por adelantado cuántas bajas hay firmadas y de cuánto dinero se
-- trata. Antes esto solo existía en la cabeza de quien lo había hablado.
create or replace view v_estados_previstos as
select
  p.id as paciente_id,
  p.nombre, p.apellidos, p.estado as estado_actual,
  p.estado_programado, p.estado_programado_desde, p.estado_programado_motivo,
  (p.estado_programado_desde - current_date) as dias_para,
  b.tipo as bono_tipo
from pacientes p
left join lateral (
  select tipo from bonos
   where paciente_id = p.id and activo and sesiones_totales is null
   order by anio desc, mes desc limit 1
) b on true
where p.estado_programado is not null
order by p.estado_programado_desde;
