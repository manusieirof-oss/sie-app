import { supabase } from './supabase'

// Etiquetas de tipo de alerta. Fuente única: antes estaban duplicadas en la ficha
// (LBL_ALERTA) y en el modal, y podían desincronizarse.
export const LBL_ALERTA: Record<string, string> = {
  dolor: 'Dolor / molestia',
  lesion: 'Lesión',
  cita_medica: 'Cita médica',
  personal: 'Situación personal',
  duda: 'Duda / consulta',
  otro: 'Otro',
}

const hoy = () => new Date().toISOString().split('T')[0]

// Abrir y cerrar alertas SIEMPRE por aquí. La agenda hacía el update a pelo y no
// dejaba traza en eventos_paciente, así que esas alertas no salían en el historial.
export async function abrirAlerta(pacienteId: string, tipo: string, afectaSesion: boolean, descripcion: string) {
  const { error } = await supabase.from('alertas_paciente')
    .insert({ paciente_id: pacienteId, tipo, afecta_sesion: afectaSesion, descripcion, activa: true })
  if (error) return { ok: false, error: error.message }

  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId,
    tipo: 'alerta_abierta',
    titulo: `${LBL_ALERTA[tipo] || tipo}${afectaSesion ? ' · afecta sesión' : ''}`,
    descripcion: descripcion || null,
    fecha: hoy(),
  })
  return { ok: true }
}

// Recibe la alerta entera (no solo el id) porque el evento necesita paciente_id,
// tipo y descripción, y después del update ya no se pueden leer del estado.
export async function cerrarAlerta(alerta: { id: string, paciente_id: string, tipo: string, descripcion?: string | null }) {
  const { error } = await supabase.from('alertas_paciente')
    .update({ activa: false, fecha_cierre: new Date().toISOString() })
    .eq('id', alerta.id)
  if (error) return { ok: false, error: error.message }

  await supabase.from('eventos_paciente').insert({
    paciente_id: alerta.paciente_id,
    tipo: 'alerta_cerrada',
    titulo: LBL_ALERTA[alerta.tipo] || alerta.tipo,
    descripcion: alerta.descripcion || null,
    fecha: hoy(),
  })
  return { ok: true }
}
