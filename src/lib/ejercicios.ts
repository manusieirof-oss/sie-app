import { supabase } from './supabase'
import { comprimirImagen, MAX_EJERCICIO } from './imagen'
import { categoriaDe } from './etiquetas'

// Ejercicios de la biblioteca: subida de imágenes y borrado.
//
// El bucket 'fotos' es PÚBLICO a propósito: aquí viven imágenes de ejercicios y de
// tests, que son catálogo y no datos personales. La cara de un paciente va al bucket
// privado, en `fotos.ts`.

const BUCKET = 'fotos'

/**
 * Lateralidades sugeridas al crear una variante. Estaban escritas a mano dentro de
 * BibliotecaTab; se sacan aquí porque el explorador y el taller acabarán mostrándolas.
 * No es una lista cerrada: el editor deja escribir cualquier otra.
 */
export const LATERALIDADES = ['Bilateral', 'Unilateral', 'Alterno', 'Unipodal', 'Bipodal', 'Contralateral']

/**
 * Categorías que dicen si dos ejercicios se parecen.
 *
 * El material NO cuenta: un press de banca y un remo con barra comparten "Barra" y con
 * eso salían como similares, que es absurdo. Lo que los hace parecidos es qué músculo
 * trabajan, qué articulación mueven y con qué patrón — no que se usen con el mismo
 * hierro. Lo mismo con el agarre, el apoyo o la posición.
 */
const CATEGORIAS_SIMILITUD = ['musculo', 'articulacion', 'movimiento', 'patologia']

/**
 * Ejercicios parecidos al dado, ordenados por cuántas etiquetas relevantes comparten.
 *
 * La misma consulta estaba escrita tres veces: en la ficha del ejercicio, en el panel
 * del editor de sesión y en el explorador. Y en las tres bastaba UNA etiqueta común de
 * cualquier tipo para considerarlos similares.
 */
export function similaresA(ejercicios: any[], ejercicio: any, max = 6, etiquetas: any[] = []) {
  // Sin el árbol de etiquetas no se puede saber la categoría de cada una. En ese caso
  // se cae al criterio antiguo: mejor algo aproximado que una lista vacía.
  const relevante = (id: string) => {
    if (etiquetas.length === 0) return true
    const et = etiquetas.find((e: any) => e.id === id)
    if (!et) return false
    return CATEGORIAS_SIMILITUD.includes(categoriaDe(etiquetas, et))
  }

  const propias = (ejercicio?.etiquetas || []).filter(relevante)
  if (propias.length === 0) return []

  return ejercicios
    .filter(e => e.id !== ejercicio.id)
    .map(e => ({
      ejercicio: e,
      comunes: (e.etiquetas || []).filter((id: string) => propias.includes(id) && relevante(id)).length,
    }))
    // Dos etiquetas en común es el mínimo para llamarlo parecido: con una sola,
    // "Cuádriceps" emparejaría la sentadilla con cualquier cosa que use pierna.
    .filter(x => x.comunes >= Math.min(2, propias.length))
    .sort((a, b) => b.comunes - a.comunes)
    .slice(0, max)
    .map(x => x.ejercicio)
}

/**
 * Convierte una variante en un ejercicio propio del catálogo.
 *
 * Una variante no se puede prescribir por su cuenta ni tiene criterios de ejecución
 * propios, y hasta ahora tampoco progresión separada. Cuando una variante ya es otro
 * ejercicio —tiene su técnica, sus fallos y sus objetivos— esto la saca del padre.
 *
 * Hereda del padre lo que define al movimiento (etiquetas, cómo se mide, criterios y
 * feedbacks) y se queda con lo suyo (nombre, descripción, foto y vídeo). La imagen se
 * REFERENCIA, no se copia: son el mismo fichero en el bucket y duplicarlo solo
 * ocuparía el doble.
 *
 * No borra la variante del padre: puede seguir teniendo sentido ahí, y borrarla
 * rompería el desplegable de las sesiones que ya la usan.
 */
export async function promoverVariante(padre: any, indice: number) {
  const v = (padre?.variantes || [])[indice]
  if (!v) return { ok: false as const, error: 'La variante ya no existe' }

  const nombre = (v.nombre || '').trim()
  if (!nombre) return { ok: false as const, error: 'La variante no tiene nombre' }

  const { data, error } = await supabase.from('ejercicios').insert({
    nombre: `${padre.nombre} · ${nombre}`,
    descripcion: v.descripcion || padre.descripcion || '',
    video_url: v.video_url || padre.video_url || '',
    imagen_url: v.imagen_url || padre.imagen_url || '',
    etiquetas: padre.etiquetas || [],
    tipo_medida: padre.tipo_medida || 'peso_reps',
    items_ejecucion: padre.items_ejecucion || [],
    feedbacks: padre.feedbacks || [],
    variantes: [],
  }).select().single()

  if (error || !data) return { ok: false as const, error: error?.message || 'No se pudo crear' }
  return { ok: true as const, ejercicio: data }
}

/**
 * Sube la imagen de un ejercicio, comprimida, y devuelve su URL pública.
 *
 * La ruta es fija por ejercicio (`ejercicios/{id}/foto.jpg`) para que al cambiarla se
 * sustituya en vez de acumular ficheros huérfanos, que es lo que pasaba antes con el
 * nombre basado en la extensión original: subir un PNG y luego un JPG dejaba los dos.
 */
export async function subirImagenEjercicio(ejercicioId: string, file: File) {
  let preparado: File
  try { preparado = await comprimirImagen(file, MAX_EJERCICIO) }
  catch { return { ok: false as const, error: 'No se pudo procesar la imagen. Prueba con un JPG.' } }

  const ruta = `ejercicios/${ejercicioId}/foto.jpg`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true })
  if (error) return { ok: false as const, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  // La URL pública se cachea: sin el sufijo, al cambiar la foto seguirías viendo la
  // anterior porque la ruta es la misma.
  return { ok: true as const, url: `${data.publicUrl}?v=${Date.now()}` }
}

/**
 * Imagen de un TEST. Misma mecánica que la del ejercicio.
 *
 * Vive aquí y no en un `lib/tests.ts` propio para no tener dos formas de subir la misma
 * clase de imagen: el bucket, la compresión y el truco del sufijo contra la caché son
 * exactamente los mismos, y separarlos garantizaría que un día divergieran.
 */
export async function subirImagenTest(testId: string, file: File) {
  let preparado: File
  try { preparado = await comprimirImagen(file, MAX_EJERCICIO) }
  catch { return { ok: false as const, error: 'No se pudo procesar la imagen. Prueba con un JPG.' } }

  const ruta = `tests/${testId}/foto.jpg`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true })
  if (error) return { ok: false as const, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  return { ok: true as const, url: `${data.publicUrl}?v=${Date.now()}` }
}

/** Imagen de un OBJETIVO. Misma mecánica que las anteriores. */
export async function subirImagenObjetivo(objetivoId: string, file: File) {
  let preparado: File
  try { preparado = await comprimirImagen(file, MAX_EJERCICIO) }
  catch { return { ok: false as const, error: 'No se pudo procesar la imagen. Prueba con un JPG.' } }

  const ruta = `objetivos/${objetivoId}/foto.jpg`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true })
  if (error) return { ok: false as const, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  return { ok: true as const, url: `${data.publicUrl}?v=${Date.now()}` }
}

/** Imagen de una variante. Ruta fija por índice, mismo motivo. */
export async function subirImagenVariante(ejercicioId: string, indice: number, file: File) {
  let preparado: File
  try { preparado = await comprimirImagen(file, MAX_EJERCICIO) }
  catch { return { ok: false as const, error: 'No se pudo procesar la imagen. Prueba con un JPG.' } }

  const ruta = `ejercicios/${ejercicioId}/variante-${indice}.jpg`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(ruta, preparado, { contentType: 'image/jpeg', upsert: true })
  if (error) return { ok: false as const, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta)
  return { ok: true as const, url: `${data.publicUrl}?v=${Date.now()}` }
}

/**
 * Cuántas veces se ha usado el ejercicio. Sirve para avisar antes de borrarlo.
 *
 * Se mira `registros_ejercicio` (lo ejecutado) y no las sesiones: las sesiones
 * congelan nombre e imagen dentro de su JSON, así que sobreviven al borrado y siguen
 * viéndose igual. Lo que no se puede reconstruir es el histórico de ejecución.
 */
export async function usosDeEjercicio(ejercicioId: string) {
  const { count } = await supabase.from('registros_ejercicio')
    .select('id', { count: 'exact', head: true })
    .eq('ejercicio_id', ejercicioId)
  return count || 0
}

/**
 * Borra el ejercicio y sus imágenes.
 *
 * El histórico de `registros_ejercicio` NO se toca: guarda `ejercicio_nombre`, así que
 * las sesiones pasadas siguen contando qué se hizo aunque el ejercicio ya no exista.
 * Borrar ese rastro sería reescribir la historia clínica para limpiar el catálogo.
 */
export async function eliminarEjercicio(ejercicioId: string) {
  // Primero la fila: si falla, no se ha borrado ninguna imagen y se puede reintentar.
  const { error } = await supabase.from('ejercicios').delete().eq('id', ejercicioId)
  if (error) return { ok: false as const, error: error.message }

  // Las imágenes después, y sin bloquear: un fichero suelto en el bucket no rompe
  // nada, y fallar aquí no debe dejar el ejercicio a medio borrar.
  try {
    const { data: ficheros } = await supabase.storage.from(BUCKET).list(`ejercicios/${ejercicioId}`)
    if (ficheros && ficheros.length > 0) {
      await supabase.storage.from(BUCKET)
        .remove(ficheros.map(f => `ejercicios/${ejercicioId}/${f.name}`))
    }
  } catch { /* el ejercicio ya no existe: las imágenes sobrantes son inocuas */ }

  return { ok: true as const }
}
