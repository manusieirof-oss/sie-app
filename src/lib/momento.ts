// SU MOMENTO (embarazo, postoperatorio…), puesto a mano en la cabecera del paciente.
// Mismo color dorado en todos los sitios donde sale (ficha, taller, agenda), para que se
// reconozca de un vistazo.
export const COLOR_MOMENTO = { fondo: '#FFF8E6', borde: '#D9B85C', texto: '#7A5800', raya: '#D4A24E' }

/** «Postoperatorio · Ligamento cruzado · desde 2 oct» (o '' si no tiene). */
export function textoMomento(p: any): string {
  if (!p?.momento) return ''
  const cosas = (p.momento_cosas || []).map((c: any) => c.nombre).filter(Boolean)
  const desde = p.momento_desde ? new Date(p.momento_desde + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : ''
  return [p.momento, ...cosas].join(' · ') + (desde ? ` · desde ${desde}` : '')
}
