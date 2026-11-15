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
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true, cacheControl: '86400' })
  if (error) return { ok: false as const, error: error.message }

  // La foto es nueva con la misma ruta: fuera de la cache para que no salga la vieja.
  olvidarFoto(ruta)
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
  // El mismo enlace guardado que usan las listas: uno nuevo en cada visita a la ficha
  // obligaba al navegador a descargar la foto otra vez.
  return pedirFoto(valor)
}

// ---------------------------------------------------------------------------
// FOTOS EN LISTAS (agenda, pacientes, taller, movil).
//
// Pedir una URL firmada por cara hace una peticion por paciente: en una agenda con 40
// citas son 40 llamadas cada vez que se pinta. Aqui se juntan las que se piden en el
// mismo momento en UNA (createSignedUrls) y se guardan un rato, asi que volver a pintar
// no pide nada.
//
// EL ENLACE FIRMADO SE GUARDA EN EL EQUIPO, y dura un dia. Antes vivia solo en la
// memoria de la pagina: cada vez que se abria o se recargaba SIE se firmaban enlaces
// nuevos, y para el navegador un enlace nuevo es una foto nueva, asi que volvia a
// descargar TODAS las caras. Con las fotos a 4 MB eso eran decenas de megas por pantalla
// y casi 100 GB en dos semanas (el 98 % del trafico de Supabase). Con el mismo enlace
// durante el dia, el navegador tira de su copia. Firmadas 24 h y se renuevan a las 20.
// ---------------------------------------------------------------------------
const VIDA = 24 * 3600, RENOVAR = 20 * 3600 * 1000
const CLAVE_ENLACES = 'sie-fotos-enlaces'
const cache = new Map<string, { u: string | null, t: number }>()
// Lo guardado en este equipo, al arrancar (solo lo que sigue en plazo y tiene enlace).
if (typeof window !== 'undefined') {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE_ENLACES) || '{}')
    Object.entries(m || {}).forEach(([r, c]: [string, any]) => { if (c?.u && c?.t && Date.now() - c.t < RENOVAR) cache.set(r, { u: c.u, t: c.t }) })
  } catch {}
}
function guardarEnlaces() {
  try {
    const m: Record<string, { u: string, t: number }> = {}
    cache.forEach((c, r) => { if (c.u && Date.now() - c.t < RENOVAR) m[r] = { u: c.u, t: c.t } })
    localStorage.setItem(CLAVE_ENLACES, JSON.stringify(m))
  } catch {}
}
/** La foto de esa ruta ha cambiado: su enlace guardado ya no vale. */
export function olvidarFoto(ruta: string) { cache.delete(ruta); guardarEnlaces() }
/** Al cerrar sesion a mano: los enlaces a las caras no se quedan en el equipo. */
export function olvidarEnlacesFotos() { cache.clear(); try { localStorage.removeItem(CLAVE_ENLACES) } catch {} }
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
  guardarEnlaces()
}
