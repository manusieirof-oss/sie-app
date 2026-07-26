import { supabase } from './supabase'

// Foto del paciente. Bucket PRIVADO 'pacientes-fotos' con URL firmada.
//
// Ojo con el bucket 'fotos': sigue siendo público a propósito, porque ahí viven
// las imágenes de ejercicios y de tests, que son biblioteca y no datos personales.
// La cara de un paciente sí lo es, y por eso va aparte.

const BUCKET = 'pacientes-fotos'

// La foto del banner se pinta a 84px. Una foto de móvil son 3-4 MB.
async function comprimir(file: File): Promise<File> {
  const esHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
  if (esHeic) {
    const heic2any = (await import('heic2any')).default
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
    file = new File([blob], 'foto.jpg', { type: 'image/jpeg' })
  }
  const bitmap = await createImageBitmap(file)
  const MAX = 600
  const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.85))
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

export async function subirFotoPaciente(pacienteId: string, file: File) {
  let preparado: File
  try { preparado = await comprimir(file) }
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
