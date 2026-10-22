import { supabase } from './supabase'
import { cicloDe } from './rotacion'

/**
 * LAS SESIONES CORREN CON LAS CITAS (Ajustes › Recuperaciones: «Las sesiones corren»).
 *
 * En la semana unos faltan, otros cancelan y otros recuperan entre semana. La sesión va
 * enganchada a la cita (`citas.sesion_id`), así que una falta se llevaba su sesión con
 * ella y el programa se saltaba un paso. Con esto activado, la secuencia de sesiones se
 * mantiene y son las citas las que se mueven por debajo:
 *
 *   · QUITAR una cita (falta, cancelada o borrada): su sesión pasa a la siguiente clase
 *     y empuja a las demás. La última se queda sin cita: la cogerá la próxima cita
 *     suelta que se cree, siguiendo la rotación.
 *   · AÑADIR una cita suelta en medio (recuperación, clase extra): tira de las sesiones.
 *     La siguiente le da la suya, y así hasta la última, que se rellena con la rotación.
 *   · CAMBIAR UNA CITA DE DÍA: las sesiones se recolocan en el orden en que iban; la cita
 *     coge la sesión que le toca en su nueva posición. Cambiar solo hora o sala, no.
 *
 * EL CANDADO (`sesiones.fija`). Una sesión con candado no corre: se queda en su cita
 * pase lo que pase alrededor (los días de fuerza en grupo). Si se quita SU cita, pasa a
 * la siguiente clase del paciente y las demás se apartan. A mano se mueve como siempre.
 *
 * Solo se mueven citas PENDIENTES (programadas) desde la que cambia. Lo hecho no se toca.
 * Las valoraciones no llevan sesión y no cuentan como hueco.
 *
 * Lo que NO pasa por aquí, a propósito: crear citas en bloque (meses, plan de horario),
 * pausas y bajas. Cancelan o crean muchas a la vez y empujar ahí no tiene sentido.
 */

type Item = { sesion_id: string | null, ajustes: any }
type Cita = { id: string, fecha: string, hora: string, tipo: string, sesion_id: string | null, ajustes: any, fija: boolean }
export type CitaAntes = { id: string, paciente_id: string, fecha: string, hora?: string | null, sesion_id?: string | null, ajustes?: any }

export const AJUSTE_CORREN = 'sesiones_corren'

export async function correnActivo(): Promise<boolean> {
  const { data } = await supabase.from('ajustes').select('valor').eq('clave', AJUSTE_CORREN).maybeSingle()
  return (data as any)?.valor === 'true'
}

const esClase = (c: { tipo?: string | null }) => !/valora/i.test(c.tipo || '')
const clave = (c: { fecha: string, hora?: string | null }) => `${c.fecha} ${String(c.hora || '').slice(0, 5)}`
const item = (c: { sesion_id?: string | null, ajustes?: any }): Item => ({ sesion_id: c.sesion_id || null, ajustes: c.ajustes ?? null })

/** Si una sesión tiene candado. Sin la columna (falta el SQL), ninguna lo tiene. */
async function fijas(ids: string[]): Promise<Set<string>> {
  const u = Array.from(new Set(ids.filter(Boolean)))
  if (!u.length) return new Set()
  const { data, error } = await supabase.from('sesiones').select('id,fija').in('id', u)
  if (error) return new Set()
  return new Set((data || []).filter((s: any) => s.fija).map((s: any) => s.id))
}

/** Citas pendientes del paciente desde ese día, en orden. */
async function pendientes(pid: string, desde: string): Promise<Cita[]> {
  const { data } = await supabase.from('citas').select('id,fecha,hora,tipo,sesion_id,ajustes')
    .eq('paciente_id', pid).gte('fecha', desde).eq('estado', 'programada').order('fecha').order('hora')
  const cs = (data || []).filter(esClase) as any[]
  const f = await fijas(cs.map(c => c.sesion_id))
  return cs.map(c => ({ ...c, hora: String(c.hora || '').slice(0, 5), fija: !!c.sesion_id && f.has(c.sesion_id) }))
}

/** Escribe solo lo que cambia. Devuelve cuántas citas se han tocado. */
async function escribir(antes: Cita[], nuevo: Map<string, Item>) {
  let n = 0
  for (const c of antes) {
    const x = nuevo.get(c.id); if (!x) continue
    if ((x.sesion_id || null) === (c.sesion_id || null) && JSON.stringify(x.ajustes ?? null) === JSON.stringify(c.ajustes ?? null)) continue
    const { error } = await supabase.from('citas').update({ sesion_id: x.sesion_id, ajustes: x.ajustes }).eq('id', c.id)
    if (!error) n++
  }
  return n
}

/** La siguiente de la rotación del paciente, o null si no hay una rotación clara. */
async function siguienteDeRotacion(pid: string, anterior: string | null): Promise<string | null> {
  const { data } = await supabase.from('citas').select('fecha,hora,tipo,sesion_id')
    .eq('paciente_id', pid).in('estado', ['programada', 'realizada']).not('sesion_id', 'is', null)
    .order('fecha', { ascending: false }).order('hora', { ascending: false }).limit(24)
  const cs = (data || []).filter(esClase).reverse()
  const f = await fijas(cs.map((c: any) => c.sesion_id))
  const seq = cs.map((c: any) => c.sesion_id as string).filter(id => !f.has(id))
  const ciclo = cicloDe(seq)
  // Si no se repite nada, no hay rotación que seguir: mejor un hueco que adivinar.
  if (!ciclo.length || ciclo.length === seq.length) return null
  // Sin anterior (la nueva va la ultima), se sigue desde la ultima que tiene.
  const ant = anterior || seq[seq.length - 1] || null
  const p = ant ? ciclo.indexOf(ant) : -1
  return ciclo[(p + 1) % ciclo.length]
}

/**
 * QUITAR: falta, cancelada o borrada. `quitada` es la cita como estaba ANTES del cambio.
 * Se llama después de cambiar el estado (o de borrarla).
 */
export async function correrAlQuitar(quitada: CitaAntes) {
  if (!quitada.sesion_id || !(await correnActivo())) return { movidas: 0 }
  const pid = quitada.paciente_id, kq = clave(quitada as any)
  const L = (await pendientes(pid, quitada.fecha)).filter(c => c.id !== quitada.id && clave(c) >= kq)
  const esFija = (await fijas([quitada.sesion_id])).has(quitada.sesion_id)
  const nuevo = new Map<string, Item>()
  let movibles: Cita[], seq: Item[]
  if (esFija) {
    // La del candado pasa a la siguiente clase; lo que tenia esa clase empuja al resto.
    const dest = L.find(c => !c.fija)
    if (!dest) return { movidas: 0 }
    nuevo.set(dest.id, item(quitada))
    movibles = L.filter(c => !c.fija && clave(c) > clave(dest))
    seq = [item(dest), ...movibles.map(item)]
  } else {
    movibles = L.filter(c => !c.fija)
    seq = [item(quitada), ...movibles.map(item)]
  }
  movibles.forEach((c, i) => nuevo.set(c.id, seq[i]))
  let n = await escribir(L, nuevo)
  // La quitada suelta su sesion: ya la lleva otra. Si vuelve, tirara de nuevo.
  if (n > 0 || esFija) await supabase.from('citas').update({ sesion_id: null, ajustes: null }).eq('id', quitada.id)
  return { movidas: n }
}

/**
 * AÑADIR una cita suelta (o una que vuelve de falta/cancelada). Si ya trae sesión
 * elegida a mano, se respeta y no se mueve nada.
 */
export async function correrAlAnadir(pid: string, citaId: string) {
  if (!(await correnActivo())) return { movidas: 0 }
  const { data: c0 } = await supabase.from('citas').select('id,fecha,hora,tipo,sesion_id,estado').eq('id', citaId).maybeSingle()
  if (!c0 || c0.sesion_id || c0.estado !== 'programada' || !esClase(c0)) return { movidas: 0 }
  const k0 = clave(c0)
  const L = (await pendientes(pid, c0.fecha)).filter(c => clave(c) >= k0 || c.id === citaId)
  const movibles = L.filter(c => !c.fija)
  const seq = movibles.filter(c => c.id !== citaId).map(item)
  const nuevo = new Map<string, Item>()
  movibles.forEach((c, i) => { if (i < seq.length) nuevo.set(c.id, seq[i]) })
  // La ultima se queda sin nada: se rellena con la rotacion.
  const ultima = movibles[movibles.length - 1]
  if (ultima) {
    const previa = seq.length ? seq[seq.length - 1].sesion_id : null
    const sig = await siguienteDeRotacion(pid, previa)
    nuevo.set(ultima.id, { sesion_id: sig, ajustes: null })
  }
  return { movidas: await escribir(L, nuevo) }
}

/**
 * CAMBIO DE DIA de una cita. Las sesiones se recolocan en el orden en que iban y la cita
 * coge la que toca en su nueva posición. Solo hora o sala: no se llama.
 */
export async function correrAlMover(pid: string, citaId: string, fechaAntes: string, horaAntes?: string | null) {
  if (!(await correnActivo())) return { movidas: 0 }
  const { data: c0 } = await supabase.from('citas').select('id,fecha,hora').eq('id', citaId).maybeSingle()
  if (!c0 || c0.fecha === fechaAntes) return { movidas: 0 }
  const desde = c0.fecha < fechaAntes ? c0.fecha : fechaAntes
  const L = await pendientes(pid, desde)
  const movida = L.find(c => c.id === citaId)
  // Una con candado movida a mano se lleva su sesion: es lo que se ha querido hacer.
  if (!movida || movida.fija) return { movidas: 0 }
  const movibles = L.filter(c => !c.fija)
  const claveAntes = (c: Cita) => c.id === citaId ? `${fechaAntes} ${String(horaAntes || c.hora).slice(0, 5)}` : clave(c)
  const seq = [...movibles].sort((a, b) => claveAntes(a).localeCompare(claveAntes(b))).map(item)
  const nuevo = new Map<string, Item>()
  movibles.forEach((c, i) => nuevo.set(c.id, seq[i]))
  return { movidas: await escribir(L, nuevo) }
}

/**
 * Para los sitios que cambian el estado: decide si es quitar o añadir.
 * `antes` es la cita como estaba antes del cambio (con su estado).
 */
export async function correrTrasEstado(antes: CitaAntes & { estado?: string | null }, estadoNuevo: string) {
  const fuera = (e?: string | null) => e === 'falta' || e === 'cancelada'
  if (!fuera(antes.estado) && fuera(estadoNuevo)) return correrAlQuitar(antes)
  if (fuera(antes.estado) && !fuera(estadoNuevo)) return correrAlAnadir(antes.paciente_id, antes.id)
  return { movidas: 0 }
}

/** Lee la cita tal como esta, para pasarla como `antes`. */
export async function citaAntes(id: string) {
  const { data } = await supabase.from('citas').select('id,paciente_id,fecha,hora,estado,sesion_id,ajustes').eq('id', id).maybeSingle()
  return data as (CitaAntes & { estado: string }) | null
}
