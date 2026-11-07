import { supabase } from './supabase'
import { hoyISO } from '@/lib/fechas'

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

const hoy = () => hoyISO()

// Abrir y cerrar alertas SIEMPRE por aquí. La agenda hacía el update a pelo y no
// dejaba traza en eventos_paciente, así que esas alertas no salían en el historial.
/** MARCARLO EN EL CUERPO: una alerta de dolor o lesión puede apuntarse a la vez en su
    salud, con zona y lado, para que salga en el muñeco de la ficha. Como MOLESTIA (se
    quita sola al cerrar la alerta) o como PATOLOGÍA a trabajar (se queda hasta que se
    resuelva en Salud). Lo que se hace para eso sale solo: el muñeco cruza esa zona con lo
    que trabajan sus sesiones. */
export type CuerpoAlerta = { zona: string, lado: 'izquierdo' | 'derecho' | 'bilateral' | null, como: 'molestia' | 'patologia' }

export async function abrirAlerta(pacienteId: string, tipo: string, afectaSesion: boolean, descripcion: string, cuerpo?: CuerpoAlerta | null) {
  const { data: al, error } = await supabase.from('alertas_paciente')
    .insert({ paciente_id: pacienteId, tipo, afecta_sesion: afectaSesion, descripcion, activa: true }).select('id').single()
  if (error) return { ok: false, error: error.message }

  if (cuerpo?.zona) {
    // Con alerta_id para poder quitarla al cerrar; si aún no existe la columna, sin él.
    const fila: { tabla: string, datos: Record<string, any> } = cuerpo.como === 'molestia'
      ? { tabla: 'molestias', datos: { paciente_id: pacienteId, zona: cuerpo.zona, lado: cuerpo.lado, observaciones: descripcion || null, activa: true } }
      : { tabla: 'patologias', datos: { paciente_id: pacienteId, nombre: descripcion || cuerpo.zona, zona: cuerpo.zona, lado: cuerpo.lado, estado: 'activa', descripcion: descripcion || '' } }
    let r = await supabase.from(fila.tabla).insert({ ...fila.datos, alerta_id: al?.id })
    if (r.error) r = await supabase.from(fila.tabla).insert(fila.datos)
    if (!r.error) await supabase.from('eventos_paciente').insert({ paciente_id: pacienteId, tipo: cuerpo.como === 'molestia' ? 'molestia' : 'patologia',
      titulo: `${cuerpo.como === 'molestia' ? 'Molestia' : 'Patología'}: ${cuerpo.zona}${cuerpo.lado && cuerpo.lado !== 'bilateral' ? ' ' + cuerpo.lado : ''} (desde una alerta)`, descripcion: descripcion || null, fecha: hoy() })
  }

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
  // La molestia que se apuntó con esta alerta se quita con ella (la patología no: se
  // resuelve en Salud cuando toque). Si no hay columna o no hay ninguna, no pasa nada.
  await supabase.from('molestias').update({ activa: false, resuelta_el: hoy() }).eq('alerta_id', alerta.id).eq('activa', true)

  await supabase.from('eventos_paciente').insert({
    paciente_id: alerta.paciente_id,
    tipo: 'alerta_cerrada',
    titulo: LBL_ALERTA[alerta.tipo] || alerta.tipo,
    descripcion: alerta.descripcion || null,
    fecha: hoy(),
  })
  return { ok: true }
}
