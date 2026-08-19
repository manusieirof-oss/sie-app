import { supabase } from './supabase'
import { guardarVias, abrirObjetivo, resolverVia, resolverViasDeTest, type Via } from './objetivos'
import { revisarMetas } from './metas'

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

  // ── ÍTEM CON BARRA ────────────────────────────────────────────────────────
  // Cuando el ítem trae `regla`, deja de ser una casilla que se marca a ojo y pasa a ser
  // una MEDIDA que se decide sola. El lunge no es "¿hay restricción? sí/no": son los
  // centímetros que llega, y por debajo de 10 hay restricción. Marcarlo a mano era pedir
  // que hicieras tú la comparación cada vez, y que la hicieras igual cada vez.
  /** Extremos de la barra. `min` admite negativos: hay medidas que los tienen. */
  min?: number
  max?: number
  /** Qué valor lo hace POSITIVO (hallazgo). Sin regla, manda la casilla de siempre. */
  regla?: 'menor' | 'mayor' | 'entre' | 'fuera'
  umbral?: number
  /** Segundo extremo, solo en 'entre' y 'fuera'. */
  umbral2?: number
}

/** true si el ítem se rellena con la barra y no con la casilla. */
export const tieneBarra = (i: any) => !!i?.regla && mide(i)

/**
 * ¿Este ítem es un hallazgo? null si todavía no se ha medido.
 *
 * Se separa de `resultadoDeItems` para poder pintarlo ítem a ítem mientras se rellena: hay
 * que ver que ese número concreto está fuera de rango, no solo el veredicto del test.
 */
export function evaluaItem(item: any): boolean | null {
  if (!tieneBarra(item)) return null
  const v = parseFloat(valorDe(item))
  if (!isFinite(v)) return null
  const a = Number(item.umbral)
  const b = Number(item.umbral2)
  switch (item.regla) {
    case 'menor': return v < a
    case 'mayor': return v > a
    case 'entre': return v >= Math.min(a, b) && v <= Math.max(a, b)
    case 'fuera': return v < Math.min(a, b) || v > Math.max(a, b)
    default: return null
  }
}

/** La regla en una línea, para que se lea al rellenar y no haya que recordarla. */
export function textoRegla(item: any): string {
  if (!tieneBarra(item)) return ''
  const u = unidadDe(item).simbolo.trim()
  const a = item.umbral, b = item.umbral2
  switch (item.regla) {
    case 'menor': return `Positivo por debajo de ${a}${u}`
    case 'mayor': return `Positivo por encima de ${a}${u}`
    case 'entre': return `Positivo entre ${Math.min(a, b)} y ${Math.max(a, b)}${u}`
    case 'fuera': return `Positivo fuera de ${Math.min(a, b)}–${Math.max(a, b)}${u}`
    default: return ''
  }
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
  // Las escalas clínicas puntúan, no miden: Ashworth va de 0 a 4, Berg de 0 a 56. Sin esto
  // habría que anotarlas en "repeticiones", que es escribir un dato falso en un campo que
  // luego se pinta como "3 reps" en el historial.
  { id: 'puntos', nombre: 'Puntos', simbolo: ' pts' },
  { id: 'metros', nombre: 'Metros', simbolo: ' m' },
  { id: 'meses', nombre: 'Meses', simbolo: ' meses' },
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
  // El ítem con barra no se marca: lo decide su valor. Se traduce a marcado y a partir de
  // ahí manda la misma lógica de siempre, para no tener dos formas de resolver un test.
  const marcado = (i: ItemTest) => tieneBarra(i) ? evaluaItem(i) === true : !!i.marcado
  const marcados = items.filter(marcado).length
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
  /** Metas medibles que este resultado ha dado por alcanzadas. */
  metasCerradas: number
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

  /**
   * Se traduce la barra a `marcado` UNA VEZ, aquí, y a partir de ahí todo lee lo mismo.
   *
   * Estaba escrito en tres sitios: `resultadoDeItems`, el insert del resultado y —este se
   * olvidó— la apertura de objetivos, que seguía mirando el `marcado` crudo. Como un ítem
   * con barra nunca se marca a mano, para esa tercera copia SIEMPRE estaba a false: metías
   * una distancia por debajo del umbral, el test salía positivo y aun así el objetivo no
   * se abría. Peor: se iba por la rama del `else` y RESOLVÍA la vía, cerrando por buena
   * una restricción que se acababa de medir.
   */
  const items = (datos.items || []).map(i => ({
    ...i, marcado: tieneBarra(i) ? evaluaItem(i) === true : !!i.marcado,
  }))
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
      nombre: i.nombre, marcado: i.marcado,
      unidad: unidadDe(i).id, valor: valorDe(i),
      // La REGLA se congela igual que la unidad. Si mañana subes el umbral del lunge de 10
      // a 12, el registro de marzo tiene que seguir explicando por qué salió positivo
      // aquel día. Sin esto, el histórico cambiaría de sentido al tocar la biblioteca.
      ...(tieneBarra(i) ? { regla: i.regla, umbral: i.umbral, umbral2: i.umbral2, min: i.min, max: i.max } : {}),
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
    logrados += await abrirObjetivosDelTest(pacienteId, test, datos.contexto, lado)
    logrados += await moverObjetivosDeItems(pacienteId, test, items, datos.contexto, lado)
  } else if (resultado === 'negativo') {
    // Negativo = no queda nada marcado, así que se cierran la vía del test y las de sus
    // ítems de una vez. Hacerlo ítem a ítem dejaba abierta la del test entero.
    const r = await resolverViasDeTest(pacienteId, test.id, datos.contexto || 'un test')
    logrados += r.logrados
  }
  // 'sin_realizar' no toca ningún objetivo: no haber hecho el test no dice nada.

  // Y las metas medibles, que es lo que cierra los objetivos con número. Un test es el
  // único momento en que un valor puede haber cambiado, así que se revisan aquí y no en
  // un proceso aparte que habría que acordarse de lanzar.
  const { cerradas } = await revisarMetas(pacienteId)

  return { ok: true, resultado, logrados, metasCerradas: cerradas.length }
}

/**
 * Los tests que el paciente tiene abiertos: los que dieron POSITIVO la última vez.
 *
 * Un positivo no se cierra solo. Deja vías de objetivo abiertas y etiquetas de
 * ejercicio desaconsejadas, y ahí se queda hasta que otro test lo levante. Por eso
 * es exactamente lo que hay que volver a pasar en una revaloración.
 *
 * Se mira POR TEST Y POR LADO: una rodilla derecha positiva y la izquierda limpia
 * son dos historias distintas, y quedarse con "el último resultado del test" haría
 * desaparecer una de las dos según cuál se registrara después.
 *
 * Lo derivado no se guarda: esto se calcula al abrir la revaloración, no hay una
 * columna `tiene_test_pendiente` que mantener en su sitio.
 */
export type UltimoResultado = {
  test_id: string
  lado: string
  fecha: string
  resultado: ResultadoTest
  observaciones: string | null
  items_resultado: ItemTest[]
}

export async function ultimosResultadosDe(pacienteId: string): Promise<UltimoResultado[]> {
  if (!pacienteId) return []
  const { data } = await supabase.from('resultados_tests')
    .select('test_id,lado,fecha,resultado,observaciones,items_resultado,created_at')
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  const visto = new Set<string>()
  const ultimos: UltimoResultado[] = []
  for (const r of (data || [])) {
    const lado = r.lado || 'bilateral'
    const clave = r.test_id + '|' + lado
    // Viene ordenado de más nuevo a más viejo: el primero de cada clave es el vigente.
    if (visto.has(clave)) continue
    visto.add(clave)
    ultimos.push({
      test_id: r.test_id, lado, fecha: r.fecha, resultado: r.resultado,
      observaciones: r.observaciones, items_resultado: Array.isArray(r.items_resultado) ? r.items_resultado : [],
    })
  }
  return ultimos
}

/** Los que siguen positivos. Es lo que precarga la revaloración. */
export async function testsPositivosDe(pacienteId: string): Promise<UltimoResultado[]> {
  return (await ultimosResultadosDe(pacienteId)).filter(r => r.resultado === 'positivo')
}

/**
 * Objetivos vinculados al test entero (`objetivos.test_id`).
 *
 * El LADO viaja también por aquí. Un objetivo puede colgar del test entero y no de un
 * ítem —es lo normal cuando la ficha mide una sola cosa— y sin esto la meta del paciente
 * nacía sin lado justo en el caso más frecuente.
 */
async function abrirObjetivosDelTest(pacienteId: string, test: any, contexto?: string, lado?: string) {
  const { data: objs } = await supabase.from('objetivos')
    .select('id').eq('test_id', test.id).eq('activo', true)
  const etiqueta = 'Test: ' + (test.nombre || 'test')
  for (const o of (objs || [])) {
    await abrirOReabrir(pacienteId, o.id, {
      tipo: 'test', ref: test.id, etiqueta, resuelto: false, fecha_resuelto: null,
      mov: null, lado: lado || null,
    }, contexto)
  }
  return 0
}

/**
 * Objetivos que cuelgan de un ítem concreto: se abren si queda marcado y se resuelven
 * si no. La referencia es `testId:índice`, que es lo que `resolverViasDeTest` sabe leer.
 */
async function moverObjetivosDeItems(pacienteId: string, test: any, items: ItemTest[], contexto?: string, lado?: string) {
  let logrados = 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const objIds = it.objetivos || []
    if (objIds.length === 0) continue
    const ref = test.id + ':' + i
    const etiqueta = 'Test: ' + (test.nombre || 'test') + ' · ' + (it.nombre || `ítem ${i + 1}`)
    // Qué movimiento del objetivo mide este ítem, si se dejó dicho en la biblioteca.
    // Se apunta en la vía para que la meta del paciente nazca ya concretada.
    const movs = (it as any).objetivos_mov || {}
    for (const oid of objIds) {
      if (it.marcado) {
        await abrirOReabrir(pacienteId, oid, {
          tipo: 'test_item', ref, etiqueta, resuelto: false, fecha_resuelto: null,
          mov: movs[oid] || null, lado: lado || null,
        }, contexto)
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
  // Al reabrir se refrescan movimiento y lado: manda la medición de hoy, no la de marzo.
  // El resto de la vía se conserva por si trae datos que aquí no se calculan.
  const nuevas = yaEsta
    ? vias.map((v: any) => (v.tipo === via.tipo && v.ref === via.ref)
      ? { ...v, resuelto: false, fecha_resuelto: null, mov: via.mov ?? v.mov ?? null, lado: via.lado ?? v.lado ?? null }
      : v)
    : [...vias, via]
  const origen = (exist.origen || '').includes('test') ? exist.origen : (exist.origen ? exist.origen + '+test' : 'test')
  await guardarVias(pacienteId, objetivoId, nuevas, { origen, logradoAntes: !!exist.logrado, contexto: contexto || 'un test' })
}
