import { supabase } from './supabase'
import { sumarDias, hoyISO } from './fechas'
import { retratoDe } from './objetivos'

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
  unidad?: 'dias' | 'semanas' | 'meses' | null
  objetivos?: string[]
  /** Que especificos de cada objetivo pide la fase. Vacio = el objetivo entero. */
  movimientos?: Record<string, string[]>
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
  /**
   * Desde que fase arranca EN ESTE PACIENTE, cuando entra a mitad.
   *
   * En los sistemas por calendario esto se resuelve con la fecha de inicio: se
   * calcula hacia atras y ya cae donde toca. Pero por objetivos no hay fechas
   * que mover —se avanza logrando cosas—, asi que la fase de entrada no tenia
   * donde guardarse y siempre se empezaba por la primera.
   */
  fase_inicial?: number | null
  nota?: string | null
  sistema?: Sistema | null
}

/** Un tramo es una fase con sus fechas ya resueltas. `null` = abierto por ese lado. */
export type Tramo = { fase: Fase, desde: string | null, hasta: string | null }

const orden = (f: Fase[]) => [...(f||[])].sort((a,b)=>(a.orden||0)-(b.orden||0))

/**
 * LOS OBJETIVOS DE UNA FASE SON LOS DE SUS SESIONES.
 *
 * Antes se le asignaban aparte, y eso permitia que la fase pidiera el objetivo A
 * mientras sus sesiones trabajaban el B: una fase que no se cierra nunca y nadie
 * avisando. Un objetivo que no se entrena en ninguna sesion de la fase no es un
 * objetivo de esa fase, es una intencion. Si hay que exigirlo, se pone una sesion
 * que lo trabaje.
 */
function objetivosDeLaFase(f: any): { objetivos: string[], movimientos: Record<string, string[]> } {
  const objetivos: string[] = []
  const movimientos: Record<string, string[]> = {}
  ;(f?.sistema_fase_sesiones || []).forEach((x: any) => {
    const ses = Array.isArray(x.sesiones) ? x.sesiones[0] : x.sesiones
    ;(ses?.sesiones_objetivos || []).forEach((o: any) => {
      if (objetivos.includes(o.objetivo_id) === false) objetivos.push(o.objetivo_id)
      // Los especificos se suman: dos sesiones pueden trabajar partes distintas
      // del mismo objetivo, y la fase las pide todas.
      const ya = movimientos[o.objetivo_id] || []
      movimientos[o.objetivo_id] = Array.from(new Set([...ya, ...(o.movimientos || [])]))
    })
  })
  return { objetivos, movimientos }
}

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
    if (a.fecha_fin == null) return []
    const out: Tramo[] = []
    let hasta = a.fecha_fin
    for (let i = fases.length - 1; i >= 0; i--) {
      const desde = i === 0 ? (a.fecha_inicio || null) : arranque(hasta, fases[i])
      out.unshift({ fase: fases[i], desde, hasta })
      hasta = sumarDias(desde || hasta, -1)
    }
    return out
  }

  if (a.fecha_inicio == null) return []
  const out: Tramo[] = []
  let desde = a.fecha_inicio
  fases.forEach((f, i) => {
    const ultima = i === fases.length - 1
    const hasta = (ultima || duracion(f) <= 0) ? null : remate(desde, f)
    out.push({ fase: f, desde, hasta })
    if (hasta) desde = sumarDias(hasta, 1)
  })
  return out
}

const duracion = (f: Fase) => Number(f.dias) || 0

/** Meses de verdad: tres meses desde el 31 de enero acaban en abril, no a los 90 días. */
function sumarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const base = new Date(y, m - 1 + n, 1)
  const ultimo = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  base.setDate(Math.min(d, ultimo))
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  const dd = String(base.getDate()).padStart(2, '0')
  return `${base.getFullYear()}-${mm}-${dd}`
}

/** Ultimo dia de la fase que arranca en `desde`. */
function remate(desde: string, f: Fase): string {
  const n = duracion(f)
  if (f.unidad === 'meses') return sumarDias(sumarMeses(desde, n), -1)
  if (f.unidad === 'semanas') return sumarDias(desde, n * 7 - 1)
  return sumarDias(desde, n - 1)
}

/** Primer dia de la fase que termina en `hasta`. Lo que hace falta al ir hacia atras. */
function arranque(hasta: string, f: Fase): string {
  const n = duracion(f)
  if (f.unidad === 'meses') return sumarMeses(sumarDias(hasta, 1), -n)
  if (f.unidad === 'semanas') return sumarDias(hasta, -(n * 7 - 1))
  return sumarDias(hasta, -(n - 1))
}

/**
 * Que fecha de inicio hay que poner para que HOY caiga en la fase `indice`.
 *
 * Una embarazada no empieza con nosotros en la semana 1. Sin esto habria que
 * restar a mano lo que duran las fases anteriores y poner esa fecha, que es
 * justo la clase de cuenta que se hace mal un martes por la tarde.
 */
export function inicioParaEmpezarEn(sistema: Sistema, indice: number, hoy: string): string {
  const fases = orden(sistema.fases)
  let desde = hoy
  for (let i = indice - 1; i >= 0; i--) desde = arranque(sumarDias(desde, -1), fases[i])
  return desde
}

/**
 * Cuando acabaria, si todo va como esta previsto. NO SE GUARDA: se calcula del
 * inicio y de lo que duran las fases. Guardarla seria una segunda verdad que
 * empieza a mentir en cuanto tocas una fase.
 *
 * En los sistemas por fecha fin no hay nada que calcular: la fecha ES el dato.
 */
export function finPrevisto(sistema: Sistema, a: Asignacion): string | null {
  if (sistema.progresion === 'fecha_fin') return a.fecha_fin || null
  if (sistema.progresion === 'objetivos') return null
  const t = tramos(sistema, a)
  if (t.length === 0) return null
  const ultimo = t[t.length - 1]
  if (ultimo.desde == null || duracion(ultimo.fase) <= 0) return null
  return remate(ultimo.desde, ultimo.fase)
}

/** "13 semanas", "3 meses". Para decir la duracion sin traducirla a dias. */
export function textoDuracion(f: Fase): string {
  const n = duracion(f)
  if (n <= 0) return 'sin duración'
  if (f.unidad === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`
  if (f.unidad === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  return `${n} ${n === 1 ? 'día' : 'días'}`
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

  // Antes de empezar no hay fase, tambien por objetivos. Sin esto el sistema
  // etiquetaba y pintaba las citas anteriores a su fecha de inicio, que es justo
  // lo que hace que la lista no cuadre con lo que pusiste.
  if (a.fecha_inicio && fecha < a.fecha_inicio) return null

  if (sistema.progresion === 'objetivos') {
    const cerrada = (f: Fase) => {
      const ids = f.objetivos || []
      if (ids.length === 0) return false          // sin condición no se sale sola
      return ids.every(id => {
        const d = logrados?.[id]
        return !!d && d <= fecha
      })
    }
    // Se busca desde la fase en la que entro, no desde la primera: lo anterior
    // no lo hizo con nosotros y no hay objetivos suyos que puedan estar logrados.
    const desdeI = Math.max(0, Math.min(Number(a.fase_inicial) || 0, fases.length - 1))
    const resto = fases.slice(desdeI)
    const i = resto.findIndex(f => cerrada(f) === false)
    const fase = i === -1 ? resto[resto.length - 1] : resto[i]
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

/** true si el sistema es un molde: existe sin dueno y sirve de plantilla. */
export const esMolde = (s: any) => !s?.paciente_id

/** Los MOLDES de la biblioteca. Las copias de cada paciente no salen aqui. */
export async function cargarSistemas(soloActivos = true): Promise<Sistema[]> {
  let q = supabase.from('sistemas')
    .select('*, sistema_fases(*, sistema_fase_objetivos(objetivo_id,movimientos), sistema_fase_sesiones(sesion_id,orden, sesiones(id, sesiones_objetivos(objetivo_id,movimientos))))')
    .is('paciente_id', null)
    .order('nombre')
  if (soloActivos) q = q.eq('activo', true)
  const { data } = await q
  return (data || []).map((s: any) => ({
    ...s,
    fases: orden((s.sistema_fases || []).map((f: any) => ({
      ...f,
      ...objetivosDeLaFase(f),
      sesiones: [...(f.sistema_fase_sesiones || [])]
        .sort((a: any, b: any) => (a.orden||0)-(b.orden||0)).map((x: any) => x.sesion_id),
    }))),
  }))
}

/** Lo que lleva un paciente ahora, con el sistema entero dentro. */
/**
 * TODO lo que ha llevado, tambien lo terminado.
 *
 * Un sistema que se quita no se borra: se marca inactivo. Las citas de aquel
 * tramo tienen que poder seguir diciendo en que fase cayeron, y por donde ha
 * pasado alguien es justo lo que hay que mirar antes de ponerle lo siguiente.
 */
export async function historialSistemas(pacienteId: string): Promise<Asignacion[]> {
  const { data } = await supabase.from('pacientes_sistemas')
    .select('*, sistemas(*, sistema_fases(*, sistema_fase_objetivos(objetivo_id,movimientos), sistema_fase_sesiones(sesion_id,orden, sesiones(id, sesiones_objetivos(objetivo_id,movimientos)))))')
    .eq('paciente_id', pacienteId)
    .order('activo', { ascending: false }).order('created_at', { ascending: false })
  return (data || []).map(conFases)
}

/** El sistema con sus fases ya ordenadas y resueltas. */
function conFases(a: any): Asignacion {
  const s = a.sistemas
  return {
    ...a,
    sistema: s ? {
      ...s,
      fases: orden((s.sistema_fases || []).map((f: any) => ({
        ...f,
        ...objetivosDeLaFase(f),
        sesiones: [...(f.sistema_fase_sesiones || [])]
          .sort((x: any, y: any) => (x.orden||0)-(y.orden||0)).map((x: any) => x.sesion_id),
      }))),
    } : null,
  }
}

export async function sistemasDePaciente(pacienteId: string): Promise<Asignacion[]> {
  const { data } = await supabase.from('pacientes_sistemas')
    .select('*, sistemas(*, sistema_fases(*, sistema_fase_objetivos(objetivo_id,movimientos), sistema_fase_sesiones(sesion_id,orden, sesiones(id, sesiones_objetivos(objetivo_id,movimientos)))))')
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
          ...objetivosDeLaFase(f),
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
    unidad: f.unidad || 'dias',
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
export async function fijarObjetivosDeFase(faseId: string, ids: string[],
  movs: Record<string, string[]> = {}) {
  await supabase.from('sistema_fase_objetivos').delete().eq('fase_id', faseId)
  if (ids.length === 0) return { ok: true as const }
  const { error } = await supabase.from('sistema_fase_objetivos')
    .insert(ids.map(objetivo_id => ({ fase_id: faseId, objetivo_id, movimientos: movs[objetivo_id] || [] })))
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
/**
 * COPIA el sistema para un paciente. Igual que una plantilla de sesion.
 *
 * Referenciar el molde hacia que tocarle las fases en la biblioteca cambiara la
 * programacion de todos los que lo llevan, tambien hacia atras: una cita de hace
 * un mes podia pasar a caer en otra fase. Copiandolo, lo prescrito es suyo y la
 * biblioteca se puede corregir sin miedo —y de paso se le pueden hacer cambios
 * solo a el, que es lo que hace falta a mitad de una recuperacion.
 */
export async function duplicarSistema(plantillaId: string, pacienteId: string) {
  const { data: pl } = await supabase.from('sistemas')
    .select('*, sistema_fases(*, sistema_fase_objetivos(objetivo_id,movimientos), sistema_fase_sesiones(sesion_id,orden, sesiones(id, sesiones_objetivos(objetivo_id,movimientos))))')
    .eq('id', plantillaId).single()
  if (pl == null) return { ok: false as const, error: 'No se encuentra el sistema' }

  const { data: copia, error } = await supabase.from('sistemas').insert({
    nombre: pl.nombre, descripcion: pl.descripcion, color: pl.color, icono: pl.icono,
    progresion: pl.progresion, activo: true,
    paciente_id: pacienteId, plantilla_id: pl.id,
  }).select('id').single()
  if (error || copia == null) return { ok: false as const, error: error?.message || 'No se pudo copiar' }

  for (const f of orden(pl.sistema_fases || [])) {
    const { data: nf } = await supabase.from('sistema_fases').insert({
      sistema_id: copia.id, orden: f.orden, nombre: f.nombre,
      descripcion: f.descripcion, dias: f.dias, unidad: (f as any).unidad || 'dias',
    }).select('id').single()
    if (nf == null) continue
    const objs = (f as any).sistema_fase_objetivos || []
    if (objs.length > 0) {
      await supabase.from('sistema_fase_objetivos').insert(objs.map((o: any) => ({
        fase_id: nf.id, objetivo_id: o.objetivo_id, movimientos: o.movimientos || [],
      })))
    }
    const ses = (f as any).sistema_fase_sesiones || []
    if (ses.length > 0) {
      await supabase.from('sistema_fase_sesiones').insert(ses.map((x: any) => ({
        fase_id: nf.id, sesion_id: x.sesion_id, orden: x.orden || 0,
      })))
    }
  }
  return { ok: true as const, id: copia.id }
}

export async function asignarSistema(pacienteId: string, sistemaId: string, d: {
  fecha_inicio?: string | null, fecha_fin?: string | null, principal?: boolean,
  nota?: string | null, faseInicial?: number,
}) {
  const { data: ya } = await supabase.from('pacientes_sistemas')
    .select('id').eq('paciente_id', pacienteId).eq('activo', true)
  const principal = d.principal ?? (ya || []).length === 0
  if (principal) {
    await supabase.from('pacientes_sistemas').update({ principal: false })
      .eq('paciente_id', pacienteId).eq('activo', true)
  }
  // Se le pone SU copia, no el molde.
  const cp = await duplicarSistema(sistemaId, pacienteId)
  if (cp.ok === false) return cp

  const { error } = await supabase.from('pacientes_sistemas').insert({
    paciente_id: pacienteId, sistema_id: cp.id,
    fecha_inicio: d.fecha_inicio || null, fecha_fin: d.fecha_fin || null,
    fase_inicial: d.faseInicial || 0,
    nota: d.nota || null, principal,
  })
  if (error) return { ok: false as const, error: error.message }
  await sembrarObjetivos(pacienteId, cp.id)
  return { ok: true as const }
}

/**
 * LOS OBJETIVOS DEL CICLO, EN LA FICHA DEL PACIENTE.
 *
 * Un ciclo persigue unos objetivos —los de las sesiones de sus fases— y hasta
 * ahora asignarlo no se los daba a nadie: llegaban solo si un test los abria o
 * si te acordabas de ponerlos a mano. Sin ellos en la ficha una fase por
 * objetivos no puede cerrarse nunca y la evaluacion se queda sin nada que pedir.
 *
 * Nacen SIN vias, que es como nace uno puesto a mano: se cierran al pasar su
 * test o a mano con "Dar por logrado". Al que ya lleva el objetivo no se le
 * toca nada —ni el retrato ni las vias—: ya es suyo.
 */
export async function sembrarObjetivos(pacienteId: string, sistemaId: string) {
  const { data: fases } = await supabase.from('sistema_fases')
    .select('id, sistema_fase_sesiones(sesiones(sesiones_objetivos(objetivo_id)))')
    .eq('sistema_id', sistemaId)

  const quiere: string[] = []
  ;(fases || []).forEach((f: any) => {
    ;(f.sistema_fase_sesiones || []).forEach((x: any) => {
      const ses = Array.isArray(x.sesiones) ? x.sesiones[0] : x.sesiones
      ;(ses?.sesiones_objetivos || []).forEach((o: any) => {
        if (quiere.includes(o.objetivo_id) === false) quiere.push(o.objetivo_id)
      })
    })
  })
  if (quiere.length === 0) return { ok: true as const, puestos: 0 }

  const { data: ya } = await supabase.from('pacientes_objetivos')
    .select('objetivo_id').eq('paciente_id', pacienteId).in('objetivo_id', quiere)
  const tiene = new Set((ya || []).map((r: any) => r.objetivo_id))
  const faltan = quiere.filter(id => tiene.has(id) === false)
  if (faltan.length === 0) return { ok: true as const, puestos: 0 }

  // El retrato se congela al asignarlo, igual que desde la ficha.
  const { data: objs } = await supabase.from('objetivos')
    .select('id,nombre,descripcion,movimientos').in('id', faltan)

  const { error } = await supabase.from('pacientes_objetivos').insert(
    faltan.map(id => ({
      // Lo ponemos nosotros: viene de la programacion. Ver `viasObjetivo`.
      paciente_id: pacienteId, objetivo_id: id, origen: 'sistema', vias: [], vias_origen: ['plan'],
      ...retratoDe((objs || []).find((o: any) => o.id === id)),
    })))
  return error ? { ok: false as const, error: error.message } : { ok: true as const, puestos: faltan.length }
}

/** Cambiar las fechas de un sistema ya puesto, sin tener que quitarlo. */
export async function actualizarAsignacion(id: string, d: {
  fecha_inicio?: string | null, fecha_fin?: string | null, nota?: string | null,
  faseInicial?: number,
}) {
  const { error } = await supabase.from('pacientes_sistemas').update({
    fecha_inicio: d.fecha_inicio || null,
    fecha_fin: d.fecha_fin || null,
    fase_inicial: d.faseInicial || 0,
  }).eq('id', id)
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
