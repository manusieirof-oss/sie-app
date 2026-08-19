import { supabase } from './supabase'

// ÚNICO sitio que decide si un objetivo está logrado y que registra el hito.
//
// La regla "si todas las vías están resueltas, el objetivo está logrado" estaba
// escrita siete veces en cinco ficheros (taller/page, taller/ModoClase, SaludTab,
// [id]/page y la ficha), ya con variaciones entre copias, y ninguna dejaba rastro
// en el historial. Que un paciente logre un objetivo es el resultado del trabajo
// con él: es el hito más importante de la app y era invisible.
//
// Todo lo que toque `pacientes_objetivos` debe pasar por aquí.

export type Via = {
  tipo: 'test' | 'test_item' | 'ejecucion' | string
  ref: string
  etiqueta?: string
  resuelto: boolean
  fecha_resuelto?: string | null
  /**
   * Qué movimiento y qué lado midió el test que abrió esta vía.
   *
   * El test ya lo sabe —el lunge mide dorsiflexión de tobillo, y se hizo sobre una pierna
   * concreta—, así que la ficha del paciente no tiene por qué volver a preguntarlo para
   * ponerle una meta. Antes ese dato se perdía al cruzar de un sitio a otro y había que
   * reconstruirlo a mano, que es donde se cuelan las metas puestas sobre el lado sano.
   *
   * Opcionales: las vías anteriores no los tienen y siguen valiendo igual.
   */
  mov?: string | null
  lado?: string | null
}

const hoy = () => new Date().toISOString().split('T')[0]

/** Un objetivo está logrado cuando tiene vías y todas están resueltas. */
export function estaLogrado(vias: Via[]): boolean {
  return Array.isArray(vias) && vias.length > 0 && vias.every(v => v.resuelto)
}

async function nombreObjetivo(objetivoId: string) {
  const { data } = await supabase.from('objetivos').select('nombre').eq('id', objetivoId).maybeSingle()
  return data?.nombre || 'Objetivo'
}

/**
 * Guarda las vías y recalcula `logrado`. Si el estado cambia, registra el evento.
 * Devuelve si el objetivo quedó logrado.
 */
export async function guardarVias(pacienteId: string, objetivoId: string, vias: Via[], opciones?: {
  origen?: string
  /** Estado anterior, para saber si hubo cambio sin volver a consultarlo. */
  logradoAntes?: boolean
  /** De dónde viene el cambio, para el texto del evento: "test", "ejecución"… */
  contexto?: string
}) {
  const logrado = estaLogrado(vias)

  const cambios: any = { vias, logrado, fecha_logrado: logrado ? hoy() : null }
  if (opciones?.origen) cambios.origen = opciones.origen

  const { error } = await supabase.from('pacientes_objetivos')
    .update(cambios).eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  if (error) return { ok: false as const, error: error.message, logrado }

  // Solo se registra el cambio de estado, no cada retoque de una vía.
  if (opciones?.logradoAntes !== undefined && opciones.logradoAntes !== logrado) {
    const nombre = await nombreObjetivo(objetivoId)
    const pendientes = vias.filter(v => !v.resuelto).length
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId,
      tipo: logrado ? 'objetivo_logrado' : 'objetivo_reabierto',
      titulo: logrado ? `Objetivo logrado: ${nombre}` : `Objetivo reabierto: ${nombre}`,
      descripcion: logrado
        ? (opciones.contexto ? `Resuelto desde ${opciones.contexto}` : null)
        : `Quedan ${pendientes} vía${pendientes === 1 ? '' : 's'} por resolver`,
      fecha: hoy(),
    })
  }
  return { ok: true as const, logrado }
}

/** Crea el objetivo para el paciente con su primera vía. */
export async function abrirObjetivo(pacienteId: string, objetivoId: string, via: Via, origen: string) {
  const { error } = await supabase.from('pacientes_objetivos')
    .insert({ paciente_id: pacienteId, objetivo_id: objetivoId, origen, vias: [via] })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/**
 * Resuelve TODAS las vías que dependen de un test: la vía del test completo y
 * las de sus ítems (`test_item` con ref `testId:índice`).
 *
 * Un test que pasa a negativo significa que no queda ningún ítem marcado, así
 * que sus vías por ítem también quedan resueltas. Resolver solo la vía 'test'
 * dejaba los objetivos abiertos por un ítem activos para siempre, sin ninguna
 * forma de cerrarlos desde la ficha.
 */
export async function resolverViasDeTest(pacienteId: string, testId: string, contexto?: string) {
  const { data: pos } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id, vias, logrado').eq('paciente_id', pacienteId)

  let logrados = 0
  for (const po of (pos || [])) {
    const vias: Via[] = Array.isArray(po.vias) ? po.vias : []
    let cambio = false
    const nuevas = vias.map(v => {
      const esDeEsteTest =
        (v.tipo === 'test' && v.ref === testId) ||
        (v.tipo === 'test_item' && typeof v.ref === 'string' && v.ref.startsWith(testId + ':'))
      if (esDeEsteTest && !v.resuelto) { cambio = true; return { ...v, resuelto: true, fecha_resuelto: hoy() } }
      return v
    })
    if (!cambio) continue
    const r = await guardarVias(pacienteId, po.objetivo_id, nuevas, { logradoAntes: !!po.logrado, contexto })
    if (r.logrado && !po.logrado) logrados++
  }
  return { ok: true as const, logrados }
}

/**
 * Marca como resuelta (o sin resolver) la vía que coincide con tipo+ref, y
 * recalcula el estado. Es lo que hacen el taller al marcar un ítem y la ficha
 * al pasar un test a negativo.
 */
export async function resolverVia(pacienteId: string, objetivoId: string, tipo: string, ref: string, resuelto: boolean, contexto?: string) {
  const { data: po } = await supabase.from('pacientes_objetivos')
    .select('vias, logrado').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()
  if (!po) return { ok: true as const, logrado: false, sinCambios: true }

  const vias: Via[] = Array.isArray(po.vias) ? po.vias : []
  let cambio = false
  const nuevas = vias.map(v => {
    if (v.tipo === tipo && v.ref === ref && v.resuelto !== resuelto) {
      cambio = true
      return { ...v, resuelto, fecha_resuelto: resuelto ? hoy() : null }
    }
    return v
  })
  if (!cambio) return { ok: true as const, logrado: !!po.logrado, sinCambios: true }

  return guardarVias(pacienteId, objetivoId, nuevas, { logradoAntes: !!po.logrado, contexto })
}
