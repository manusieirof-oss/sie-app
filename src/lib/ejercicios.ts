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
 * Cómo se mide un ejercicio. Decide qué campos pide la sesión y qué pregunta el taller,
 * así que no se puede dejar en blanco ni adivinar: una plancha creada con el valor por
 * defecto pediría kilos y nadie sabría por qué.
 */
export const TIPOS_MEDIDA = [
  { id: 'peso_reps', nombre: 'Peso y reps', ayuda: 'Series de repeticiones, con carga.' },
  { id: 'tiempo', nombre: 'Tiempo', ayuda: 'Se aguanta o se sostiene. Segundos, sin carga.' },
  { id: 'peso_tiempo', nombre: 'Peso y tiempo', ayuda: 'Segundos con carga: isométricos cargados, paseos.' },
] as const

export const nombreMedida = (id?: string | null) =>
  TIPOS_MEDIDA.find(m => m.id === id)?.nombre || TIPOS_MEDIDA[0].nombre

// ---------------------------------------------------------------------------
// EJERCICIOS POR COMPLETAR
//
// Montando una sesión hace falta un ejercicio que no está en la biblioteca y no hay
// tiempo de rellenarlo entero. Se crea con lo mínimo y queda en una cola.
//
// SE CALCULA, NO SE GUARDA. No hay columna "pendiente" que alguien pueda dejar
// marcada en un ejercicio ya completo, ni al revés. La cola son los huecos que el
// ejercicio tiene AHORA MISMO, así que rellenar el último lo saca solo.
//
// Y no hay botón de "déjalo estar": completo significa completo. Si algún día un
// ejercicio no puede tener foto de verdad, se hablará entonces; hoy un silenciador
// solo serviría para que la cola no bajara nunca y acabara ignorándose.
// ---------------------------------------------------------------------------

export type ProblemaEjercicio = {
  campo: 'etiquetas' | 'imagen' | 'descripcion' | 'ejecucion'
  texto: string
  /** Rompe algo de verdad, no es solo un hueco. */
  grave?: boolean
}

/**
 * Qué le falta a un ejercicio para estar completo. Único sitio que lo decide.
 */
export function problemasDeEjercicio(ej: any): ProblemaEjercicio[] {
  const p: ProblemaEjercicio[] = []
  if (!ej) return p

  // El grave, y encima silencioso: sin etiquetas `motivoDe` no puede avisar de
  // contraindicaciones, `similaresA` no encuentra nada y no sale en ningún filtro. El
  // ejercicio funciona, pero la app deja de protegerte con él.
  if ((ej.etiquetas || []).length === 0)
    p.push({ campo: 'etiquetas', texto: 'Sin etiquetas: no avisa de contraindicaciones ni sale en los filtros', grave: true })

  if (!ej.imagen_url) p.push({ campo: 'imagen', texto: 'Sin imagen' })
  if (!(ej.descripcion || '').trim()) p.push({ campo: 'descripcion', texto: 'Sin descripción' })
  if ((ej.items_ejecucion || []).length === 0)
    p.push({ campo: 'ejecucion', texto: 'Sin ítems de ejecución correcta' })

  return p
}

export const estaCompleto = (ej: any) => problemasDeEjercicio(ej).length === 0

/** Los que tienen algún hueco. Es la cola de "por completar". */
export const ejerciciosPendientes = (lista: any[] = []) => lista.filter(e => !estaCompleto(e))

/**
 * Crea un ejercicio con lo mínimo: nombre y cómo se mide.
 *
 * ES UNA FILA DE VERDAD en `ejercicios`, no un nombre suelto dentro del JSON de la
 * sesión. El `ejercicio_id` es lo que engancha el histórico de ejecución, la progresión
 * de cargas, las contraindicaciones y los criterios de ejecución; un nombre tecleado
 * funcionaría hoy y rompería todo eso sin decir nada.
 *
 * Se comprueba el nombre repetido porque crear a las prisas es justo donde nacen los
 * duplicados, y dos ejercicios iguales parten en dos la progresión del paciente.
 */
export async function crearEjercicioRapido(nombre: string, tipoMedida: string) {
  const limpio = (nombre || '').trim()
  if (!limpio) return { ok: false as const, error: 'Hace falta el nombre' }
  if (!TIPOS_MEDIDA.some(m => m.id === tipoMedida))
    return { ok: false as const, error: 'Hay que decir cómo se mide' }

  const { data: ya } = await supabase.from('ejercicios')
    .select('id,nombre').ilike('nombre', limpio).limit(1)
  if (ya && ya[0]) return { ok: false as const, error: `Ya existe "${ya[0].nombre}" en la biblioteca` }

  const { data, error } = await supabase.from('ejercicios').insert({
    nombre: limpio, descripcion: '', video_url: '', imagen_url: '',
    etiquetas: [], tipo_medida: tipoMedida,
    variantes: [], items_ejecucion: [], feedbacks: [],
  }).select().single()

  if (error || !data) return { ok: false as const, error: error?.message || 'No se pudo crear el ejercicio' }
  return { ok: true as const, ejercicio: data }
}

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
