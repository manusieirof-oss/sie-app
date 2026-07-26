import { supabase } from './supabase'

/**
 * Duplica una sesión con sus objetivos.
 *
 * Los objetivos no viven en la fila de `sesiones` sino en `sesiones_objetivos`.
 * Tanto EntrenoTab como el Pilar Taller duplicaban copiando solo la fila, así que
 * la copia salía sin ningún objetivo y sin avisar. Aquí se leen de la base en vez
 * de confiar en que la consulta de origen los haya traído.
 */
export async function duplicarSesion(sesion: any, pacienteId: string) {
  const { data: nueva, error } = await supabase.from('sesiones').insert({
    paciente_id: pacienteId,
    nombre: (sesion.nombre || 'Sesión') + ' (copia)',
    descripcion: sesion.descripcion,
    partes: sesion.partes || [],
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

  await registrarSesion(pacienteId, `Sesión creada: ${nueva.nombre}`,
    ids.length > 0 ? `Duplicada · ${ids.length} objetivo${ids.length>1?'s':''}` : 'Duplicada')

  return { ok: true as const, sesion: nueva, nObjetivos: ids.length }
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
