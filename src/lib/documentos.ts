import { supabase } from './supabase'

// Documentos clínicos del paciente. El bucket 'documentos' es PRIVADO:
// nunca se usa getPublicUrl, siempre createSignedUrl. Ver sql/documentos.sql.

const BUCKET = 'documentos'

export type DocumentoPaciente = {
  id: string
  paciente_id: string
  patologia_id: string | null
  nombre: string
  tipo: string
  ruta: string
  mime: string | null
  tamano_bytes: number | null
  fecha: string
  notas: string | null
}

export const TIPOS_DOCUMENTO = [
  { valor: 'informe',        nombre: 'Informe médico' },
  { valor: 'imagen',         nombre: 'Prueba de imagen' },
  { valor: 'consentimiento', nombre: 'Consentimiento' },
  { valor: 'otro',           nombre: 'Otro' },
]

export const esImagen = (mime?: string | null) => !!mime && mime.startsWith('image/')
export const esPdf = (mime?: string | null) => mime === 'application/pdf'

export function tamanoLegible(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

// La foto de un informe hecha con el móvil son 3-4 MB para leer un A4.
// Se reescala a 1600px de lado mayor, que sigue siendo legible, y baja a ~200 KB.
// Los PDF no se tocan: comprimirlos aquí estropearía el texto seleccionable.
async function prepararFichero(file: File): Promise<File> {
  const esHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
  if (esHeic) {
    try {
      const heic2any = (await import('heic2any')).default
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
      file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
    } catch {
      throw new Error('No se pudo convertir la imagen HEIC. Prueba con un JPG o un PDF.')
    }
  }
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const MAX = 1600
  const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  if (escala === 1 && file.size < 700 * 1024) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.82))
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
}

export async function listarDocumentos(pacienteId: string) {
  const { data, error } = await supabase.from('documentos_paciente')
    .select('*').eq('paciente_id', pacienteId).order('fecha', { ascending: false })
  if (error) return { ok: false as const, error: error.message, documentos: [] as DocumentoPaciente[] }
  return { ok: true as const, documentos: (data || []) as DocumentoPaciente[] }
}

export async function subirDocumento(pacienteId: string, file: File, datos: {
  nombre?: string, tipo?: string, patologiaId?: string | null, notas?: string | null,
}) {
  let preparado: File
  try { preparado = await prepararFichero(file) }
  catch (e: any) { return { ok: false as const, error: e.message } }

  const ext = (preparado.name.split('.').pop() || 'bin').toLowerCase()
  const ruta = `${pacienteId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`

  const { error: errSub } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: preparado.type, upsert: false })
  if (errSub) return { ok: false as const, error: errSub.message }

  const { error } = await supabase.from('documentos_paciente').insert({
    paciente_id: pacienteId,
    patologia_id: datos.patologiaId || null,
    nombre: (datos.nombre || file.name).slice(0, 160),
    tipo: datos.tipo || 'informe',
    ruta,
    mime: preparado.type,
    tamano_bytes: preparado.size,
    notas: datos.notas || null,
  })
  // Si falla la fila, se retira el fichero para no dejar huérfanos en el bucket.
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta])
    return { ok: false as const, error: error.message }
  }

  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'documento',
    titulo: `Documento: ${datos.nombre || file.name}`,
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true as const }
}

// Enlace temporal. Se pide en el momento de abrir, nunca se guarda en base:
// caduca, y un enlace caducado guardado es un enlace roto.
export async function urlFirmada(ruta: string, segundos = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, segundos)
  if (error || !data) return null
  return data.signedUrl
}

export async function borrarDocumento(doc: DocumentoPaciente) {
  const { error } = await supabase.from('documentos_paciente').delete().eq('id', doc.id)
  if (error) return { ok: false as const, error: error.message }
  await supabase.storage.from(BUCKET).remove([doc.ruta])
  await supabase.from('eventos_paciente').insert({
    paciente_id: doc.paciente_id, tipo: 'documento',
    titulo: `Documento eliminado: ${doc.nombre}`,
    fecha: new Date().toISOString().split('T')[0],
  })
  return { ok: true as const }
}
