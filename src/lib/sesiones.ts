import { supabase } from './supabase'

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
    ayuda: 'Los ejercicios del mismo grupo se hacen seguidos y se descansa al terminarlo.' },
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
export async function duplicarSesion(sesion: any, pacienteId: string, opciones?: { sufijo?: string, motivo?: string }) {
  const sufijo = opciones?.sufijo ?? ' (copia)'
  const { data: nueva, error } = await supabase.from('sesiones').insert({
    paciente_id: pacienteId,
    nombre: (sesion.nombre || 'Sesión') + sufijo,
    descripcion: sesion.descripcion,
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

  const motivo = opciones?.motivo ?? 'Duplicada'
  await registrarSesion(pacienteId, `Sesión creada: ${nueva.nombre}`,
    ids.length > 0 ? `${motivo} · ${ids.length} objetivo${ids.length>1?'s':''}` : motivo)

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
