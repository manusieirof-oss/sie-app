import { supabase } from './supabase'
import { textoDescanso } from './capacidades'

/**
 * Modos de ejecución. Van en la PARTE, no en la sesión.
 *
 * Un entrenamiento real es calentamiento suelto, bloque principal en circuito y
 * accesorios sueltos otra vez. Con el modo en la parte eso sale solo y no hace falta
 * inventar un modo "mixto", que además no le diría nada al taller: tendría que
 * preguntar "mixto de qué y qué parte es cuál". La sesión no guarda modo; su etiqueta
 * se calcula con `modoDeSesion()`.
 *
 * Van en código y no en Ajustes —al contrario que los tipos de clase— porque cada uno
 * necesita su propia pantalla: añadir uno no es añadir una fila, es escribir cómo se
 * recorre.
 *
 * Fuera quedan, a propósito:
 *  - Las FASES: son estado del paciente, sobreviven a la sesión y necesitan su tabla.
 *  - Pirámides y series descendentes: ahí no cambia el recorrido sino cada serie.
 *    Se resuelven al anotar repeticiones y pesos, no con un modo.
 */
export const MODOS_PARTE = [
  { id: 'ejercicio', nombre: 'Ejercicio a ejercicio', icono: 'lista',
    ayuda: 'Todas las series de un ejercicio antes de pasar al siguiente.' },
  { id: 'circuito', nombre: 'Circuito', icono: 'recuperar',
    ayuda: 'Los ejercicios se recorren en bucle, tantas vueltas como se indique.' },
  { id: 'superserie', nombre: 'Superseries', icono: 'altabaja',
    ayuda: 'Una serie de cada ejercicio del grupo, seguidas, y el descanso al acabarlas.' },
  { id: 'tiempo', nombre: 'Por tiempo', icono: 'reloj',
    ayuda: 'Manda el reloj: EMOM, AMRAP o intervalos fijos.' },
] as const

export type ModoParte = typeof MODOS_PARTE[number]['id']

export function modoParte(id?: string | null) {
  return MODOS_PARTE.find(m => m.id === id) || MODOS_PARTE[0]
}

/** Subtipos de "por tiempo". Cambian lo que hace el cronómetro, no el recorrido. */
export const TIPOS_TIEMPO = [
  { id: 'emom', nombre: 'EMOM', ayuda: 'Un bloque al arrancar cada minuto.' },
  { id: 'amrap', nombre: 'AMRAP', ayuda: 'Vueltas que dé en el tiempo total.' },
  { id: 'intervalos', nombre: 'Intervalos', ayuda: 'Trabajo y descanso fijos que se repiten.' },
] as const

/**
 * El modo de una parte con sus parámetros, en una línea: "Circuito · 4 vueltas",
 * "EMOM · 12 min", "Superseries".
 *
 * El descanso NO va aquí: lo devuelve `descansoDeParte`, para que la vista pueda
 * ponerle su icono delante y no quede un número de minutos suelto sin decir de qué es.
 */
export function textoModo(parte: any): string {
  const m = modoParte(parte?.modo)
  const trozos: string[] = []

  if (m.id === 'tiempo') {
    const t = TIPOS_TIEMPO.find(x => x.id === (parte?.tipo_tiempo || 'emom'))
    trozos.push(t?.nombre || m.nombre)
    if (parte?.minutos) trozos.push(`${parte.minutos} min`)
    if (parte?.intervalo) trozos.push(`${parte.intervalo}s`)
    return trozos.join(' · ')
  }

  trozos.push(m.nombre)
  if (m.id === 'circuito' && parte?.vueltas) trozos.push(`${parte.vueltas} vueltas`)
  return trozos.join(' · ')
}

/**
 * El descanso de una parte: cuánto y de qué. Devuelve null si no hay ninguno escrito,
 * y eso significa que NO HAY descanso —solo el tiempo de cambiar de ejercicio—, no que
 * esté sin rellenar.
 *
 * Va aparte de `textoModo` para que la vista pueda ponerle su icono delante: un número
 * suelto de minutos en medio de una línea no dice si es descanso, duración o qué.
 */
export function descansoDeParte(parte: any): { texto: string, cuando: string } | null {
  if (!parte?.descanso) return null
  const m = modoParte(parte?.modo)
  // De qué son esos minutos depende del modo, y el mismo número significa cosas
  // distintas en cada uno.
  const cuando = m.id === 'circuito' ? 'entre vueltas'
    : m.id === 'superserie' ? 'tras cada vuelta del grupo'
    : m.id === 'tiempo' ? 'entre bloques'
    : 'entre series'
  return { texto: textoDescanso(parte.descanso), cuando }
}

/**
 * El descanso que de verdad aplica a un ejercicio, y de dónde sale.
 *
 * En "ejercicio a ejercicio" el descanso de la parte es un GENERAL: vale para todos
 * salvo que el ejercicio traiga el suyo, y entonces manda el suyo. Es lo natural al
 * prescribir: pones minuto y medio para toda la parte y le subes a tres el peso muerto,
 * sin tener que rellenar los otros cinco.
 *
 * En circuito y superserie no hay herencia: ahí el descanso es del recorrido y el del
 * ejercicio no pinta nada.
 */
export function descansoEfectivo(parte: any, ej: any): { valor: string, heredado: boolean } {
  const modo = modoParte(parte?.modo).id
  if (modo === 'circuito' || modo === 'superserie') {
    return { valor: String(parte?.descanso || ''), heredado: true }
  }
  if (ej?.descanso) return { valor: String(ej.descanso), heredado: false }
  return { valor: String(parte?.descanso || ''), heredado: true }
}

/**
 * Etiqueta de la sesión a partir de sus partes: la que compartan todas, o "Mixta".
 * Derivada y no guardada, para que no pueda contradecir a las partes.
 */
export function modoDeSesion(partes: any[]): { id: string, nombre: string } {
  const modos = Array.from(new Set((partes||[])
    .filter((p:any)=>(p?.ejercicios||[]).length>0)
    .map((p:any)=>p?.modo || 'ejercicio')))
  if (modos.length === 0) return { id:'ejercicio', nombre: modoParte('ejercicio').nombre }
  if (modos.length === 1) { const m = modoParte(modos[0]); return { id:m.id, nombre:m.nombre } }
  return { id: 'mixta', nombre: 'Mixta' }
}

/**
 * Duplica una sesión con sus objetivos.
 *
 * Los objetivos no viven en la fila de `sesiones` sino en `sesiones_objetivos`.
 * Tanto EntrenoTab como el Pilar Taller duplicaban copiando solo la fila, así que
 * la copia salía sin ningún objetivo y sin avisar. Aquí se leen de la base en vez
 * de confiar en que la consulta de origen los haya traído.
 */
export async function duplicarSesion(sesion: any, pacienteId: string, opciones?: {
  sufijo?: string
  motivo?: string
  /**
   * Id de la sesión de la que esta es la SIGUIENTE VERSIÓN. Solo lo pone
   * `evolucionarPrograma`: una copia suelta no es una versión nueva, es otra sesión.
   * Ver src/lib/linaje.ts y sql/sesiones_linaje.sql.
   */
  evolucionDe?: string
  /** No registrar evento propio: quien llama va a poner uno con el total. */
  sinEvento?: boolean
}) {
  const sufijo = opciones?.sufijo ?? ' (copia)'
  const { data: nueva, error } = await supabase.from('sesiones').insert({
    paciente_id: pacienteId,
    nombre: (sesion.nombre || 'Sesión') + sufijo,
    descripcion: sesion.descripcion,
    evolucion_de: opciones?.evolucionDe || null,
    // COPIA, no referencia. `partes` es JSON y se guarda entero en la fila nueva, así
    // que a partir de aquí las dos sesiones son independientes: tocar la del paciente
    // no cambia la plantilla, y tocar la plantilla no cambia lo ya prescrito a nadie.
    partes: JSON.parse(JSON.stringify(sesion.partes || [])),
    estado: 'lista',
  }).select().single()
  if (error || !nueva) return { ok: false as const, error: error?.message || 'No se pudo crear la copia' }

  const { data: objs } = await supabase.from('sesiones_objetivos')
    .select('objetivo_id').eq('sesion_id', sesion.id)

  const ids = (objs || []).map((o: any) => o.objetivo_id).filter(Boolean)
  if (ids.length > 0) {
    const { error: errObj } = await supabase.from('sesiones_objetivos')
      .insert(ids.map((objetivo_id: string) => ({ sesion_id: nueva.id, objetivo_id })))
    // La copia ya existe: se avisa del fallo parcial en vez de fingir que fue bien.
    if (errObj) return { ok: false as const, error: 'La sesión se duplicó pero sus objetivos no: ' + errObj.message, sesion: nueva }
  }

  // Ocho copias seguidas son ocho eventos que tapan la cronología: cuando la copia es
  // parte de una operación mayor, el evento lo pone quien la dirige, con el total.
  if (!opciones?.sinEvento) {
    const motivo = opciones?.motivo ?? 'Duplicada'
    await registrarSesion(pacienteId, `Sesión creada: ${nueva.nombre}`,
      ids.length > 0 ? `${motivo} · ${ids.length} objetivo${ids.length>1?'s':''}` : motivo)
  }

  return { ok: true as const, sesion: nueva, nObjetivos: ids.length }
}

/** true si la sesión es una plantilla: existe sin dueño y sirve de molde. */
export const esPlantilla = (s: any) => !s?.paciente_id

/**
 * Asigna una plantilla a un paciente creando una COPIA suya.
 *
 * No se cambia el `paciente_id` de la plantilla ni se enlaza: se copia. A partir de
 * ahí la sesión es del paciente y lo que se toque en ella no afecta a nadie más,
 * que es justo lo que hace útil tener plantillas. Y sin sufijo en el nombre: en la
 * ficha del paciente "Core (copia)" no significa nada, ahí solo hay una.
 */
export async function asignarPlantilla(plantilla: any, pacienteId: string) {
  if (!pacienteId) return { ok: false as const, error: 'Falta el paciente' }
  return duplicarSesion(plantilla, pacienteId, { sufijo: '', motivo: `Desde la plantilla "${plantilla.nombre}"` })
}

/**
 * Qué hay colgando de una sesión, para avisar antes de borrarla.
 *
 * Las citas guardan `sesion_id`: si se borra, esas citas se quedan sin sesión y el
 * historial deja de contar qué se hizo ese día. Los registros de ejercicio no se
 * miran porque van por paciente y fecha, no por sesión: sobreviven igual.
 */
export async function usosDeSesion(sesionId: string) {
  const { count } = await supabase.from('citas')
    .select('id', { count: 'exact', head: true }).eq('sesion_id', sesionId)
  return count || 0
}

/**
 * Borra una sesión. Sus objetivos se van con ella por la clave foránea; las citas
 * que la usaran se quedan sin sesión, y por eso conviene avisar antes con
 * `usosDeSesion`.
 */
export async function eliminarSesion(sesionId: string) {
  const { error } = await supabase.from('sesiones').delete().eq('id', sesionId)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const }
}

/**
 * Eventos de sesión en el historial del paciente. Se registra el PLAN
 * —qué sesiones tiene y desde cuándo—, no la asistencia: engancharlo a las
 * citas realizadas metería dos o tres eventos por semana y ahogaría la cronología.
 */
export async function registrarSesion(pacienteId: string, titulo: string, descripcion?: string | null) {
  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId, tipo: 'sesion', titulo,
    descripcion: descripcion || null,
    fecha: new Date().toISOString().split('T')[0],
  })
}
