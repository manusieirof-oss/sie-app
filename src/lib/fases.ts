import { supabase } from './supabase'
import { cambiarFase, FASE_MAX } from './metas'

/**
 * Los CRITERIOS DE SALIDA de un objetivo por fases. UN SOLO SITIO.
 *
 * Hasta ahora un objetivo por fases solo decía cuántas fases tenía, y en qué fase estaba
 * un paciente se ponía a mano pulsando la barrita de la ficha. Eso es exactamente lo que
 * la app evita en todo lo demás: una decisión clínica que se vuelve a tomar a ojo cada
 * vez, sin dejar dicho con qué criterio se tomó.
 *
 * Aquí la fase se CALCULA. Cada fase lleva sus condiciones de salida —"extensión completa",
 * "índice de fuerza por encima del 90%"— y cada condición apunta a un ítem de un test. Al
 * registrar cualquier test se vuelve a mirar, igual que `revisarMetas` vuelve a mirar las
 * metas, y sin que nadie tenga que acordarse de lanzarlo.
 *
 * DOS REGLAS QUE VIENEN DE CÓMO SE TRABAJA, NO DEL CÓDIGO:
 *
 *  - "Criterios de salida de la fase 1" son los que hay que cumplir para SALIR de la 1. Se
 *    está en la fase 3 cuando se cumplen los de la 1 y la 2 y no los de la 3.
 *  - TODOS o ninguno. Un criterio que falla deja abajo aunque el resto vaya sobrado. Una
 *    rodilla con fuerza de fase 4 y sin extensión completa no es una rodilla de fase 4.
 *
 * Y una tercera que sale de aquí: un criterio que NO SE HA MEDIDO no se cumple. No es lo
 * mismo que no cumplirse, pero para avanzar de fase pesa igual — avanzar por lo que no se
 * ha mirado es la peor forma de avanzar.
 */

export type CriterioFase = {
  test_id: string
  /**
   * Nombre del ítem dentro del test, no su posición.
   *
   * Igual que en los baremos: por posición, reordenar los ítems del test movería en
   * silencio contra qué se compara cada fase. El precio es que renombrar un ítem deja el
   * criterio huérfano, y por eso hay que poder verlo (`problemasDeCriterios`).
   */
  item: string
  /** Qué hace que el criterio se CUMPLA. Ojo: al revés que la regla del test, que dice qué lo hace positivo. */
  regla: 'mayor' | 'menor' | 'entre' | 'fuera'
  umbral?: number | null
  umbral2?: number | null
}

export type FaseDef = { fase: number, criterios: CriterioFase[] }

/**
 * Los criterios TAL CUAL están guardados, sin descartar nada.
 *
 * Es lo que necesitan el formulario y la validación: un criterio recién añadido nace sin
 * test ni ítem, y si se lee con `criteriosDe` desaparece antes de poder rellenarlo —el
 * botón "añadir criterio" parecía no hacer nada—. Y al guardar, una fila a medias tiene
 * que dar aviso, no evaporarse en silencio.
 */
export function criteriosBrutos(objetivo: any): { fase: number, criterios: any[] }[] {
  const bruto = Array.isArray(objetivo?.criterios_fase) ? objetivo.criterios_fase : []
  return bruto
    .filter((f: any) => f && isFinite(Number(f.fase)))
    .map((f: any) => ({ fase: Number(f.fase), criterios: Array.isArray(f.criterios) ? f.criterios : [] }))
    .sort((a: { fase: number }, b: { fase: number }) => a.fase - b.fase)
}

/**
 * Los criterios que SÍ pueden juzgar, ordenados por fase.
 *
 * Aquí se descarta lo que está a medias, y es a propósito: un criterio sin test o sin ítem
 * no puede decidir si alguien cambia de fase. Lo que no puede pasar es que además
 * desaparezca sin decirlo, y de eso se encarga `problemasDeCriterios` al guardar.
 */
export function criteriosDe(objetivo: any): FaseDef[] {
  return criteriosBrutos(objetivo)
    .map(f => ({ fase: f.fase, criterios: f.criterios.filter((c: any) => c && c.test_id && c.item) }))
}

/** La regla en una línea, para leerla al configurarla y al explicarla en la ficha. */
export function textoCriterio(c: CriterioFase, unidad?: string): string {
  const u = unidad ? ` ${unidad}` : ''
  const a = c.umbral, b = c.umbral2
  switch (c.regla) {
    case 'mayor': return `por encima de ${a}${u}`
    case 'menor': return `por debajo de ${a}${u}`
    case 'entre': return `entre ${Math.min(Number(a), Number(b))} y ${Math.max(Number(a), Number(b))}${u}`
    case 'fuera': return `fuera de ${Math.min(Number(a), Number(b))}–${Math.max(Number(a), Number(b))}${u}`
    default: return ''
  }
}

/** ¿Se cumple este criterio con este valor? null si todavía no se ha medido. */
export function cumpleCriterio(c: CriterioFase, valor: number | null): boolean | null {
  if (valor == null || !isFinite(valor)) return null
  const a = Number(c.umbral), b = Number(c.umbral2)
  switch (c.regla) {
    case 'mayor': return isFinite(a) ? valor > a : null
    case 'menor': return isFinite(a) ? valor < a : null
    case 'entre': return isFinite(a) && isFinite(b) ? valor >= Math.min(a, b) && valor <= Math.max(a, b) : null
    case 'fuera': return isFinite(a) && isFinite(b) ? valor < Math.min(a, b) || valor > Math.max(a, b) : null
    default: return null
  }
}

/**
 * El valor de un ítem en el resultado más reciente de un test, para un lado.
 *
 * El LADO manda: si el objetivo se abrió sobre la rodilla derecha, la fase la deciden las
 * mediciones de la derecha. Un test pasado sobre la pierna sana no puede hacer avanzar a
 * la lesionada. Un resultado bilateral sí vale para cualquier lado: ahí no hay dos
 * historias que confundir.
 */
export function valorDeItem(resultados: any[], testId: string, item: string, lado: string): number | null {
  const nombre = String(item || '').trim().toLowerCase()
  const sirve = (r: any) => {
    const l = r.lado || 'bilateral'
    return r.test_id === testId && (l === lado || l === 'bilateral')
  }
  const filas = (resultados || []).filter(sirve).sort((a: any, b: any) =>
    String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
    String(b.created_at || '').localeCompare(String(a.created_at || '')))
  for (const fila of filas) {
    const it = (fila.items_resultado || []).find((x: any) => String(x?.nombre || '').trim().toLowerCase() === nombre)
    if (!it) continue
    const v = parseFloat(String(it.valor ?? it.grados ?? ''))
    if (isFinite(v)) return v
  }
  return null
}

export type DetalleCriterio = { criterio: CriterioFase, valor: number | null, cumple: boolean | null }
export type DetalleFase = { fase: number, criterios: DetalleCriterio[], superada: boolean }

export type EvaluacionFases = {
  /** La fase que sale de las mediciones. null si no hay criterios que evaluar. */
  fase: number | null
  /** Hasta qué fase alcanzan los criterios escritos, contando desde la 1 sin saltos. */
  hasta: number
  detalle: DetalleFase[]
}

/**
 * En qué fase está el paciente según lo medido.
 *
 * Solo se decide hasta donde hay criterios ESCRITOS Y SEGUIDOS desde la fase 1. Si la 1 y
 * la 2 los tienen y la 3 no, se puede afirmar que ha salido de la 1 y de la 2, pero no
 * qué pasa de la 3 en adelante: ahí manda lo que haya puesto el entrenador a mano y no se
 * toca. Inventar un veredicto sobre una fase sin criterios sería justo lo contrario de lo
 * que esto viene a arreglar.
 */
export function evaluarFases(objetivo: any, resultados: any[], lado: string, faseActual?: number | null): EvaluacionFases {
  const total = Math.min(Number(objetivo?.fases) || 0, FASE_MAX)
  const defs = criteriosDe(objetivo)
  const porFase = new Map<number, CriterioFase[]>(defs.map(d => [d.fase, d.criterios]))

  // Contiguas desde la 1: un hueco corta la cadena.
  let hasta = 0
  while (hasta < total && (porFase.get(hasta + 1) || []).length > 0) hasta++

  const detalle: DetalleFase[] = []
  let primerFallo: number | null = null
  for (let n = 1; n <= hasta; n++) {
    const criterios = porFase.get(n) || []
    const filas = criterios.map(c => {
      const valor = valorDeItem(resultados, c.test_id, c.item, lado)
      return { criterio: c, valor, cumple: cumpleCriterio(c, valor) }
    })
    const superada = filas.length > 0 && filas.every(f => f.cumple === true)
    detalle.push({ fase: n, criterios: filas, superada })
    if (!superada && primerFallo === null) primerFallo = n
  }

  if (hasta === 0) return { fase: null, hasta, detalle }

  // Se ha quedado en la primera que no supera. Si las supera todas, sale de la última que
  // sabemos juzgar; y si el entrenador ya lo había puesto más arriba, no se le baja desde
  // aquí: por encima de `hasta` esta función no tiene nada que decir.
  const fase = primerFallo !== null
    ? primerFallo
    : Math.max(faseActual || 0, Math.min(hasta + 1, total || hasta + 1))

  return { fase: Math.min(Math.max(fase, 1), Math.max(total, 1)), hasta, detalle }
}

/** El lado sobre el que se abrió el objetivo. Es contra el que se miden sus criterios. */
export function ladoDeObjetivo(vias: any[]): string {
  const con = (Array.isArray(vias) ? vias : []).find((v: any) => v?.lado && v.lado !== 'bilateral')
  return con?.lado || 'bilateral'
}

export type CambioFase = { objetivo: string, desde: number | null, hasta: number }

/**
 * Recalcula la fase de todos los objetivos por fases del paciente.
 *
 * Se llama desde `registrarResultadoTest`, en el mismo sitio que `revisarMetas`: un test
 * es el único momento en que un criterio puede haber cambiado, y ponerlo en un proceso
 * aparte sería otro proceso del que acordarse.
 *
 * La fase BAJA si un criterio deja de cumplirse. Es deliberado: la fase es el reflejo de
 * la última medición, no una medalla. Una recaída que no baje la fase es una recaída que
 * no se ve.
 */
export async function revisarFases(pacienteId: string): Promise<CambioFase[]> {
  if (!pacienteId) return []

  const { data: filas, error } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,vias,fase_actual,logrado,objetivos!inner(id,nombre,tipo,fases,criterios_fase)')
    .eq('paciente_id', pacienteId)
  if (error) return []

  const conFases = (filas || []).filter((f: any) => {
    const o: any = Array.isArray(f.objetivos) ? f.objetivos[0] : f.objetivos
    return o?.tipo === 'fase' && criteriosDe(o).length > 0 && !f.logrado
  })
  if (conFases.length === 0) return []

  const { data: resultados } = await supabase.from('resultados_tests')
    .select('test_id,lado,fecha,items_resultado,created_at').eq('paciente_id', pacienteId)

  const cambios: CambioFase[] = []
  for (const fila of conFases as any[]) {
    const o: any = Array.isArray(fila.objetivos) ? fila.objetivos[0] : fila.objetivos
    const lado = ladoDeObjetivo(fila.vias)
    const ev = evaluarFases(o, resultados || [], lado, fila.fase_actual)
    if (ev.fase == null || ev.fase === fila.fase_actual) continue

    const sube = (fila.fase_actual || 0) < ev.fase
    const r = await cambiarFase(pacienteId, fila.objetivo_id, ev.fase, o.nombre, {
      desde: fila.fase_actual,
      motivo: sube
        ? 'Cumple los criterios de salida de las fases anteriores'
        : 'Un criterio de salida ha dejado de cumplirse',
    })
    if (!r.ok) continue
    cambios.push({ objetivo: o.nombre, desde: fila.fase_actual ?? null, hasta: ev.fase })
  }
  return cambios
}

/**
 * Qué le falta a un juego de criterios para poder usarse. Se enseña en la biblioteca, que
 * es donde se escriben, y no cuando ya está el paciente delante.
 */
export function problemasDeCriterios(objetivo: any, tests: any[]): string[] {
  const p: string[] = []
  // Sobre los BRUTOS: si se leyeran los buenos, una fila sin test o sin ítem se habría
  // descartado antes de llegar aquí y se perdería al guardar sin que nadie lo dijera.
  const defs = criteriosBrutos(objetivo)
  if (defs.length === 0) return p

  defs.forEach(d => {
    d.criterios.forEach((c: any, i: number) => {
      if (!c?.test_id) p.push(`Fase ${d.fase}, criterio ${i + 1}: falta elegir el test.`)
      else if (!c?.item) p.push(`Fase ${d.fase}, criterio ${i + 1}: falta elegir el ítem.`)
    })
  })

  const total = Number(objetivo?.fases) || 0
  const num = (v: any) => (v === '' || v === null || v === undefined) ? NaN : Number(v)

  // Un hueco corta la cadena: de ahí para arriba no se puede decidir nada.
  for (let n = 1; n <= total; n++) {
    const tiene = defs.find(d => d.fase === n)
    if (!tiene || tiene.criterios.length === 0) {
      if (defs.some(d => d.fase > n && d.criterios.length > 0)) {
        p.push(`La fase ${n} no tiene criterios y sí los tienen fases posteriores. Sin ella la cadena se corta: no se podrá pasar de la ${n} sola.`)
      }
      break
    }
  }

  defs.forEach(d => {
    if (total > 0 && d.fase > total) p.push(`Hay criterios para la fase ${d.fase} y el objetivo solo tiene ${total}.`)
    d.criterios.forEach((c: any, i: number) => {
      // Las filas a medias ya se avisaron arriba; repetirlo con otro texto solo confunde.
      if (!c?.test_id || !c?.item) return
      const como = `Fase ${d.fase}, criterio ${i + 1}`
      const t = (tests || []).find((x: any) => x.id === c.test_id)
      if (!t) { p.push(`${como}: el test ya no está en la biblioteca.`); return }
      const item = (t.items || []).find((x: any) => String(x?.nombre || '').trim().toLowerCase() === String(c.item || '').trim().toLowerCase())
      if (!item) { p.push(`${como}: «${c.item}» ya no es un ítem de «${t.nombre}». Se empareja por nombre, así que renombrarlo deja el criterio huérfano.`); return }
      if (!item.unidad && !item.tiene_grados) p.push(`${como}: «${c.item}» no mide nada, así que no se puede comparar con un umbral.`)
      if (!isFinite(num(c.umbral))) p.push(`${como}: falta el valor del umbral.`)
      if ((c.regla === 'entre' || c.regla === 'fuera') && !isFinite(num(c.umbral2))) p.push(`${como}: la regla «${c.regla}» necesita dos valores.`)
    })
  })

  return p
}
