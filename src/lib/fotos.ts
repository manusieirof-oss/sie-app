import { supabase } from './supabase'
import { comprimirImagen, MAX_FOTO_PACIENTE } from './imagen'

// Foto del paciente. Bucket PRIVADO 'pacientes-fotos' con URL firmada.
//
// Ojo con el bucket 'fotos': sigue siendo público a propósito, porque ahí viven
// las imágenes de ejercicios y de tests, que son biblioteca y no datos personales.
// La cara de un paciente sí lo es, y por eso va aparte.

const BUCKET = 'pacientes-fotos'

export async function subirFotoPaciente(pacienteId: string, file: File) {
  let preparado: File
  try { preparado = await comprimirImagen(file, MAX_FOTO_PACIENTE) }
  catch { return { ok: false as const, error: 'No se pudo procesar la imagen. Prueba con un JPG.' } }

  // Ruta fija por paciente: al cambiar la foto se sustituye y no se acumulan.
  const ruta = `${pacienteId}/foto.jpg`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true })
  if (error) return { ok: false as const, error: error.message }

  // La foto es nueva con la misma ruta: fuera de la cache para que no salga la vieja.
  cache.delete(ruta)
  // En foto_url se guarda la RUTA, no una URL: las firmadas caducan.
  const { error: errPac } = await supabase.from('pacientes').update({ foto_url: ruta }).eq('id', pacienteId)
  if (errPac) return { ok: false as const, error: errPac.message }
  return { ok: true as const, ruta }
}

/**
 * Devuelve una URL utilizable en un <img>.
 * Acepta tanto la ruta nueva como las URL públicas antiguas, para que las fotos
 * subidas antes del cambio no se queden en negro mientras no se resuban.
 */
export async function urlFotoPaciente(valor?: string | null, segundos = 3600) {
  if (!valor) return null
  if (valor.startsWith('http')) return valor
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(valor, segundos)
  if (error || !data) return null
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// FOTOS EN LISTAS (agenda, pacientes, taller, movil).
//
// Pedir una URL firmada por cara hace una peticion por paciente: en una agenda con 40
// citas son 40 llamadas cada vez que se pinta. Aqui se juntan las que se piden en el
// mismo momento en UNA (createSignedUrls) y se guardan un rato, asi que volver a pintar
// no pide nada. Firmadas 6 h y se renuevan a las 5.
// ---------------------------------------------------------------------------
const VIDA = 6 * 3600, RENOVAR = 5 * 3600 * 1000
const cache = new Map<string, { u: string | null, t: number }>()
const esperando = new Map<string, ((u: string | null) => void)[]>()
let cola: string[] = []
let reloj: any = null

/** Lo que ya se sabe, sin esperar (para pintar la foto a la primera). */
export function fotoEnCache(ruta?: string | null): string | null {
  if (!ruta) return null
  if (ruta.startsWith('http')) return ruta
  const c = cache.get(ruta)
  return c && Date.now() - c.t < RENOVAR ? c.u : null
}

export function pedirFoto(ruta?: string | null): Promise<string | null> {
  if (!ruta) return Promise.resolve(null)
  if (ruta.startsWith('http')) return Promise.resolve(ruta)
  const c = cache.get(ruta)
  if (c && Date.now() - c.t < RENOVAR) return Promise.resolve(c.u)
  return new Promise(res => {
    const l = esperando.get(ruta)
    if (l) { l.push(res); return }
    esperando.set(ruta, [res]); cola.push(ruta)
    if (!reloj) reloj = setTimeout(vaciarCola, 40)
  })
}

async function vaciarCola() {
  const lote = cola; cola = []; reloj = null
  for (let i = 0; i < lote.length; i += 100) {
    const trozo = lote.slice(i, i + 100)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(trozo, VIDA)
    if (error) console.warn('fotos de pacientes:', error.message)
    const m = new Map<string, string | null>((data || []).map((d: any) => [d.path, d.error ? null : d.signedUrl]))
    trozo.forEach(r => {
      const u = m.get(r) ?? null
      cache.set(r, { u, t: Date.now() })
      ;(esperando.get(r) || []).forEach(f => f(u))
      esperando.delete(r)
    })
  }
}
