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

/** El lunes (mediodía) de la semana de una fecha, en milisegundos. */
function lunesDe(fechaISO: string): number {
  const d = new Date(fechaISO + 'T12:00:00')
  const n = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (n - 1))
  return d.getTime()
}

/**
 * Plan para horario ALTERNO: el paciente que una semana viene de mañana y la
 * siguiente de tarde, y que además puede venir en días distintos según la semana.
 *
 * La semana de la fecha de inicio es la "A" (par); la siguiente la "B" (impar); y así
 * alternando. Cada bloque coge SUS días. Sale de `planDeFechas`, la misma función que el
 * resto, para que la cuenta previa y la que se escribe no puedan discrepar.
 */
export function planDeFechasAlterno(desde: string, hasta: string, diasA: string[], diasB: string[]): { fechasA: string[]; fechasB: string[] } {
  const base = lunesDe(desde)
  const semana = (f: string) => Math.round((lunesDe(f) - base) / (7 * 86400000))
  const fechasA = planDeFechas(desde, hasta, diasA).filter(f => semana(f) % 2 === 0)
  const fechasB = planDeFechas(desde, hasta, diasB).filter(f => semana(f) % 2 === 1)
  return { fechasA, fechasB }
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

/**
 * A qué bono de sesiones se ata una cita de ese paciente en esa fecha, y
 * cuántas plazas libres le quedan a ese bono.
 *
 * Un solo sitio para las dos formas de crear citas. Cuando esto estaba solo
 * dentro de `crearCitas`, crear una cita suelta desde la agenda no descontaba
 * nada: la misma clase consumía o no según por qué botón se hubiera entrado.
 *
 * Devuelve `{bonoId: null}` si no tiene ninguno disponible o si ha caducado, y
 * entonces la cita se crea igual sin consumir: será de cuota mensual, o se le
 * habrán acabado las sesiones. Se avisa, no se impide.
 */
async function bonoDisponible(pacienteId: string, fecha: string) {
  const { data } = await supabase.from('v_bonos_sesiones')
    .select('bono_id, libres, caduca')
    .eq('paciente_id', pacienteId)
    .gt('libres', 0)
    .order('fecha_inicio')
    .limit(1)
  const b = data?.[0]
  if (!b) return { bonoId: null as string | null, libres: 0 }
  if (b.caduca && b.caduca < fecha) return { bonoId: null as string | null, libres: 0 }
  return { bonoId: b.bono_id as string, libres: Number(b.libres) || 0 }
}

/** Una sola cita. Devuelve la fila creada, que hace falta para enganchar recuperaciones. */
export async function crearCita(fecha: string, d: DatosCita): Promise<{ ok: true; cita: any; sinBono?: number } | { ok: false; error: string }> {
  const { bonoId } = await bonoDisponible(d.pacienteId, fecha)
  const { data, error } = await supabase.from('citas').insert({ ...fila(fecha, d), bono_id: bonoId }).select().single()
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
export async function crearCitas(fechas: string[], d: DatosCita): Promise<{ ok: true; creadas: number; sinBono?: number } | { ok: false; error: string; creadas: number }> {
  if (!fechas.length) return { ok: true, creadas: 0 }

  // ¿Tira de un bono de sesiones? Se resuelve UNA vez, antes del bucle: la
  // función de Postgres devuelve el bono más antiguo con sesiones libres, y si
  // se preguntara por cada cita daría el mismo hasta agotarlo. Se reparten aquí.
  //
  // Las citas que no encuentren bono se crean igual y no consumen nada: serán de
  // cuota mensual, o se le habrán acabado las sesiones. Se avisa, no se impide:
  // negarse a citar a alguien porque no le quedan sesiones es un bloqueo que se
  // esquiva por fuera de la app y entonces la cita no queda registrada.
  const { bonoId, libres } = await bonoDisponible(d.pacienteId, fechas[0])

  const filas = fechas.map((f, i) => ({ ...fila(f, d), bono_id: i < libres ? bonoId : null }))
  const sinBono = bonoId ? Math.max(0, fechas.length - libres) : 0

  let creadas = 0
  for (let i = 0; i < filas.length; i += 50) {
    const lote = filas.slice(i, i + 50)
    const { error } = await supabase.from('citas').insert(lote)
    if (error) return { ok: false, error: error.message, creadas }
    creadas += lote.length
  }
  return { ok: true, creadas, sinBono }
}

/**
 * Varias citas con hora/sala PROPIAS por fecha (horario alterno).
 *
 * Igual que `crearCitas` pero cada fecha lleva su hora y su sala, porque la semana de
 * mañana y la de tarde no coinciden. El bono se resuelve UNA vez sobre el conjunto
 * ordenado, no por bloque: si se resolviera por separado, las dos semanas creerían tener
 * las mismas sesiones libres y se descontaría de más.
 */
export async function crearCitasPlan(items: { fecha: string; hora: string; sala?: string }[], base: DatosCita): Promise<{ ok: true; creadas: number; sinBono?: number } | { ok: false; error: string; creadas: number }> {
  if (!items.length) return { ok: true, creadas: 0 }
  const orden = items.slice().sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')))
  const { bonoId, libres } = await bonoDisponible(base.pacienteId, orden[0].fecha)
  const filas = orden.map((it, i) => ({ ...fila(it.fecha, { ...base, hora: it.hora, sala: it.sala || base.sala }), bono_id: i < libres ? bonoId : null }))
  const sinBono = bonoId ? Math.max(0, orden.length - libres) : 0
  let creadas = 0
  for (let i = 0; i < filas.length; i += 50) {
    const lote = filas.slice(i, i + 50)
    const { error } = await supabase.from('citas').insert(lote)
    if (error) return { ok: false, error: error.message, creadas }
    creadas += lote.length
  }
  return { ok: true, creadas, sinBono }
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
