'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// LA IMAGEN DE UN EJERCICIO, LA DE AHORA.
//
// Cada sesión guarda una copia de sus ejercicios (nombre, imagen…) del día en que se
// montó. Si entonces el ejercicio no tenía imagen, o se le puso después, o es una
// variante que usa la de su familia, la sesión seguía enseñando el hueco vacío. Aquí
// se mira la biblioteca tal como está hoy: la imagen propia y, si no tiene, la de la
// portada de su familia. La copia guardada queda solo como último recurso.

const cache: Record<string, string> = {}

async function cargar(ids: string[]) {
  const faltan = Array.from(new Set(ids.filter(id => id && !(id in cache))))
  for (let i = 0; i < faltan.length; i += 200) {
    const trozo = faltan.slice(i, i + 200)
    const { data } = await supabase.from('ejercicios').select('id,imagen_url,portada_id').in('id', trozo)
    const filas = data || []
    // Las portadas de los que no tienen imagen propia, en una segunda vuelta.
    const portadas = Array.from(new Set(filas.filter((f: any) => !f.imagen_url && f.portada_id).map((f: any) => f.portada_id)))
    const imgPortada: Record<string, string> = {}
    if (portadas.length) {
      const { data: p } = await supabase.from('ejercicios').select('id,imagen_url').in('id', portadas)
      ;(p || []).forEach((x: any) => { imgPortada[x.id] = x.imagen_url || '' })
    }
    filas.forEach((f: any) => { cache[f.id] = f.imagen_url || imgPortada[f.portada_id] || '' })
    // Los que ya no existen en la biblioteca: vacío, para no volver a preguntar.
    trozo.forEach(id => { if (!(id in cache)) cache[id] = '' })
  }
}

/** Mapa ejercicio_id → imagen actual, para los ejercicios que se le pasen. */
export function useImagenes(ids: string[]): Record<string, string> {
  const clave = Array.from(new Set(ids.filter(Boolean))).sort().join(',')
  const [mapa, setMapa] = useState<Record<string, string>>(() => ({ ...cache }))
  useEffect(() => {
    if (!clave) return
    let vivo = true
    cargar(clave.split(',')).then(() => { if (vivo) setMapa({ ...cache }) })
    return () => { vivo = false }
  }, [clave])
  return mapa
}

/** La de la biblioteca hoy; si no hay, la que se copió en la sesión. */
export const imagenDe = (ej: any, mapa: Record<string, string>) =>
  (ej?.ejercicio_id && mapa[ej.ejercicio_id]) || ej?.imagen_url || ''

/** Todos los ejercicio_id de una o varias sesiones (sus partes). */
export const idsDeSesiones = (sesiones: any[]) =>
  sesiones.flatMap((s: any) => (s?.partes || []).flatMap((p: any) => (p.ejercicios || []).map((e: any) => e.ejercicio_id))).filter(Boolean)
