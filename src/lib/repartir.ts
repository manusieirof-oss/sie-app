// ---------------------------------------------------------------------------
// REPARTIR SESIONES EN LAS CITAS DE UN PACIENTE
//
// Tres formas, las mismas en toda la app (se usan desde el calendario de citas,
// que es la única pantalla que pone sesiones en citas):
//
//   · POR DÍA DE LA SEMANA: "martes → Sesión 1, jueves → Sesión 2". Es como se
//     piensa en la sala: cada día que viene, lo suyo.
//   · ALTERNANDO: "Sesión 1, Sesión 2, Sesión 1…" siguiendo sus citas en orden.
//   · POR BLOQUES: "Sesión 1 durante 4 semanas, luego Sesión 2 otras 4", como las
//     fases del torno.
//
// Reglas comunes, para que las tres se comporten igual:
//   · Lo tocado a mano se respeta.
//   · Una cita con candado (sesión fija, la de fuerza) no se toca nunca.
//   · Sin "pisar", solo se rellenan citas vacías o que ya llevan una de las
//     sesiones que se están repartiendo.
//   · Una sesión de una fase de ciclo solo cae en fechas de su fase.
//
// El plan se CALCULA aquí y se pinta en el calendario; se guarda al Confirmar.
// ---------------------------------------------------------------------------

export type ModoReparto = 'dias' | 'alternar' | 'bloques'
export type HastaReparto = { tipo: 'todas' | 'fecha' | 'semanas', fecha?: string, semanas?: number }
export type Bloque = { ses: string, semanas: number }

type CitaR = { id: string, fecha: string }
type SesR = { id: string, desde: string | null, hasta: string | null }

/** Día de la semana de una fecha 'YYYY-MM-DD', con el lunes como 0. */
export const diaSemana = (f: string) => (new Date(f + 'T12:00:00').getDay() + 6) % 7
export const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const dias = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

/** Las sesiones que intervienen en un reparto (para saber qué se puede pisar sin "pisar"). */
export function sesionesDelReparto(modo: ModoReparto, porDia: Record<number, string>, orden: string[], bloques: Bloque[]) {
  if (modo === 'dias') return Array.from(new Set(Object.values(porDia).filter(Boolean)))
  if (modo === 'alternar') return Array.from(new Set(orden))
  return Array.from(new Set(bloques.map(b => b.ses).filter(Boolean)))
}

export function planReparto(a: {
  citas: CitaR[]
  original: Record<string, string | null>
  aMano: Record<string, string | null>
  fijas: Set<string>
  sesiones: SesR[]
  modo: ModoReparto
  porDia: Record<number, string>
  orden: string[]
  bloques: Bloque[]
  hasta: HastaReparto
  pisar: boolean
  /** Alternando: poner una de cada N citas libres (1 = en todas). */
  cada?: number
}): Record<string, string | null> {
  const enJuego = new Set(sesionesDelReparto(a.modo, a.porDia, a.orden, a.bloques))
  const ses = (id: string) => a.sesiones.find(s => s.id === id)
  const cabe = (id: string, f: string) => { const s = ses(id); return !!s && (!s.desde || f >= s.desde) && (!s.hasta || f <= s.hasta) }

  // Las citas que pueden recibir sesión, en orden.
  const libres = a.citas.filter(c => {
    if (c.id in a.aMano) return false
    const act = a.original[c.id]
    if (act && a.fijas.has(act)) return false
    return !act || enJuego.has(act) || a.pisar
  })
  const inicio = libres[0]?.fecha
  const dentro = (f: string) => {
    if (a.hasta.tipo === 'fecha') return !a.hasta.fecha || f <= a.hasta.fecha
    if (a.hasta.tipo === 'semanas') return !inicio || dias(inicio, f) < 7 * Math.max(1, a.hasta.semanas || 1)
    return true
  }

  const nuevo: Record<string, string | null> = {}
  let i = 0, paso = 0
  const cada = Math.max(1, a.cada || 1)
  for (const c of libres) {
    if (!dentro(c.fecha)) break
    if (a.modo === 'alternar' && paso++ % cada !== 0) continue
    let s: string | null = null
    if (a.modo === 'dias') {
      const d = a.porDia[diaSemana(c.fecha)]
      if (d && cabe(d, c.fecha)) s = d
    } else if (a.modo === 'alternar') {
      // La que toca en el orden y que además cabe en su fase; si no cabe, la siguiente.
      for (let k = 0; k < a.orden.length; k++) {
        const id = a.orden[(i + k) % a.orden.length]
        if (cabe(id, c.fecha)) { s = id; i = i + k + 1; break }
      }
    } else {
      // Por bloques: según cuántas semanas han pasado desde la primera cita.
      const sem = inicio ? Math.floor(dias(inicio, c.fecha) / 7) : 0
      let acc = 0
      for (const b of a.bloques) {
        acc += Math.max(1, b.semanas || 1)
        if (sem < acc) { if (b.ses && cabe(b.ses, c.fecha)) s = b.ses; break }
      }
    }
    if (s && s !== a.original[c.id]) nuevo[c.id] = s
  }
  return nuevo
}

/**
 * SEGUIR ALTERNANDO después de cambiar una cita a mano.
 *
 * Si iban "A, B, A, B" y la de hoy pasa de A a B, las siguientes tienen que seguir
 * la alternancia desde B: "A, B, A…". Solo se recolocan las que llevan una de las
 * sesiones que alternan (o ninguna); las de candado y las que llevan otra cosa se
 * quedan como están. Devuelve solo las que cambian.
 */
export function seguirAlternando(despues: { id: string, sesion_id: string | null, fija?: boolean }[], orden: string[], desde: string) {
  const out: Record<string, string> = {}
  let i = orden.indexOf(desde)
  if (i < 0 || orden.length < 2) return out
  for (const c of despues) {
    if (c.fija) continue
    if (c.sesion_id && !orden.includes(c.sesion_id)) continue
    i = (i + 1) % orden.length
    if (orden[i] !== c.sesion_id) out[c.id] = orden[i]
  }
  return out
}

/** Las sesiones que van alternando en unas citas: las distintas, en el orden en que aparecen. */
export function ordenQueAlterna(citas: { sesion_id: string | null, fija?: boolean }[]) {
  const o: string[] = []
  for (const c of citas) if (c.sesion_id && !c.fija && !o.includes(c.sesion_id)) o.push(c.sesion_id)
  return o
}
