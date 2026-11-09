// SU MOMENTO (embarazo, postoperatorio…), puesto a mano en la cabecera del paciente.
// Mismo color dorado en todos los sitios donde sale (ficha, taller, agenda), para que se
// reconozca de un vistazo.
export const COLOR_MOMENTO = { fondo: '#FFF8E6', borde: '#D9B85C', texto: '#7A5800', raya: '#D4A24E' }

const DIA = 864e5
const ms = (f: string) => new Date(f + 'T12:00:00').getTime()
const hoyMs = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime() }
const fCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
export const esEmbarazo = (t?: string | null) => /embaraz|gestaci/i.test(t || '')

/* CUENTA ATRÁS. Si el momento tiene fecha de fin, se sabe en qué semana va.
   · Embarazo: la fecha de fin es la FPP (fecha probable de parto). Un embarazo dura 40
     semanas, así que la semana de gestación es 40 menos las que faltan para la FPP, y el
     trimestre sale de ahí: 1º hasta la 13, 2º hasta la 27, 3º desde la 28. Lo pidió el
     equipo para preparar las clases.
   · Cualquier otro (postoperatorio 6 semanas…): semana X de Y, desde «desde» hasta «hasta». */
export type Progreso = { semana: number, total: number, quedan: number, trimestre?: 1 | 2 | 3, pasado: boolean }
export function progresoMomento(p: any): Progreso | null {
  if (!p?.momento || !p?.momento_hasta) return null
  const fin = ms(p.momento_hasta), hoy = hoyMs()
  const quedan = Math.max(0, Math.ceil((fin - hoy) / (7 * DIA)))
  if (esEmbarazo(p.momento)) {
    const semana = Math.max(1, Math.min(42, Math.floor(40 - (fin - hoy) / (7 * DIA))))
    return { semana, total: 40, quedan, trimestre: semana <= 13 ? 1 : semana <= 27 ? 2 : 3, pasado: hoy > fin }
  }
  if (!p.momento_desde) return { semana: 0, total: 0, quedan, pasado: hoy > fin }
  const ini = ms(p.momento_desde)
  const total = Math.max(1, Math.ceil((fin - ini) / (7 * DIA)))
  const semana = Math.max(1, Math.min(total, Math.floor((hoy - ini) / (7 * DIA)) + 1))
  return { semana, total, quedan, pasado: hoy > fin }
}

/** «Embarazo · semana 22 · 2º trimestre · FPP 15 mar» / «Postoperatorio · Ligamento cruzado · semana 3 de 6». */
export function textoMomento(p: any): string {
  if (!p?.momento) return ''
  const cosas = (p.momento_cosas || []).map((c: any) => c.nombre).filter(Boolean)
  const pr = progresoMomento(p)
  let cola = ''
  if (pr && esEmbarazo(p.momento)) cola = pr.pasado ? ` · FPP pasada (${fCorta(p.momento_hasta)})` : ` · semana ${pr.semana} · ${pr.trimestre}º trimestre · FPP ${fCorta(p.momento_hasta)}`
  else if (pr) cola = pr.pasado ? ` · terminó el ${fCorta(p.momento_hasta)}` : pr.total ? ` · semana ${pr.semana} de ${pr.total}` : ` · hasta el ${fCorta(p.momento_hasta)}`
  else if (p.momento_desde) cola = ` · desde ${fCorta(p.momento_desde)}`
  return [p.momento, ...cosas].join(' · ') + cola
}
