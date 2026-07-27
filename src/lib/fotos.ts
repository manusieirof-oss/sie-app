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
