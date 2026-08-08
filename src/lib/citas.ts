import { supabase } from './supabase'

/**
 * Crear citas. UN SOLO SITIO.
 *
 * Estaba escrito a mano dentro del botón de guardar de `agenda/page.tsx`: recorrer los
 * días, montar las filas, trocear de 50 en 50 e insertar, todo mezclado con la validación
 * del formulario y con la creación del paciente nuevo. Mientras solo lo usara la agenda
 * daba igual; en cuanto la valoración necesita ofrecer "ponerle ya el horario", sería la
 * segunda copia, y las dos tendrían que acordarse de la duración según el tipo de clase.
 *
 * EL PLAN SE CALCULA APARTE DE ESCRIBIRLO, igual que en `lib/rotacion.ts`: `planDeFechas`
 * dice qué días caerían y `crearCitas` los escribe. Así la previsualización sale de la
 * misma función que ejecuta y no puede decir una cosa distinta de la que pasa.
 */

/** Los nombres de día tal cual se muestran y se guardan en el formulario. */
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

const DIA_A_NUMERO: Record<string, number> = { Lun: 1, Mar: 2, Mié: 3, Jue: 4, Vie: 5, Sáb: 6 }

export type Periodo = '1mes' | '3meses' | '6meses' | '1anio'

/** La fecha de fin que corresponde a un periodo contado desde `desde`. */
export function finDePeriodo(desde: string, periodo: Periodo): string {
  const d = new Date(desde + 'T12:00:00')
  if (periodo === '1mes') d.setMonth(d.getMonth() + 1)
  else if (periodo === '3meses') d.setMonth(d.getMonth() + 3)
  else if (periodo === '6meses') d.setMonth(d.getMonth() + 6)
  else if (periodo === '1anio') d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

/**
 * Qué días caen entre dos fechas para unos días de la semana dados.
 *
 * No sabe nada de festivos, a propósito y por ahora: hoy la agenda crea las citas
 * igualmente y cambiarlo aquí las cambiaría también allí sin avisar. Está apuntado en
 * PENDIENTES; cuando se decida, se decide en esta función y vale para todos.
 */
export function planDeFechas(desde: string, hasta: string, dias: string[]): string[] {
  if (!desde || !hasta || !dias?.length) return []
  const fechas: string[] = []
  const f = new Date(desde + 'T12:00:00')
  const fin = new Date(hasta + 'T12:00:00')
  // Tope de seguridad: un rango mal escrito no puede colgar el navegador ni escribir
  // cinco mil filas.
  let vueltas = 0
  while (f <= fin && vueltas++ < 800) {
    const n = f.getDay() === 0 ? 7 : f.getDay()
    const nombre = Object.keys(DIA_A_NUMERO).find(k => DIA_A_NUMERO[k] === n)
    if (nombre && dias.includes(nombre)) fechas.push(f.toISOString().split('T')[0])
    f.setDate(f.getDate() + 1)
  }
  return fechas
}

export type DatosCita = {
  pacienteId: string
  /** 'HH:MM'. Se guarda con segundos. */
  hora: string
  sala?: string
  tipo?: string
  notas?: string | null
  duracionMin?: number
  sesionId?: string | null
  estado?: string
}

function fila(fecha: string, d: DatosCita) {
  return {
    paciente_id: d.pacienteId,
    fecha,
    hora: d.hora.length === 5 ? d.hora + ':00' : d.hora,
    sala: d.sala || 'A',
    tipo: d.tipo || 'entrenamiento',
    notas: d.notas || null,
    duracion_min: d.duracionMin || 50,
    estado: d.estado || 'programada',
    sesion_id: d.sesionId || null,
  }
}

/** Una sola cita. Devuelve la fila creada, que hace falta para enganchar recuperaciones. */
export async function crearCita(fecha: string, d: DatosCita): Promise<{ ok: true; cita: any } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('citas').insert(fila(fecha, d)).select().single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, cita: data }
}

/**
 * Varias citas de golpe.
 *
 * Se insertan en lotes de 50: Supabase acepta más, pero un lote enorme que falla deja sin
 * saber cuáles entraron. Si un lote falla se para y se dice cuántas se escribieron, que es
 * lo que hace falta para arreglarlo a mano.
 */
export async function crearCitas(fechas: string[], d: DatosCita): Promise<{ ok: true; creadas: number } | { ok: false; error: string; creadas: number }> {
  if (!fechas.length) return { ok: true, creadas: 0 }
  const filas = fechas.map(f => fila(f, d))
  let creadas = 0
  for (let i = 0; i < filas.length; i += 50) {
    const lote = filas.slice(i, i + 50)
    const { error } = await supabase.from('citas').insert(lote)
    if (error) return { ok: false, error: error.message, creadas }
    creadas += lote.length
  }
  return { ok: true, creadas }
}

/** Con estas o menos citas por delante, el aviso se pone en rojo. */
export const CITAS_POCAS = 5

export type ResumenCitas = {
  /** Citas por delante, sin contar las canceladas. */
  citas: number
  /** De esas, cuántas tienen sesión asignada. */
  conSesion: number
}

/**
 * Cuántas citas le quedan a cada paciente y cuántas llevan sesión.
 *
 * SE CALCULA, NO SE GUARDA. Un contador guardado habría que corregirlo cada vez que se
 * cambia, cancela o anula una cita —y son cuatro sitios distintos—, así que a la semana
 * diría un número que no es. Aquí sale de las citas, que es donde vive la verdad:
 *
 *  - CAMBIAR una cita mueve la fecha de la misma fila: el número se recalcula solo.
 *  - CANCELAR la saca de la cuenta, porque solo cuentan las `programada`. Si luego se
 *    recupera, la cita de recuperación es una fila nueva y entra por su cuenta.
 *  - ANULAR borra la fila y desaparece.
 *  - Y las que ya pasaron salen solas: el cron las marca como realizadas.
 *
 * Una consulta para toda la lista, no una por paciente: con doscientos pacientes en
 * pantalla, doscientas consultas se notan.
 */
export async function resumenCitasFuturas(pacienteIds: string[]): Promise<Record<string, ResumenCitas>> {
  const salida: Record<string, ResumenCitas> = {}
  if (!pacienteIds?.length) return salida
  const hoy = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase.from('citas')
    .select('paciente_id,sesion_id')
    .in('paciente_id', pacienteIds)
    .gte('fecha', hoy)
    .eq('estado', 'programada')
  // Si la consulta falla se devuelve vacío y no se pinta nada. Es preferible a enseñar
  // ceros, que se leerían como "no tiene ninguna cita".
  if (error) return {}
  ;(data || []).forEach((c: any) => {
    const r = salida[c.paciente_id] || (salida[c.paciente_id] = { citas: 0, conSesion: 0 })
    r.citas++
    if (c.sesion_id) r.conSesion++
  })
  return salida
}
