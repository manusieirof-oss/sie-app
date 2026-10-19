import type { AnimEjercicio } from './tipos'
import { MOVIMIENTOS, paramsPorDefecto } from './movimientos'

/**
 * QUÉ ANIMACIÓN LE TOCA A UN EJERCICIO.
 *
 * Si el ejercicio tiene `animacion` guardada (alguien la eligió en la ficha), manda
 * esa. Si no, se deduce del nombre — incluida la variante ("Zancada con deslizador ·
 * Lateral" no es la misma que "· Atrás").
 *
 * Regla de oro: sólo se asigna cuando el movimiento la representa BIEN. Si el
 * nombre no encaja con ningún movimiento hecho, se devuelve null y en la ficha
 * sigue saliendo la foto. Mejor sin animación que con una que no es.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

type Regla = [RegExp, (n: string, v: string) => AnimEjercicio | null]

const tiene = (s: string, re: RegExp) => re.test(s)

const REGLAS: Regla[] = [
  // ── Sentadillas ──
  [/^sentadilla goblet/, (_, v) => ({ mov: 'sentadilla', p: { carga: tiene(v, /disco/) ? 'goblet_disco' : tiene(v, /mancuerna/) ? 'goblet_mancuerna' : 'goblet_kettlebell' } })],
  [/^sentadilla trasera/, (_, v) => ({ mov: 'sentadilla', p: { carga: 'barra_trasera', tipo: tiene(v, /cajon/) ? 'banco' : 'libre', pausa: tiene(v, /pausa/) ? 'si' : 'no', cuna: tiene(v, /cuna/) ? 'si' : 'no' } })],
  [/^sentadilla frontal/, () => ({ mov: 'sentadilla', p: { carga: 'barra_frontal' } })],
  [/^sentadilla al banco/, (_, v) => ({ mov: 'sentadilla', p: { tipo: 'banco', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', carga: tiene(v, /mancuerna/) ? 'goblet_mancuerna' : 'ninguna' } })],
  [/^sentadilla isometrica en pared/, (_, v) => ({ mov: 'sentadilla', p: { tipo: 'pared_iso', piernas: tiene(v, /unipodal/) ? 'una' : 'dos', pelota: tiene(v, /pelota/) ? 'si' : 'no' } })],
  [/^sentadilla profunda sostenida/, (_, v) => ({ mov: 'sentadilla', p: { tipo: 'profunda', cuna: tiene(v, /cuna/) ? 'si' : 'no' } })],
  [/^sentadilla cara a la pared/, () => ({ mov: 'sentadilla', p: { tipo: 'pared_cara' } })],
  [/^sentarse y levantarse de la silla/, (_, v) => ({ mov: 'sentadilla', p: { tipo: 'silla', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', manos: tiene(v, /apoyo de manos/) ? 'apoyo' : tiene(v, /sin manos/) ? 'cruzadas' : 'libres' } })],
  [/^levantarse y sentarse con apoyo/, (_, v) => tiene(v, /hacia un lado/) ? null : ({ mov: 'sentadilla', p: { tipo: 'silla', manos: tiene(v, /cruzados/) ? 'cruzadas' : 'apoyo' } })],
  [/^sentadilla split/, (_, v) => ({ mov: 'zancada', p: { tipo: 'estatica', carga: tiene(v, /mancuerna/) ? 'mancuernas' : 'ninguna', elevado: tiene(v, /elevado/) ? 'si' : 'no' } })],
  // ── Zancadas ──
  [/^zancada bulgara/, (_, v) => ({ mov: 'zancada', p: { tipo: 'bulgara', carga: tiene(v, /barra/) ? 'barra_trasera' : tiene(v, /mancuerna/) ? 'mancuernas' : 'ninguna' } })],
  [/^zancada con deslizador/, (_, v) => ({ mov: 'zancada', p: { tipo: tiene(v, /lateral/) ? 'deslizador_lateral' : 'deslizador_atras' } })],
  [/^zancada lateral/, (_, v) => ({ mov: 'zancada', p: { tipo: tiene(v, /deslizador/) ? 'deslizador_lateral' : 'lateral', carga: tiene(v, /mancuerna/) ? 'goblet_mancuerna' : 'ninguna' } })],
  [/^zancada con rotacion/, (_, v) => tiene(v, /mano en el suelo|stick/) ? null : ({ mov: 'zancada', p: { tipo: 'estatica', tronco: 'rotacion' } })],
  [/^zancadas atras con barra/, () => ({ mov: 'zancada', p: { tipo: 'atras', carga: 'barra_trasera' } })],
  [/^zancadas alternas con salto/, () => null],
  [/^zancadas? hac[ií]a delante|^zancadas?$/, (_, v) => ({ mov: 'zancada', p: { tipo: tiene(v, /atras/) ? 'atras' : tiene(v, /en el sitio/) ? 'estatica' : 'adelante' } })],
  // ── Bisagra ──
  [/^peso muerto rumano/, (_, v) => ({ mov: 'peso_muerto', p: { tipo: tiene(v, /una pierna/) ? 'una_pierna' : 'rumano', carga: tiene(v, /mancuerna/) ? 'mancuernas' : 'barra', deficit: tiene(v, /deficit/) ? 'si' : 'no' } })],
  [/^peso muerto convencional/, (_, v) => ({ mov: 'peso_muerto', p: { tipo: tiene(v, /sumo/) ? 'sumo' : 'convencional', carga: 'barra' } })],
  [/^peso muerto a una pierna/, (_, v) => tiene(v, /stick/) ? null : ({ mov: 'peso_muerto', p: { tipo: 'una_pierna', carga: tiene(v, /contralateral/) ? 'mancuerna_contralateral' : 'mancuernas' } })],
  [/^buenos dias/, (_, v) => tiene(v, /sentado|banda/) ? null : ({ mov: 'peso_muerto', p: { tipo: 'buenos_dias', carga: tiene(v, /barra/) ? 'barra' : 'ninguna' } })],
  // ── Press de hombros ──
  [/^press militar de pie/, (_, v) => ({ mov: 'press_hombros', p: { posicion: tiene(v, /sentado/) ? 'sentado' : 'de_pie', carga: tiene(v, /mancuerna|sentado|una mano/) ? 'mancuernas' : 'barra', brazos: tiene(v, /una mano/) ? 'una' : 'dos' } })],
  // ── Puente ──
  [/^puente con banda en rodillas/, (_, v) => ({ mov: 'puente', p: { banda: tiene(v, /aperturas/) ? 'aperturas' : 'si', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', ritmo: tiene(v, /estatico/) ? 'estatico' : 'dinamico' } })],
  [/^puente de gluteo sobre talones/, (_, v) => ({ mov: 'puente', p: { tipo: 'talones', piernas: tiene(v, /unilateral/) ? 'una' : 'dos' } })],
  [/^puente de gluteo/, (_, v) => ({ mov: 'puente', p: { tipo: tiene(v, /pies elevados/) ? 'pies_elevados' : 'suelo', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', banda: tiene(v, /banda/) ? 'si' : 'no' } })],
  [/^hip thrust/, (_, v) => ({ mov: 'puente', p: { tipo: 'hip_thrust', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', carga: tiene(v, /barra/) ? 'barra' : tiene(v, /disco/) ? 'disco' : 'ninguna' } })],
  // ── Bird-dog ──
  [/^bird dog/, (_, v) => ({ mov: 'bird_dog', p: { tipo: tiene(v, /solo brazo/) ? 'brazo' : tiene(v, /solo pierna/) ? 'pierna' : 'completo' } })],
]

/** Lo que propone el nombre (base + variante), o null si no hay animación fiel. */
export function animacionSugerida(nombre: string): AnimEjercicio | null {
  const [base, ...resto] = String(nombre || '').split('·')
  const n = norm(base), v = norm(resto.join(' '))
  for (const [re, f] of REGLAS) if (re.test(n)) {
    const r = f(n, v)
    if (!r) return null
    return { mov: r.mov, p: { ...paramsPorDefecto(r.mov), ...r.p } }
  }
  return null
}

/** La que vale para el ejercicio: la guardada o, si no hay, la sugerida. */
export function animacionDe(ej: { nombre?: string, animacion?: AnimEjercicio | null }): AnimEjercicio | null {
  const a = ej?.animacion
  if (a && a.mov === 'ninguno') return null
  if (a && MOVIMIENTOS[a.mov]) return { mov: a.mov, p: { ...paramsPorDefecto(a.mov), ...(a.p || {}) } }
  return animacionSugerida(ej?.nombre || '')
}
