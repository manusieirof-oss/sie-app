'use client'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { CONFIG_DEFECTO, CLAVE_AJUSTE, leerConfigTrabajo, type ConfigTrabajo } from './trabajo'

/**
 * EJECUCIONES Y CAPACIDADES SALEN DE AJUSTES › ENTRENADOR, EN TODAS PARTES.
 *
 * El editor de sesiones y el taller tenian su propia lista fija (5 ejecuciones de fuerza
 * y 5 capacidades), y Ajustes y el mapa de calor otra mas larga (estiramientos,
 * movilidad, equilibrio...). Una sesion hecha con el mapa de calor con "Estatico" no se
 * podia volver a elegir en el editor. Ahora todos leen la misma, y lo que se anada en
 * Ajustes aparece en todas las pantallas.
 */
let pedido: Promise<ConfigTrabajo> | null = null
export function cargarConfigTrabajo(): Promise<ConfigTrabajo> {
  if (!pedido) pedido = Promise.resolve(supabase.from('ajustes').select('clave,valor').eq('clave', CLAVE_AJUSTE))
    .then(({ data }: any) => leerConfigTrabajo(Object.fromEntries((data || []).map((x: any) => [x.clave, x.valor]))))
    .catch(() => CONFIG_DEFECTO)
  return pedido
}

export function useConfigTrabajo(): ConfigTrabajo {
  const [cfg, setCfg] = useState<ConfigTrabajo>(CONFIG_DEFECTO)
  useEffect(() => { let vivo = true; cargarConfigTrabajo().then(c => { if (vivo) setCfg(c) }); return () => { vivo = false } }, [])
  return cfg
}

export const nombresEjecucion = (cfg: ConfigTrabajo) => cfg.ejecuciones.map(e => e.nombre)

/**
 * ¿EL EJERCICIO ES DE ESTIRAR O DE FUERZA? Por las capacidades de su «trabajo»: si todas
 * son de estiramiento o movilidad, es de estirar; si no hay ninguna de esas, de fuerza;
 * si mezcla, no se sabe (null) y se ofrecen todas las ejecuciones.
 */
export function grupoDeTrabajo(cfg: ConfigTrabajo, trabajo?: any): 'fuerza' | 'estiramiento' | null {
  const fams = ((trabajo?.int || []) as string[]).map(id => cfg.intensidades.find(i => i.id === id)?.familia).filter(Boolean)
  if (!fams.length) return null
  const estira = (f: any) => f === 'estiramiento' || f === 'movilidad'
  if (fams.every(estira)) return 'estiramiento'
  return fams.some(estira) ? null : 'fuerza'
}

/** LAS EJECUCIONES QUE TIENEN SENTIDO PARA ESTE EJERCICIO. A un estiramiento se le
 *  ofrecían concéntrico, excéntrico… (las de fuerza); ahora estático, FNP, dinámico… */
export function ejecucionesPara(cfg: ConfigTrabajo, trabajo?: any): string[] {
  const g = grupoDeTrabajo(cfg, trabajo)
  return (g ? cfg.ejecuciones.filter(e => e.grupo === g) : cfg.ejecuciones).map(e => e.nombre)
}

/** La que se enseña sin elegir: en un estiramiento la primera de estirar (estático), no «Concéntrico». */
export function ejecucionPorDefecto(cfg: ConfigTrabajo, trabajo?: any): string {
  return grupoDeTrabajo(cfg, trabajo) === 'estiramiento'
    ? (cfg.ejecuciones.find(e => e.grupo === 'estiramiento')?.nombre || 'Estático') : 'Concéntrico'
}
export const nombresCapacidad = (cfg: ConfigTrabajo) => cfg.intensidades.map(i => i.nombre)

/**
 * Lo que se sugiere al elegir una capacidad: repeticiones (o segundos si el ejercicio va
 * por tiempo, o la capacidad solo tiene tiempos) y descanso. Las cinco de fuerza dan lo
 * mismo que antes (3, 5, 10, 15, 25).
 */
const SUGERIDO_ANTES: Record<string, number> = { 'Fuerza máxima': 3, 'Fuerza': 5, 'Hipertrofia': 10, 'Fuerza-resistencia': 15, 'Resistencia': 25 }
export function sugerenciaCapacidad(cfg: ConfigTrabajo, nombre: string, porTiempo: boolean): { reps?: string, tiempo?: string, descanso?: string } {
  const i = cfg.intensidades.find(x => x.nombre === nombre)
  if (!i) return {}
  const out: { reps?: string, tiempo?: string, descanso?: string } = {}
  if (i.descanso != null) out.descanso = String(i.descanso)
  if ((porTiempo || i.repsMin == null) && i.segMin != null) out.tiempo = String(i.segMin)
  else if (i.repsMin != null) {
    const r = SUGERIDO_ANTES[i.nombre] ?? (i.repsMax != null ? Math.round((i.repsMin + i.repsMax) / 2) : i.repsMin + 4)
    out.reps = String(r)
  }
  return out
}
