import { supabase } from './supabase'
import { duplicarSesion, registrarSesion, esPlantilla } from './sesiones'
import { hoyISO } from '@/lib/fechas'

/**
 * Programar UNA sesión a UN GRUPO de pacientes.
 *
 * El caso real: treinta personas que entrenan en grupo tienen que hacer la misma sesión
 * "la 2ª vez que vengan cada mes". Hacerlo a mano son treinta fichas.
 *
 * LA REGLA NO ES UNA FECHA, ES UN ORDINAL. "El 14 de abril" solo le cae a quien
 * casualmente tenga cita ese día; con treinta agendas distintas eso es media clase. "La
 * 2ª sesión de abril" existe para todos: es la segunda cita de ESE paciente en abril,
 * que para uno es el día 3 y para otro el 7. Por eso se cuentan citas y no días.
 *
 * Es la misma idea que ya usa `lib/rotacion.ts`: la frecuencia del paciente no se
 * modela en ningún sitio, se leen sus citas. La agenda ya sabe qué días viene cada uno,
 * y cualquier otro sitio donde se guardara acabaría contradiciéndola.
 *
 * QUÉ PASA SI CAMBIAN LA CITA. El enlace vive en la cita (`citas.sesion_id`), no en la
 * fecha: mover el martes al jueves se lleva la sesión al jueves sin que nadie haga nada.
 * Si la CANCELAN, la cita cancelada sale de la cuenta y lo que era la 3ª pasa a ser la
 * 2ª — pero esto NO recalcula solo. Mover por su cuenta una sesión ya prescrita, en
 * treinta fichas, es de esas cosas que se descubren tarde. En su lugar el plan se puede
 * volver a pasar cuando se quiera: como solo rellena huecos, la segunda pasada le pone
 * la sesión al que la perdió y no toca a nadie más.
 *
 * SOLO RELLENA HUECOS. Nunca sustituye una sesión ya prescrita. Lo que se salta sale
 * por su nombre en los avisos, no desaparece.
 *
 * El plan se CALCULA aparte de escribirse (`planDeGrupo` / `aplicarPlanGrupo`) para que
 * la vista previa salga de la misma función que va a ejecutar. Una vista previa
 * calculada por su cuenta acaba mintiendo el día que una de las dos cambie.
 */

export type ReglaGrupo = {
  /** Qué sesiones del mes. [1,2] = la 1ª y la 2ª cita del paciente ese mes. */
  ordinales: number[]
  /**
   * DESDE DÓNDE SE CUENTA.
   *
   * Contando desde el principio, "la 7ª" es un número distinto para cada bono: quien viene
   * 8 veces al mes y quien viene 16 no tienen la misma séptima clase en el calendario.
   *
   * Desde el FINAL, en cambio, "la penúltima" es la misma idea para todos y cae donde
   * corresponde a cada uno: la 7ª en reducido, la 11ª en esencial, la 15ª en progreso. Es
   * lo que permite programar la última semana de una tanda a todo el mundo de una vez, en
   * lugar de hacer una pasada por bono calculando los números a mano.
   */
  desdeElFinal?: boolean
  /** Primer mes, en formato 'YYYY-MM'. */
  desde: string
  /** Cuántos meses seguidos contando el primero. */
  meses: number
}

export type CitaGrupo = {
  id: string
  paciente_id: string
  fecha: string
  hora?: string | null
  estado?: string | null
  sesion_id?: string | null
}

/** Una cita a la que le toca la sesión del grupo. */
export type FilaPlan = {
  pacienteId: string
  citaId: string
  fecha: string
  hora?: string | null
  /** 'YYYY-MM' */
  mes: string
  /** Qué número de sesión del mes es. */
  ordinal: number
}

/**
 * Algo que NO se va a programar, y por qué.
 *
 * Existe porque el silencio aquí es peligroso: "se han programado 24 de 30" sin decir
 * quiénes son los seis se lee como que ha ido bien.
 */
export type AvisoPlan = {
  pacienteId: string
  mes: string
  motivo: 'sin_citas' | 'no_llega' | 'ya_paso' | 'ocupada' | 'ya_puesta'
  texto: string
}

export type PlanGrupo = {
  filas: FilaPlan[]
  avisos: AvisoPlan[]
}

const dosCifras = (n: number) => String(n).padStart(2, '0')

/** Hoy en 'YYYY-MM-DD', igual que lo guardan las citas. */
// `hoyISO` vive ahora en lib/fechas, que no pasa por UTC. Se reexporta para
// no romper a quien lo importaba desde aquí.
export { hoyISO }

/** El mes de hoy, en 'YYYY-MM'. Es el valor con el que arranca el formulario. */
export const mesActual = () => hoyISO().slice(0, 7)

/** ['2026-04','2026-05',...]. Sin objetos Date para no depender de la zona horaria. */
export function mesesDe(desde: string, cuantos: number): string[] {
  const [a, m] = desde.split('-').map(Number)
  if (!a || !m || cuantos < 1) return []
  const salida: string[] = []
  for (let i = 0; i < cuantos; i++) {
    const total = (m - 1) + i
    salida.push(`${a + Math.floor(total / 12)}-${dosCifras((total % 12) + 1)}`)
  }
  return salida
}

/** Último día del mes, en 'YYYY-MM-DD'. El día 0 del siguiente es el último de este. */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${mes}-${dosCifras(new Date(Date.UTC(a, m, 0)).getUTCDate())}`
}

/** '2026-04' → 'abril de 2026'. Para poder decir el mes en los avisos. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function nombreMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return `${MESES[m - 1] || mes} de ${a}`
}

/** '2026-04-03' → '3 abr'. */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${Number(d)} ${(MESES[Number(m) - 1] || '').slice(0, 3)}`
}

/** '1ª', '2ª'… para no escribir el ordinal a mano en cinco sitios. */
export const ordinalTexto = (n: number) => `${n}ª`

/** Cómo se llama el ordinal contando desde el final. La 1ª desde el final es la última. */
export const ordinalDesdeFinal = (n: number) =>
  n === 1 ? 'Última' : n === 2 ? 'Penúltima' : n === 3 ? 'Antepenúltima' : `${n}ª por el final`

/** El nombre que toca según cómo se esté contando. */
export const textoOrdinal = (n: number, desdeElFinal?: boolean) =>
  desdeElFinal ? ordinalDesdeFinal(n) : ordinalTexto(n)

/**
 * Las copias que estos pacientes ya tienen de esta plantilla, por paciente.
 *
 * Sin esto, volver a pasar el plan le crearía a cada uno una segunda copia con el mismo
 * nombre. El enlace es `sesiones.plantilla_id`, que pone `duplicarSesion`.
 */
export async function copiasDeLaPlantilla(plantillaId: string, pacienteIds: string[]) {
  const mapa: Record<string, string> = {}
  if (!plantillaId || pacienteIds.length === 0) return mapa
  const { data, error } = await supabase.from('sesiones')
    .select('id,paciente_id,created_at')
    .eq('plantilla_id', plantillaId).in('paciente_id', pacienteIds)
    .order('created_at')
  if (error) return mapa
  // La primera de cada paciente: si por lo que sea hubiera dos, se sigue usando la que
  // ya está en sus citas en vez de repartir entre las dos.
  ;(data || []).forEach((s: any) => { if (s.paciente_id && !mapa[s.paciente_id]) mapa[s.paciente_id] = s.id })
  return mapa
}

/**
 * Las citas de estos pacientes en este rango. Las CANCELADAS no vienen: no se programan
 * y, sobre todo, no cuentan para el ordinal. Si el paciente anula la 2ª de abril, la que
 * era 3ª pasa a ser la 2ª, que es lo que de verdad va a ocurrir en la sala.
 */
export async function citasDelGrupo(pacienteIds: string[], meses: string[]): Promise<CitaGrupo[]> {
  if (pacienteIds.length === 0 || meses.length === 0) return []
  const { data } = await supabase.from('citas')
    .select('id,paciente_id,fecha,hora,estado,sesion_id')
    .in('paciente_id', pacienteIds)
    .gte('fecha', `${meses[0]}-01`).lte('fecha', finDeMes(meses[meses.length - 1]))
    .neq('estado', 'cancelada')
    .order('fecha').order('hora')
  return (data || []) as CitaGrupo[]
}

/**
 * Qué cita de cada paciente recibe la sesión. NO escribe nada.
 *
 * `copias` dice qué sesión es "la de este grupo" para cada paciente, y sirve para
 * distinguir dos cosas que si no se confundirían: una cita que ya tiene ESTA sesión
 * (no hay nada que hacer) de una que tiene OTRA (no se pisa, y se avisa).
 */
export function planDeGrupo(
  pacienteIds: string[],
  citas: CitaGrupo[],
  regla: ReglaGrupo,
  copias: Record<string, string> = {},
  hoy: string = hoyISO(),
): PlanGrupo {
  const filas: FilaPlan[] = []
  const avisos: AvisoPlan[] = []
  const meses = mesesDe(regla.desde, regla.meses)
  const ordinales = Array.from(new Set(regla.ordinales.filter(n => n >= 1))).sort((a, b) => a - b)
  if (ordinales.length === 0 || meses.length === 0) return { filas, avisos }

  for (const pid of pacienteIds) {
    const suyas = citas.filter(c => c.paciente_id === pid)
    for (const mes of meses) {
      // Ya vienen ordenadas de la consulta; se filtra por mes y el índice ES el ordinal.
      const delMes = suyas.filter(c => c.fecha.slice(0, 7) === mes)

      if (delMes.length === 0) {
        // No se distingue "no viene ese mes" de "la agenda no llega todavía": las dos
        // se ven igual desde aquí y jurar cuál es sería inventar.
        avisos.push({ pacienteId: pid, mes, motivo: 'sin_citas',
          texto: `${nombreMes(mes)}: no tiene ninguna cita. O no viene, o la agenda aún no llega a ese mes.` })
        continue
      }

      for (const n of ordinales) {
        // Desde el final, la 1ª es la última cita del mes; desde el principio, la primera.
        const cita = regla.desdeElFinal ? delMes[delMes.length - n] : delMes[n - 1]
        const nombreN = textoOrdinal(n, regla.desdeElFinal)

        if (!cita) {
          avisos.push({ pacienteId: pid, mes, motivo: 'no_llega',
            texto: `${nombreMes(mes)}: solo tiene ${delMes.length} cita${delMes.length > 1 ? 's' : ''}, no hay ${nombreN.toLowerCase()}.` })
          continue
        }

        if (cita.sesion_id && copias[pid] && cita.sesion_id === copias[pid]) {
          avisos.push({ pacienteId: pid, mes, motivo: 'ya_puesta',
            texto: `${nombreMes(mes)}: la ${nombreN.toLowerCase()} (${fechaCorta(cita.fecha)}) ya la tiene puesta.` })
          continue
        }

        if (cita.sesion_id) {
          avisos.push({ pacienteId: pid, mes, motivo: 'ocupada',
            texto: `${nombreMes(mes)}: la ${nombreN.toLowerCase()} (${fechaCorta(cita.fecha)}) ya tiene otra sesión. No se pisa.` })
          continue
        }

        // El ordinal cuenta TODAS las citas del mes, también las que ya pasaron: si no,
        // en el mes en curso la "2ª" sería la segunda que queda, que no es la segunda.
        // Pero escribir en una cita pasada es reescribir lo que ya se entrenó.
        if (cita.fecha < hoy || cita.estado === 'realizada' || cita.estado === 'falta') {
          avisos.push({ pacienteId: pid, mes, motivo: 'ya_paso',
            texto: `${nombreMes(mes)}: la ${nombreN.toLowerCase()} (${fechaCorta(cita.fecha)}) ya pasó.` })
          continue
        }

        filas.push({ pacienteId: pid, citaId: cita.id, fecha: cita.fecha, hora: cita.hora, mes, ordinal: n })
      }
    }
  }

  return { filas, avisos }
}

export type ResultadoGrupo = {
  /** Citas escritas. */
  nCitas: number
  /** Pacientes que han recibido algo. */
  nPacientes: number
  /** Copias de la plantilla creadas ahora. */
  nCopias: number
  /** Lo que ha fallado, por paciente. Se sigue con el resto y se cuenta al final. */
  fallos: { pacienteId: string, error: string }[]
}

/**
 * Escribe el plan.
 *
 * Cada paciente recibe UNA copia suya de la plantilla y esa misma copia se pone en
 * todas sus fechas del grupo. La regla es de `lib/asignarCita.ts` y no se salta aquí:
 * una cita nunca apunta a una plantilla, porque el día que alguien la retocara estaría
 * reescribiendo lo ya entrenado, y a la vez para todo el mundo.
 *
 * Un evento por paciente con el total, no uno por cita: programar el trimestre es una
 * decisión, no doce.
 */
export async function aplicarPlanGrupo(
  plantilla: any,
  plan: PlanGrupo,
  copias: Record<string, string> = {},
): Promise<{ ok: false, error: string } | ({ ok: true } & ResultadoGrupo)> {
  if (!plantilla?.id) return { ok: false, error: 'Falta la sesión' }
  if (!esPlantilla(plantilla)) return { ok: false, error: 'Solo se puede programar a un grupo desde una plantilla, no desde la sesión ya prescrita a un paciente' }

  const porPaciente: Record<string, FilaPlan[]> = {}
  plan.filas.forEach(f => { (porPaciente[f.pacienteId] ||= []).push(f) })

  let nCitas = 0, nPacientes = 0, nCopias = 0
  const fallos: { pacienteId: string, error: string }[] = []

  for (const [pid, filas] of Object.entries(porPaciente)) {
    if (filas.length === 0) continue

    let sesionId = copias[pid]
    if (!sesionId) {
      const r = await duplicarSesion(plantilla, pid, {
        sufijo: '', motivo: `Del grupo "${plantilla.nombre}"`, plantillaId: plantilla.id, sinEvento: true,
      })
      // Un fallo PARCIAL de `duplicarSesion` —la copia se crea pero sus objetivos no—
      // también entra por aquí: la copia existe y queda enlazada a la plantilla, así
      // que la próxima pasada la encuentra, pero este paciente no se da por programado
      // con una sesión a la que le faltan sus objetivos.
      if (!r.ok) { fallos.push({ pacienteId: pid, error: r.error || 'No se pudo copiar la sesión' }); continue }
      sesionId = r.sesion.id
      copias[pid] = sesionId
      nCopias++
    }

    let escritas = 0
    let falloCitas = ''
    for (const f of filas) {
      const { error } = await supabase.from('citas').update({ sesion_id: sesionId }).eq('id', f.citaId)
      if (error) { falloCitas = error.message; break }
      escritas++
    }

    if (escritas > 0) {
      nCitas += escritas
      nPacientes++
      const fechas = filas.slice(0, escritas).map(f => fechaCorta(f.fecha)).join(' · ')
      await registrarSesion(pid, `«${plantilla.nombre}» programada en ${escritas} cita${escritas > 1 ? 's' : ''}`,
        `En grupo · ${fechas}`)
    }
    // La copia ya existe y parte de las citas están escritas: se cuenta el fallo en vez
    // de fingir que el paciente ha quedado programado entero.
    if (falloCitas) fallos.push({ pacienteId: pid, error: falloCitas })
  }

  return { ok: true, nCitas, nPacientes, nCopias, fallos }
}
