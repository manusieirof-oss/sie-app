'use client'
import { supabase } from '@/lib/supabase'
import { horasDeAgenda } from '@/lib/generarHoras'
import { parseTiposClase, TIPOS_CLASE_FALLBACK } from '@/lib/tipos'
import { hoyISO } from '@/lib/fechas'

/**
 * Lo que la versión móvil necesita de Ajustes: horas, salas, aforo y tipos de clase.
 *
 * Es lo mismo que lee la agenda de escritorio, pero en un solo sitio y de una vez:
 * en el móvil cada consulta se nota, y estas cuatro cosas no cambian en el día.
 */
export type ConfigMovil = { horas: string[], salas: string[], max: number, tiposClase: any[] }

let cache: ConfigMovil | null = null

export async function configMovil(): Promise<ConfigMovil> {
  if (cache) return cache
  const { data } = await supabase.from('ajustes').select('clave,valor')
  const map: Record<string, string> = {}
  ;(data || []).forEach((a: any) => { map[a.clave] = a.valor || '' })
  let salas = ['A', 'B']
  try { const s = JSON.parse(map.clinica_salas || ''); if (Array.isArray(s) && s.length) salas = s } catch {}
  cache = {
    horas: horasDeAgenda(map),
    salas,
    max: parseInt(map.clinica_max_personas_sala || '6') || 6,
    tiposClase: map.tipos_clase ? parseTiposClase(map.tipos_clase) : TIPOS_CLASE_FALLBACK,
  }
  return cache
}

/** 'HH:MM' de una hora de la base ('10:30:00'). */
export const hhmm = (h?: string | null) => (h || '').slice(0, 5)

export const iniciales = (p: any) =>
  (((p?.nombre || '').trim()[0] || '') + ((p?.apellidos || '').trim()[0] || '')).toUpperCase() || '·'

export const nombreDe = (p: any) => `${p?.nombre || ''} ${p?.apellidos || ''}`.trim()

/** Sumar días a una fecha ISO sin líos de zona horaria. */
export function masDias(fecha: string, n: number) {
  const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lunes a sábado de la semana de esa fecha. */
export function semanaDe(fecha: string) {
  const d = new Date(fecha + 'T12:00:00'), dia = d.getDay()
  const lunes = masDias(fecha, dia === 0 ? -6 : 1 - dia)
  return Array.from({ length: 6 }, (_, i) => masDias(lunes, i))
}

export const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export function textoFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Minutos desde medianoche de una hora 'HH:MM'. */
export const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return (a || 0) * 60 + (b || 0) }

/** La franja que está en marcha ahora (la última que ya empezó), solo si la fecha es hoy. */
export function franjaActual(horas: string[], fecha: string): string | null {
  if (fecha !== hoyISO()) return null
  const ahora = new Date(); const m = ahora.getHours() * 60 + ahora.getMinutes()
  let actual: string | null = null
  for (const h of horas) if (aMin(h) <= m) actual = h
  // Más de una hora después de su comienzo ya no está "en marcha".
  if (actual && m - aMin(actual) > 70) return null
  return actual
}
