import { supabase } from './supabase'
import { sumarDias, hoyISO } from './fechas'

/**
 * SISTEMAS Y MÉTODOS. El nivel de arriba: ejercicios → sesiones → sistemas.
 *
 * Un sistema es un cúmulo de sesiones con fases para lograr algo. La regla que
 * manda aquí es que LA FASE NO SE GUARDA EN NINGÚN SITIO: se calcula de la fecha
 * (o de qué objetivos estaban logrados ese día). Por eso una cita pasada sigue
 * diciendo bien en qué fase cayó aunque después muevas las fechas del sistema, y
 * por eso dos sistemas pueden correr a la vez sin saber nada el uno del otro.
 */

export type Progresion = 'tiempo' | 'fecha_fin' | 'objetivos'

export const PROGRESIONES: { valor: Progresion, nombre: string, ayuda: string }[] = [
  { valor:'tiempo',    nombre:'Por tiempo',    ayuda:'Cada fase dura sus días. Avanza con el calendario, se venga o no.' },
  { valor:'fecha_fin', nombre:'Por fecha fin', ayuda:'Las fases se reparten hacia atrás desde el día señalado.' },
  { valor:'objetivos', nombre:'Por objetivos', ayuda:'Se sale de una fase cuando TODOS sus objetivos están logrados.' },
]

export type Fase = {
  id: string
  sistema_id: string
  orden: number
  nombre: string
  descripcion?: string | null
  dias?: number | null
  objetivos?: string[]
  sesiones?: string[]
}

export type Sistema = {
  id: string
  nombre: string
  descripcion?: string | null
  color: string
  icono?: string | null
  progresion: Progresion
  activo: boolean
  fases: Fase[]
}

export type Asignacion = {
  id: string
  paciente_id: string
  sistema_id: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
  principal: boolean
  activo: boolean
  nota?: string | null
  sistema?: Sistema | null
}

/** Un tramo es una fase con sus fechas ya resueltas. `null` = abierto por ese lado. */
export type Tramo = { fase: Fase, desde: string | null, hasta: string | null }

const orden = (f: Fase[]) => [...(f||[])].sort((a,b)=>(a.orden||0)-(b.orden||0))

/**
 * Las fases con fecha, para las progresiones que van por calendario.
 *
 * Por tiempo: se encadenan desde el inicio y la última queda abierta —un embarazo
 * no se acaba porque se cumplan los días previstos.
 * Por fecha fin: se encadenan hacia atrás desde el día señalado, que es justo lo
 * que hace falta cuando lo inamovible es el final y no el principio.
 */
export function tramos(sistema: Sistema, a: Asignacion): Tramo[] {
  const fases = orden(sistema.fases)
  if (fases.length === 0) return []

  if (sistema.progresion === 'fecha_fin') {
    if (!a.fecha_fin) return []
    const out: Tramo[] = []
    let hasta = a.fecha_fin
    for (let i = fases.length - 1; i >= 0; i--) {
      const d = Number(fases[i].dias) || 0
      const desde = i === 0 ? (a.fecha_inicio || null) : sumarDias(hasta, -(d - 1))
      out.unshift({ fase: fases[i], desde, hasta })
      hasta = sumarDias(desde || hasta, -1)
    }
    return out
  }

  if (!a.fecha_inicio) return []
  const out: Tramo[] = []
  let desde = a.fecha_inicio
  fases.forEach((f, i) => {
    const d = Number(f.dias) || 0
    const ultima = i === fases.length - 1
    const hasta = (ultima || d <= 0) ? null : sumarDias(desde, d - 1)
    out.push({ fase: f, desde, hasta })
    if (hasta) desde = sumarDias(hasta, 1)
  })
  return out
}

/**
 * En qué fase estaba este sistema el día `fecha`.
 *
 * Con progresión por objetivos no hay fechas que mirar: se avanza cuando los
 * objetivos de la fase están logrados, y para saber la fase de un día pasado se
 * mira qué había logrado ESE día, no hoy. De ahí `logrados`, que es un mapa
 * objetivo_id → fecha en que se logró.
 */
export function faseEn(
  sistema: Sistema,
  a: Asignacion,
  fecha: string,
  logrados?: Record<string, string | null>,
): Tramo | null {
  if (!sistema || !a) return null
  const fases = orden(sistema.fases)
  if (fases.length === 0) return null

  if (sistema.progresion === 'objetivos') {
    const cerrada = (f: Fase) => {
      const ids = f.objetivos || []
      if (ids.length === 0) return false          // sin condición no se sale sola
      return ids.every(id => {
        const d = logrados?.[id]
        return !!d && d <= fecha
      })
    }
    const i = fases.findIndex(f => !cerrada(f))
    const fase = i === -1 ? fases[fases.length - 1] : fases[i]
    return { fase, desde: a.fecha_inicio || null, hasta: null }
  }

  const t = tramos(sistema, a)
  if (a.fecha_inicio && fecha < a.fecha_inicio) return null
  return t.find(x => (!x.desde || fecha >= x.desde) && (!x.hasta || fecha <= x.hasta)) || null
}

/** El que manda: marca el color de las citas y gana cuando dos sistemas chocan. */
export function principalDe(as: Asignacion[]): Asignacion | null {
  const vivos = (as || []).filter(a => a.activo)
  return vivos.find(a => a.principal) || vivos[0] || null
}

// ---- Carga -----------------------------------------------------------------

/** Los sistemas de la biblioteca, con sus fases, objetivos y sesiones. */
export async function cargarSistemas(soloActivos = true): Promise<Sistema[]> {
  let q = supabase.from('sistemas')
    .select('*, sistema_fases(*, sistema_fase_objetivos(objetivo_id), sistema_fase_sesiones(sesion_id,orden))')
    .order('nombre')
  if (soloActivos) q = q.eq('activo', true)
  const { data } = await q
  return (data || []).map((s: any) => ({
    ...s,
    fases: orden((s.sistema_fases || []).map((f: any) => ({
      ...f,
      objetivos: (f.sistema_fase_objetivos || []).map((o: any) => o.objetivo_id),
      sesiones: [...(f.sistema_fase_sesiones || [])]
        .sort((a: any, b: any) => (a.orden||0)-(b.orden||0)).map((x: any) => x.sesion_id),
    }))),
  }))
}

/** Lo que lleva un paciente ahora, con el sistema entero dentro. */
export async function sistemasDePaciente(pacienteId: string): Promise<Asignacion[]> {
  const { data } = await supabase.from('pacientes_sistemas')
    .select('*, sistemas(*, sistema_fases(*, sistema_fase_objetivos(objetivo_id), sistema_fase_sesiones(sesion_id,orden)))')
    .eq('paciente_id', pacienteId).eq('activo', true)
    .order('principal', { ascending: false }).order('created_at')
  return (data || []).map((a: any) => {
    const s = a.sistemas
    return {
      ...a,
      sistema: s ? {
        ...s,
        fases: orden((s.sistema_fases || []).map((f: any) => ({
          ...f,
          objetivos: (f.sistema_fase_objetivos || []).map((o: any) => o.objetivo_id),
          sesiones: [...(f.sistema_fase_sesiones || [])]
            .sort((x: any, y: any) => (x.orden||0)-(y.orden||0)).map((x: any) => x.sesion_id),
        }))),
      } : null,
    }
  })
}

/** objetivo_id → fecha en que se logró. Lo que necesita `faseEn` por objetivos. */
export async function logradosDe(pacienteId: string): Promise<Record<string, string | null>> {
  const { data } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id,logrado,fecha_logrado').eq('paciente_id', pacienteId).eq('logrado', true)
  const map: Record<string, string | null> = {}
  ;(data || []).forEach((o: any) => { map[o.objetivo_id] = o.fecha_logrado || hoyISO() })
  return map
}

// ---- Guardar ---------------------------------------------------------------

/** Crea o actualiza el sistema. Devuelve su id para poder seguir con las fases. */
export async function guardarSistema(s: any): Promise<{ ok: boolean, id?: string, error?: string }> {
  const fila = {
    nombre: (s.nombre || '').trim(),
    descripcion: (s.descripcion || '').trim() || null,
    color: s.color || '#5A969E',
    icono: s.icono || null,
    progresion: s.progresion || 'tiempo',
    activo: s.activo !== false,
  }
  if (!fila.nombre) return { ok: false, error: 'Ponle un nombre.' }
  if (s.id) {
    const { error } = await supabase.from('sistemas').update(fila).eq('id', s.id)
    return error ? { ok: false, error: error.message } : { ok: true, id: s.id }
  }
  const { data, error } = await supabase.from('sistemas').insert(fila).select('id').single()
  return error ? { ok: false, error: error.message } : { ok: true, id: data!.id }
}

/**
 * Borrar el sistema NO borra las sesiones ni toca a quien lo esté siguiendo: lo que
 * ya se copió a un paciente es suyo. Solo desaparece de la biblioteca.
 */
export async function borrarSistema(id: string) {
  const { error } = await supabase.from('sistemas').delete().eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export async function guardarFase(f: any): Promise<{ ok: boolean, id?: string, error?: string }> {
  const fila = {
    sistema_id: f.sistema_id,
    orden: Number(f.orden) || 0,
    nombre: (f.nombre || '').trim() || 'Fase',
    descripcion: (f.descripcion || '').trim() || null,
    dias: f.dias === '' || f.dias == null ? null : Number(f.dias),
  }
  if (f.id) {
    const { error } = await supabase.from('sistema_fases').update(fila).eq('id', f.id)
    return error ? { ok: false, error: error.message } : { ok: true, id: f.id }
  }
  const { data, error } = await supabase.from('sistema_fases').insert(fila).select('id').single()
  return error ? { ok: false, error: error.message } : { ok: true, id: data!.id }
}

export async function borrarFase(id: string) {
  const { error } = await supabase.from('sistema_fases').delete().eq('id', id)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/** Se reescribe entero: son listas cortas y así no hay que diffear nada. */
export async function fijarObjetivosDeFase(faseId: string, ids: string[]) {
  await supabase.from('sistema_fase_objetivos').delete().eq('fase_id', faseId)
  if (ids.length === 0) return { ok: true as const }
  const { error } = await supabase.from('sistema_fase_objetivos')
    .insert(ids.map(objetivo_id => ({ fase_id: faseId, objetivo_id })))
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

export async function fijarSesionesDeFase(faseId: string, ids: string[]) {
  await supabase.from('sistema_fase_sesiones').delete().eq('fase_id', faseId)
  if (ids.length === 0) return { ok: true as const }
  const { error } = await supabase.from('sistema_fase_sesiones')
    .insert(ids.map((sesion_id, orden) => ({ fase_id: faseId, sesion_id, orden })))
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

// ---- Asignar a un paciente -------------------------------------------------

/** El primero que se le pone es el marco; los siguientes entran por debajo. */
export async function asignarSistema(pacienteId: string, sistemaId: string, d: {
  fecha_inicio?: string | null, fecha_fin?: string | null, principal?: boolean, nota?: string | null,
}) {
  const { data: ya } = await supabase.from('pacientes_sistemas')
    .select('id').eq('paciente_id', pacienteId).eq('activo', true)
  const principal = d.principal ?? (ya || []).length === 0
  if (principal) {
    await supabase.from('pacientes_sistemas').update({ principal: false })
      .eq('paciente_id', pacienteId).eq('activo', true)
  }
  const { error } = await supabase.from('pacientes_sistemas').insert({
    paciente_id: pacienteId, sistema_id: sistemaId,
    fecha_inicio: d.fecha_inicio || null, fecha_fin: d.fecha_fin || null,
    nota: d.nota || null, principal,
  })
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/** Solo uno manda: marcar uno desmarca al resto. */
export async function marcarPrincipal(pacienteId: string, asignacionId: string) {
  await supabase.from('pacientes_sistemas').update({ principal: false })
    .eq('paciente_id', pacienteId).eq('activo', true)
  const { error } = await supabase.from('pacientes_sistemas')
    .update({ principal: true }).eq('id', asignacionId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

/**
 * Se marca inactivo, no se borra. Un sistema terminado es historia del paciente:
 * las citas de aquel tramo tienen que poder seguir diciendo en qué fase cayeron.
 */
export async function quitarSistema(asignacionId: string) {
  const { error } = await supabase.from('pacientes_sistemas')
    .update({ activo: false }).eq('id', asignacionId)
  return error ? { ok: false as const, error: error.message } : { ok: true as const }
}

// ---- Color -----------------------------------------------------------------

/** El color del sistema con transparencia, para fondos. */
export function tinte(hex: string, alfa: number): string {
  const h = (hex || '#5A969E').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`
}

/**
 * El tono sube con la fase: así el corte entre tramos se ve sin leer nada.
 * Entre .07 y .22, que es donde el fondo se distingue sin comerse el texto.
 */
export function alfaDeFase(indice: number, total: number): number {
  if (total <= 1) return 0.10
  return 0.07 + (0.15 * (indice / (total - 1)))
}
