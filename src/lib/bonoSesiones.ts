import { supabase } from './supabase'
import { aISO } from './fechas'

// ---------------------------------------------------------------------------
// BONOS POR SESIONES
//
// Único sitio que decide qué gasta una sesión y cuántas quedan.
//
// EL CONSUMO NO SE GUARDA, SE CUENTA. Las restantes son las compradas menos las
// citas que las han gastado. No hay contador que restar, así que no hay contador
// que pueda mentir: cambiar una cita de "vino" a "canceló" devuelve la sesión
// sola, sin que nadie tenga que acordarse.
//
// OJO CON EL NOMBRE: `lib/sesiones.ts` es otra cosa —las sesiones de
// entrenamiento, con sus partes y sus ejercicios— y no tiene nada que ver con
// esto. Aquí "sesión" es una unidad comprada de un bono, no un plan de trabajo.
// Por eso este fichero se llama `bonoSesiones`.
// ---------------------------------------------------------------------------

/**
 * Qué gasta una sesión. Acordado así:
 *
 *   realizada  → gasta. Vino y se le atendió.
 *   falta      → gasta. No avisó y el hueco se perdió igual.
 *   cancelada  → NO gasta. Avisó con tiempo, se le guarda.
 *   programada → todavía no, pero queda reservada.
 *
 * Que la falta gaste y la cancelación no es lo que empuja a avisar, que es
 * justo el comportamiento que interesa.
 */
/**
 * Las dos modalidades de bono.
 *
 * `mensual` es la cuota de siempre: se renueva el día 1 y da derecho a venir
 * todo el mes. `sesiones` se compra, se gasta y se acaba.
 *
 * La distinción vive en el TIPO, no en el bono comprado: un tipo lo es siempre.
 * Y sí está aquí y no en Ajustes porque cada modalidad se comporta distinto en
 * la renovación, en la agenda y en el cobro: añadir una tercera no sería añadir
 * una fila, sería escribir cómo se consume.
 */
export const MODALIDADES = [
  { id: 'mensual',  nombre: 'Cuota mensual', ayuda: 'Se renueva cada mes. Da derecho a venir los días que marque el bono.' },
  { id: 'sesiones', nombre: 'Bono de sesiones', ayuda: 'Se compran N sesiones, se gastan viniendo y se acaban. No se renueva solo.' },
] as const

export type Modalidad = typeof MODALIDADES[number]['id']

/** true si el tipo (o el bono comprado) se gasta por sesiones. */
export const esDeSesiones = (x: any) =>
  x?.modalidad === 'sesiones' || x?.sesiones_totales != null

/** Cómo se describe un tipo de bono en una línea, en listas y desplegables. */
export function textoModalidad(tipo: any): string {
  if (!esDeSesiones(tipo)) {
    const d = tipo?.dias_semana || 1
    return `${d} día${d !== 1 ? 's' : ''}/semana`
  }
  const n = tipo?.sesiones || tipo?.sesiones_totales || 0
  const cad = tipo?.caduca_meses
  return `${n} sesiones` + (cad ? ` · caduca a los ${cad} ${cad === 1 ? 'mes' : 'meses'}` : ' · sin caducidad')
}

/**
 * Fecha límite de un bono de sesiones. Se calcula AL COMPRARLO y se guarda en
 * la fila, no se deriva del tipo cada vez: si mañana cambias la caducidad de
 * tres meses a dos, quien compró con tres sigue teniendo tres.
 *
 * Es la excepción consciente a "lo derivado no se guarda": aquí el dato no es
 * un cálculo, es una condición pactada en el momento de la venta.
 */
export function caducidadDesde(inicio: string | Date, meses?: number | null): string | null {
  if (!meses) return null
  const d = new Date(typeof inicio === 'string' ? inicio + 'T12:00:00' : inicio)
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().split('T')[0]
}

export const ESTADOS_QUE_GASTAN = ['realizada', 'falta'] as const
export const ESTADO_RESERVA = 'programada'

export type BonoSesiones = {
  bono_id: string
  paciente_id: string
  tipo: string
  sesiones_totales: number
  caduca: string | null
  fecha_inicio: string | null
  gastadas: number
  reservadas: number
  restantes: number
  /** Restantes menos las ya reservadas en la agenda. Es lo que de verdad se puede prometer. */
  libres: number
  caducado: boolean
  ultima: string | null
}

export type EstadoBono = 'ok' | 'pocas' | 'agotado' | 'caducado'

export const UMBRAL_POCAS = 2

/**
 * Cómo está el bono, para pintarlo y para avisar.
 *
 * El caducado manda sobre el resto: da igual que le queden seis sesiones si ya
 * no las puede usar. Y se AVISA, no se impide: si decides dejárselas gastar,
 * la app no te lo va a bloquear.
 */
export function estadoDe(b: BonoSesiones): EstadoBono {
  if (b.caducado) return 'caducado'
  if (b.restantes <= 0) return 'agotado'
  if (b.restantes <= UMBRAL_POCAS) return 'pocas'
  return 'ok'
}

export const LBL_ESTADO: Record<EstadoBono, string> = {
  ok: 'Al día', pocas: 'Quedan pocas', agotado: 'Agotado', caducado: 'Caducado',
}

export const COLOR_ESTADO: Record<EstadoBono, string> = {
  ok: 'var(--gd)', pocas: '#7A5800', agotado: 'var(--red)', caducado: 'var(--red)',
}

/** Texto corto para la ficha: "5 de 8 · caduca el 30 nov". */
export function resumenDe(b: BonoSesiones): string {
  const base = `${Math.max(0, b.restantes)} de ${b.sesiones_totales}`
  if (b.caducado) return `${base} · caducó el ${fechaCorta(b.caduca)}`
  if (b.caduca) return `${base} · caduca el ${fechaCorta(b.caduca)}`
  return base
}

const fechaCorta = (f: string | null) =>
  f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''

// ---------------------------------------------------------------------------
// CONSULTA
// ---------------------------------------------------------------------------

/** Bonos de sesiones de un paciente, con su consumo ya calculado. */
export async function bonosDe(pacienteId: string) {
  const { data, error } = await supabase.from('v_bonos_sesiones')
    .select('*').eq('paciente_id', pacienteId).order('fecha_inicio')
  if (error) return { ok: false as const, error: error.message, bonos: [] as BonoSesiones[] }
  return { ok: true as const, error: null, bonos: (data || []) as BonoSesiones[] }
}

/** Consumo de varios bonos de golpe, para pintar una lista sin una consulta por fila. */
export async function consumoDe(bonoIds: string[]) {
  if (!bonoIds.length) return { ok: true as const, mapa: new Map<string, BonoSesiones>() }
  const { data, error } = await supabase.from('v_bonos_sesiones').select('*').in('bono_id', bonoIds)
  if (error) return { ok: false as const, error: error.message, mapa: new Map<string, BonoSesiones>() }
  return { ok: true as const, mapa: new Map((data || []).map((b: any) => [b.bono_id, b as BonoSesiones])) }
}

/** Quién está a punto de quedarse sin sesiones, para avisar antes y no después. */
export async function porAgotar() {
  const { data, error } = await supabase.from('v_sesiones_por_agotar').select('*')
  if (error) return { ok: false as const, error: error.message, filas: [] as any[] }
  return { ok: true as const, error: null, filas: data || [] }
}

/**
 * Qué bono de sesiones debería consumir una cita nueva de ese paciente.
 * El más antiguo con sesiones libres y sin caducar; null si no tiene ninguno.
 */
export async function bonoParaCita(pacienteId: string, fecha: string) {
  const { data, error } = await supabase.rpc('bono_sesiones_para', {
    p_paciente_id: pacienteId, p_fecha: fecha,
  })
  if (error) return { ok: false as const, error: error.message, bonoId: null }
  return { ok: true as const, error: null, bonoId: (data as string | null) ?? null }
}

/**
 * Ata una cita a un bono de sesiones.
 *
 * Se llama al crear o mover una cita. Si el paciente no tiene bono de sesiones
 * disponible, la cita se queda sin atar y no consume nada: será de cuota
 * mensual, o se le habrán acabado y eso se ve en la ficha.
 */
export async function atarCitaABono(citaId: string, pacienteId: string, fecha: string) {
  const r = await bonoParaCita(pacienteId, fecha)
  if (!r.ok) return { ok: false as const, error: r.error }
  const { error } = await supabase.from('citas').update({ bono_id: r.bonoId }).eq('id', citaId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, bonoId: r.bonoId }
}

/**
 * Renueva un bono de sesiones: crea otro igual, listo para cobrar.
 *
 * Copia el TIPO, no el bono viejo: las sesiones y la caducidad se releen de
 * `bonos_tipos` porque el nuevo se compra hoy, con las condiciones de hoy. Si
 * mientras tanto subiste el bono de 8 a 10, el que renueva se lleva 10.
 *
 * El viejo NO se toca. Está agotado o caducado, que es información de lo que
 * pasó, y desactivarlo borraría el rastro de las sesiones que sí usó.
 *
 * Nace 'pendiente': renovar no es cobrar. Quien llama abre el cobro después, y
 * la factura sale de ahí y solo de ahí.
 */
export async function renovarBonoSesiones(bonoViejo: { bono_id: string, paciente_id: string, tipo: string }) {
  const { data: tipo, error: errTipo } = await supabase
    .from('bonos_tipos').select('*').eq('id', bonoViejo.tipo).maybeSingle()
  if (errTipo) return { ok: false as const, error: errTipo.message }
  if (!tipo) return { ok: false as const, error: `El tipo de bono "${bonoViejo.tipo}" ya no existe en Ajustes` }
  if (!tipo.sesiones) return { ok: false as const, error: `"${tipo.nombre}" ya no es un bono de sesiones` }

  // El descuento del paciente se mantiene: lo pactado con él sigue en pie.
  const { data: viejo } = await supabase.from('bonos')
    .select('descuento_tipo,descuento_valor,descuento_motivo,dias_semana')
    .eq('id', bonoViejo.bono_id).maybeSingle()

  const hoy = new Date()
  const hoyStr = aISO(hoy)
  const { data: nuevo, error } = await supabase.from('bonos').insert({
    paciente_id: bonoViejo.paciente_id,
    tipo: bonoViejo.tipo,
    dias_semana: viejo?.dias_semana ?? tipo.dias_semana ?? 1,
    estado_pago: 'pendiente',
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    fecha_inicio: hoyStr,
    activo: true,
    sesiones_totales: tipo.sesiones,
    caduca: caducidadDesde(hoyStr, tipo.caduca_meses),
    descuento_tipo: viejo?.descuento_tipo ?? null,
    descuento_valor: viejo?.descuento_valor ?? null,
    descuento_motivo: viejo?.descuento_motivo ?? null,
  }).select().single()
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('eventos_paciente').insert({
    paciente_id: bonoViejo.paciente_id,
    tipo: 'cambio_bono',
    titulo: `Bono renovado: ${tipo.nombre}`,
    descripcion: `${tipo.sesiones} sesiones. Pendiente de cobro.`,
    fecha: hoyStr,
  })

  return { ok: true as const, bono: nuevo }
}
