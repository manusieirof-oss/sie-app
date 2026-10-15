import { supabase } from './supabase'
import { hoyISO } from './fechas'
import { DIAS_SEMANA } from './citas'

// ---------------------------------------------------------------------------
// SU HORARIO: a qué días y horas viene de verdad.
//
// Para reactivar a la gente intermitente (se va, vuelve, se va) sin reconstruir de
// memoria a qué hora venía. No se guarda en ningún sitio: sale de su historial de
// citas, que se conserva aunque se vaya, así que nunca se queda desfasado.
//
// CÓMO SE CALCULA:
//   - Solo citas a las que estaba apuntado de verdad: realizadas y faltas. Las
//     canceladas no (avisó de que no venía) y las programadas tampoco (aún no son).
//   - La ventana va hacia atrás DESDE SU ÚLTIMA CLASE, no desde hoy: a quien lleva
//     seis meses fuera se le mira cuando venía. 12 semanas; si en ese tramo vino muy
//     poco (menos de 8 clases), 26, para que una racha corta no decida.
//   - Para cada día y hora se cuentan las SEMANAS en que vino a esa hora, sobre las
//     semanas del tramo. Es más honesto que contar clases: dos clases recuperadas el
//     mismo martes no hacen del martes su día.
//   - Es "su horario" lo que repite en al menos el 40% de las semanas. Un hueco por
//     día (si un día va a dos horas, la más repetida), y tantos días como su bono.
// ---------------------------------------------------------------------------

export type Hueco = {
  /** 0 = Lun … 5 = Sáb (índice de DIAS_SEMANA). */
  dia: number
  /** 'HH:MM' */
  hora: string
  sala: string
  /** Semanas en que vino a ese hueco, y en qué proporción de las del tramo. */
  semanas: number
  pct: number
}

const UMBRAL = 0.4
const DIA_MS = 86400000

export async function horarioDe(pacienteId: string): Promise<
  { ok: true, huecos: Hueco[], diasBono: number | null, desde: string | null, hasta: string | null, semanas: number, clases: number } |
  { ok: false, error: string }> {
  const { data, error } = await supabase.from('citas').select('fecha,hora,sala,estado')
    .eq('paciente_id', pacienteId).lte('fecha', hoyISO()).in('estado', ['realizada', 'falta'])
    .order('fecha', { ascending: false }).limit(500)
  if (error) return { ok: false, error: error.message }
  // Su bono: cuántos días a la semana. El último que tuvo, aunque ya esté cerrado.
  const { data: b } = await supabase.from('bonos').select('dias_semana').eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false }).limit(1)
  const diasBono = Number(b?.[0]?.dias_semana) > 0 ? Number(b![0].dias_semana) : null
  const vacio = { ok: true as const, huecos: [], diasBono, desde: null, hasta: null, semanas: 0, clases: 0 }
  const citas = (data || []).filter((c: any) => c.hora)
  if (citas.length === 0) return vacio

  const ms = (f: string) => new Date(f + 'T12:00:00').getTime()
  const ultima = citas[0].fecha
  let tramo = citas.filter((c: any) => ms(ultima) - ms(c.fecha) < 84 * DIA_MS)
  if (tramo.length < 8) tramo = citas.filter((c: any) => ms(ultima) - ms(c.fecha) < 182 * DIA_MS)
  const primera = tramo[tramo.length - 1].fecha
  // Las semanas cuentan desde el lunes de su primera clase del tramo.
  const d0 = new Date(primera + 'T12:00:00'); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7))
  const semanaDe = (f: string) => Math.floor((ms(f) - d0.getTime()) / (7 * DIA_MS))
  const semanas = semanaDe(ultima) + 1

  const porHueco = new Map<string, { dia: number, hora: string, semanas: Set<number>, salas: Record<string, number> }>()
  for (const c of tramo) {
    const dow = new Date(c.fecha + 'T12:00:00').getDay()
    if (dow === 0) continue
    const dia = dow - 1
    const hora = String(c.hora).slice(0, 5)
    const k = `${dia}|${hora}`
    const x = porHueco.get(k) || { dia, hora, semanas: new Set<number>(), salas: {} }
    x.semanas.add(semanaDe(c.fecha))
    const s = c.sala || 'A'
    x.salas[s] = (x.salas[s] || 0) + 1
    porHueco.set(k, x)
  }
  const candidatos: Hueco[] = Array.from(porHueco.values()).map(x => ({
    dia: x.dia, hora: x.hora, semanas: x.semanas.size, pct: x.semanas.size / semanas,
    sala: Object.entries(x.salas).sort((a, b) => b[1] - a[1])[0][0],
  })).filter(h => h.pct >= UMBRAL).sort((a, b) => b.semanas - a.semanas || a.dia - b.dia)

  const huecos: Hueco[] = []
  for (const h of candidatos) {
    if (huecos.some(x => x.dia === h.dia)) continue
    if (diasBono && huecos.length >= diasBono) break
    huecos.push(h)
  }
  huecos.sort((a, b) => a.dia - b.dia)
  return { ok: true, huecos, diasBono, desde: primera, hasta: ultima, semanas, clases: tramo.length }
}

export const nombreDia = (dia: number) => DIAS_SEMANA[dia] || '?'

/**
 * Cuánta gente hay ya en una sala a una hora, en cada una de esas fechas. Las
 * canceladas no ocupan. Para saber si en su hueco de siempre todavía cabe.
 */
export async function ocupacionEnFechas(fechas: string[], hora: string, sala: string): Promise<Record<string, number>> {
  const h = hora.length === 5 ? hora + ':00' : hora
  const out: Record<string, number> = {}
  for (let i = 0; i < fechas.length; i += 200) {
    const { data } = await supabase.from('citas').select('fecha').in('fecha', fechas.slice(i, i + 200))
      .eq('hora', h).eq('sala', sala).neq('estado', 'cancelada')
    ;(data || []).forEach((c: any) => { out[c.fecha] = (out[c.fecha] || 0) + 1 })
  }
  return out
}
