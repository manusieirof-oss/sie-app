import { supabase } from './supabase'
import { apuntarHistorial } from './sesionViva'
import { guardarFase, fijarSesionesDeFase, sembrarObjetivos } from './sistemas'
import { registrarSesion } from './sesiones'
import { hoyISO } from './fechas'

/**
 * GUARDAR LO TORNEADO COMO SUYO.
 *
 * Lo de la derecha del torno se convierte en sesiones y, si es un ciclo, en un ciclo
 * del paciente con sus fases. Todo nace SUYO (paciente_id puesto): la biblioteca de
 * la que salió no se toca, igual que al copiar una plantilla.
 *
 * Cada ejercicio se guarda con sus objetivos (`objetivos`), así el taller y la ficha
 * leen el vínculo tal cual. Los objetivos de la sesión son la suma de los de sus
 * ejercicios: es lo que de verdad trabaja.
 */

export type ParteT = { nombre: string, base?: any, ejercicios: any[] }
export type FaseT = { nombre: string, dias?: number | null, unidad?: string | null, sesiones: { nombre: string, partes: ParteT[] }[] }

export async function guardarSesionTorno(
  pid: string, nombre: string, partes: ParteT[], objsEj: (ej: any) => string[], conEvento = true,
): Promise<{ ok: true, id: string } | { ok: false, error: string }> {
  const partesF = partes.filter(p => p.ejercicios.length > 0).map(p => ({
    ...(p.base || {}), nombre: p.nombre,
    ejercicios: p.ejercicios.map(ej => ({ ...ej, objetivos: objsEj(ej) })),
  }))
  if (partesF.length === 0) return { ok: false, error: `«${nombre}» está vacía` }
  const { data, error } = await supabase.from('sesiones')
    .insert({ paciente_id: pid, nombre: nombre.trim() || 'Sesión', descripcion: '', partes: partesF, estado: 'lista' })
    .select('id').single()
  if (error || !data) return { ok: false, error: error?.message || 'No se pudo crear la sesión' }
  const objs = Array.from(new Set(partesF.flatMap(p => p.ejercicios.flatMap((e: any) => e.objetivos || []))))
  if (objs.length > 0) {
    const { error: e2 } = await supabase.from('sesiones_objetivos').insert(objs.map(objetivo_id => ({ sesion_id: data.id, objetivo_id })))
    if (e2) return { ok: false, error: 'La sesión se creó pero sus objetivos no: ' + e2.message }
  }
  if (conEvento) await registrarSesion(pid, `Sesión creada: ${nombre}`, 'Desde el torno')
  await apuntarHistorial(data.id, pid, 'inicio', 'Creada en el torno', 'Torno', partesF)
  return { ok: true, id: data.id }
}

export async function guardarCicloTorno(
  pid: string, c: { nombre: string, color?: string, progresion: string, fin?: string | null },
  fases: FaseT[], objsEj: (ej: any) => string[],
): Promise<{ ok: true, id: string } | { ok: false, error: string }> {
  if (!c.nombre.trim()) return { ok: false, error: 'Ponle un nombre al ciclo.' }
  if (fases.every(f => f.sesiones.length === 0)) return { ok: false, error: 'El ciclo no tiene ninguna sesión.' }
  const { data: sis, error } = await supabase.from('sistemas').insert({
    nombre: c.nombre.trim(), descripcion: null, color: c.color || '#5A969E', icono: null,
    progresion: c.progresion || 'objetivos', activo: true, paciente_id: pid,
  }).select('id').single()
  if (error || !sis) return { ok: false, error: error?.message || 'No se pudo crear el ciclo' }

  for (let i = 0; i < fases.length; i++) {
    const f = fases[i]
    const rf = await guardarFase({ sistema_id: sis.id, orden: i, nombre: f.nombre, dias: f.dias ?? null, unidad: f.unidad || 'dias' })
    if (!rf.ok || !rf.id) return { ok: false, error: rf.error || 'No se pudo crear una fase' }
    const ids: string[] = []
    for (const s of f.sesiones) {
      const r = await guardarSesionTorno(pid, s.nombre, s.partes, objsEj, false)
      if (r.ok === false) return { ok: false, error: r.error }
      ids.push(r.id)
    }
    const rs = await fijarSesionesDeFase(rf.id, ids)
    if (rs.ok === false) return { ok: false, error: rs.error }
  }

  // Se le pone como cualquier ciclo: el primero que lleva es el marco.
  const { data: ya } = await supabase.from('pacientes_sistemas').select('id').eq('paciente_id', pid).eq('activo', true)
  const principal = (ya || []).length === 0
  const { error: ea } = await supabase.from('pacientes_sistemas').insert({
    paciente_id: pid, sistema_id: sis.id, fecha_inicio: hoyISO(), fecha_fin: c.fin || null,
    fase_inicial: 0, nota: 'Desde el torno', principal,
  })
  if (ea) return { ok: false, error: 'El ciclo se creó pero no se le pudo poner: ' + ea.message }
  await sembrarObjetivos(pid, sis.id)
  await registrarSesion(pid, `Ciclo puesto: ${c.nombre}`, `Desde el torno · ${fases.length} fase${fases.length === 1 ? '' : 's'}`)
  return { ok: true, id: sis.id }
}
