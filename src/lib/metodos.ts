import { supabase } from './supabase'

// LOS MÉTODOS DE TRABAJO DE UNA PARTE Y SUS VALORES DE PARTIDA.
//
// Cada parte de una sesión se trabaja de un modo (ejercicio a ejercicio, circuito,
// superseries, por tiempo) y cada modo tiene SUS números: en un circuito importan las
// vueltas, la pausa entre estaciones y el descanso entre vueltas; ejercicio a ejercicio,
// las series y el descanso entre ellas. Al cambiar el modo en el taller, lo que no se
// sabe se rellena con los valores de partida de Ajustes → Entrenador.
//
// Los descansos van en SEGUNDOS, como en el editor de sesiones (textoDescanso los pinta).

export const CLAVE_METODOS = 'metodos_defecto'

export type ValoresMetodo = { series?: string, vueltas?: string, transicion?: string, descanso?: string, minutos?: string, tipo_tiempo?: string }

export const METODOS_DEFECTO: Record<string, ValoresMetodo> = {
  ejercicio: { series: '3', descanso: '90' },
  circuito: { vueltas: '3', transicion: '15', descanso: '120' },
  superserie: { series: '3', transicion: '0', descanso: '90' },
  tiempo: { tipo_tiempo: 'emom', minutos: '12' },
}

/** Los campos que tiene cada modo, con lo que significan en ESE modo. */
export const CAMPOS_METODO: Record<string, { k: keyof ValoresMetodo, nombre: string, seg?: boolean, paso: number }[]> = {
  ejercicio: [
    { k: 'series', nombre: 'Series', paso: 1 },
    { k: 'descanso', nombre: 'Descanso entre series', seg: true, paso: 15 },
  ],
  circuito: [
    { k: 'vueltas', nombre: 'Vueltas', paso: 1 },
    { k: 'transicion', nombre: 'Entre ejercicios', seg: true, paso: 5 },
    { k: 'descanso', nombre: 'Entre vueltas', seg: true, paso: 15 },
  ],
  superserie: [
    { k: 'series', nombre: 'Series', paso: 1 },
    { k: 'transicion', nombre: 'Entre ejercicios', seg: true, paso: 5 },
    { k: 'descanso', nombre: 'Tras cada vuelta del grupo', seg: true, paso: 15 },
  ],
  tiempo: [
    { k: 'minutos', nombre: 'Minutos', paso: 1 },
  ],
}

/** Los de Ajustes, con los de serie debajo para lo que no esté puesto. */
export function leerMetodos(ajustes: Record<string, string>): Record<string, ValoresMetodo> {
  let guardado: any = {}
  try { guardado = JSON.parse(ajustes[CLAVE_METODOS] || '{}') } catch {}
  const out: Record<string, ValoresMetodo> = {}
  Object.keys(METODOS_DEFECTO).forEach(m => { out[m] = { ...METODOS_DEFECTO[m], ...(guardado?.[m] || {}) } })
  return out
}

export async function cargarMetodos(): Promise<Record<string, ValoresMetodo>> {
  const { data } = await supabase.from('ajustes').select('clave,valor').eq('clave', CLAVE_METODOS).maybeSingle()
  return leerMetodos(data ? { [CLAVE_METODOS]: (data as any).valor || '' } : {})
}

/** Lo que tiene ahora una parte, para enseñarlo y editarlo. Las series, de su primer ejercicio. */
export function valoresDeParte(parte: any): ValoresMetodo {
  const ej0 = (parte?.ejercicios || [])[0] || {}
  return {
    series: String(ej0.series ?? ''), vueltas: String(parte?.vueltas ?? ''),
    transicion: String(parte?.transicion ?? ''), descanso: String(parte?.descanso ?? ''),
    minutos: String(parte?.minutos ?? ''), tipo_tiempo: String(parte?.tipo_tiempo ?? ''),
  }
}

/**
 * Lo que queda de una parte al aplicarle un modo y unos valores. Devuelve una copia.
 * Las series se ponen a TODOS los ejercicios de la parte: es lo que se cambia aquí.
 */
export function aplicarMetodo(parte: any, modo: string, v: ValoresMetodo): any {
  const p = { ...parte, modo }
  ;(['vueltas', 'transicion', 'descanso', 'minutos', 'tipo_tiempo'] as const).forEach(k => { if (v[k] !== undefined) p[k] = v[k] })
  if (v.series !== undefined && v.series !== '' && modo !== 'circuito') {
    p.ejercicios = (parte.ejercicios || []).map((e: any) => ({ ...e, series: v.series }))
  }
  return p
}
