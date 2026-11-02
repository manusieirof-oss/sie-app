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
  // ── Remo ──
  [/^remo con barra/, () => ({ mov: 'remo', p: { tipo: 'barra' } })],
  [/^remo con mancuerna a una mano/, (_, v) => tiene(v, /banda/) ? null : ({ mov: 'remo', p: { tipo: 'una_mano' } })],
  [/^remo en polea/, (_, v) => tiene(v, /una mano/) ? null : ({ mov: 'remo', p: { tipo: 'polea' } })],
  // ── Curl de bíceps ──
  [/^curl con barra/, () => ({ mov: 'curl', p: { carga: 'barra' } })],
  [/^curl de biceps con mancuernas/, (_, v) => ({ mov: 'curl', p: { brazos: tiene(v, /alterno/) ? 'alterno' : 'dos', posicion: tiene(v, /sentado/) ? 'sentado' : 'de_pie' } })],
  [/^curl de biceps en polea/, () => ({ mov: 'curl', p: { carga: 'polea' } })],
  [/^(curl martillo|biceps martillo)/, (_, v) => tiene(v, /cruzado/) ? null : ({ mov: 'curl', p: { carga: tiene(v, /cuerda|polea/) ? 'polea' : 'mancuernas', brazos: tiene(v, /unilateral/) ? 'una' : 'dos' } })],
  // ── Talones ──
  [/^elevacion de talones de pie/, (_, v) => ({ mov: 'talones', p: { piernas: tiene(v, /una pierna/) ? 'una' : 'dos', carga: tiene(v, /peso/) ? 'mancuernas' : 'ninguna' } })],
  [/^elevacion de talon en escalon|^excentrico de aquiles/, (_, v) => tiene(v, /rodilla flexionada/) ? null : ({ mov: 'talones', p: { tipo: 'escalon', piernas: tiene(v, /una pierna/) ? 'una' : 'dos', carga: tiene(v, /peso/) ? 'mancuernas' : 'ninguna' } })],
  // ── Elevaciones de hombro ──
  [/^elevacion lateral/, (_, v) => ({ mov: 'elevacion_brazos', p: { tipo: 'lateral', carga: tiene(v, /banda|goma/) ? 'banda' : 'mancuernas', posicion: tiene(v, /sentado/) ? 'sentado' : 'de_pie' } })],
  [/^elevacion frontal/, (_, v) => ({ mov: 'elevacion_brazos', p: { tipo: 'frontal', brazos: tiene(v, /alterna/) ? 'alterno' : 'dos', carga: tiene(v, /disco/) ? 'disco' : tiene(v, /banda/) ? 'banda' : 'mancuernas' } })],
  // ── Tríceps ──
  [/^extension de triceps en polea/, () => ({ mov: 'triceps', p: { tipo: 'polea' } })],
  [/^extension de triceps sobre la cabeza/, (_, v) => ({ mov: 'triceps', p: { tipo: 'cabeza', brazos: tiene(v, /una mano/) ? 'una' : 'dos', posicion: tiene(v, /sentado/) ? 'sentado' : 'de_pie' } })],
  [/^press frances/, (_, v) => tiene(v, /de pie|mancuernas/) ? null : ({ mov: 'triceps', p: { tipo: 'frances' } })],
  // ── Press de banca ──
  [/^press de banca con mancuernas/, (_, v) => ({ mov: 'press_banca', p: { carga: 'mancuernas', brazos: tiene(v, /alterno/) ? 'alterno' : 'dos' } })],
  [/^press de banca/, (_, v) => tiene(v, /inclinado/) ? null : ({ mov: 'press_banca', p: { carga: 'barra' } })],
  // ── Planchas ──
  [/^plancha frontal/, (_, v) => tiene(v, /pies elevados/) ? null : ({ mov: 'plancha', p: { tipo: tiene(v, /rodillas/) ? 'rodillas' : tiene(v, /toques/) ? 'manos' : 'antebrazos', toques: tiene(v, /toques/) ? 'si' : 'no' } })],
  [/^plancha lateral/, (_, v) => tiene(v, /pierna elevada/) ? null : ({ mov: 'plancha_lateral', p: { tipo: tiene(v, /elevacion/) ? 'elevacion' : 'estatica', rodillas: tiene(v, /rodillas/) ? 'si' : 'no' } })],
  [/^puente lateral con elevacion/, (_, v) => tiene(v, /banda/) ? null : ({ mov: 'plancha_lateral', p: { tipo: 'elevacion', rodillas: tiene(v, /rodillas/) ? 'si' : 'no' } })],
  // ── Crunch ──
  [/^abdominal crunch$/, (_, v) => tiene(v, /fitball/) ? null : ({ mov: 'crunch', p: {} })],
  // ── Subida al cajón ──
  [/^subida al cajon/, (_, v) => tiene(v, /lateral/) ? null : ({ mov: 'subida_cajon', p: { carga: tiene(v, /mancuerna/) ? 'mancuernas' : 'ninguna' } })],
  // ── Marcha lateral con banda ──
  [/^marcha lateral con mini band/, (_, v) => ({ mov: 'marcha_lateral', p: { banda: tiene(v, /tobillo/) ? 'tobillos' : 'rodillas' } })],
  // ── Face pull ──
  [/^face pull/, (_, v) => tiene(v, /rodillas/) ? null : ({ mov: 'face_pull', p: {} })],
  // ── Rotación de hombro ──
  [/^rotacion (externa|interna) con banda/, (n, v) => tiene(v, /tumbado/) ? null : ({ mov: 'rotacion_hombro', p: { tipo: tiene(n, /interna/) ? 'interna' : 'externa', posicion: tiene(v, /90 grados/) ? 'a90' : 'pegado' } })],
  [/^rotacion (externa|interna) de hombro/, (n) => ({ mov: 'rotacion_hombro', p: { tipo: tiene(n, /interna/) ? 'interna' : 'externa' } })],
  // ── Cadera de pie ──
  [/^abduccion de cadera de pie/, (_, v) => ({ mov: 'abduccion_pie', p: { banda: tiene(v, /tobillo/) ? 'tobillos' : tiene(v, /rodilla/) ? 'rodillas' : 'no' } })],
  [/^(patada de gluteo|extensiones de gluteo) en polea/, () => ({ mov: 'abduccion_pie', p: { tipo: 'extension' } })],
  // ── Flexiones ──
  [/^flexiones$/, (_, v) => tiene(v, /pies elevados|pared/) ? null : ({ mov: 'flexiones', p: { rodillas: tiene(v, /rodillas/) ? 'si' : 'no' } })],
  // ── Pájaro ──
  [/^pajaro/, (_, v) => tiene(v, /sentado|banco/) ? null : ({ mov: 'pajaro', p: { carga: tiene(v, /banda/) ? 'banda' : 'mancuernas' } })],
  // ── Swing ──
  [/^swing con kettlebell/, (_, v) => tiene(v, /una mano/) ? null : ({ mov: 'swing', p: {} })],
  // ── Gato-camello ──
  [/^gato.camello/, (_, v) => tiene(v, /sentado/) ? null : ({ mov: 'gato_camello', p: { tipo: tiene(v, /solo flexion/) ? 'flexion' : 'completo' } })],
  // ── Brazos asistidos ──
  [/^autoasistido de hombro con baston/, (_, v) => tiene(v, /sentado|tumbado|rotacion|sin baston/) ? null : ({ mov: 'brazos_asistida', p: { tipo: 'baston' } })],
  [/^(elevacion de brazos con stick|flexion de hombro con stick)/, () => ({ mov: 'brazos_asistida', p: { tipo: 'baston' } })],
  [/^(deslizamiento en pared|elevacion de brazos en pared)/, (_, v) => tiene(v, /tumbado|banda|rodillas/) ? null : ({ mov: 'brazos_asistida', p: { tipo: 'pared' } })],
  // ── Marcha ──
  [/^marcha$/, (_, v) => v ? null : ({ mov: 'marcha', p: {} })],
  [/^paseo del granjero/, (_, v) => v ? null : ({ mov: 'marcha', p: { carga: 'granjero' } })],
  // ── Una pierna ──
  [/^equilibrio unipodal en bosu/, (_, v) => tiene(v, /en el suelo/) ? ({ mov: 'una_pierna', p: {} }) : null],
  [/^elevacion de rodilla con banda/, (_, v) => tiene(v, /sentado|tumbado/) ? null : ({ mov: 'una_pierna', p: { tipo: 'rodilla' } })],
  // ── Saltos ──
  [/^saltos suaves en el sitio/, (_, v) => tiene(v, /talones/) ? null : ({ mov: 'saltos', p: { piernas: tiene(v, /una pierna/) ? 'una' : 'dos' } })],
  // ── Sacados de los vídeos de la clínica ──
  [/^escaladores/, (_, v) => ({ mov: 'escaladores', p: { piernas: tiene(v, /altern/) ? 'alternas' : 'juntas', deslizadores: tiene(v, /sin deslizador/) ? 'no' : 'si' } })],
  [/^rotacion (interna|externa) de cadera sentado/, (n, v) => ({ mov: 'rotacion_cadera_sentado', p: { tipo: tiene(n, /externa/) ? 'externa' : 'interna', pelota: tiene(n + ' ' + v, /pelota/) ? 'si' : 'no' } })],
  [/^(flexion de cadera sobre cajon|estiramiento psoas en cajon)/, () => ({ mov: 'flexor_cajon', p: {} })],
  // ── Tanda 1 de vídeos (camilla, goma, aro, pelota) ──
  [/^sentadilla con camilla/, n => ({ mov: 'sentadilla_camilla', p: { altura: tiene(n, /alta/) ? 'alta' : tiene(n, /baja/) ? 'baja' : 'media' } })],
  [/^marcha lateral$/, () => ({ mov: 'paso_lateral', p: {} })],
  [/^extension de rodilla con (ketlle|kettle|kettlebell|pesa)/, () => ({ mov: 'rodilla_sentado', p: { tipo: 'extension', carga: 'kettlebell' } })],
  [/^extension de rodilla apretando pelota/, () => ({ mov: 'rodilla_sentado', p: { tipo: 'extension', carga: 'pelota' } })],
  [/^flexion de rodilla con goma en tobillos/, () => ({ mov: 'rodilla_sentado', p: { tipo: 'flexion_goma' } })],
  [/^abduccion de cadera con goma sentado/, () => ({ mov: 'cadera_sentado', p: { tipo: 'abduccion' } })],
  [/^apretar (el |la )?(aro|pelota) con (las )?rodillas/, n => ({ mov: 'cadera_sentado', p: { tipo: 'aduccion', objeto: tiene(n, /aro/) ? 'aro' : 'pelota' } })],
  [/^flexion de cadera sentado con goma/, () => ({ mov: 'cadera_sentado', p: { tipo: 'flexion' } })],
  [/^apretar (el )?aro con las manos/, () => ({ mov: 'aro_manos', p: {} })],
  // ── Tanda 2 de vídeos (fitball, taco, goma y deslizador en el suelo, pared) ──
  [/^flexo.extension de rodilla con pies sobre fitball/, () => ({ mov: 'fitball_supino', p: { tipo: 'flexo_rodilla' } })],
  [/^flexo.extension de rodilla con extension de cadera y pies sobre fitball/, () => ({ mov: 'fitball_supino', p: { tipo: 'curl' } })],
  [/^extension de cadera con pies sobre (el )?fitball/, () => ({ mov: 'fitball_supino', p: { tipo: 'puente' } })],
  [/^flexion de cadera con pies sobre fitball/, () => ({ mov: 'fitball_supino', p: { tipo: 'elevar_pierna' } })],
  [/^extension de cadera unilateral con talon sobre taco/, () => ({ mov: 'fitball_supino', p: { tipo: 'taco_iso' } })],
  [/^flexo.extension de rodilla con goma supino/, () => ({ mov: 'supino_goma', p: {} })],
  [/^flexo.extension de rodilla con goma$/, () => ({ mov: 'sentado_suelo', p: { tipo: 'goma' } })],
  [/^flexo.extension de rodilla con pie sobre deslizador/, () => ({ mov: 'sentado_suelo', p: { tipo: 'deslizador' } })],
  [/^hiperextension de rodilla con pie sobre taco/, () => ({ mov: 'sentado_suelo', p: { tipo: 'taco' } })],
  [/^extension de rodilla con fitball/, () => ({ mov: 'rodilla_fitball_pared', p: {} })],
  [/^flexion completa de rodillas/, () => ({ mov: 'arrodillado', p: {} })],
  [/^retraccion escapular con abduccion de hombro con balon/, () => ({ mov: 'balon_pared', p: { tipo: 'abduccion' } })],
  [/^retraccion escapular con rotacion externa de hombro con balon/, () => ({ mov: 'balon_pared', p: { tipo: 'rotacion_externa' } })],
  [/^flexion de hombro con proteccion escapular con balon/, () => ({ mov: 'balon_pared', p: { tipo: 'flexion', objeto: 'balon' } })],
  [/^flexion de hombro con rueda/, () => ({ mov: 'balon_pared', p: { tipo: 'flexion', objeto: 'rueda' } })],
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
