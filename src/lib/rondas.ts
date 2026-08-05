import { supabase } from './supabase'

/**
 * Rondas de preguntas: la misma pregunta a todos los pacientes, y saber a quién falta.
 *
 * "¿Qué horario quieres en septiembre?" se pregunta por la mañana, por WhatsApp y al
 * cruzarse en la puerta, y acaba en una hoja de Excel con ticks que se desactualiza.
 *
 * LO QUE HACE ÚTIL ESTO NO ES LA MARCA, ES EL CONTADOR. Una columna que hay que recorrer
 * con la vista por cien filas es el Excel otra vez. Lo que hace que la tarea se termine
 * es saber cuántos faltan y poder ver solo esos.
 *
 * Y se guarda LA RESPUESTA, no solo el tick. Con un tick sigues necesitando el Excel para
 * apuntar el horario que te dijo, que es el dato por el que preguntabas.
 */

export const ESTADOS_RONDA = [
  { id: 'preguntado', nombre: 'Preguntado', ayuda: 'Se le preguntó y aún no ha contestado.' },
  { id: 'respondido', nombre: 'Respondido', ayuda: 'Contestó. Lo que dijo va en la respuesta.' },
  { id: 'no_procede', nombre: 'No procede', ayuda: 'No hay que preguntarle. Sale de la cuenta de pendientes.' },
] as const

export type EstadoRonda = typeof ESTADOS_RONDA[number]['id']

export type Ronda = {
  id: string
  nombre: string
  descripcion?: string | null
  estado: 'abierta' | 'cerrada'
  created_at?: string
  cerrada_at?: string | null
}

export type Respuesta = {
  paciente_id: string
  estado: EstadoRonda
  respuesta?: string | null
}

export const nombreEstado = (id?: string | null) =>
  ESTADOS_RONDA.find(e => e.id === id)?.nombre || 'Pendiente'

/** La ronda abierta, si hay alguna. Solo puede trabajarse con una a la vez: dos columnas
 *  de preguntas distintas en la misma lista es pedir que se marque en la equivocada. */
export async function rondaAbierta(): Promise<Ronda | null> {
  const { data } = await supabase.from('rondas')
    .select('*').eq('estado', 'abierta').order('created_at', { ascending: false }).limit(1)
  return (data && data[0]) || null
}

export async function todasLasRondas(): Promise<Ronda[]> {
  const { data } = await supabase.from('rondas').select('*').order('created_at', { ascending: false })
  return data || []
}

/** Las respuestas de una ronda, indexadas por paciente. Lo que no está, está pendiente. */
export async function respuestasDe(rondaId: string): Promise<Record<string, Respuesta>> {
  const { data } = await supabase.from('rondas_respuestas')
    .select('paciente_id,estado,respuesta').eq('ronda_id', rondaId)
  const mapa: Record<string, Respuesta> = {}
  ;(data || []).forEach((r: any) => { mapa[r.paciente_id] = r })
  return mapa
}

/**
 * Marca a un paciente en la ronda. Si se pasa estado null, se borra la marca y vuelve a
 * pendiente: hace falta poder deshacer un clic sin tener que inventarse un cuarto estado.
 */
export async function marcar(rondaId: string, pacienteId: string, estado: EstadoRonda | null, respuesta?: string) {
  if (!estado) {
    const { error } = await supabase.from('rondas_respuestas')
      .delete().eq('ronda_id', rondaId).eq('paciente_id', pacienteId)
    return error ? { ok: false as const, error: error.message } : { ok: true as const }
  }
  const { error } = await supabase.from('rondas_respuestas').upsert({
    ronda_id: rondaId, paciente_id: pacienteId, estado,
    respuesta: respuesta ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'ronda_id,paciente_id' })
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export type Cuenta = { total: number, pendientes: number, preguntados: number, respondidos: number }

/**
 * Cuántos van y cuántos faltan, sobre los pacientes que se le pasen.
 *
 * El total lo pone quien llama —los activos, no todos— porque preguntarle el horario de
 * septiembre a alguien de baja no es una tarea pendiente, es ruido, y metido en el
 * denominador haría que la ronda no llegara nunca al final.
 *
 * "No procede" sale del total en vez de contar como hecho: si de cien hay diez que no
 * aplican, lo honesto es decir 90, no 100 con diez de regalo.
 */
export function contar(pacientes: any[], respuestas: Record<string, Respuesta>): Cuenta {
  let preguntados = 0, respondidos = 0, noProcede = 0
  pacientes.forEach(p => {
    const e = respuestas[p.id]?.estado
    if (e === 'respondido') respondidos++
    else if (e === 'preguntado') preguntados++
    else if (e === 'no_procede') noProcede++
  })
  const total = pacientes.length - noProcede
  return { total, preguntados, respondidos, pendientes: total - preguntados - respondidos }
}

export async function crearRonda(nombre: string, descripcion?: string) {
  if (!nombre.trim()) return { ok: false as const, error: 'Ponle un nombre' }
  const { data, error } = await supabase.from('rondas')
    .insert({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null }).select().single()
  return error ? { ok: false as const, error: error.message } : { ok: true as const, ronda: data as Ronda }
}

/** Cerrar NO borra: la ronda y sus respuestas se conservan para consultarlas. */
export async function cerrarRonda(rondaId: string) {
  const { error } = await supabase.from('rondas')
    .update({ estado: 'cerrada', cerrada_at: new Date().toISOString() }).eq('id', rondaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export async function reabrirRonda(rondaId: string) {
  const { error } = await supabase.from('rondas')
    .update({ estado: 'abierta', cerrada_at: null }).eq('id', rondaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/** Borra la ronda y con ella sus respuestas. Solo para las creadas por error. */
export async function eliminarRonda(rondaId: string) {
  const { error } = await supabase.from('rondas').delete().eq('id', rondaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
