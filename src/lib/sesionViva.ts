import { supabase } from './supabase'
import { duplicarSesion, registrarSesion } from './sesiones'
import { hoyISO } from './fechas'

/**
 * LA SESION VIVA.
 *
 * La sesion de un paciente no se copia para avanzar (se acabaron las tandas 2ª, 3ª...):
 * crece. Cada cambio fijo se apunta en su historial (`sesiones_historial`) con una foto de
 * como quedo, asi lo que tocaba un dia pasado se sigue pudiendo ver aunque hoy sea otra.
 * Cuando ya ha dado de si, se FINALIZA: queda cerrada con su historia y, si se quiere,
 * nace otra que parte de como estaba.
 *
 * Las plantillas de la biblioteca no viven: son el punto de partida. Al asignar una a un
 * paciente se le hace su copia, y es la copia la que crece.
 *
 * Una sesion puede estar dentro de un ciclo (sistema_fase_sesiones). Al finalizar y
 * seguir con otra, la nueva ocupa su sitio en la fase: el ciclo no se queda apuntando a
 * una sesion cerrada. Cuando cerrarla lo decide el profesional; el aviso de Ajustes
 * (dias activa) solo recuerda que conviene mirarlo, porque una recuperacion no va por
 * calendario.
 */

export type TipoHistorial = 'inicio' | 'cambio' | 'fin'
export const AJUSTE_AVISO_DIAS = 'sesion_aviso_dias'
export const AVISO_DIAS_DEFECTO = 90

/** Apunta un hito o un cambio. Sin la tabla (falta el SQL) no rompe nada: solo no apunta. */
export async function apuntarHistorial(sesionId: string, pacienteId: string | null, tipo: TipoHistorial,
  texto: string, origen: string, partes?: any[] | null) {
  if (!sesionId || !texto) return
  const { error } = await supabase.from('sesiones_historial').insert({
    sesion_id: sesionId, paciente_id: pacienteId || null, tipo, texto, origen,
    partes: partes ? JSON.parse(JSON.stringify(partes)) : null,
  })
  if (error) console.warn('sesiones_historial:', error.message)
}

export async function historialDe(sesionId: string) {
  const { data, error } = await supabase.from('sesiones_historial')
    .select('id,fecha,tipo,texto,origen').eq('sesion_id', sesionId).order('fecha', { ascending: false })
  return error ? [] : (data || [])
}

/** Como estaba la sesion en una fecha: la ultima foto de ese dia o anterior. null si no hay. */
export async function partesEnFecha(sesionId: string, fecha: string): Promise<any[] | null> {
  const { data, error } = await supabase.from('sesiones_historial')
    .select('partes,fecha').eq('sesion_id', sesionId).not('partes', 'is', null)
    .lte('fecha', fecha + 'T23:59:59').order('fecha', { ascending: false }).limit(1)
  if (error || !data?.length) return null
  return data[0].partes
}

const nombreEj = (e: any) => e?.nombre || 'Ejercicio'
const num = (e: any) => [e?.series && `${e.series} series`, e?.reps && `${e.reps} reps`, e?.tiempo && `${e.tiempo} s`, e?.metros && `${e.metros} m`, e?.peso && `${e.peso} kg`].filter(Boolean).join(' · ')

/**
 * QUE HA CAMBIADO, en frases cortas: "Zancada → Sentadilla búlgara", "Sentadilla
 * búlgara: 3 series → 4 series", "Añadido: Step up". Se compara posicion a posicion
 * dentro de cada parte (es como se monta y como se reordena en el editor).
 */
export function resumenCambios(antes: any[] = [], despues: any[] = []): string[] {
  const out: string[] = []
  const n = Math.max(antes.length, despues.length)
  for (let pi = 0; pi < n; pi++) {
    const a = antes[pi], d = despues[pi]
    if (!a && d) { out.push(`Parte nueva: ${d.nombre || 'sin nombre'}`); continue }
    if (a && !d) { out.push(`Parte quitada: ${a.nombre || 'sin nombre'}`); continue }
    if ((a.modo || '') !== (d.modo || '') || String(a.vueltas || '') !== String(d.vueltas || ''))
      out.push(`${d.nombre || 'Parte'}: ${a.modo || 'ejercicio'}${a.vueltas ? ' ' + a.vueltas : ''} → ${d.modo || 'ejercicio'}${d.vueltas ? ' ' + d.vueltas : ''}`)
    const ea: any[] = a.ejercicios || [], ed: any[] = d.ejercicios || []
    const idsA = ea.map(e => e.ejercicio_id), idsD = ed.map(e => e.ejercicio_id)
    const m = Math.max(ea.length, ed.length)
    for (let i = 0; i < m; i++) {
      const x = ea[i], y = ed[i]
      if (x && y && x.ejercicio_id !== y.ejercicio_id) {
        // Movido de sitio no es cambiado: si sigue en la parte, no se dice nada aqui.
        if (idsD.includes(x.ejercicio_id) && idsA.includes(y.ejercicio_id)) continue
        if (!idsD.includes(x.ejercicio_id) && !idsA.includes(y.ejercicio_id)) { out.push(`${nombreEj(x)} → ${nombreEj(y)}`); continue }
      }
      if (x && y && x.ejercicio_id === y.ejercicio_id) {
        const cs: string[] = []
        if (num(x) !== num(y)) cs.push(`${num(x) || '—'} → ${num(y) || '—'}`)
        if ((x.regimen || 'Concéntrico') !== (y.regimen || 'Concéntrico')) cs.push(`${x.regimen || 'Concéntrico'} → ${y.regimen || 'Concéntrico'}`)
        if ((x.lado || 'Bilateral') !== (y.lado || 'Bilateral')) cs.push(`${x.lado || 'Bilateral'} → ${y.lado || 'Bilateral'}`)
        if ((x.variante || '') !== (y.variante || '')) cs.push(`variante ${y.variante || 'estándar'}`)
        if (cs.length) out.push(`${nombreEj(y)}: ${cs.join(', ')}`)
      }
    }
    ed.filter(e => !idsA.includes(e.ejercicio_id)).forEach(e => { if (!out.some(t => t.endsWith('→ ' + nombreEj(e)))) out.push(`Añadido: ${nombreEj(e)}`) })
    ea.filter(e => !idsD.includes(e.ejercicio_id)).forEach(e => { if (!out.some(t => t.startsWith(nombreEj(e) + ' →'))) out.push(`Quitado: ${nombreEj(e)}`) })
  }
  return out
}

/** Dias que lleva activa. Cuenta desde que nacio (o desde su primer hito si es anterior). */
export function diasActiva(s: any): number {
  if (!s?.created_at) return 0
  return Math.floor((Date.now() - new Date(s.created_at).getTime()) / 864e5)
}

export async function avisoDias(): Promise<number> {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave', AJUSTE_AVISO_DIAS).maybeSingle()
  return parseInt((data as any)?.valor || '') || AVISO_DIAS_DEFECTO
}

/**
 * FINALIZAR. Queda cerrada (solo consulta) y sus citas FUTURAS pasan a la siguiente:
 *   · 'continuar': una nueva que parte de como esta hoy (misma sesion, historia nueva).
 *   · 'cerrar': se quedan sin sesion, para ponerles otra.
 * Las pasadas no se tocan: siguen diciendo que ese dia se hizo esta.
 */
export async function finalizarSesion(sesion: any, pacienteId: string, modo: 'continuar' | 'cerrar', nota?: string) {
  const hoy = hoyISO()
  let nueva: any = null
  if (modo === 'continuar') {
    const r = await duplicarSesion(sesion, pacienteId, { sufijo: '', motivo: `Sigue de «${sesion.nombre}»`, sinEvento: true, sinHistorial: true })
    if (!r.ok || !r.sesion) return { ok: false as const, error: r.error || 'No se ha podido crear la nueva' }
    nueva = r.sesion
    // Sin el candado de la anterior heredado por error: duplicarSesion ya lo copia si lo tiene.
  }
  const { data: futuras } = await supabase.from('citas').select('id')
    .eq('paciente_id', pacienteId).eq('sesion_id', sesion.id).gte('fecha', hoy).eq('estado', 'programada')
  const ids = (futuras || []).map((c: any) => c.id)
  if (ids.length) {
    const { error } = await supabase.from('citas').update({ sesion_id: nueva?.id || null }).in('id', ids)
    if (error) return { ok: false as const, error: 'No se han podido pasar sus citas: ' + error.message }
  }
  // En sus ciclos, la nueva ocupa su sitio.
  if (nueva) await supabase.from('sistema_fase_sesiones').update({ sesion_id: nueva.id }).eq('sesion_id', sesion.id)

  const { error: e2 } = await supabase.from('sesiones').update({ finalizada_en: new Date().toISOString() }).eq('id', sesion.id)
  if (e2) return { ok: false as const, error: /finalizada_en/.test(e2.message) ? 'Falta el SQL de la sesión viva (columna finalizada_en).' : e2.message }

  await apuntarHistorial(sesion.id, pacienteId, 'fin', `Finalizada${nota ? ': ' + nota : ''}`, 'Ficha', sesion.partes)
  if (nueva) await apuntarHistorial(nueva.id, pacienteId, 'inicio', `Sigue de «${sesion.nombre}»`, 'Finalizar', nueva.partes)
  await registrarSesion(pacienteId, `Sesión finalizada: ${sesion.nombre}`,
    nueva ? `Sigue con una nueva desde esta · ${ids.length} cita${ids.length === 1 ? '' : 's'} pasan a ella` : `${ids.length} cita${ids.length === 1 ? '' : 's'} se quedan sin sesión`)
  return { ok: true as const, nueva, nCitas: ids.length }
}
