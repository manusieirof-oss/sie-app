import { supabase } from './supabase'
import { traerTodo } from './paginar'
import { comprimirImagen, MAX_EJERCICIO } from './imagen'
import { categoriaDe } from './etiquetas'
import { normalizar } from './texto'
import { TODAS_MEDIDAS, partesMedida, nombreMedida as nombreMedidaLib, CARGAS, VOLUMENES } from './medida'

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
// Todas las combinaciones de carga × volumen (ver lib/medida). Los tres primeros son
// los de siempre; el resto llegaron con peso corporal, bandas y distancia.
export const TIPOS_MEDIDA: { id: string, nombre: string, ayuda: string }[] = TODAS_MEDIDAS.map(id => {
  const { carga, volumen } = partesMedida(id)
  return { id, nombre: nombreMedidaLib(id),
    ayuda: `${CARGAS.find(c => c.id === carga)!.nombre} · ${VOLUMENES.find(v => v.id === volumen)!.nombre.toLowerCase()}` }
})

export const nombreMedida = (id?: string | null) => nombreMedidaLib(id)

// ---------------------------------------------------------------------------
// LO QUE LE FALTA PARA EL ROSCO DE AMASAR: los mismos quesitos que cuentan allí, para
// que "Por completar" del torno y el "x de 6" del rosco digan lo mismo. La foto no
// cuenta: sin ella sale la figura.
// ---------------------------------------------------------------------------
const conTexto = (l: any[] | null | undefined) => (l || []).some((i: any) => i?.texto?.trim())
export const FALTAS_AMASAR = [
  { k: 'etiquetas', t: 'Etiquetas', falta: (e: any) => !(e.etiquetas || []).length },
  { k: 'descripcion', t: 'Descripción', falta: (e: any) => !(e.descripcion || '').trim() },
  { k: 'medida', t: 'Cómo se mide', falta: (e: any) => !e.tipo_medida },
  { k: 'ejecucion', t: 'Ejecución', falta: (e: any) => !conTexto(e.items_ejecucion) },
  { k: 'feedbacks', t: 'Feedbacks', falta: (e: any) => !conTexto(e.feedbacks) },
  { k: 'revisar', t: 'Copiado sin revisar', falta: (e: any) => (e.por_revisar || []).length > 0 },
]
export const faltasAmasar = (e: any) => FALTAS_AMASAR.filter(f => f.falta(e)).map(f => f.k)

/* LA COLA DE AMASAR: los ejercicios que se van a ir completando uno detrás de otro.
   Va en sessionStorage (solo esta pestaña, solo esta tanda): no es un dato del centro. */
const CLAVE_COLA = 'amasar_cola'
export function guardarCola(ids: string[]) { try { sessionStorage.setItem(CLAVE_COLA, JSON.stringify(ids)) } catch {} }
export function leerCola(): string[] { try { return JSON.parse(sessionStorage.getItem(CLAVE_COLA) || '[]') } catch { return [] } }
// Los elegidos para "poner en común" (rosco de varios, /torno/amasar/varios).
const CLAVE_GRUPO = 'amasar_grupo'
export function guardarGrupo(ids: string[]) { try { sessionStorage.setItem(CLAVE_GRUPO, JSON.stringify(ids)) } catch {} }
export function leerGrupo(): string[] { try { return JSON.parse(sessionStorage.getItem(CLAVE_GRUPO) || '[]') } catch { return [] } }

/**
 * PONER EN COMÚN: lo mismo a varios ejercicios de una vez.
 *
 * SOLO AÑADE, NUNCA QUITA. Etiquetas y frases se suman a las que ya tenga cada uno
 * (sin repetir, sin mirar mayúsculas ni tildes); así aplicarlo a uno ya hecho no le
 * borra nada. Lo único que se sustituye es "cómo se mide", porque solo hay uno.
 * La familia va al final: si el principal es uno de ellos, los demás cuelgan de él.
 */
export async function ponerEnComun(elegidos: any[], todos: any[], c: {
  etiquetas: string[], tipo_medida: string, ejecucion: string[], feedbacks: string[], portada_id: string | null,
}) {
  const sumar = (lista: any[] | null, nuevas: string[]) => {
    const l = (lista || []).filter((i: any) => i?.texto?.trim())
    const tiene = new Set(l.map((i: any) => normalizar(i.texto).trim()))
    return [...l, ...nuevas.filter(t => !tiene.has(normalizar(t).trim())).map(texto => ({ texto }))]
  }
  for (const e of elegidos) {
    const cambio: any = {}
    if (c.etiquetas.length) cambio.etiquetas = Array.from(new Set([...(e.etiquetas || []), ...c.etiquetas]))
    if (c.tipo_medida) cambio.tipo_medida = c.tipo_medida
    if (c.ejecucion.length) cambio.items_ejecucion = sumar(e.items_ejecucion, c.ejecucion)
    if (c.feedbacks.length) cambio.feedbacks = sumar(e.feedbacks, c.feedbacks)
    if (!Object.keys(cambio).length) continue
    const { error } = await supabase.from('ejercicios').update(cambio).eq('id', e.id)
    if (error) return { ok: false as const, error: `${e.nombre}: ${error.message}` }
  }
  if (c.portada_id) {
    const destino = todos.find(x => x.id === c.portada_id) || { id: c.portada_id }
    const raiz = destino.portada_id || destino.id
    for (const e of elegidos) {
      if (e.id === raiz || e.portada_id === raiz) continue
      const r = await moverAFamilia(e.id, destino)
      if (r.ok === false) return { ok: false as const, error: `${e.nombre}: ${r.error}` }
    }
  }
  return { ok: true as const }
}

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
  // Variante recién sacada: su ejecución o feedbacks son los de otro hasta que se confirman.
  if ((ej.por_revisar || []).length)
    p.push({ campo: 'ejecucion', texto: 'Ejecución o feedbacks copiados sin revisar' })

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

  // `ilike` de Postgres distingue acentos: "flexion" no encontraba "Flexión" y se
  // colaba el duplicado. Se traen los nombres y se comparan normalizados, que es
  // como los compara quien los lee.
  // Todos: Supabase corta cada respuesta en 1000 y el duplicado podia estar detras.
  const { filas: ya } = await traerTodo((d, h) => supabase.from('ejercicios').select('id,nombre').order('id').range(d, h))
  const clon = (ya || []).find((e: any) => normalizar(e.nombre).trim() === normalizar(limpio).trim())
  if (clon) return { ok: false as const, error: `Ya existe "${clon.nombre}" en la biblioteca` }

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
const CATEGORIAS_SIMILITUD = ['musculo', 'articulacion', 'movimiento', 'patron', 'patologia']

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

  /* FAMILIAS: los de su propia familia ya se ven en "Familia", así que aquí no se
     repiten; y de cada familia parecida sale solo la portada, una vez. Si no, el curl
     con barra enseñaba sus propias dos variantes como "similares". */
  const raiz = (e: any) => e?.portada_id && ejercicios.some(x => x.id === e.portada_id) ? e.portada_id : e?.id
  const suya = raiz(ejercicio)
  return ejercicios
    .filter(e => e.id !== ejercicio.id && raiz(e) !== suya && raiz(e) === e.id)
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
  /* DIBUJO PLANO → SVG. Las ilustraciones hechas con IA (silueta, fondo blanco) se
     redibujan como vector: sin fondo y nítidas en el rosco. Una foto sigue su camino. */
  const svg = typeof window !== 'undefined' ? await (await import('./vectorizar')).vectorizarSiDibujo(file) : null
  if (svg) {
    const rutaSvg = `ejercicios/${ejercicioId}/figura.svg`
    const { error } = await supabase.storage.from(BUCKET).upload(rutaSvg, svg, { contentType: 'image/svg+xml', upsert: true })
    if (!error) {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(rutaSvg)
      return { ok: true as const, url: `${data.publicUrl}?v=${Date.now()}`, vector: true }
    }
    // Si el almacén no acepta SVG, se sube como imagen normal: mejor eso que nada.
  }
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

// ---------------------------------------------------------------------------
// FAMILIAS DE EJERCICIOS.
//
// Una variante es un ejercicio completo (sus criterios, feedbacks, objetivos y su
// propia progresión) con `portada_id` apuntando al ejercicio de portada. La familia
// tiene UN solo nivel: una variante no tiene variantes. En la biblioteca se ven las
// portadas con "N variantes" y se despliegan. Ver `entrenamiento/familias`.
// ---------------------------------------------------------------------------

const malE = (e: any) => ({ ok: false as const, error: e?.message || String(e) })

/** Nueva variante a partir de un ejercicio: copia lo que define el movimiento, con otro nombre. */
export async function crearVariante(base: any, nombre: string) {
  const portada = base.portada_id || base.id
  const { data, error } = await supabase.from('ejercicios').insert({
    nombre: nombre.trim(), portada_id: portada,
    descripcion: base.descripcion || '', video_url: '', imagen_url: base.imagen_url || '',
    etiquetas: base.etiquetas || [], tipo_medida: base.tipo_medida || 'peso_reps',
    items_ejecucion: base.items_ejecucion || [], feedbacks: base.feedbacks || [], variantes: [],
  }).select().single()
  if (error || !data) return malE(error || 'No se pudo crear')
  return { ok: true as const, ejercicio: data }
}

/**
 * Mete un ejercicio en la familia de otro. Si el que se mueve tenía su propia
 * familia, se va entera con él: no hay variantes de variantes.
 */
export async function moverAFamilia(ejId: string, destino: any) {
  const portada = destino.portada_id || destino.id
  if (portada === ejId) return { ok: false as const, error: 'No puede ser variante de sí mismo' }
  const { error: e1 } = await supabase.from('ejercicios').update({ portada_id: portada }).eq('portada_id', ejId)
  if (e1) return malE(e1)
  const { error } = await supabase.from('ejercicios').update({ portada_id: portada }).eq('id', ejId)
  return error ? malE(error) : { ok: true as const }
}

/** Esta variante pasa a ser la portada: la antigua y las demás cuelgan de ella. */
export async function hacerPortada(ej: any) {
  const antigua = ej.portada_id
  if (!antigua) return { ok: true as const }
  const { error: e1 } = await supabase.from('ejercicios').update({ portada_id: ej.id }).eq('portada_id', antigua).neq('id', ej.id)
  if (e1) return malE(e1)
  const { error: e2 } = await supabase.from('ejercicios').update({ portada_id: ej.id }).eq('id', antigua)
  if (e2) return malE(e2)
  const { error } = await supabase.from('ejercicios').update({ portada_id: null }).eq('id', ej.id)
  return error ? malE(error) : { ok: true as const }
}

/** Sale de su familia y queda suelto. */
export async function sacarDeFamilia(ejId: string) {
  const { error } = await supabase.from('ejercicios').update({ portada_id: null }).eq('id', ejId)
  return error ? malE(error) : { ok: true as const }
}
