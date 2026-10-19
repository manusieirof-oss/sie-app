/**
 * VÍDEOS DE UN EJERCICIO.
 *
 * `ejercicios.videos` es una lista [{ titulo, url }]: puede haber varios (técnica,
 * errores comunes, progresiones…). Antes sólo había `video_url`; si la lista está
 * vacía se sigue usando ese enlace como único vídeo, así no se pierde nada.
 */

export interface VideoEj { titulo: string, url: string }

export function videosDe(ej: any): VideoEj[] {
  const lista = Array.isArray(ej?.videos) ? ej.videos.filter((v: any) => v && String(v.url || '').trim()) : []
  if (lista.length) return lista.map((v: any) => ({ titulo: String(v.titulo || '').trim() || 'Vídeo', url: String(v.url).trim() }))
  const viejo = String(ej?.video_url || '').trim()
  return viejo ? [{ titulo: 'Vídeo', url: viejo }] : []
}

/**
 * Cómo se reproduce un enlace: YouTube y Vimeo van incrustados; un archivo de vídeo
 * (mp4, mov, webm) con el reproductor del navegador; cualquier otra cosa, como enlace.
 */
export function comoReproducir(url: string): { tipo: 'iframe' | 'video' | 'enlace', src: string } {
  const u = String(url || '').trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` }
  const vi = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vi) return { tipo: 'iframe', src: `https://player.vimeo.com/video/${vi[1]}` }
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return { tipo: 'video', src: u }
  return { tipo: 'enlace', src: u }
}
