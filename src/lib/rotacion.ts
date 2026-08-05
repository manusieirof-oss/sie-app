import { supabase } from './supabase'
import { registrarSesion } from './sesiones'

/**
 * Repartir las sesiones entre las citas futuras siguiendo una rotación.
 *
 * El caso real: el que viene dos días hace empujes y tirones alternos; el de tres, lo
 * mismo con tres sesiones; el de cinco, igual. Se hacía a mano, cita por cita.
 *
 * LOS 2, 3, 4 O 5 DÍAS NO SE MODELAN. No son cuatro reglas: son una sola. Se cogen las
 * citas futuras en orden de fecha y se van repartiendo las sesiones en bucle. Que a uno
 * le toque una cada tres días naturales y a otro una cada dos no lo decide esto, ya está
 * decidido en la agenda, que es la que sabe qué días viene cada uno.
 *
 * Por eso NO hay un ajuste de "frecuencia" en el paciente. Sería un tercer sitio donde
 * guardar algo que la agenda ya sabe, y empezaría a contradecirla en cuanto se le cambie
 * un día de la semana.
 *
 * El plan se calcula aparte de escribirlo (`planDeReparto` / `aplicarReparto`) para que
 * la previsualización salga de la misma función que va a ejecutar. Una vista previa
 * calculada por su cuenta acaba mintiendo el día que una de las dos cambie.
 */

export type CitaFutura = {
  id: string
  fecha: string
  hora?: string | null
  sala?: string | null
  sesion_id?: string | null
}

export type Reparto = {
  cita: CitaFutura
  /** Sesión que le toca. */
  sesionId: string
  /** true si supone cambiar lo que ya tenía. */
  pisa: boolean
}

/** Citas futuras no canceladas, en orden. Las canceladas no se programan. */
export async function citasFuturasDe(pacienteId: string): Promise<CitaFutura[]> {
  const hoy = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('citas')
    .select('id,fecha,hora,sala,sesion_id')
    .eq('paciente_id', pacienteId).gte('fecha', hoy)
    .neq('estado', 'cancelada')
    .order('fecha').order('hora')
  return (data || []) as CitaFutura[]
}

/**
 * El ciclo más corto que explica una secuencia de sesiones ya asignadas.
 *
 * [A,B,A,B,A] devuelve [A,B]. Sirve para continuar una rotación cuando se añaden meses
 * de citas nuevas, sin tener que volver a decir cuál va primero.
 *
 * Si la secuencia no es periódica devuelve la secuencia entera. Es la respuesta honesta:
 * no hay un ciclo que la explique, y adivinar uno repartiría mal sin avisar.
 */
export function cicloDe(seq: string[]): string[] {
  if (seq.length === 0) return []
  for (let k = 1; k <= seq.length; k++) {
    let periodica = true
    for (let i = k; i < seq.length; i++) {
      if (seq[i] !== seq[i - k]) { periodica = false; break }
    }
    if (periodica) return seq.slice(0, k)
  }
  return seq
}

/** La rotación que ya se está siguiendo, deducida de las citas futuras asignadas. */
export function rotacionActual(citas: CitaFutura[]): string[] {
  return cicloDe(citas.map(c => c.sesion_id).filter(Boolean) as string[])
}

/**
 * Qué sesión le tocaría a cada cita. NO escribe nada.
 *
 * Con `pisar` se reparte sobre todas las citas futuras desde la primera. Sin él solo se
 * rellenan los huecos, y el ciclo continúa donde lo dejó la última cita ya asignada para
 * que el patrón no se desalinee: si venía A,B,A y quedan tres vacías, siguen B,A,B.
 */
export function planDeReparto(citas: CitaFutura[], ciclo: string[], opciones: { pisar: boolean }): Reparto[] {
  const k = ciclo.length
  if (k === 0) return []

  if (opciones.pisar) {
    return citas.map((c, i) => ({
      cita: c, sesionId: ciclo[i % k], pisa: !!c.sesion_id && c.sesion_id !== ciclo[i % k],
    }))
  }

  const plan: Reparto[] = []
  let pos = -1
  for (const c of citas) {
    if (c.sesion_id) {
      // Marca el compás: si la que está puesta pertenece al ciclo, el hueco siguiente
      // continúa desde ella. Si no pertenece, no mueve la cuenta.
      const p = ciclo.indexOf(c.sesion_id)
      if (p >= 0) pos = p
      continue
    }
    pos = (pos + 1) % k
    plan.push({ cita: c, sesionId: ciclo[pos], pisa: false })
  }
  return plan
}

/**
 * Escribe el plan. Devuelve cuántas citas han cambiado.
 *
 * Un solo evento con el total: repartir en veinte citas es una decisión, no veinte.
 */
export async function aplicarReparto(pacienteId: string, plan: Reparto[], nombreDe: (id: string) => string) {
  let n = 0
  for (const r of plan) {
    if (r.cita.sesion_id === r.sesionId) continue
    const { error } = await supabase.from('citas').update({ sesion_id: r.sesionId }).eq('id', r.cita.id)
    if (error) return { ok: false as const, error: error.message, n }
    n++
  }
  if (n > 0) {
    const usadas = Array.from(new Set(plan.map(r => r.sesionId))).map(nombreDe).filter(Boolean)
    await registrarSesion(pacienteId, `Sesiones repartidas en ${n} cita${n > 1 ? 's' : ''}`,
      usadas.length > 0 ? `Rotación: ${usadas.join(' · ')}` : undefined)
  }
  return { ok: true as const, n }
}
