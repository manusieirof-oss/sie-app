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
 * Las tres modalidades.
 *
 * `mensual` es la cuota de siempre: se renueva el día 1 y da derecho a venir
 * todo el mes. `sesiones` se compra, se gasta y se acaba. `suelto` no se
 * compra para usarlo después —una valoración, una sesión individual—: se cobra
 * en el momento y ahí acaba.
 *
 * La distinción vive en el TIPO, no en el bono comprado: un tipo lo es siempre.
 * Y está aquí y no en Ajustes porque cada modalidad se comporta distinto en la
 * renovación, en la agenda y en el cobro: añadir una no es añadir una fila, es
 * escribir cómo se consume. `suelto` se escribe en una línea —no se consume, no
 * crea bono, no se asigna— y por eso cabe.
 *
 * CATEGORÍA es otra cosa y vive en lib/servicios: un entreno online puede ser
 * mensual o de sesiones, así que no son el mismo campo.
 */
export const MODALIDADES = [
  { id: 'mensual',  nombre: 'Cuota mensual', ayuda: 'Se renueva cada mes. Da derecho a venir los días que marque el bono.' },
  { id: 'sesiones', nombre: 'Bono de sesiones', ayuda: 'Se compran N sesiones, se gastan viniendo y se acaban. No se renueva solo.' },
  { id: 'suelto',   nombre: 'Venta suelta', ayuda: 'Se cobra y se acaba: no se asigna a nadie ni aparece en Cobros el mes que viene.' },
] as const

export type Modalidad = typeof MODALIDADES[number]['id']

/** true si el tipo (o el bono comprado) se gasta por sesiones. */
export const esDeSesiones = (x: any) =>
  x?.modalidad === 'sesiones' || x?.sesiones_totales != null

/** Una venta que no deja nada detrás: ni bono, ni sesiones, ni mes siguiente. */
export const esSuelto = (x: any) => x?.modalidad === 'suelto'

/**
 * Si genera un derecho que hay que guardar.
 *
 * LA pregunta que separa un servicio de otro: mensual y sesiones crean fila en
 * `bonos`; un suelto no, y por eso no aparece nunca en la rejilla de Cobros.
 */
export const esAsignable = (x: any) => !esSuelto(x)

/** En la valoración: viene solo a valorarse y no contrata nada. No es un bono de Ajustes. */
export const SOLO_VALORACION = 'solo_valoracion'

/** Cómo se describe un tipo de bono en una línea, en listas y desplegables. */
export function textoModalidad(tipo: any): string {
  if (esSuelto(tipo)) return 'venta suelta'
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

/**
 * INDIVIDUAL O EN GRUPO. Un paciente puede tener bono de clases y bono individual a la
 * vez (Beatriz Millán): las citas de tipo «Individual» gastan solo de un bono individual
 * y el resto solo de los de clase. Antes cualquier cita gastaba de cualquier bono.
 * El tipo de bono lo dice su casilla «individual» (Ajustes › Servicios); si aún no
 * existe la columna, vale que se llame «individual».
 */
export const esCitaIndividual = (tipoCita?: string | null) => String(tipoCita || '').toLowerCase() === 'individual'
export const esBonoIndividual = (tipoBono: any) =>
  tipoBono?.individual != null ? !!tipoBono.individual : /individual/i.test(`${tipoBono?.nombre || ''} ${tipoBono?.id || ''}`)

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

/** Si cada bono es individual, por su tipo. */
async function individualidad(bonoIds: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>()
  if (!bonoIds.length) return out
  const { data: bs } = await supabase.from('bonos').select('id,tipo').in('id', bonoIds)
  const tipos = Array.from(new Set((bs || []).map((b: any) => b.tipo)))
  const { data: ts } = tipos.length ? await supabase.from('bonos_tipos').select('*').in('id', tipos) : { data: [] as any[] }
  const porTipo = new Map((ts || []).map((t: any) => [t.id, esBonoIndividual(t)]))
  ;(bs || []).forEach((b: any) => out.set(b.id, porTipo.get(b.tipo) ?? esBonoIndividual({ id: b.tipo })))
  return out
}

/**
 * Los bonos de sesiones con sitio para citas de esa clase (individual o en grupo), del
 * más antiguo al más nuevo. TODOS, no solo el primero: si el más antiguo había caducado
 * con sesiones sin usar, las citas nuevas no pasaban al bono nuevo; y si le quedaban 2,
 * el resto de una serie se quedaba fuera aunque hubiera otro bono. Ni desactivados.
 */
export async function bonosDisponibles(pacienteId: string, individual: boolean) {
  const { data } = await supabase.from('v_bonos_sesiones')
    .select('bono_id, libres, caduca, fecha_inicio').eq('paciente_id', pacienteId).gt('libres', 0)
  const ids = (data || []).map((b: any) => b.bono_id)
  if (!ids.length) return [] as { bonoId: string, libres: number, caduca: string | null }[]
  const [{ data: act }, ind] = await Promise.all([supabase.from('bonos').select('id,activo,created_at').in('id', ids), individualidad(ids)])
  const info = new Map((act || []).map((b: any) => [b.id, b]))
  return (data || []).filter((b: any) => info.get(b.bono_id)?.activo && (ind.get(b.bono_id) ?? false) === individual)
    .sort((a: any, b: any) => String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || ''))
      || String(info.get(a.bono_id)?.created_at || '').localeCompare(String(info.get(b.bono_id)?.created_at || '')))
    .map((b: any) => ({ bonoId: b.bono_id as string, libres: Number(b.libres) || 0, caduca: (b.caduca || null) as string | null }))
}

/**
 * Reparte unas fechas entre esos bonos: primero el más antiguo hasta agotarlo y luego el
 * siguiente. Una cita no cae en un bono que ya habrá caducado ese día.
 * Devuelve el bono de cada fecha (null = sin bono) y cuántas se quedan fuera.
 */
export async function repartirEnBonos(pacienteId: string, fechas: string[], individual: boolean) {
  const lista = await bonosDisponibles(pacienteId, individual)
  const quedan = lista.map(b => b.libres)
  const orden = fechas.map((f, i) => ({ f, i })).sort((a, b) => a.f.localeCompare(b.f))
  const bono: (string | null)[] = fechas.map(() => null)
  for (const { f, i } of orden) {
    const k = lista.findIndex((b, j) => quedan[j] > 0 && (!b.caduca || b.caduca >= f))
    if (k >= 0) { bono[i] = lista[k].bonoId; quedan[k]-- }
  }
  return { bono, sinBono: lista.length ? bono.filter(x => !x).length : 0 }
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
  // Según sea individual o no: cada cita, a su clase de bono.
  const { data: c } = await supabase.from('citas').select('tipo').eq('id', citaId).maybeSingle()
  const { bono: [bonoId] } = await repartirEnBonos(pacienteId, [fecha], esCitaIndividual(c?.tipo))
  const { error } = await supabase.from('citas').update({ bono_id: bonoId }).eq('id', citaId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, bonoId }
}

/**
 * TRAS EDITAR UNA CITA (tipo o fecha). Si ya no le toca su bono —ha pasado de clase a
 * Individual o al revés, o se ha movido fuera de su caducidad—, se suelta (su hueco lo
 * coge la siguiente) y se ata al que le toque.
 */
export async function revisarBonoDeCita(citaId: string) {
  const { data: c } = await supabase.from('citas').select('bono_id,paciente_id,fecha,tipo,estado').eq('id', citaId).maybeSingle()
  if (!c || c.estado === 'cancelada') return
  if (c.bono_id) {
    const [{ data: b }, ind] = await Promise.all([
      supabase.from('bonos').select('fecha_inicio,caduca').eq('id', c.bono_id).maybeSingle(),
      individualidad([c.bono_id])])
    const encaja = (ind.get(c.bono_id) ?? false) === esCitaIndividual(c.tipo)
      && (!b?.caduca || c.fecha <= b.caduca) && (!b?.fecha_inicio || c.fecha >= b.fecha_inicio)
    if (encaja) return
    await supabase.from('citas').update({ bono_id: null }).eq('id', citaId)
    await engancharCitas(c.bono_id)
  }
  await atarCitaABono(citaId, c.paciente_id, c.fecha)
}

/**
 * Engancha a un bono recien creado las citas que el paciente YA TENIA en la agenda.
 *
 * Antes solo se enganchaban las citas creadas despues del bono. Pero lo normal es
 * tener la serie puesta y asignar el bono despues, y entonces ninguna de esas
 * citas descontaba: Jose, Jesus y Patricia salian con el bono entero sin estrenar
 * y Beatriz con 3 de 4 habiendo venido cuatro veces desde que lo compro.
 *
 * Toma las citas sin bono desde el dia de compra (hechas, faltas y programadas,
 * dentro de la caducidad), por orden de fecha, hasta llenar las sesiones. Las de
 * antes de la compra no se tocan: se pagaron de otra forma.
 */
export async function engancharCitas(bonoId: string) {
  const { data: b, error: eb } = await supabase.from('bonos')
    .select('paciente_id,fecha_inicio,caduca,sesiones_totales').eq('id', bonoId).maybeSingle()
  if (eb || !b) return { ok: false as const, error: eb?.message || 'No existe el bono' }
  if (!b.sesiones_totales || !b.fecha_inicio) return { ok: true as const, enganchadas: 0 }

  const { count: ya } = await supabase.from('citas').select('id', { count: 'exact', head: true })
    .eq('bono_id', bonoId).in('estado', [...ESTADOS_QUE_GASTAN, ESTADO_RESERVA])
  const hueco = b.sesiones_totales - (ya || 0)
  if (hueco <= 0) return { ok: true as const, enganchadas: 0 }

  const individual = (await individualidad([bonoId])).get(bonoId) ?? false
  let q = supabase.from('citas').select('id,tipo')
    .eq('paciente_id', b.paciente_id).is('bono_id', null)
    .in('estado', [...ESTADOS_QUE_GASTAN, ESTADO_RESERVA])
    .gte('fecha', b.fecha_inicio)
  if (b.caduca) q = q.lte('fecha', b.caduca)
  const { data: citas, error: ec } = await q.order('fecha').order('hora').limit(500)
  if (ec) return { ok: false as const, error: ec.message }
  // Solo las de su clase: a un bono individual, las citas Individual; a uno de clases, el resto.
  const ids = (citas || []).filter((c: any) => esCitaIndividual(c.tipo) === individual).slice(0, hueco).map((c: any) => c.id)
  if (!ids.length) return { ok: true as const, enganchadas: 0 }

  const { error } = await supabase.from('citas').update({ bono_id: bonoId }).in('id', ids)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, enganchadas: ids.length }
}

/**
 * LA CITA QUE GASTA LA ÚLTIMA SESIÓN de cada bono, entre las citas dadas.
 *
 * Se calcula al vuelo, por orden de fecha y hora de las citas que cuentan
 * (hechas, faltas y reservadas): si una se cancela o se mueve, la marca pasa sola
 * a la que le toque. Es para avisar en la agenda de que toca renovar.
 */
export async function ultimasDeBono(citas: { id: string, bono_id?: string | null }[]): Promise<Set<string>> {
  const ids = Array.from(new Set(citas.map(c => c.bono_id).filter(Boolean))) as string[]
  const out = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    const [{ data: bs }, { data: cs }] = await Promise.all([
      supabase.from('bonos').select('id,sesiones_totales').in('id', lote),
      supabase.from('citas').select('id,bono_id').in('bono_id', lote)
        .in('estado', [...ESTADOS_QUE_GASTAN, ESTADO_RESERVA]).order('fecha').order('hora').order('id'),
    ])
    for (const b of bs || []) {
      if (!b.sesiones_totales) continue
      const suyas = (cs || []).filter((c: any) => c.bono_id === b.id)
      if (suyas.length >= b.sesiones_totales) out.add(suyas[b.sesiones_totales - 1].id)
    }
  }
  return out
}

/**
 * Una cita cancelada deja de gastar: se suelta del bono y el hueco lo coge la
 * siguiente cita suya sin bono, si la hay. Así la última del bono "corre" sola.
 */
export async function soltarDelBono(citaId: string) {
  const { data: c } = await supabase.from('citas').select('bono_id').eq('id', citaId).maybeSingle()
  if (!c?.bono_id) return
  await supabase.from('citas').update({ bono_id: null }).eq('id', citaId)
  await engancharCitas(c.bono_id)
}

/**
 * A MANO, DESDE LA TARJETA DEL BONO. Lo automático no siempre acierta (una clase hecha
 * que no se ató, una cita que cayó en el bono viejo): aquí se saca una cita del bono o
 * se mete una de las suyas que no esté en ningún bono.
 */
export async function quitarCitaDeBono(citaId: string) {
  // Sin volver a enganchar otra: si se quita a mano, es porque no tocaba.
  const { error } = await supabase.from('citas').update({ bono_id: null }).eq('id', citaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
export async function ponerCitaEnBono(citaId: string, bonoId: string) {
  // Solo si no está en otro bono: no se le quita una sesión a otro sin darse cuenta.
  const { data: c } = await supabase.from('citas').select('bono_id').eq('id', citaId).maybeSingle()
  if (c?.bono_id && c.bono_id !== bonoId) return { ok: false as const, error: 'Esa cita ya está en otro bono' }
  const { error } = await supabase.from('citas').update({ bono_id: bonoId }).eq('id', citaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}
/** Sus citas que no están en ningún bono (hechas, faltas y programadas), las más recientes primero. */
export async function citasSinBono(pacienteId: string) {
  const desde = new Date(); desde.setMonth(desde.getMonth() - 6)
  const { data, error } = await supabase.from('citas').select('id,fecha,hora,estado,tipo')
    .eq('paciente_id', pacienteId).is('bono_id', null).in('estado', [...ESTADOS_QUE_GASTAN, ESTADO_RESERVA])
    .gte('fecha', aISO(desde)).order('fecha', { ascending: false }).order('hora', { ascending: false }).limit(60)
  return error ? [] : (data || [])
}

/**
 * EL BONO TRAS CAMBIAR EL ESTADO DE UNA CITA. Un solo sitio para agenda, ficha y taller.
 *   · Cancelada: deja de gastar, se suelta y su hueco lo coge la siguiente cita sin bono.
 *   · Cualquier otro (vuelve a programada, o se marca hecha o falta): si no lleva bono,
 *     se ata al que tenga sesiones libres. Antes, deshacer una cancelación dejaba la cita
 *     fuera del bono para siempre (solo se arreglaba al volver de una pausa).
 */
export async function bonoTrasEstado(citaId: string, estado: string) {
  if (estado === 'cancelada') return soltarDelBono(citaId)
  const { data: c } = await supabase.from('citas').select('bono_id,paciente_id,fecha').eq('id', citaId).maybeSingle()
  if (!c || c.bono_id) return
  await atarCitaABono(citaId, c.paciente_id, c.fecha)
}

/**
 * CAMBIAR CUÁNDO EMPEZÓ un bono de sesiones.
 *
 * Caso real: viene a clase, y el bono se le crea días después. El bono nacía
 * con la fecha de ese día y la clase ya hecha se quedaba fuera, sin descontar.
 * Al cambiar el inicio se sueltan sus citas, se recalcula la caducidad desde la
 * fecha nueva (con los meses de su tipo) y se vuelven a enganchar por orden de
 * fecha desde ahí: las primeras del bono pasan a ser las de verdad.
 */
export async function cambiarInicioBono(bonoId: string, fecha: string) {
  if (!fecha) return { ok: false as const, error: 'Falta la fecha' }
  const { data: b, error: eb } = await supabase.from('bonos').select('tipo').eq('id', bonoId).maybeSingle()
  if (eb || !b) return { ok: false as const, error: eb?.message || 'No existe el bono' }
  const { data: t } = await supabase.from('bonos_tipos').select('caduca_meses').eq('id', b.tipo).maybeSingle()
  const { error: e1 } = await supabase.from('bonos')
    .update({ fecha_inicio: fecha, caduca: caducidadDesde(fecha, t?.caduca_meses) }).eq('id', bonoId)
  if (e1) return { ok: false as const, error: e1.message }
  const { error: e2 } = await supabase.from('citas').update({ bono_id: null }).eq('bono_id', bonoId)
  if (e2) return { ok: false as const, error: e2.message }
  return engancharCitas(bonoId)
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
  // Las citas que ya tenia puestas y se quedaron sin bono al agotarse el viejo.
  await engancharCitas(nuevo.id)

  await supabase.from('eventos_paciente').insert({
    paciente_id: bonoViejo.paciente_id,
    tipo: 'cambio_bono',
    titulo: `Bono renovado: ${tipo.nombre}`,
    descripcion: `${tipo.sesiones} sesiones. Pendiente de cobro.`,
    fecha: hoyStr,
  })

  return { ok: true as const, bono: nuevo }
}
