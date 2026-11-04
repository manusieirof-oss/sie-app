import { supabase } from './supabase'
import { registrarCambio } from './cambioSesion'

// ---------------------------------------------------------------------------
// CAMBIAR LA SESIÓN DE UNA CITA YA PROGRAMADA (agenda y ficha → Programación).
//
// Dos gestos, los mismos en todos los sitios:
//   · PONER otra sesión en una cita (de las suyas).
//   · INTERCAMBIAR las sesiones de dos citas (arrastrar una encima de otra).
//
// Siempre con MOTIVO, igual que en el taller: cambiar lo programado es una
// decisión clínica y queda en el historial de cambios (cambios_sesion) con la
// fecha de la cita. Si la cita no se puede escribir, no se apunta nada; si se
// escribe pero falla el apunte, se avisa sin deshacer el cambio.
// ---------------------------------------------------------------------------

export type CitaProg = { id: string, fecha: string, sesion_id: string | null, sesNombre?: string | null }
type Motivo = { motivo: string, nota?: string }

async function escribir(citaId: string, sesionId: string | null) {
  const { data, error } = await supabase.from('citas').update({ sesion_id: sesionId }).eq('id', citaId).select('id')
  if (error) return error.message
  if (!data?.length) return 'la base de datos no ha guardado el cambio (permiso en la tabla de citas)'
  return null
}

export async function ponerEnCita(pacienteId: string, cita: CitaProg, nueva: { id: string, nombre: string }, m: Motivo) {
  if (nueva.id === cita.sesion_id) return { ok: true as const }
  const e = await escribir(cita.id, nueva.id)
  if (e) return { ok: false as const, error: e }
  const r = await registrarCambio({ citaId: cita.id, pacienteId, fecha: cita.fecha,
    antesId: cita.sesion_id, antesNombre: cita.sesNombre || null, despuesId: nueva.id, despuesNombre: nueva.nombre, motivo: m.motivo, nota: m.nota })
  return { ok: true as const, aviso: r.ok ? undefined : r.error }
}

export async function intercambiarCitas(pacienteId: string, a: CitaProg, b: CitaProg, m: Motivo) {
  if (a.sesion_id === b.sesion_id) return { ok: true as const }
  const e1 = await escribir(a.id, b.sesion_id)
  if (e1) return { ok: false as const, error: e1 }
  const e2 = await escribir(b.id, a.sesion_id)
  if (e2) {
    // La segunda no entró: se devuelve la primera a como estaba para no dejar media vuelta.
    await escribir(a.id, a.sesion_id)
    return { ok: false as const, error: e2 }
  }
  const avisos: string[] = []
  for (const [c, otra] of [[a, b], [b, a]] as const) {
    const r = await registrarCambio({ citaId: c.id, pacienteId, fecha: c.fecha,
      antesId: c.sesion_id, antesNombre: c.sesNombre || null, despuesId: otra.sesion_id, despuesNombre: otra.sesNombre || null,
      motivo: m.motivo, nota: m.nota })
    if (!r.ok) avisos.push(r.error)
  }
  return { ok: true as const, aviso: avisos[0] }
}
