import { supabase } from '@/lib/supabase'
import { sumarDias, desdeISO } from '@/lib/fechas'
import { aplicarAjustes } from '@/lib/ajustesCita'

// ---------------------------------------------------------------------------
// EJERCICIOS QUE SE REPITEN EN LA SEMANA.
//
// En sala vieron que a veces un paciente hace el mismo ejercicio en la sesión de fuerza y
// en otra sesión de la misma semana. No es un error, pero para algunos ejercicios resulta
// repetitivo. Esto NO prohíbe nada: solo avisa, para que el entrenador decida si lo
// cambia por un similar.
//
// Mira la semana de la clase (lunes a domingo):
//   · lo que ya se le apuntó OTROS días (registros_ejercicio), y
//   · lo que tiene en las citas que le quedan después de hoy (su sesión, con los
//     cambios de ese día ya aplicados).
// El calentamiento de momento cuenta igual (se afinará más adelante).
// ---------------------------------------------------------------------------

/** Lo que se sabe de un ejercicio repetido: el texto corto para la tarjeta y el detalle. */
export type Repetido = { corto: string, detalle: string[] }

const dia = (iso: string) => desdeISO(iso).toLocaleDateString('es-ES', { weekday: 'long' })

export async function repetidosSemana(pacienteId: string, fecha: string): Promise<Record<string, Repetido>> {
  const d = desdeISO(fecha).getDay() // 0 domingo
  const lunes = sumarDias(fecha, -((d + 6) % 7))
  const domingo = sumarDias(lunes, 6)

  const [reg, cit] = await Promise.all([
    supabase.from('registros_ejercicio').select('ejercicio_id,fecha')
      .eq('paciente_id', pacienteId).gte('fecha', lunes).lte('fecha', domingo).neq('fecha', fecha),
    supabase.from('citas').select('fecha,sesion_id,ajustes,estado')
      .eq('paciente_id', pacienteId).gt('fecha', fecha).lte('fecha', domingo).neq('estado', 'cancelada').not('sesion_id', 'is', null),
  ])

  const hechos: Record<string, Set<string>> = {}, previstos: Record<string, Set<string>> = {}
  ;(reg.data || []).forEach((r: any) => { if (r.ejercicio_id) (hechos[r.ejercicio_id] ||= new Set()).add(r.fecha) })

  const citas = cit.data || []
  const ids = Array.from(new Set(citas.map((c: any) => c.sesion_id)))
  if (ids.length) {
    const { data: ses } = await supabase.from('sesiones').select('id,partes').in('id', ids)
    const porId = Object.fromEntries((ses || []).map((s: any) => [s.id, s]))
    citas.forEach((c: any) => {
      const s = porId[c.sesion_id]; if (!s) return
      const conCambios = aplicarAjustes(s, c.ajustes)
      ;(conCambios?.partes || []).forEach((p: any) => (p?.ejercicios || []).forEach((it: any) => {
        if (it?.ejercicio_id) (previstos[it.ejercicio_id] ||= new Set()).add(c.fecha)
      }))
    })
  }

  const out: Record<string, Repetido> = {}
  Array.from(new Set([...Object.keys(hechos), ...Object.keys(previstos)])).forEach(id => {
    const h = Array.from(hechos[id] || []).sort(), p = Array.from(previstos[id] || []).sort()
    const detalle = [...h.map(f => `Lo hizo el ${dia(f)}`), ...p.map(f => `Lo tiene el ${dia(f)}`)]
    out[id] = { corto: detalle[0] + (detalle.length > 1 ? ` +${detalle.length - 1}` : ''), detalle }
  })
  return out
}
