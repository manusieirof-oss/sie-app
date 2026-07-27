// Compresión de imágenes antes de subirlas.
//
// Estaba escrita dos veces —en `fotos.ts` a 600px y en `documentos.ts` a 1600px— y
// no estaba en la biblioteca de ejercicios, que era justo donde más pesaba: la foto
// de un ejercicio se carga en el catálogo, en el editor de sesión, en el detalle y en
// la pantalla del taller. Subir el original del móvil son 3-4 MB cada vez.
//
// Los HEIC de iPhone se convierten a JPEG primero: si no, medio navegador no los pinta.

/** Lado mayor recomendado según dónde se vaya a ver la imagen. */
export const MAX_FOTO_PACIENTE = 600
export const MAX_EJERCICIO = 1000
export const MAX_DOCUMENTO = 1600

export async function comprimirImagen(file: File, maxLado: number, calidad = 0.85): Promise<File> {
  let origen = file

  const esHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif'
  if (esHeic) {
    const heic2any = (await import('heic2any')).default
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: calidad }) as Blob
    origen = new File([blob], 'imagen.jpg', { type: 'image/jpeg' })
  }

  const bitmap = await createImageBitmap(origen)
  // Nunca se agranda: una imagen ya pequeña se deja como está.
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', calidad))
  return new File([blob], 'imagen.jpg', { type: 'image/jpeg' })
}
