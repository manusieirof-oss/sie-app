import { supabase } from './supabase'
import { guardarVias, abrirObjetivo, resolverVia, resolverViasDeTest, type Via } from './objetivos'

/**
 * Registrar el resultado de un test. UN SOLO SITIO.
 *
 * Registrar un test no es guardar una fila: es guardar la fila, dejar el evento en el
 * historial y mover los objetivos del paciente —los del test entero y los de cada ítem
 * marcado—. Eso estaba escrito tres veces y las tres hacían cosas distintas:
 *
 *  - La ficha hacía lo completo... salvo que al registrar un NEGATIVO no cerraba la vía
 *    del test. Se quedaba abierta para siempre y solo la cerraba el botón "resolver" de
 *    Salud, que es otro camino distinto.
 *  - La valoración SOLO guardaba la fila. Ni evento ni objetivos. Un positivo detectado
 *    en la valoración inicial —que es cuando se detectan— no abría nada, y nadie se
 *    enteraba porque la fila sí quedaba guardada.
 *  - Salud, al resolver, guardaba fila, evento y cerraba vías, pero por su cuenta.
 *
 * Mismo patrón que `lib/objetivos.ts` y `lib/alertas.ts`: la escritura y sus
 * consecuencias van en la misma función, para que no se pueda hacer una sin la otra.
 */

const hoy = () => new Date().toISOString().split('T')[0]

export type ResultadoTest = 'positivo' | 'negativo' | 'sin_realizar'

export type ItemTest = {
  nombre: string
  marcado?: boolean
  /** Unidad en la que se mide, si se mide. Vacío = cualitativo, solo la casilla. */
  unidad?: string
  /** Lo medido. Se lee de `grados` en lo guardado antes de que hubiera unidades. */
  valor?: string
  /** @deprecated Booleano anterior: solo permitía grados. Se sigue leyendo. */
  tiene_grados?: boolean
  /** @deprecated Valor anterior. Se sigue leyendo. */
  grados?: string
  /** Objetivos que abre ESTE ítem al quedar marcado. Vienen del test de la biblioteca. */
  objetivos?: string[]
}

/**
 * En qué se puede medir un ítem.
 *
 * Antes solo había grados: `tiene_grados`, un booleano, y el símbolo `°` escrito a mano
 * en la valoración, la ficha, Salud y la biblioteca. Con eso, media biblioteca de tests
 * no se podía escribir: la sentadilla a una pierna se mide en segundos, el sit-and-reach
 * en centímetros y el sentarse-levantarse en repeticiones. Anotarlos en una casilla que
 * pinta un grado no es un apaño, es un dato falso.
 *
 * La unidad va por ÍTEM y no por test: un mismo test tiene ítems cualitativos —"hay dolor
 * en el arco medio"— y medidos, y forzar a elegir una de las dos naturalezas por test
 * obligaría a partir en dos tests lo que en la camilla es uno.
 */
export const UNIDADES = [
  { id: '', nombre: 'Sin medida', simbolo: '' },
  { id: 'grados', nombre: 'Grados', simbolo: '°' },
  { id: 'cm', nombre: 'Centímetros', simbolo: ' cm' },
  { id: 'segundos', nombre: 'Segundos', simbolo: ' s' },
  { id: 'repeticiones', nombre: 'Repeticiones', simbolo: ' reps' },
  { id: 'kg', nombre: 'Kilos', simbolo: ' kg' },
] as const

/** La unidad de un ítem. Lo guardado con el booleano antiguo se lee como grados. */
export function unidadDe(item: any) {
  const id = item?.unidad ?? (item?.tiene_grados ? 'grados' : '')
  return UNIDADES.find(u => u.id === id) || UNIDADES[0]
}

/** true si el ítem lleva un número al lado de la casilla. */
export const mide = (item: any) => unidadDe(item).id !== ''

/** Lo medido, tolerando el nombre de campo anterior. */
export const valorDe = (item: any): string => String(item?.valor ?? item?.grados ?? '')

/** "35°", "12 cm", o vacío si no se midió. Es lo que se pinta en todas partes. */
export function textoMedida(item: any): string {
  const v = valorDe(item)
  if (!v) return ''
  return v + unidadDe(item).simbolo
}

/**
 * El resultado que sale de los ítems.
 *
 * `logica: 'todos'` exige que estén todos marcados; cualquier otra cosa, con uno basta.
 * Si el test no tiene ítems manda lo que se haya elegido a mano.
 *
 * SIN REALIZAR NO SE PISA. Un test con ítems y ninguno marcado podría calcularse como
 * negativo, pero "no se lo hice" y "se lo hice y salió limpio" no son lo mismo: lo
 * segundo es un hallazgo clínico y lo primero un hueco. La valoración deja marcar una u
 * otra a propósito y aquí se respeta.
 */
export function resultadoDeItems(items: ItemTest[], logica?: string, aMano: ResultadoTest = 'positivo'): ResultadoTest {
  if (aMano === 'sin_realizar') return 'sin_realizar'
  if (!items || items.length === 0) return aMano
  const marcados = items.filter(i => i.marcado).length
  if (logica === 'todos') return marcados === items.length ? 'positivo' : 'negativo'
  return marcados > 0 ? 'positivo' : 'negativo'
}

/** Fecha de revisión por defecto, a partir de la frecuencia del test. Vacío si no la tiene. */
export function fechaRevisionDe(test: any): string {
  if (!test?.frecuencia_meses) return ''
  const d = new Date()
  d.setMonth(d.getMonth() + Number(test.frecuencia_meses))
  return d.toISOString().split('T')[0]
}

export type DatosResultado = {
  /** Solo se usa si el test no tiene ítems; con ítems lo decide la lógica. */
  resultado?: ResultadoTest
  items?: ItemTest[]
  observaciones?: string
  lado?: string
  fechaRepeticion?: string | null
  /** Por defecto hoy. La valoración registra con la fecha del día igualmente. */
  fecha?: string
  /** De dónde viene, para que el historial lo diga: 'la valoración', 'la ficha'... */
  contexto?: string
}

export type ResultadoRegistro = {
  ok: true
  resultado: ResultadoTest
  /** Objetivos que han pasado a logrados al cerrarse sus vías. */
  logrados: number
} | {
  ok: false
  error: string
}

/**
 * Guarda el resultado y mueve lo que tenga que moverse.
 *
 * `test` es la fila de la biblioteca: hace falta su nombre para el evento, su `logica`
 * para calcular el resultado y su `id` para buscar los objetivos vinculados.
 */
export async function registrarResultadoTest(
  pacienteId: string, test: any, datos: DatosResultado,
): Promise<ResultadoRegistro> {
  if (!pacienteId || !test?.id) return { ok: false, error: 'Falta el paciente o el test' }

  const items = datos.items || []
  const resultado = resultadoDeItems(items, test.logica, datos.resultado || 'positivo')
  const lado = datos.lado || 'bilateral'
  const fecha = datos.fecha || hoy()

  const { error } = await supabase.from('resultados_tests').insert({
    paciente_id: pacienteId,
    test_id: test.id,
    fecha,
    resultado,
    observaciones: datos.observaciones || null,
    fecha_repeticion: datos.fechaRepeticion || null,
    lado,
    // Se congela la unidad con el resultado, igual que la sesión congela el nombre del
    // ejercicio: si mañana el test pasa a medirse en centímetros, el registro de marzo
    // tiene que seguir diciendo los grados que se anotaron aquel día.
    items_resultado: items.map(i => ({
      nombre: i.nombre, marcado: !!i.marcado,
      unidad: unidadDe(i).id, valor: valorDe(i),
    })),
  })
  if (error) return { ok: false, error: error.message }

  // El evento va SIEMPRE, también cuando el test es negativo: que un test haya dado
  // negativo en marzo es información clínica, no ausencia de ella.
  const marcados = items.filter(i => i.marcado)
    .map(i => { const m = textoMedida(i); return i.nombre + (m ? ` (${m})` : '') }).join(', ')
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'test',
    titulo: `Test ${resultado}: ${test.nombre || 'test'}${lado && lado !== 'bilateral' ? ' · ' + lado : ''}`,
    descripcion: [marcados || null, datos.observaciones || null, datos.contexto ? `Desde ${datos.contexto}` : null]
      .filter(Boolean).join(' · ') || null,
    fecha,
  })

  let logrados = 0

  if (resultado === 'positivo') {
    logrados += await abrirObjetivosDelTest(pacienteId, test, datos.contexto)
    logrados += await moverObjetivosDeItems(pacienteId, test, items, datos.contexto)
  } else if (resultado === 'negativo') {
    // Negativo = no queda nada marcado, así que se cierran la vía del test y las de sus
    // ítems de una vez. Hacerlo ítem a ítem dejaba abierta la del test entero.
    const r = await resolverViasDeTest(pacienteId, test.id, datos.contexto || 'un test')
    logrados += r.logrados
  }
  // 'sin_realizar' no toca ningún objetivo: no haber hecho el test no dice nada.

  return { ok: true, resultado, logrados }
}

/** Objetivos vinculados al test entero (`objetivos.test_id`). */
async function abrirObjetivosDelTest(pacienteId: string, test: any, contexto?: string) {
  const { data: objs } = await supabase.from('objetivos')
    .select('id').eq('test_id', test.id).eq('activo', true)
  const etiqueta = 'Test: ' + (test.nombre || 'test')
  for (const o of (objs || [])) {
    await abrirOReabrir(pacienteId, o.id, { tipo: 'test', ref: test.id, etiqueta, resuelto: false, fecha_resuelto: null }, contexto)
  }
  return 0
}

/**
 * Objetivos que cuelgan de un ítem concreto: se abren si queda marcado y se resuelven
 * si no. La referencia es `testId:índice`, que es lo que `resolverViasDeTest` sabe leer.
 */
async function moverObjetivosDeItems(pacienteId: string, test: any, items: ItemTest[], contexto?: string) {
  let logrados = 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const objIds = it.objetivos || []
    if (objIds.length === 0) continue
    const ref = test.id + ':' + i
    const etiqueta = 'Test: ' + (test.nombre || 'test') + ' · ' + (it.nombre || `ítem ${i + 1}`)
    for (const oid of objIds) {
      if (it.marcado) {
        await abrirOReabrir(pacienteId, oid, { tipo: 'test_item', ref, etiqueta, resuelto: false, fecha_resuelto: null }, contexto)
      } else {
        const r = await resolverVia(pacienteId, oid, 'test_item', ref, true, contexto || 'un test')
        if (r.ok && r.logrado) logrados++
      }
    }
  }
  return logrados
}

/**
 * Añade la vía al objetivo del paciente, creándolo si aún no lo tenía y reabriéndola si
 * ya estaba pero resuelta. Es el trozo que estaba copiado cuatro veces en la ficha.
 */
async function abrirOReabrir(pacienteId: string, objetivoId: string, via: Via, contexto?: string) {
  const { data: exist } = await supabase.from('pacientes_objetivos')
    .select('vias,origen,logrado').eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId).maybeSingle()

  if (!exist) {
    await abrirObjetivo(pacienteId, objetivoId, via, 'test')
    return
  }
  const vias: Via[] = Array.isArray(exist.vias) ? exist.vias : []
  const yaEsta = vias.some((v: any) => v.tipo === via.tipo && v.ref === via.ref)
  const nuevas = yaEsta
    ? vias.map((v: any) => (v.tipo === via.tipo && v.ref === via.ref) ? { ...v, resuelto: false, fecha_resuelto: null } : v)
    : [...vias, via]
  const origen = (exist.origen || '').includes('test') ? exist.origen : (exist.origen ? exist.origen + '+test' : 'test')
  await guardarVias(pacienteId, objetivoId, nuevas, { origen, logradoAntes: !!exist.logrado, contexto: contexto || 'un test' })
}
