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

/** El nombre con el que se refiere uno a un ítem en los avisos. */
const nombreItem = (it: any, i: number) => String(it?.nombre || '').trim() || `ítem ${i + 1}`

/**
 * Los ítems con barra que todavía no se han medido.
 *
 * Una barra sin valor NO es un cero ni un "no hay hallazgo": es una medición que no se ha
 * hecho. `resultadoDeItems` la trata como no marcada, que para un test de tres barras con
 * una sola medida significa anunciar "negativo · calculado automáticamente" habiendo
 * mirado un tercio del test. El cálculo se deja como está —cambiarlo rompería los tests
 * que sí se rellenan enteros— pero quien decide tiene que ver qué le falta.
 */
export function medicionesPendientes(items: any[]): string[] {
  return (items || [])
    .map((it, i) => ({ it, nombre: nombreItem(it, i) }))
    .filter(x => tieneBarra(x.it) && valorDe(x.it) === '')
    .map(x => x.nombre)
}

/* ─── TESTS DE PUNTUACIÓN ───────────────────────────────────────────────────
 *
 * Hay tests que no se resuelven ítem a ítem sino por el TOTAL. El FPI-6 puntúa seis
 * observaciones de -2 a +2 y lo que dice del pie sale de la suma: de -12 a -5 muy
 * supinado, de 0 a 5 normal, 10 o más muy pronado. Los ítems por separado no significan
 * nada, y forzarlos a "positivo si alguno está marcado" convierte una escala en un sí/no.
 *
 * El tipo va en `logica`, donde ya viven 'cualquiera' y 'todos', porque decide exactamente
 * lo mismo que ellas: cómo se pasa de los ítems al veredicto.
 *
 * El positivo/negativo NO desaparece: es lo que mueve objetivos, vías y contraindicaciones
 * en el resto de la app. Lo decide la BANDA en la que cae el total, y cada banda dice si
 * caer ahí es un hallazgo. Así "Normal" sale negativo y "Pronado" positivo sin que nada
 * más abajo tenga que enterarse de que este test es de otro tipo.
 */

export type Banda = {
  /** Techo de la banda, incluido. Manda la primera que lo alcance. */
  hasta: number
  etiqueta: string
  /** Si caer aquí cuenta como hallazgo. Es lo que se traduce a positivo/negativo. */
  hallazgo: boolean
  /**
   * Los objetivos que abre caer en ESTA banda.
   *
   * La banda es, en un test de puntuación, lo que el ítem es en uno de casillas: el sitio
   * concreto del que cuelga el trabajo. Un FPI-6 positivo no dice qué hacer —un pie
   * supinado y uno pronado piden lo contrario— y la banda sí.
   *
   * Por eso se cuelgan desde el test y no desde el objetivo: así todos los objetivos se
   * enganchan igual, y una misma banda puede abrir varios —fortalecer peroneos, liberar la
   * planta, ganar movilidad— cada uno con su específico.
   */
  objetivos?: string[]
  /** Qué específico de cada objetivo concreta esta banda. Igual que en los ítems. */
  objetivos_mov?: Record<string, string>
}

/** true si el test se resuelve por el total de sus ítems. */
export const esSuma = (test: any) => test?.logica === 'suma'

/** Las bandas ordenadas por techo. Se guardan en el orden en que se escriban. */
export function bandasDe(test: any): Banda[] {
  return (Array.isArray(test?.bandas) ? test.bandas : [])
    .filter((b: any) => b && b.hasta !== '' && b.hasta !== null && isFinite(Number(b.hasta)))
    .map((b: any) => ({
      hasta: Number(b.hasta), etiqueta: String(b.etiqueta || ''), hallazgo: !!b.hallazgo,
      objetivos: Array.isArray(b.objetivos) ? b.objetivos : [],
      objetivos_mov: (b.objetivos_mov && typeof b.objetivos_mov === 'object') ? b.objetivos_mov : {},
    }))
    .sort((a: Banda, b: Banda) => a.hasta - b.hasta)
}

/**
 * El total. `null` si falta algún ítem por puntuar.
 *
 * Una suma incompleta no es una suma más pequeña: es que no hay resultado. Aquí sí se
 * puede ser tajante, al revés que con las barras sueltas, donde cada ítem se sostiene solo.
 */
export function puntuacionDe(items: any[]): number | null {
  const lista = items || []
  if (lista.length === 0) return null
  const valores = lista.map(i => { const v = valorDe(i); return v === '' ? NaN : parseFloat(v) })
  if (valores.some(v => !isFinite(v))) return null
  return valores.reduce((a, b) => a + b, 0)
}

/** Los ítems que quedan por puntuar. Para poder decir QUÉ falta, no solo que falta. */
export function puntuacionesPendientes(items: any[]): string[] {
  return (items || [])
    .map((it, i) => ({ it, nombre: nombreItem(it, i) }))
    .filter(x => valorDe(x.it) === '')
    .map(x => x.nombre)
}

/**
 * En qué banda cae un total. `null` si no cae en ninguna: eso es un test mal configurado
 * y hay que decirlo, no repartirlo al extremo más cercano y dar un veredicto inventado.
 */
export function bandaDe(test: any, total: number | null): Banda | null {
  if (total === null) return null
  return bandasDe(test).find(b => total <= b.hasta) || null
}

/** Hasta dónde puede llegar el total, según los mín/máx de los ítems. */
export function rangoTotal(items: any[]): { min: number, max: number } | null {
  const lista = items || []
  if (lista.length === 0) return null
  let min = 0, max = 0
  for (const i of lista) {
    const a = Number(i?.min), b = Number(i?.max)
    if (!isFinite(a) || !isFinite(b)) return null
    min += a; max += b
  }
  return { min, max }
}

/* ─── TESTS CONTRA BAREMO ───────────────────────────────────────────────────
 *
 * El otro tipo que faltaba. En el fitness de mayores no hay un total que sumar: son seis
 * pruebas independientes —sentarse y levantarse en 30 s, flexiones de brazo, levantarse y
 * andar 2,4 m— y cada una se compara con SU norma, que depende del sexo y de la edad.
 * Sumarlas sería sumar segundos con repeticiones, que da un número sin significado.
 *
 * Lo que sí se puede contar es CUÁNTAS pruebas quedan por debajo de su norma, y ese
 * recuento cae en las mismas bandas que un test de puntuación. Así no hay una tercera
 * mecánica: 'suma' y 'baremo' se diferencian solo en de dónde sale el número.
 *
 * Y una cosa que aquí importa más que en ningún otro tipo: si falta el sexo, falta la
 * fecha de nacimiento, o el paciente cae fuera de los tramos de la tabla, el test NO tiene
 * resultado. Dar un negativo ahí sería decir "está bien" sobre alguien a quien no se ha
 * podido comparar con nada.
 */

export type FilaBaremo = {
  /** Nombre del ítem al que se aplica, tal cual está escrito en `items`. */
  item: string
  /** 'hombre' | 'mujer'. Vacío = vale para cualquiera. */
  sexo?: string
  edad_min?: number
  edad_max?: number
  /** El intervalo NORMAL. Los dos son opcionales por separado: hay pruebas donde más es
   *  mejor (repeticiones, normal ≥ min) y otras donde menos lo es (segundos, normal ≤ max). */
  min?: number
  max?: number
  fuente?: string
}

export type ContextoPaciente = { sexo?: string | null, edad?: number | null }

export const esBaremo = (test: any) => test?.logica === 'baremo'

export function baremosDe(test: any): FilaBaremo[] {
  return (Array.isArray(test?.baremos) ? test.baremos : []).filter((b: any) => b && String(b.item || '').trim())
}

/** Edad cumplida en una fecha. Sin fecha de nacimiento no hay edad, y eso se dice. */
export function edadEn(fechaNacimiento?: string | null, fecha?: string): number | null {
  if (!fechaNacimiento) return null
  const n = new Date(String(fechaNacimiento).slice(0, 10) + 'T12:00:00')
  const d = new Date((fecha ? String(fecha).slice(0, 10) : hoy()) + 'T12:00:00')
  if (!isFinite(n.getTime()) || !isFinite(d.getTime())) return null
  let e = d.getFullYear() - n.getFullYear()
  const m = d.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && d.getDate() < n.getDate())) e--
  return e >= 0 && e < 130 ? e : null
}

/** Cuánto de concreta es una fila. Gana la más concreta cuando encajan varias. */
const concrecion = (b: FilaBaremo) => (b.sexo ? 2 : 0) + (b.edad_min != null || b.edad_max != null ? 1 : 0)

/**
 * La fila de baremo que aplica a un ítem para este paciente.
 *
 * Se empareja por NOMBRE del ítem, igual que las metas se emparejan con el movimiento:
 * es lo que permite escribir la tabla una vez y que siga valiendo al reordenar los ítems.
 */
export function baremoDe(test: any, nombre: any, ctx: ContextoPaciente): FilaBaremo | null {
  const n = String(nombre || '').trim().toLowerCase()
  if (!n) return null
  const encaja = (b: FilaBaremo) => {
    // Una fila con sexo no vale para un paciente sin sexo: no es que valga "para
    // cualquiera", es que no se sabe cuál mirar.
    if (b.sexo && b.sexo !== (ctx.sexo || '')) return false
    if (b.edad_min != null && (ctx.edad == null || ctx.edad < Number(b.edad_min))) return false
    if (b.edad_max != null && (ctx.edad == null || ctx.edad > Number(b.edad_max))) return false
    return true
  }
  return baremosDe(test)
    .filter(b => String(b.item).trim().toLowerCase() === n)
    .filter(encaja)
    .sort((a, b) => concrecion(b) - concrecion(a))[0] || null
}

/** ¿Está el valor dentro de su norma? null si no se puede saber. */
export function dentroDeNorma(fila: FilaBaremo | null, valor: any): boolean | null {
  if (!fila) return null
  const v = parseFloat(String(valor))
  if (!isFinite(v)) return null
  const tieneMin = fila.min !== undefined && fila.min !== null && isFinite(Number(fila.min))
  const tieneMax = fila.max !== undefined && fila.max !== null && isFinite(Number(fila.max))
  if (!tieneMin && !tieneMax) return null
  if (tieneMin && v < Number(fila.min)) return false
  if (tieneMax && v > Number(fila.max)) return false
  return true
}

/** La norma en una línea, para leerla al lado del número mientras se rellena. */
export function textoNorma(fila: FilaBaremo | null, item?: any): string {
  if (!fila) return ''
  const u = item ? unidadDe(item).simbolo.trim() : ''
  const tieneMin = fila.min !== undefined && fila.min !== null
  const tieneMax = fila.max !== undefined && fila.max !== null
  if (tieneMin && tieneMax) return `Normal entre ${fila.min} y ${fila.max}${u}`
  if (tieneMin) return `Normal a partir de ${fila.min}${u}`
  if (tieneMax) return `Normal hasta ${fila.max}${u}`
  return ''
}

export type EvaluacionBaremo = {
  /** Por qué no se puede resolver. null = sí se puede. */
  motivo: string | null
  filas: { nombre: string, valor: string, baremo: FilaBaremo | null, dentro: boolean | null }[]
  /** Ítems por debajo de su norma. null si no se puede resolver. */
  fallos: number | null
}

export function evaluarBaremo(test: any, items: any[], ctx: ContextoPaciente): EvaluacionBaremo {
  const filas = (items || []).map((it, i) => {
    const baremo = baremoDe(test, it?.nombre, ctx)
    return { nombre: nombreItem(it, i), valor: valorDe(it), baremo, dentro: dentroDeNorma(baremo, valorDe(it)) }
  })

  let motivo: string | null = null
  if (filas.length === 0) motivo = 'El test no tiene ítems que comparar.'
  else if (!ctx.sexo) motivo = 'Falta el sexo del paciente. Los baremos se leen por sexo y edad, así que sin él no hay con qué comparar.'
  else if (ctx.edad == null) motivo = 'Falta la fecha de nacimiento del paciente. Los baremos se leen por sexo y edad.'
  else {
    const sinMedir = filas.filter(f => f.valor === '').map(f => f.nombre)
    const sinTabla = filas.filter(f => f.valor !== '' && !f.baremo).map(f => f.nombre)
    if (sinMedir.length > 0) motivo = `Falta medir: ${sinMedir.join(', ')}.`
    else if (sinTabla.length > 0) motivo = `No hay baremo para ${sinTabla.join(', ')} en ${ctx.sexo} de ${ctx.edad} años. Añádelo en la biblioteca: sin él, este test no significa nada.`
  }

  return { motivo, filas, fallos: motivo ? null : filas.filter(f => f.dentro === false).length }
}

/**
 * Qué le falta a un test de la biblioteca para poder guardarse.
 *
 * Un ítem con `regla` pero sin umbral, o sin barra de mín/máx, no da error al guardar: se
 * guarda tal cual y el fallo aparece semanas después con el paciente delante, en forma de
 * barra que va de 0 a 100 por defecto o de regla que nunca se cumple. El sitio donde se
 * toma la decisión es este formulario, así que el aviso va aquí.
 *
 * Devuelve la lista de problemas en el mismo orden en que se leen en pantalla. Vacía = se
 * puede guardar.
 */
export function problemasDelTest(test: any): string[] {
  const p: string[] = []
  // '' y null son "sin poner"; Number() los convertiría en 0 y daría por válido un umbral
  // que nadie ha escrito.
  const num = (v: any) => (v === '' || v === null || v === undefined) ? NaN : Number(v)

  if (!String(test?.nombre || '').trim()) p.push('El test no tiene nombre.')

  const items: any[] = test?.items || []
  items.forEach((it, i) => {
    const como = `«${nombreItem(it, i)}»`

    if (!String(it?.nombre || '').trim()) {
      p.push(`${como}: sin nombre. El nombre del ítem es lo que empareja la meta con el movimiento del objetivo, así que en blanco no resuelve nada.`)
    }
    // En suma y en baremo la regla por ítem no decide nada; se revisa en su propio bloque.
    if (!it?.regla || esSuma(test) || esBaremo(test)) return

    if (!mide(it)) {
      p.push(`${como}: tiene regla pero no tiene unidad, así que la regla se ignora y el ítem vuelve a ser una casilla. Ponle unidad o quítale la regla.`)
      return
    }

    const dos = it.regla === 'entre' || it.regla === 'fuera'
    const a = num(it.umbral), b = num(it.umbral2)
    if (!isFinite(a)) p.push(`${como}: falta el valor del umbral.`)
    if (dos && !isFinite(b)) p.push(`${como}: la regla «${it.regla}» necesita dos valores y solo tiene uno.`)

    const min = num(it.min), max = num(it.max)
    if (!isFinite(min) || !isFinite(max)) {
      p.push(`${como}: la barra no tiene mínimo y máximo. Sin ellos se pinta de 0 a 100, que casi nunca es el rango real.`)
      return
    }
    if (min >= max) { p.push(`${como}: el mínimo de la barra (${min}) no es menor que el máximo (${max}).`); return }

    for (const u of [a, ...(dos ? [b] : [])]) {
      if (isFinite(u) && (u < min || u > max)) {
        p.push(`${como}: el umbral ${u} queda fuera de la barra ${min}–${max}, así que nunca se podrá alcanzar.`)
      }
    }
  })

  if (esSuma(test)) {
    if (items.length === 0) p.push('Un test de puntuación necesita ítems: el resultado es la suma de todos.')

    items.forEach((it, i) => {
      const como = `«${nombreItem(it, i)}»`
      if (!mide(it)) {
        p.push(`${como}: en un test de puntuación todos los ítems puntúan, así que necesita unidad. Para el FPI-6, puntos.`)
      } else if (!isFinite(num(it.min)) || !isFinite(num(it.max))) {
        p.push(`${como}: falta el mínimo o el máximo. Sin ellos no se sabe hasta dónde puede llegar el total ni se puede pintar el selector.`)
      } else if (num(it.min) >= num(it.max)) {
        p.push(`${como}: el mínimo (${it.min}) no es menor que el máximo (${it.max}).`)
      }
      if (it?.regla) p.push(`${como}: tiene regla propia, y en un test de puntuación el veredicto lo da el total. Quítasela para que no parezca que decide algo.`)
      if ((it?.objetivos || []).length > 0) p.push(`${como}: tiene objetivos colgados, y en un test de puntuación no se abren: el hallazgo es del total. El objetivo se engancha al test entero desde la biblioteca de objetivos.`)
    })

    p.push(...problemasDeBandas(test, rangoTotal(items)?.max, 'el total'))
  }

  if (esBaremo(test)) {
    if (items.length === 0) p.push('Un test de baremo necesita ítems: cada uno se compara con su norma.')
    const filas = baremosDe(test)
    const nombres = items.map((it, i) => nombreItem(it, i).toLowerCase())

    items.forEach((it, i) => {
      const como = `«${nombreItem(it, i)}»`
      if (it?.regla) p.push(`${como}: tiene regla propia, y en un test de baremo el umbral lo pone la tabla de normas. Quítasela para que no parezca que decide algo.`)
      if ((it?.objetivos || []).length > 0) p.push(`${como}: tiene objetivos colgados, y en un test de baremo no se abren: el hallazgo es del conjunto. El objetivo se engancha al test entero.`)
      if (!mide(it)) { p.push(`${como}: en un test de baremo todos los ítems se miden, así que necesita unidad.`); return }
      const suyas = filas.filter(b => String(b.item).trim().toLowerCase() === nombreItem(it, i).toLowerCase())
      if (suyas.length === 0) p.push(`${como}: no tiene ninguna condición de baremo. Sin norma no se puede decir si el resultado está bien o mal.`)
    })

    filas.forEach((b, i) => {
      const como = `Condición ${i + 1} (${b.item || 'sin ítem'})`
      if (!nombres.includes(String(b.item).trim().toLowerCase())) {
        p.push(`${como}: no coincide con ningún ítem del test. Se empareja por nombre, así que un ítem renombrado deja su baremo huérfano.`)
      }
      const min = num(b.min), max = num(b.max)
      if (!isFinite(min) && !isFinite(max)) p.push(`${como}: no dice ni mínimo ni máximo, así que no marca ninguna norma.`)
      if (isFinite(min) && isFinite(max) && min > max) p.push(`${como}: el mínimo normal (${b.min}) es mayor que el máximo (${b.max}).`)
      const eMin = num(b.edad_min), eMax = num(b.edad_max)
      if (isFinite(eMin) && isFinite(eMax) && eMin > eMax) p.push(`${como}: el tramo de edad va de ${b.edad_min} a ${b.edad_max}, al revés.`)
      if (b.sexo && b.sexo !== 'hombre' && b.sexo !== 'mujer') p.push(`${como}: el sexo «${b.sexo}» no es ni hombre ni mujer, así que no va a encajar con ningún paciente.`)
    })

    // El número que cae en las bandas es cuántos ítems fallan: como mucho, todos.
    p.push(...problemasDeBandas(test, items.length, 'el recuento de pruebas por debajo de la norma'))
  }

  return p
}

/** Lo que le puede faltar a un juego de bandas, sea de suma o de baremo. */
function problemasDeBandas(test: any, techoNecesario: number | undefined, queEs: string): string[] {
  const p: string[] = []
  const bandas = bandasDe(test)
  if (bandas.length === 0) {
    p.push(`No hay bandas. Sin ellas ${queEs} es un número suelto y el test no puede dar ni positivo ni negativo.`)
  } else {
    if (bandas.some(b => !b.etiqueta.trim())) p.push('Hay bandas sin nombre. El nombre de la banda es lo que se guarda en el historial y lo que se lee luego.')
    // En estos tests el trabajo cuelga de la banda. Una banda que es hallazgo y no abre nada
    // deja un resultado positivo sin consecuencia, que es el fallo mudo de siempre.
    const mudas = bandas.filter(b => b.hallazgo && (b.objetivos || []).length === 0).map(b => b.etiqueta || 'sin nombre')
    if (mudas.length > 0) {
      p.push(`Estas bandas son hallazgo y no abren ningún objetivo: ${mudas.join(', ')}. Un resultado que caiga ahí saldrá positivo y no aparecerá nada en la ficha.`)
    }
    const techos = bandas.map(b => b.hasta)
    if (new Set(techos).size !== techos.length) p.push('Hay dos bandas con el mismo techo: la segunda nunca se alcanzaría.')
    const ultima = bandas[bandas.length - 1].hasta
    if (techoNecesario !== undefined && isFinite(techoNecesario) && ultima < techoNecesario) {
      p.push(`La última banda llega hasta ${ultima} y ${queEs} puede llegar a ${techoNecesario}. Por encima no caería en ninguna banda y el test se quedaría sin resultado.`)
    }
  }
  return p
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

/**
 * El veredicto de un test entero. ES LO QUE HAY QUE LLAMAR DESDE FUERA.
 *
 * `resultadoDeItems` solo sabe de casillas. Quien tuviera el `logica` a mano podía
 * llamarlo con un test de puntuación y recibir un "negativo" salido de contar casillas que
 * en ese test no existen, sin que nada fallara. Por eso lo que se pasa aquí es el TEST, no
 * su lógica suelta: las bandas viven en él.
 */
export function resultadoDeTest(test: any, items: ItemTest[], aMano: ResultadoTest = 'positivo', ctx?: ContextoPaciente): ResultadoTest {
  if (aMano === 'sin_realizar') return 'sin_realizar'
  // Suma y baremo acaban igual: un número que cae en una banda. Cambia de dónde sale el
  // número —el total de los ítems, o cuántos quedan por debajo de su norma—.
  const numero = esSuma(test) ? puntuacionDe(items)
    : esBaremo(test) ? evaluarBaremo(test, items, ctx || {}).fallos
    : undefined
  if (numero === undefined) return resultadoDeItems(items, test?.logica, aMano)
  // Número incompleto, o número que no cae en ninguna banda: NO hay veredicto. Devolver
  // 'negativo' aquí sería exactamente el fallo que estos tipos vienen a evitar.
  const banda = bandaDe(test, numero)
  if (!banda) return 'sin_realizar'
  return banda.hallazgo ? 'positivo' : 'negativo'
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
  /**
   * Objetivos que este resultado ha ABIERTO.
   *
   * Se devuelve para poder avisar del caso mudo: test positivo que no abre ninguno. Eso
   * casi siempre significa que el objetivo cuelga de un ítem distinto del que ha dado
   * positivo —una casilla que nadie marcó— y hasta ahora no había forma de enterarse:
   * el test se guardaba, decía "positivo", y en la ficha no aparecía nada.
   */
  abiertos: number
  /** Solo en tests de puntuación: el total y la banda en la que ha caído. */
  puntuacion?: number | null
  banda?: string | null
  /** Objetivos por fases que han cambiado de fase por este resultado. */
  fases?: { objetivo: string, desde: number | null, hasta: number }[]
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
  const lado = datos.lado || 'bilateral'
  const fecha = datos.fecha || hoy()

  /**
   * El baremo necesita al PACIENTE, no solo lo medido: la norma depende de su sexo y de la
   * edad que tenía el día del test. Se lee aquí, en la función que escribe, y no se pide a
   * quien llama, porque si dependiera de que cada pantalla lo pase, la que se olvidara
   * guardaría un resultado comparado contra nada.
   *
   * Y si falta el dato, NO SE GUARDA. Es el único caso en el que registrar un test se
   * niega: un veredicto sin baremo aplicable sería "está bien" dicho sobre alguien a quien
   * no se ha comparado con nada, y quedaría en el historial igual que uno de verdad.
   */
  let ctx: ContextoPaciente = {}
  if (esBaremo(test)) {
    const { data: pac, error: errPac } = await supabase.from('pacientes')
      .select('sexo,fecha_nacimiento').eq('id', pacienteId).maybeSingle()
    if (errPac) return { ok: false, error: errPac.message }
    ctx = { sexo: pac?.sexo || null, edad: edadEn(pac?.fecha_nacimiento, fecha) }
    const ev = evaluarBaremo(test, items, ctx)
    if (ev.motivo) return { ok: false, error: ev.motivo }
  }

  const resultado = resultadoDeTest(test, items, datos.resultado || 'positivo', ctx)

  // El número se recalcula siempre de los ítems —lo derivado no se guarda— pero la BANDA
  // sí se congela, igual que la unidad y la regla: si mañana mueves los cortes, el registro
  // de marzo tiene que seguir diciendo "Pronado".
  const evalBaremo = esBaremo(test) ? evaluarBaremo(test, items, ctx) : null
  const puntuacion = esSuma(test) ? puntuacionDe(items) : evalBaremo ? evalBaremo.fallos : null
  const banda = (esSuma(test) || esBaremo(test)) ? bandaDe(test, puntuacion) : null

  const { error } = await supabase.from('resultados_tests').insert({
    paciente_id: pacienteId,
    test_id: test.id,
    fecha,
    resultado,
    observaciones: datos.observaciones || null,
    fecha_repeticion: datos.fechaRepeticion || null,
    lado,
    banda: banda?.etiqueta || null,
    // Se congela la unidad con el resultado, igual que la sesión congela el nombre del
    // ejercicio: si mañana el test pasa a medirse en centímetros, el registro de marzo
    // tiene que seguir diciendo los grados que se anotaron aquel día.
    items_resultado: items.map((i, n) => ({
      nombre: i.nombre, marcado: i.marcado,
      unidad: unidadDe(i).id, valor: valorDe(i),
      // El BAREMO aplicado se congela también. La tabla de normas se va a corregir con el
      // tiempo, y sin esto un resultado de marzo cambiaría de sentido al retocarla.
      ...(evalBaremo?.filas[n]?.baremo ? {
        norma_min: evalBaremo.filas[n].baremo!.min,
        norma_max: evalBaremo.filas[n].baremo!.max,
        dentro: evalBaremo.filas[n].dentro,
      } : {}),
      // Los extremos se congelan siempre que estén: son los que dan sentido al número
      // guardado —un 2 sobre 4 no es un 2 sobre 10— y en un test de puntuación son además
      // lo que permite volver a pintar el selector tal y como estaba.
      ...(i.min !== undefined && i.min !== null ? { min: i.min } : {}),
      ...(i.max !== undefined && i.max !== null ? { max: i.max } : {}),
      // La REGLA se congela igual que la unidad. Si mañana subes el umbral del lunge de 10
      // a 12, el registro de marzo tiene que seguir explicando por qué salió positivo
      // aquel día. Sin esto, el histórico cambiaría de sentido al tocar la biblioteca.
      ...(tieneBarra(i) ? { regla: i.regla, umbral: i.umbral, umbral2: i.umbral2 } : {}),
    })),
  })
  if (error) return { ok: false, error: error.message }

  // El evento va SIEMPRE, también cuando el test es negativo: que un test haya dado
  // negativo en marzo es información clínica, no ausencia de ella.
  // En un test de puntuación lo que hay que leer en la cronología es el total y su banda:
  // la lista de ítems marcados está vacía porque ahí no se marca nada.
  const marcados = esBaremo(test)
    ? `${puntuacion} de ${items.length} por debajo de su norma${banda ? ` · ${banda.etiqueta}` : ''}`
    : esSuma(test)
    ? (puntuacion === null ? null : `Total ${puntuacion}${banda ? ` · ${banda.etiqueta}` : ''}`)
    : (items.filter(i => i.marcado)
        .map(i => { const m = textoMedida(i); return i.nombre + (m ? ` (${m})` : '') }).join(', ') || null)
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'test',
    titulo: `Test ${resultado}: ${test.nombre || 'test'}${lado && lado !== 'bilateral' ? ' · ' + lado : ''}`,
    descripcion: [marcados, datos.observaciones || null, datos.contexto ? `Desde ${datos.contexto}` : null]
      .filter(Boolean).join(' · ') || null,
    fecha,
  })

  let logrados = 0
  let abiertos = 0

  if (resultado === 'positivo') {
    const a = await abrirObjetivosDelTest(pacienteId, test, datos.contexto, lado, banda)
    abiertos += a
    // En puntuación y en baremo el hallazgo es del CONJUNTO, así que solo cuenta el
    // objetivo del test entero. Recorrer los ítems abriría objetivos por un ítem que por
    // sí solo no significa nada —un +1 de un FPI-6 que suma 3 no es una pronación—.
    if (!esSuma(test) && !esBaremo(test)) {
      // Los ítems marcados que NO llevan objetivo colgado no abren nada. Es legítimo —hay
      // ítems que solo describen— pero si no abre ninguno el test entero, hay que decirlo.
      const b = await moverObjetivosDeItems(pacienteId, test, items, datos.contexto, lado)
      logrados += b.logrados
      abiertos += b.abiertos
    }
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

  // Las FASES ya no se recalculan: los objetivos no las tienen. `lib/fases.ts` sigue
  // entero en el repositorio por si vuelven, pero nadie lo llama.
  return { ok: true, resultado, logrados, metasCerradas: cerradas.length, abiertos, puntuacion, banda: banda?.etiqueta || null, fases: [] }
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
  /** Solo en tests de puntuación: la banda congelada aquel día. */
  banda: string | null
}

export async function ultimosResultadosDe(pacienteId: string): Promise<UltimoResultado[]> {
  if (!pacienteId) return []
  const { data } = await supabase.from('resultados_tests')
    .select('test_id,lado,fecha,resultado,observaciones,items_resultado,banda,created_at')
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
      banda: r.banda ?? null,
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
async function abrirObjetivosDelTest(pacienteId: string, test: any, contexto?: string, lado?: string, banda?: Banda | null) {
  const base = 'Test: ' + (test.nombre || 'test')

  /**
   * CADA TIPO DE TEST CUELGA SUS OBJETIVOS DONDE LE CORRESPONDE.
   *
   * En un test de casillas, del ÍTEM. En uno de puntuación o de baremo, de la BANDA, que es
   * su equivalente: el sitio concreto que dice qué trabajo abre este resultado.
   *
   * Hacía falta porque "positivo" no siempre significa lo mismo: un FPI-6 sale positivo con
   * el pie supinado y con el pronado, y el trabajo es el contrario. Colgarlo del test entero
   * abría el objetivo de la pronación a un pie supinado, y nadie se enteraba.
   *
   * La vía lleva la banda en su `ref`, así que un resultado que cambia de banda cierra lo
   * que abrió la anterior en vez de dejar las dos cosas abiertas a la vez.
   */
  if (esSuma(test) || esBaremo(test)) {
    if (!banda) return 0
    await resolverViasDeOtrasBandas(pacienteId, test.id, banda.etiqueta, contexto)
    const ids = Array.isArray(banda.objetivos) ? banda.objetivos : []
    const movs = banda.objetivos_mov || {}
    for (const oid of ids) {
      await abrirOReabrir(pacienteId, oid, {
        tipo: 'test', ref: refDeBanda(test.id, banda.etiqueta), etiqueta: `${base} · ${banda.etiqueta}`,
        resuelto: false, fecha_resuelto: null, mov: movs[oid] || null, lado: lado || null,
      }, contexto)
    }
    return ids.length
  }

  /**
   * En un test de casillas ya no cuelga nada del test entero.
   *
   * `objetivos.test_id` era la segunda forma de decir lo mismo: el test colgaba objetivos de
   * sus ítems, y el objetivo podía colgarse a sí mismo del test completo. Dos sitios para
   * una decisión acaban contradiciéndose, y quien mira uno no ve lo que dice el otro.
   *
   * Ahora hay una sola vía y vive en el test: el ítem si es de casillas, la banda si puntúa.
   * La columna se queda en la base para no borrar de golpe lo que hubiera configurado antes,
   * pero no la lee nadie.
   */
  return 0
}

/** La referencia de una vía abierta por una banda. Lleva el test y la banda dentro. */
export const refDeBanda = (testId: string, etiqueta: string) => `${testId}|${String(etiqueta || '').trim()}`

/**
 * Cierra lo que abrieron OTRAS bandas del mismo test.
 *
 * Un pie que pasa de supinado a pronado sigue dando el test positivo, así que nada lo
 * cerraría: se abrirían los objetivos de la pronación y los de la supinación se quedarían
 * abiertos para siempre, con el paciente arrastrando trabajo de una situación que ya no
 * tiene. Cambiar de banda es dejar atrás la anterior.
 */
async function resolverViasDeOtrasBandas(pacienteId: string, testId: string, etiquetaActual: string, contexto?: string) {
  const actual = refDeBanda(testId, etiquetaActual)
  const { data: pos } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,vias,logrado').eq('paciente_id', pacienteId)

  for (const po of (pos || [])) {
    const vias: Via[] = Array.isArray(po.vias) ? po.vias : []
    let cambio = false
    const nuevas = vias.map((v: any) => {
      const deOtraBanda = v.tipo === 'test' && typeof v.ref === 'string'
        && v.ref.startsWith(testId + '|') && v.ref !== actual && !v.resuelto
      if (!deOtraBanda) return v
      cambio = true
      return { ...v, resuelto: true, fecha_resuelto: hoy() }
    })
    if (!cambio) continue
    await guardarVias(pacienteId, po.objetivo_id, nuevas, {
      logradoAntes: !!po.logrado, contexto: contexto || 'un cambio de banda del test',
    })
  }
}

/**
 * Objetivos que cuelgan de un ítem concreto: se abren si queda marcado y se resuelven
 * si no. La referencia es `testId:índice`, que es lo que `resolverViasDeTest` sabe leer.
 */
async function moverObjetivosDeItems(pacienteId: string, test: any, items: ItemTest[], contexto?: string, lado?: string) {
  let logrados = 0
  let abiertos = 0
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
        abiertos++
      } else {
        const r = await resolverVia(pacienteId, oid, 'test_item', ref, true, contexto || 'un test')
        if (r.ok && r.logrado) logrados++
      }
    }
  }
  return { logrados, abiertos }
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

/* ─── BORRAR UN TEST DE LA BIBLIOTECA ───────────────────────────────────────
 *
 * Borrar el test no era borrar el test. Se iban su fila y sus resultados, pero las VÍAS
 * que había abierto en los pacientes —`test` con ref = id del test, `test_item` con ref
 * `id:índice`— se quedaban en `pacientes_objetivos` apuntando a algo que ya no existe. Un
 * objetivo sostenido por una vía fantasma no se puede cerrar nunca: la única forma de
 * resolverla era volver a pasar el test, y el test ya no está.
 *
 * Además ninguno de los dos `delete` miraba su error, así que un borrado bloqueado por la
 * clave ajena de `resultados_tests` se veía igual que uno correcto.
 *
 * Se sigue el patrón de `lib/borrarPaciente.ts`: primero lo que apunta al test, el test al
 * final, parando en el primer fallo en vez de dejarlo a medias.
 */

const esViaDeTest = (v: any, testId: string) =>
  // `test|banda` para las que abre una banda, `test:índice` para las de un ítem.
  (v?.tipo === 'test' && typeof v?.ref === 'string' && (v.ref === testId || v.ref.startsWith(testId + '|'))) ||
  (v?.tipo === 'test_item' && typeof v?.ref === 'string' && v.ref.startsWith(testId + ':'))

export type AlcanceBorradoTest = {
  resultados: number
  /** Pacientes con alguna vía de objetivo abierta por este test. */
  pacientes: number
  /** Objetivos que este test abre desde sus ítems o sus bandas: se quedarían sin quien los abra. */
  objetivos: string[]
}

/** Qué se lleva por delante el borrado. Para poder preguntarlo ANTES de hacerlo. */
export async function alcanceBorradoTest(testId: string): Promise<AlcanceBorradoTest> {
  // Los objetivos que cuelgan de este test ya no se buscan por `objetivos.test_id`: viven
  // dentro del propio test, en sus ítems y en sus bandas.
  const [{ count }, { data: t }, { data: pos }] = await Promise.all([
    supabase.from('resultados_tests').select('id', { count: 'exact', head: true }).eq('test_id', testId),
    supabase.from('tests').select('items,bandas').eq('id', testId).maybeSingle(),
    supabase.from('pacientes_objetivos').select('paciente_id,vias'),
  ])

  const ids = Array.from(new Set([
    ...(Array.isArray(t?.items) ? t!.items : []).flatMap((i: any) => Array.isArray(i?.objetivos) ? i.objetivos : []),
    ...(Array.isArray(t?.bandas) ? t!.bandas : []).flatMap((b: any) => Array.isArray(b?.objetivos) ? b.objetivos : []),
  ])) as string[]
  const { data: objs } = ids.length > 0
    ? await supabase.from('objetivos').select('nombre').in('id', ids)
    : { data: [] as any[] }
  const pacientes = new Set(
    (pos || [])
      .filter(po => (Array.isArray(po.vias) ? po.vias : []).some((v: any) => esViaDeTest(v, testId)))
      .map(po => po.paciente_id),
  )
  return { resultados: count || 0, pacientes: pacientes.size, objetivos: (objs || []).map((o: any) => o.nombre) }
}

export type ResultadoBorradoTest =
  | { ok: true, resultados: number, viasQuitadas: number }
  | { ok: false, error: string }

export async function borrarTest(testId: string): Promise<ResultadoBorradoTest> {
  if (!testId) return { ok: false, error: 'Falta el test' }

  // 1. Las vías, primero: si el borrado del test falla después, al menos no quedan
  // apuntando a un test que sí sigue existiendo (una vía de menos se puede reabrir
  // pasando el test otra vez; una vía fantasma no se puede cerrar de ninguna forma).
  const { data: pos, error: errPos } = await supabase.from('pacientes_objetivos')
    .select('paciente_id,objetivo_id,vias,logrado')
  if (errPos) return { ok: false, error: errPos.message }

  let viasQuitadas = 0
  for (const po of (pos || [])) {
    const vias: Via[] = Array.isArray(po.vias) ? po.vias : []
    const restantes = vias.filter(v => !esViaDeTest(v, testId))
    if (restantes.length === vias.length) continue
    // La fila NO se borra aunque se quede sin vías: un objetivo con `vias: []` es un
    // estado legítimo —así nacen los que se añaden a mano desde la ficha— y borrarlo se
    // llevaría por delante un objetivo que el paciente puede tener por otro motivo.
    const r = await guardarVias(po.paciente_id, po.objetivo_id, restantes, {
      logradoAntes: !!po.logrado, contexto: 'un test eliminado',
    })
    if (!r.ok) return { ok: false, error: r.error }
    viasQuitadas += vias.length - restantes.length
  }

  // 2. Los resultados. `resultados_tests.test_id` no tiene cascada, así que sin esto el
  // borrado del test se bloquea por clave ajena.
  const { count, error: errCount } = await supabase.from('resultados_tests')
    .select('id', { count: 'exact', head: true }).eq('test_id', testId)
  if (errCount) return { ok: false, error: errCount.message }

  const { error: errRes } = await supabase.from('resultados_tests').delete().eq('test_id', testId)
  if (errRes) return { ok: false, error: errRes.message }

  // 3. El test.
  const { error: errTest } = await supabase.from('tests').delete().eq('id', testId)
  if (errTest) return { ok: false, error: errTest.message }

  // 4. Y comprobar que de verdad se ha ido: `delete` devuelve ok aunque no borre ninguna
  // fila, por ejemplo si una política RLS lo impide.
  const { data: sigue } = await supabase.from('tests').select('id').eq('id', testId).maybeSingle()
  if (sigue) return { ok: false, error: 'El test sigue en la biblioteca después de borrarlo. Probablemente lo impide una política de la base de datos.' }

  return { ok: true, resultados: count || 0, viasQuitadas }
}
