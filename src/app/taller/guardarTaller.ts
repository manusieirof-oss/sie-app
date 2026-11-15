import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'
import { partesMedida } from '@/lib/medida'
import { capacidadPorReps } from '@/lib/capacidades'

/**
 * EL GUARDADO DEL TALLER, fuera de la pantalla.
 *
 * Todo esto estaba dentro de ModoClase.tsx, que pasaba de 2.700 lineas. Aqui va lo que
 * habla con la base y no necesita nada de la pantalla (ni estado ni botones): que es una
 * serie llena, como se arma el registro de un ejercicio y como se escribe. ModoClase se
 * queda con lo que se ve y con el aviso de «Sin guardar».
 *
 * Movido tal cual, sin cambiar lo que hace.
 */

const hoy = hoyISO

/* LOS CAMPOS DE UNA SERIE (lib/medida). Antes solo se miraban peso, reps y segundos:
   una serie de banda o de metros se daba por vacía y no se guardaba. */
export const CAMPOS_MEDIDA = ['peso', 'banda', 'reps', 'segundos', 'metros']
export const CAMPOS_SERIE = [...CAMPOS_MEDIDA, 'rpe', 'rir', 'dolor']
export const serieLlena = (x: any) => CAMPOS_MEDIDA.some(f => x?.[f] != null && String(x[f]).trim() !== '')

/**
 * ¿ESTA CLASE AÚN NO HA EMPEZADO? Un día que viene, o hoy antes de su hora. Entonces el
 * taller sirve para PREPARAR: se puede cambiar la sesión (ejercicios, método, sesión
 * entera), pero lo que se apunte en las series no se guarda como hecho.
 */
export function antesDeClase(item: any, fechaVista: string): boolean {
  const f = item?.fechaClase || fechaVista
  const h = hoy()
  if (f > h) return true
  if (f < h || !item?.hora) return false
  const d = new Date()
  const ahora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  return ahora < String(item.hora).slice(0, 5)
}

/**
 * EJERCICIOS QUE YA NO ESTÁN EN LA BIBLIOTECA. Una sesión puede llevar un ejercicio que
 * luego se borró o se fusionó con otro; al guardar, la base rechazaba la clase ENTERA
 * ("violates foreign key constraint registros_ejercicio_ejercicio_id_fkey") y no se
 * guardaba nada. Ahora esos registros se guardan sin enlace (con su nombre, como los
 * escritos a mano) y el resto de la clase entra normal.
 */
export async function sinEjerciciosBorrados<T extends { ejercicio_id?: any, ejercicio_nombre?: any }>(filas: T[]): Promise<T[]> {
  const ids = Array.from(new Set(filas.map(f => f.ejercicio_id).filter(Boolean)))
  if (!ids.length) return filas
  const { data, error } = await supabase.from('ejercicios').select('id').in('id', ids)
  if (error) return filas
  const hay = new Set((data || []).map((e: any) => e.id))
  return filas.map(f => {
    if (!f.ejercicio_id || hay.has(f.ejercicio_id)) return f
    console.warn('Ejercicio que ya no está en la biblioteca, se guarda sin enlace:', f.ejercicio_nombre)
    return { ...f, ejercicio_id: null }
  })
}

/**
 * Da por guardado un borrador con SU fecha. Si ese dia ya habia uno finalizado del
 * mismo ejercicio (se corrigio despues de finalizar), manda el borrador, que es lo
 * ultimo que se apunto: el indice uniq_regej_finalizado_dia no admite dos.
 */
export async function cerrarBorrador(r: { id: string, paciente_id: string, ejercicio_id: string | null, fecha: string }) {
  if (r.ejercicio_id) {
    await supabase.from('registros_ejercicio').delete()
      .eq('paciente_id', r.paciente_id).eq('ejercicio_id', r.ejercicio_id).eq('fecha', r.fecha).eq('finalizado', true)
  }
  return supabase.from('registros_ejercicio').update({ finalizado: true }).eq('id', r.id)
}

/** Cómo se midió: lo que lleva apuntado, o si no, lo que dice su medida. */
function volumenDe(ej: any, series: any[]): 'reps' | 'segundos' | 'metros' {
  const lleno = (v: any) => v != null && String(v) !== ''
  for (const v of ['segundos', 'metros', 'reps'] as const) if (series.some(x => lleno(x?.[v]))) return v
  return partesMedida(ej.tipo_medida || 'peso_reps').volumen
}

/**
 * Escribe el borrador de UN ejercicio de la clase (lo crea o lo actualiza).
 * Devuelve el error si no ha entrado, o null si ha ido bien.
 */
export async function guardarBorradorEjercicio(pid: string, ej: any, sesionId: string, fechaC: string): Promise<{ message: string } | null> {
  const seriesLlenas = ej.series.filter(serieLlena)
  const iv = ej.items_evaluados || {}
  const fila:any = {
    paciente_id: pid, ejercicio_id: ej.ejercicio_id, ejercicio_nombre: ej.nombre,
    sesion_id: sesionId, series: seriesLlenas, comentario: ej.comentario||null, items_evaluados: iv, finalizado:false,
    fecha: fechaC,
    // Como se hizo HOY, que puede no ser como estaba prescrito.
    regimen: ej.regimen || ej.plan?.regimen || null,
    // Sin esto, la progresión de cargas mezclaba unilateral y bilateral.
    variante: ej.variante || null,
    /* CUÁNTAS SERIES HAY HOY, no solo las rellenas. Al recargar el taller se
       fusionaba con las del plan y una serie quitada en la clase volvía a salir. */
    n_series: (ej.series || []).length,
    // Bilateral / unilateral / alterno de HOY (sin la columna, se guarda sin ella).
    lado: ej.lado || ej.plan?.lado || null,
    /* PARA QUÉ ERA Y CÓMO SE MIDIÓ. Con esto Resultados separa un trabajo de fuerza
       de uno de movilidad del mismo ejercicio, y solo compara lo comparable. La
       capacidad es la de la sesión; si no la lleva y va por repes, la de sus repes. */
    medida: volumenDe(ej, seriesLlenas),
    capacidad: ej.plan?.capacidad || (volumenDe(ej, seriesLlenas) === 'reps' ? capacidadPorReps(seriesLlenas[0]?.reps || ej.plan?.reps || '') || null : null),
  }
  let error: any
  if (ej.ejercicio_id){
    // Con la variante en la clave: el mismo ejercicio puede salir dos veces en
    // la misma sesion —bilateral y unilateral— y sin esto el segundo pisaba al
    // primero, o `maybeSingle` fallaba por encontrar dos.
    let q = supabase.from('registros_ejercicio')
      .select('id,fecha').eq('paciente_id',pid).eq('ejercicio_id',ej.ejercicio_id)
      .eq('sesion_id',sesionId).eq('finalizado',false)
    q = ej.variante ? q.eq('variante', ej.variante) : q.is('variante', null)
    let { data: existe } = await q.maybeSingle()
    // Borrador de OTRO dia que se quedo sin guardar: se cierra con su fecha y se
    // empieza uno nuevo. Si se actualizara, lo de hoy quedaria con la fecha vieja.
    if (existe && existe.fecha && existe.fecha !== fechaC) {
      await cerrarBorrador({ id: existe.id, paciente_id: pid, ejercicio_id: ej.ejercicio_id, fecha: existe.fecha })
      existe = null
    }
    if (existe){
      const cambios: any = { series:seriesLlenas, comentario:ej.comentario||null, ejercicio_nombre:ej.nombre, items_evaluados:iv, variante:ej.variante||null, regimen: ej.regimen || ej.plan?.regimen || null, n_series: fila.n_series, lado: fila.lado, medida: fila.medida, capacidad: fila.capacidad }
      ;({ error } = await supabase.from('registros_ejercicio').update(cambios).eq('id', existe.id))
      // Sin las columnas nuevas (falta el SQL) se guarda igual, sin ellas.
      if (error && /capacidad|medida/.test(error.message)) { delete cambios.capacidad; delete cambios.medida; ({ error } = await supabase.from('registros_ejercicio').update(cambios).eq('id', existe.id)) }
      // Sin la columna n_series (falta el SQL) no se pierde lo apuntado: se guarda sin ella.
      if (error && /n_series/.test(error.message)) { delete cambios.n_series; ({ error } = await supabase.from('registros_ejercicio').update(cambios).eq('id', existe.id)) }
      if (error && /lado/.test(error.message)) { delete cambios.lado; delete cambios.n_series; ({ error } = await supabase.from('registros_ejercicio').update(cambios).eq('id', existe.id)) }
    } else {
      const [limpia] = await sinEjerciciosBorrados([fila]); Object.assign(fila, limpia)
      ;({ error } = await supabase.from('registros_ejercicio').insert(fila))
      if (error && /capacidad|medida/.test(error.message)) { delete fila.capacidad; delete fila.medida; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
      if (error && /n_series/.test(error.message)) { delete fila.n_series; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
      if (error && /lado/.test(error.message)) { delete fila.lado; delete fila.n_series; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
    }
  } else {
    ({ error } = await supabase.from('registros_ejercicio').insert(fila))
    if (error && /capacidad|medida/.test(error.message)) { delete fila.capacidad; delete fila.medida; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
    if (error && /n_series/.test(error.message)) { delete fila.n_series; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
    if (error && /lado/.test(error.message)) { delete fila.lado; delete fila.n_series; ({ error } = await supabase.from('registros_ejercicio').insert(fila)) }
  }
  return error || null
}
