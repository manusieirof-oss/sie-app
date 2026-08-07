import { supabase } from './supabase'

/**
 * Lo medido en un ítem, tolerando el nombre de campo anterior.
 *
 * Está copiado de `lib/tests.ts` a propósito y es la única duplicación consciente de este
 * fichero: `tests.ts` llama a `revisarMetas` al registrar un resultado, así que importarlo
 * de vuelta cerraría un ciclo entre los dos módulos. Son tres líneas y no encierran ninguna
 * decisión clínica.
 */
const leerValor = (item: any): string => String(item?.valor ?? item?.grados ?? '')

/**
 * Metas medibles de un objetivo: qué se mide, en qué movimiento y lado, y contra qué.
 *
 * Un objetivo métrico no se cierra por criterio: lo cierra una medición. La meta guarda de
 * qué test y de qué ítem sale, así que al registrar ese test el cálculo se hace solo. Sin
 * ese enlace el número es decoración y se vuelve a decidir a ojo, que es justo lo que
 * pasaba con "ganar fuerza y control cervical".
 *
 * Se puede cerrar a mano igualmente —queda marcado como tal— porque hay casos en los que la
 * medición no llega y la decisión clínica sí.
 */

/**
 * Cuánta diferencia entre lados se tolera para darlos por iguales.
 *
 * El 10% es lo que se usa habitualmente para dar el alta deportiva. Va en código y no como
 * columna por meta a propósito: si cada meta llevara el suyo, dos metas idénticas de dos
 * pacientes se cerrarían con criterios distintos sin que nadie lo notara.
 */
export const UMBRAL_IGUALDAD = 0.10

/**
 * Movimientos opuestos, para las metas de "igualar con el antagonista".
 *
 * Van en código como las parejas de patrón del informe de volumen: esto es anatomía, no
 * configuración de la clínica, y tenerlo en Ajustes solo abriría la puerta a que alguien
 * empareje cosas que no se oponen.
 */
export const PARES_MOVIMIENTO: [string, string][] = [
  ['Flexión', 'Extensión'],
  ['Rotación interna', 'Rotación externa'],
  ['Abducción', 'Aducción'],
  ['Inversión', 'Eversión'],
  ['Pronación', 'Supinación'],
  ['Protracción', 'Retracción'],
  ['Dorsiflexión', 'Flexión plantar'],
  ['Anteversión', 'Retroversión'],
]

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** El movimiento opuesto, o null si no tiene pareja conocida. */
export function antagonistaDe(movimiento: string): string | null {
  const n = norm(movimiento)
  for (const [a, b] of PARES_MOVIMIENTO) {
    if (norm(a) === n) return b
    if (norm(b) === n) return a
  }
  return null
}

export const TIPOS_META = [
  { id: 'mejorar', nombre: 'Mejorar', ayuda: 'Sobre el valor de partida del propio paciente.' },
  { id: 'igualar_lados', nombre: 'Igualar lados', ayuda: 'Que el lado peor alcance al bueno, con menos de un 10% de diferencia.' },
  { id: 'igualar_par', nombre: 'Igualar con el antagonista', ayuda: 'Que el movimiento y su opuesto queden parejos. Flexión contra extensión.' },
] as const

export type TipoMeta = typeof TIPOS_META[number]['id']

export type Meta = {
  id: string
  paciente_id: string
  objetivo_id: string
  movimiento_id?: string | null
  lado: 'izquierdo' | 'derecho' | 'bilateral'
  tipo: TipoMeta
  unidad?: string | null
  valor_inicial?: number | null
  meta_pct?: number | null
  meta_valor?: number | null
  test_id?: string | null
  item_indice?: number | null
  item_par_indice?: number | null
  cumplida?: boolean
  fecha_cumplida?: string | null
  cerrada_a_mano?: boolean
  nota?: string | null
}

export type Estado = {
  /** Lo que vale ahora, del último resultado del test. null si aún no se ha medido. */
  actual: number | null
  /** Contra qué se compara: la meta calculada, el otro lado o el antagonista. */
  referencia: number | null
  cumplida: boolean
  /** Frase corta para la ficha. Nunca un porcentaje sobre cero. */
  texto: string
  /** 0 a 1. null si todavía no hay con qué calcularlo. */
  progreso: number | null
}

/** El valor de un ítem en el resultado más reciente de un test, para un lado. */
function valorEn(resultados: any[], testId: string, lado: string, indice: number): number | null {
  const filas = resultados
    .filter(r => r.test_id === testId && (r.lado || 'bilateral') === lado)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
  const item = (filas[0]?.items_resultado || [])[indice]
  if (!item) return null
  const v = parseFloat(leerValor(item))
  return Number.isFinite(v) ? v : null
}

const otroLado = (l: string) => l === 'izquierdo' ? 'derecho' : l === 'derecho' ? 'izquierdo' : 'bilateral'

/**
 * Dónde está una meta ahora mismo, a partir de los resultados de tests del paciente.
 *
 * NO escribe nada: la usa igual la ficha para pintar y `revisarMetas` para cerrar. Que las
 * dos salgan de la misma función es lo que impide que la ficha diga una cosa y el cierre
 * automático haga otra.
 */
export function estadoDeMeta(meta: Meta, resultados: any[]): Estado {
  const vacio = (texto: string): Estado => ({ actual: null, referencia: null, cumplida: !!meta.cumplida, texto, progreso: null })

  if (meta.cerrada_a_mano) return { actual: null, referencia: null, cumplida: true, texto: 'Cerrada a mano', progreso: 1 }
  if (!meta.test_id || meta.item_indice == null) return vacio('Sin test asignado que la mida')

  const actual = valorEn(resultados, meta.test_id, meta.lado, meta.item_indice)
  const u = meta.unidad ? ` ${meta.unidad}` : ''

  if (meta.tipo === 'mejorar') {
    // Un "+20%" necesita punto de partida. Si aún no se ha medido, se dice, en vez de
    // enseñar un porcentaje calculado sobre cero.
    const base = meta.valor_inicial
    const objetivo = meta.meta_valor != null ? meta.meta_valor
      : (base != null && meta.meta_pct != null) ? base * (1 + meta.meta_pct / 100)
      : null
    if (objetivo == null) return vacio('Pendiente de la primera medición')
    if (actual == null) return { actual: null, referencia: objetivo, cumplida: !!meta.cumplida, texto: `Objetivo ${redondea(objetivo)}${u}, sin medir todavía`, progreso: null }
    const desde = base ?? 0
    // MEJORAR NO SIEMPRE ES SUBIR. Esto comparaba siempre `actual >= objetivo`, y con eso
    // media biblioteca de mediciones no tenía meta posible: el Timed up and go, los 10
    // metros, el Ashworth y cualquier escala de dolor mejoran BAJANDO. Una meta de "bajar
    // el TUG de 22 a 14 segundos" se quedaba abierta para siempre por muy bien que fuera,
    // y la barra de progreso marcaba cero.
    //
    // El sentido no hace falta preguntarlo ni guardarlo: sale de comparar el objetivo con
    // el punto de partida. Si la meta está por debajo de donde empezó, se baja. Guardarlo
    // en una columna sería una segunda verdad que podría contradecir a los dos números.
    const baja = objetivo < desde
    const progreso = objetivo === desde ? 1 : Math.max(0, Math.min(1, (actual - desde) / (objetivo - desde)))
    return { actual, referencia: objetivo, cumplida: baja ? actual <= objetivo : actual >= objetivo, progreso,
      texto: `${redondea(actual)}${u} de ${redondea(objetivo)}${u}` }
  }

  // Las dos de igualar comparan dos mediciones. Cambia solo de dónde sale la segunda.
  const referencia = meta.tipo === 'igualar_lados'
    ? valorEn(resultados, meta.test_id, otroLado(meta.lado), meta.item_indice)
    : (meta.item_par_indice != null ? valorEn(resultados, meta.test_id, meta.lado, meta.item_par_indice) : null)

  if (actual == null || referencia == null) {
    return vacio(meta.tipo === 'igualar_lados' ? 'Falta medir uno de los dos lados' : 'Falta medir el movimiento contrario')
  }

  const mayor = Math.max(actual, referencia)
  const dif = mayor === 0 ? 0 : Math.abs(actual - referencia) / mayor
  const pct = Math.round(dif * 100)
  return {
    actual, referencia, cumplida: dif <= UMBRAL_IGUALDAD,
    progreso: Math.max(0, Math.min(1, 1 - (dif - UMBRAL_IGUALDAD) / (1 - UMBRAL_IGUALDAD))),
    texto: dif <= UMBRAL_IGUALDAD
      ? `Igualados · ${pct}% de diferencia`
      : `${redondea(actual)}${u} contra ${redondea(referencia)}${u} · ${pct}% de diferencia`,
  }
}

const redondea = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1)

/** Las metas de un paciente, con el objetivo al que cuelgan. */
export async function metasDe(pacienteId: string): Promise<Meta[]> {
  const { data } = await supabase.from('objetivos_metas')
    .select('*').eq('paciente_id', pacienteId).order('created_at')
  return (data || []) as Meta[]
}

/**
 * Recalcula las metas de un paciente y cierra las que hayan llegado. Devuelve cuántas.
 *
 * Se llama después de registrar un test, que es el único momento en que un número puede
 * haber cambiado. No reabre las ya cumplidas: que hoy midas peor no borra que un día
 * llegaste, igual que un test negativo no borra el positivo de marzo del historial.
 */
export async function revisarMetas(pacienteId: string) {
  const [metas, { data: resultados }] = await Promise.all([
    metasDe(pacienteId),
    supabase.from('resultados_tests').select('test_id,lado,fecha,items_resultado').eq('paciente_id', pacienteId),
  ])

  const cerradas: Meta[] = []
  for (const m of metas) {
    if (m.cumplida) continue
    const e = estadoDeMeta(m, resultados || [])
    if (!e.cumplida) continue
    const { error } = await supabase.from('objetivos_metas')
      .update({ cumplida: true, fecha_cumplida: new Date().toISOString().split('T')[0] }).eq('id', m.id)
    if (!error) { m.cumplida = true; cerradas.push(m) }
  }

  const logrados = await revisarObjetivos(pacienteId, metas)
  return { ok: true as const, cerradas, logrados }
}

/**
 * Marca logrado el objetivo métrico al que no le queda ninguna meta abierta. Y lo reabre
 * si alguna vuelve a abrirse.
 *
 * Cerrar la meta y dejar el objetivo abierto era resolver el problema a medias: se
 * partía de que los objetivos no se podían cerrar, y sin esto seguían acumulándose en la
 * lista de activos con todas sus metas en verde.
 *
 * La regla es la misma que para los de vías —todas resueltas— y por eso también reabre:
 * `logrado` no es una decisión que se tome una vez, es el resultado de mirar sus partes.
 */
export async function revisarObjetivos(pacienteId: string, metas?: Meta[]) {
  const todas = metas || await metasDe(pacienteId)
  const porObjetivo: Record<string, Meta[]> = {}
  todas.forEach(m => { (porObjetivo[m.objetivo_id] ||= []).push(m) })

  const ids = Object.keys(porObjetivo)
  if (ids.length === 0) return []

  const { data: filas } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,logrado,objetivos(nombre)')
    .eq('paciente_id', pacienteId).in('objetivo_id', ids)

  const logrados: string[] = []
  for (const fila of (filas || []) as any[]) {
    const suyas = porObjetivo[fila.objetivo_id] || []
    const debe = suyas.length > 0 && suyas.every(m => m.cumplida)
    if (debe === !!fila.logrado) continue

    await supabase.from('pacientes_objetivos').update({
      logrado: debe,
      fecha_logrado: debe ? new Date().toISOString().split('T')[0] : null,
    }).eq('paciente_id', pacienteId).eq('objetivo_id', fila.objetivo_id)

    const obj: any = Array.isArray(fila.objetivos) ? fila.objetivos[0] : fila.objetivos
    const nombre = obj?.nombre || 'Objetivo'
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId, tipo: 'objetivo',
      titulo: debe ? `Objetivo logrado: ${nombre}` : `Objetivo reabierto: ${nombre}`,
      descripcion: debe
        ? `Sus ${suyas.length} meta${suyas.length > 1 ? 's están cumplidas' : ' está cumplida'}`
        : 'Una de sus metas ha vuelto a abrirse',
      fecha: new Date().toISOString().split('T')[0],
    })
    if (debe) logrados.push(nombre)
  }
  return logrados
}

export const FASE_MAX = 8

/**
 * Sube o baja de fase un objetivo de progresión.
 *
 * Al llegar a la última NO se da por logrado solo: la última fase de "suelo pélvico" es
 * "mantenimiento y prevención", que por definición no se acaba. Que el objetivo se cierre
 * lo decide el entrenador.
 */
export async function cambiarFase(pacienteId: string, objetivoId: string, fase: number, nombre?: string) {
  const n = Math.max(1, Math.min(FASE_MAX, Math.round(fase)))
  const { error } = await supabase.from('pacientes_objetivos')
    .update({ fase_actual: n }).eq('paciente_id', pacienteId).eq('objetivo_id', objetivoId)
  if (error) return { ok: false as const, error: error.message }
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'objetivo',
    titulo: `${nombre || 'Objetivo'}: pasa a la fase ${n}`,
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true as const }
}

/** Cierra o reabre una meta a mano. Queda marcado para poder distinguirlas después. */
export async function cerrarMetaAMano(metaId: string, cerrar: boolean, nota?: string) {
  const { error } = await supabase.from('objetivos_metas').update({
    cumplida: cerrar,
    cerrada_a_mano: cerrar,
    fecha_cumplida: cerrar ? new Date().toISOString().split('T')[0] : null,
    ...(nota !== undefined ? { nota } : {}),
  }).eq('id', metaId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Resumen de un objetivo métrico: cuántas metas van. El objetivo se da por logrado cuando
 * lo están todas, igual que un objetivo por vías.
 */
export function resumenObjetivo(metas: Meta[], resultados: any[]) {
  const estados = metas.map(m => estadoDeMeta(m, resultados))
  const cumplidas = estados.filter((e, i) => e.cumplida || metas[i].cumplida).length
  return { total: metas.length, cumplidas, logrado: metas.length > 0 && cumplidas === metas.length, estados }
}
