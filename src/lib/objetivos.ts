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

/**
 * UN OBJETIVO ESTÁ LOGRADO CUANDO TIENE PARTES Y TODAS ESTÁN RESUELTAS.
 *
 * Sus partes son sus VÍAS —lo que lo abrió: un test, una ejecución— y sus LOGROS, las
 * metas que se marcan a mano para ese paciente.
 *
 * Antes la regla solo miraba las vías, y por eso un objetivo añadido a mano, que nace sin
 * ninguna, no se podía cerrar de ninguna manera: se quedaba abierto para siempre. Y al
 * aparecer los logros habría habido dos sitios decidiendo lo mismo —las vías por un lado,
 * las metas por otro—, que acaba siempre igual: la ficha diciendo una cosa y el cierre
 * automático haciendo otra.
 *
 * Una sola regla y sin excepciones. Solo vías: lo cierra el test. Solo logros: lo cierras
 * al marcarlos. Las dos cosas: hacen falta las dos, porque que el test dé negativo no
 * significa que lo que te propusiste con ese paciente esté hecho.
 */
export type MetaParte = {
  cumplida?: boolean | null
  tipo?: string | null
  movimiento_id?: string | null
  fase?: number | null
}

/**
 * Las partes que de verdad cuentan, de entre todo lo que el paciente tiene guardado.
 *
 * Se descarta la CASILLA de un específico que además tiene una meta con número. Son la
 * misma parte contada dos veces: le pones "de 8 a 11 cm" a la dorsiflexión y no tiene
 * sentido que además siga colgando un ☐ Dorsiflexión que hay que marcar a mano. Manda el
 * número, que es el que se cierra solo.
 *
 * Se decide aquí y no borrando la fila: si un día quitas la meta, la casilla vuelve sola.
 */
export function partesQueCuentan(metas: MetaParte[] = []): MetaParte[] {
  const lista = Array.isArray(metas) ? metas : []
  const conNumero = new Set(lista
    .filter(m => m.tipo && m.tipo !== 'logro' && m.movimiento_id)
    .map(m => String(m.movimiento_id)))
  return lista.filter(m =>
    !(m.tipo === 'logro' && m.movimiento_id && conNumero.has(String(m.movimiento_id))))
}

export function estaLogradoCon(vias: Via[], metas: MetaParte[], objetivo?: { fases?: number | null } | null): boolean {
  // CON FASES MANDA LA FASE. Sus condiciones ya incluyen lo que hay que medir y lo que hay
  // que marcar, así que dejarlas contar además por su cuenta cerraba el objetivo yendo por
  // la fase 2 de 4. Quien lo cierra es `revisarFases` al superar la última.
  if (Number(objetivo?.fases) > 0) return false

  const partes = [
    ...(Array.isArray(vias) ? vias : []).map(v => !!v.resuelto),
    ...partesQueCuentan(metas).map(m => !!m.cumplida),
  ]
  return partes.length > 0 && partes.every(Boolean)
}

/** La misma regla cuando en la mano solo hay vías. */
export function estaLogrado(vias: Via[]): boolean {
  return estaLogradoCon(vias, [])
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
  // Los LOGROS también cuentan, así que hay que leerlos: cerrar por las vías sin mirarlos
  // daría por hecho un objetivo con logros pendientes, y esa es exactamente la mentira que
  // la regla nueva viene a evitar.
  const { data: metas } = await supabase.from('objetivos_metas')
    .select('cumplida,tipo,movimiento_id,fase').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  const { data: obj } = await supabase.from('objetivos').select('fases').eq('id', objetivoId).maybeSingle()
  const logrado = estaLogradoCon(vias, metas || [], obj)

  const cambios: any = { vias, logrado, fecha_logrado: logrado ? hoy() : null }
  if (opciones?.origen) cambios.origen = opciones.origen

  const { error } = await supabase.from('pacientes_objetivos')
    .update(cambios).eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  if (error) return { ok: false as const, error: error.message, logrado }

  // Solo se registra el cambio de estado, no cada retoque de una vía.
  if (opciones?.logradoAntes !== undefined && opciones.logradoAntes !== logrado) {
    const nombre = await nombreObjetivo(objetivoId)
    const pendientes = vias.filter(v => !v.resuelto).length + (metas || []).filter((m: any) => !m.cumplida).length
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId,
      tipo: logrado ? 'objetivo_logrado' : 'objetivo_reabierto',
      titulo: logrado ? `Objetivo logrado: ${nombre}` : `Objetivo reabierto: ${nombre}`,
      descripcion: logrado
        ? (opciones.contexto ? `Resuelto desde ${opciones.contexto}` : null)
        : `Quedan ${pendientes} parte${pendientes === 1 ? '' : 's'} por resolver`,
      fecha: hoy(),
    })
  }
  return { ok: true as const, logrado }
}

/**
 * Copia a la ficha del paciente los LOGROS HABITUALES escritos en la biblioteca.
 *
 * "Reeducar el control neuromuscular" tiene siempre las mismas partes —control escapular,
 * control lumbopélvico— y escribirlas paciente a paciente era repetir a mano lo que la
 * biblioteca ya sabe.
 *
 * Se COPIAN, no se enlazan, y eso es lo importante: los logros de un paciente son suyos.
 * Tienes que poder quitarle uno que no aplica o añadirle el suyo sin tocar la biblioteca ni
 * afectar a los demás. Es lo mismo que ya pasa con la métrica de un objetivo —vive en la
 * biblioteca— y su meta —vive en la ficha—.
 *
 * No duplica lo que el paciente ya tenga con el mismo texto: si el objetivo se reabre, sus
 * logros siguen siendo los de antes, con lo que ya llevara marcado.
 */
export async function copiarLogrosPlantilla(pacienteId: string, objetivoId: string): Promise<number> {
  const { data: o } = await supabase.from('objetivos')
    .select('logros_plantilla,movimientos,fases,criterios_fase').eq('id', objetivoId).maybeSingle()
  if (!o) return 0

  // Las partes salen de tres sitios de la biblioteca: los logros habituales, que son texto
  // —QUÉ tiene que conseguir—; los específicos, que son etiquetas —EN QUÉ se concreta—; y
  // las condiciones de fase que se marcan a mano, que ya nacen con su fase puesta.
  const partes: { descripcion: string, movimiento_id: string | null, fase: number | null }[] = []

  for (const x of (Array.isArray(o.logros_plantilla) ? o.logros_plantilla : [])) {
    const d = String(x || '').trim()
    if (d) partes.push({ descripcion: d, movimiento_id: null, fase: null })
  }

  /**
   * LOS ESPECÍFICOS SE COPIAN SIEMPRE, y esto cambió al quitar las familias.
   *
   * Cada específico es una parte que hace falta para lograr el objetivo —"me financian" y
   * "me alquilan el local" para montar el negocio—, así que tiene que existir en la ficha
   * o no habría nada que garantice que no se salta ninguna.
   *
   * Antes se saltaban en los métricos para no contar dos veces lo mismo. Eso ahora lo
   * resuelve `partesQueCuentan`: en cuanto le pones una meta con número a un específico, su
   * casilla deja de contar y deja de pintarse. La parte es una; lo que cambia es cómo se
   * cierra.
   */
  const especificos = Array.isArray(o.movimientos) ? o.movimientos : []
  if (especificos.length > 0) {
    const { data: ets } = await supabase.from('etiquetas').select('id,nombre').in('id', especificos)
    for (const id of especificos) {
      const nombre = (ets || []).find((e: any) => e.id === id)?.nombre
      if (nombre) partes.push({ descripcion: nombre, movimiento_id: id, fase: null })
    }
  }

  // Las condiciones de fase que no salen de un test: se marcan a mano y pertenecen a SU
  // fase, que es lo que permite que una fase se cierre con mediciones y con checks a la vez.
  // Se leen aquí y no con `criteriosBrutos` de lib/fases a propósito: fases importa metas
  // y metas importa este fichero, así que traerlo cerraría el círculo. Son cuatro líneas y
  // no juzgan nada — solo recorren lo guardado.
  const bloques = (Array.isArray(o.criterios_fase) ? o.criterios_fase : [])
    .filter((f: any) => f && isFinite(Number(f.fase)))
  for (const bloque of bloques) {
    for (const c of (Array.isArray(bloque.criterios) ? bloque.criterios : [])) {
      if (c?.tipo !== 'logro') continue
      const d = String(c.descripcion || '').trim()
      if (d) partes.push({ descripcion: d, movimiento_id: null, fase: Number(bloque.fase) })
    }
  }

  if (partes.length === 0) return 0

  const { data: ya } = await supabase.from('objetivos_metas')
    .select('descripcion,movimiento_id,fase').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).eq('tipo', 'logro')
  // La misma frase en dos fases distintas son dos partes distintas, así que la fase entra
  // en la clave: "tolera la carga" puede repetirse en la 2 y en la 4 con otro listón.
  const clave = (p: any) => `${p.fase ?? ''}|${String(p.movimiento_id || p.descripcion || '').trim().toLowerCase()}`
  const puestos = new Set((ya || []).map(clave))
  const nuevas = partes.filter(p => !puestos.has(clave(p)))
  if (nuevas.length === 0) return 0

  const { error } = await supabase.from('objetivos_metas').insert(
    nuevas.map(p => ({
      paciente_id: pacienteId, objetivo_id: objetivoId, tipo: 'logro',
      descripcion: p.descripcion, movimiento_id: p.movimiento_id, fase: p.fase, cumplida: false,
    })),
  )
  return error ? 0 : nuevas.length
}

/** Crea el objetivo para el paciente con su primera vía, y con sus logros habituales. */
export async function abrirObjetivo(pacienteId: string, objetivoId: string, via: Via, origen: string) {
  const { error } = await supabase.from('pacientes_objetivos')
    .insert({ paciente_id: pacienteId, objetivo_id: objetivoId, origen, vias: [via] })
  if (error) return { ok: false as const, error: error.message }
  // Va aquí y no en quien llama: un objetivo se abre desde un test, desde el taller y desde
  // la ficha, y si la copia dependiera de que cada sitio se acuerde, el que se olvidara
  // dejaría al paciente sin sus logros sin que nadie lo notara.
  await copiarLogrosPlantilla(pacienteId, objetivoId)
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
      // La vía de una banda lleva `test|banda` en la ref, así que no basta con comparar el
      // id: sin esto, un test de puntuación que pasa a negativo no cerraría nada.
      const esDeEsteTest =
        (v.tipo === 'test' && typeof v.ref === 'string' && (v.ref === testId || v.ref.startsWith(testId + '|'))) ||
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
