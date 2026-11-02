import type { Angulos, Apoyo, Clave, Movimiento, Pose, Prop } from './tipos'

/**
 * LOS MOVIMIENTOS: cada uno sabe construir su animación según los parámetros del
 * ejercicio (tipo, carga, piernas…). Así una búlgara no es "una zancada cualquiera":
 * es la zancada con el pie de atrás en un banco; y la del deslizador atrás no es la
 * del deslizador lateral.
 *
 * Convención de ángulos en tipos.ts. Las poses se escriben con el lado D como el
 * que trabaja (pierna delantera, pierna de apoyo…); `espejo()` da la del otro lado.
 */

// ── Ayudas ───────────────────────────────────────────────────────────────────
const sim = (n: string, v: Angulos): Pose => ({ [n + 'D']: v, [n + 'I']: [v[0], -v[1], -v[2]] })
const une = (...ps: Pose[]): Pose => Object.assign({}, ...ps)
/** Cambia de lado una pose: D↔I y se invierten los giros laterales (y, z). */
export function espejo(p: Pose): Pose {
  const o: Pose = {}
  for (const [k, v] of Object.entries(p)) {
    const n = k.endsWith('D') ? k.slice(0, -1) + 'I' : k.endsWith('I') ? k.slice(0, -1) + 'D' : k
    o[n] = [v[0], -v[1], -v[2]]
  }
  return o
}
/** Repetición típica: arriba → abajo (pausa) → arriba. */
function rep(arriba: Pose, abajo: Pose, baja: string, sube: string, pausa = .1): Clave[] {
  return [
    { t: 0, fase: baja, p: arriba },
    { t: .45, fase: sube, p: abajo },
    { t: .45 + pausa, fase: sube, p: abajo },
    { t: 1, p: arriba },
  ]
}
/** Isométrico: una postura que se mantiene, con una respiración leve para que se vea vivo. */
function aguanta(p: Pose, fase: string): Clave[] {
  const r = (k: number): Pose => ({ ...p, pecho: [(p.pecho?.[0] || 0) - k, p.pecho?.[1] || 0, p.pecho?.[2] || 0] })
  return [{ t: 0, fase, p: r(0) }, { t: .5, p: r(2.5) }, { t: 1, p: r(0) }]
}
const ladoDe = (p: Record<string, string>) => p.lado === 'I' ? 'I' : 'D'
const conLado = (claves: Clave[], p: Record<string, string>) => ladoDe(p) === 'I' ? claves.map(c => ({ ...c, p: espejo(c.p) })) : claves
const otro = (h: string) => h.endsWith('D') ? h.slice(0, -1) + 'I' : h.slice(0, -1) + 'D'
const conLadoH = (hs: string[], p: Record<string, string>) => ladoDe(p) === 'I' ? hs.map(otro) : hs

// ── Cargas en las manos ──────────────────────────────────────────────────────
// Cada carga es una postura de brazos y las piezas que la acompañan. `inclina` es
// cuánto se inclina el tronco en esa clave: los brazos que cuelgan la compensan
// para seguir verticales (las mancuernas caen a plomo).
type Carga = { brazos: (inclina: number) => Pose, props: Prop[] }
const CARGAS: Record<string, Carga> = {
  ninguna: { brazos: () => ({}), props: [] },
  mancuernas: { brazos: k => sim('brazo', [k, 0, 6]), props: [{ tipo: 'mancuerna', en: 'manoD' }, { tipo: 'mancuerna', en: 'manoI' }] },
  goblet_kettlebell: { brazos: () => une(sim('brazo', [-36, -48, -8]), sim('antebrazo', [-112, 0, 0])), props: [{ tipo: 'kettlebell', entre: ['manoD', 'manoI'], off: [0, -2, 2] }] },
  goblet_mancuerna: { brazos: () => une(sim('brazo', [-36, -48, -8]), sim('antebrazo', [-112, 0, 0])), props: [{ tipo: 'mancuerna', entre: ['manoD', 'manoI'], off: [0, -3, 2], rot: [90, 0, 0] }] },
  goblet_disco: { brazos: () => une(sim('brazo', [-36, -48, -8]), sim('antebrazo', [-112, 0, 0])), props: [{ tipo: 'disco', entre: ['manoD', 'manoI'], off: [0, -2, 2] }] },
  barra_trasera: { brazos: () => une(sim('brazo', [25, 0, 70]), sim('antebrazo', [0, 0, 70])), props: [{ tipo: 'barra', entre: ['manoD', 'manoI'] }] },
  barra_frontal: { brazos: () => une(sim('brazo', [-86, 0, 24]), sim('antebrazo', [-138, 0, 0])), props: [{ tipo: 'barra', entre: ['manoD', 'manoI'], off: [0, 1, 0] }] },
  barra_colgando: { brazos: k => une(sim('brazo', [k, 0, 4])), props: [{ tipo: 'barra', entre: ['manoD', 'manoI'] }] },
  manos_nuca: { brazos: () => une(sim('brazo', [10, 0, 62]), sim('antebrazo', [-20, 0, 125])), props: [] },
  brazos_delante: { brazos: k => sim('brazo', [-90 + k, 0, 6]), props: [] },
}
const OPC_CARGA_SENT: [string, string][] = [
  ['ninguna', 'Peso corporal'], ['goblet_kettlebell', 'Goblet con kettlebell'], ['goblet_mancuerna', 'Goblet con mancuerna'],
  ['goblet_disco', 'Goblet con disco'], ['barra_trasera', 'Barra a la espalda'], ['barra_frontal', 'Barra delante'], ['mancuernas', 'Mancuernas a los lados'],
]

const LADO = { id: 'lado', nombre: 'Lado que trabaja', opciones: [['D', 'Derecho'], ['I', 'Izquierdo']] as [string, string][] }

// ── SENTADILLA ───────────────────────────────────────────────────────────────
const sentadilla: Movimiento = {
  id: 'sentadilla', nombre: 'Sentadilla',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['libre', 'Libre'], ['banco', 'Al banco o cajón'], ['silla', 'Sentarse y levantarse'], ['pared_iso', 'Isométrica en pared'], ['profunda', 'Profunda sostenida'], ['pared_cara', 'Cara a la pared']] },
    { id: 'carga', nombre: 'Carga', opciones: OPC_CARGA_SENT },
    { id: 'piernas', nombre: 'Piernas', opciones: [['dos', 'Las dos'], ['una', 'A una pierna']] },
    { id: 'manos', nombre: 'Manos (al sentarse)', opciones: [['libres', 'Libres al frente'], ['cruzadas', 'Brazos cruzados'], ['apoyo', 'Apoyando las manos']] },
    { id: 'pausa', nombre: 'Pausa abajo', opciones: [['no', 'No'], ['si', 'Sí']] },
    { id: 'cuna', nombre: 'Talones en cuña', opciones: [['no', 'No'], ['si', 'Sí']] },
    { id: 'pelota', nombre: 'Pelota entre rodillas', opciones: [['no', 'No'], ['si', 'Sí']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'libre', carga = CARGAS[p.carga || 'ninguna'] || CARGAS.ninguna, una = p.piernas === 'una'
    const arriba: Pose = {}
    // Profundidad y tronco según el tipo. "inclina" = cuánto se va el pecho hacia delante.
    let abajo: Pose, inclina = 40
    if (tipo === 'banco' || tipo === 'silla') {
      abajo = une({ raiz: [24, 0, 0], lumbar: [6, 0, 0], pecho: [6, 0, 0], cabeza: [-20, 0, 0] }, sim('muslo', [-98, 0, 8]), sim('pierna', [104, 0, 0]), sim('pie', [-14, 0, 0]))
      inclina = 36
    } else if (tipo === 'pared_iso') {
      abajo = une({ raiz: [0, 0, 0] }, sim('muslo', [-88, 0, 6]), sim('pierna', [88, 0, 0]))
      inclina = 0
    } else if (tipo === 'profunda') {
      abajo = une({ raiz: [30, 0, 0], lumbar: [8, 0, 0], pecho: [4, 0, 0], cabeza: [-24, 0, 0] }, sim('muslo', [-128, 0, 16]), sim('pierna', [142, 0, 0]), sim('pie', [-36, 0, 0]))
      inclina = 42
    } else if (tipo === 'pared_cara') {
      abajo = une({ raiz: [10, 0, 0], lumbar: [2, 0, 0], cabeza: [-8, 0, 0] }, sim('muslo', [-100, 0, 14]), sim('pierna', [112, 0, 0]), sim('pie', [-26, 0, 0]))
      inclina = 12
    } else {
      abajo = une({ raiz: [22, 0, 0], lumbar: [10, 0, 0], pecho: [8, 0, 0], cabeza: [-22, 0, 0] }, sim('muslo', [-112, 0, 10]), sim('pierna', [118, 0, 0]), sim('pie', [-24, 0, 0]))
    }
    // Brazos: los de la carga; sin carga, al frente para equilibrar (o lo que pida el tipo).
    let bArr: Pose = carga.brazos(0), bAb: Pose = carga.brazos(inclina)
    if ((p.carga || 'ninguna') === 'ninguna') {
      if (tipo === 'pared_cara') { bArr = sim('brazo', [-172, 0, 12]); bAb = sim('brazo', [-172 + inclina, 0, 12]) }
      else if (tipo === 'pared_iso') { bArr = bAb = sim('brazo', [0, 0, 8]) }
      else if (tipo === 'silla' && p.manos === 'cruzadas') { bArr = bAb = une(sim('brazo', [-28, 0, -16]), sim('antebrazo', [-100, 0, -62])) }
      else if (tipo === 'silla' && p.manos === 'apoyo') { bArr = sim('brazo', [-8, 0, 10]); bAb = une(sim('brazo', [-20 + inclina * .2, 0, 14]), sim('antebrazo', [-30, 0, 0])) }
      else if (tipo === 'profunda') { bArr = bAb = une(sim('brazo', [-40, 0, -10]), sim('antebrazo', [-100, 0, 0])) }
      else { bArr = sim('brazo', [-10, 0, 4]); bAb = sim('brazo', [-128 + (40 - inclina), 0, 6]) }
    }
    let up = une(arriba, bArr), dn = une(abajo, bAb)
    // A una pierna: la libre (I) se queda estirada al frente.
    if (una) {
      up = une(up, { musloI: [-25, 0, -2], piernaI: [30, 0, 0] })
      dn = une(dn, { musloI: [dn.musloD[0] - 8, 0, -2], piernaI: [6, 0, 0], pieI: [-10, 0, 0] })
    }
    const props: Prop[] = [...carga.props]
    if (tipo === 'banco') props.push({ tipo: 'cajon', bajo: 'cadera', clave: 1, hueco: 9 })
    if (tipo === 'silla') props.push({ tipo: 'silla', bajo: 'cadera', clave: 1, hueco: 8, off: [0, 0, -3] })
    if (tipo === 'pared_iso') props.push({ tipo: 'pared', bajo: 'pecho', clave: 0, off: [0, 0, -7.5] })
    if (tipo === 'pared_cara') props.push({ tipo: 'pared', bajo: 'pieD', clave: 0, off: [0, 0, 14], rot: [0, 180, 0] })
    if (p.cuna === 'si') props.push({ tipo: 'cuna', bajo: 'pieD', clave: 0 }, { tipo: 'cuna', bajo: 'pieI', clave: 0 })
    if (p.pelota === 'si') props.push({ tipo: 'pelota', entre: ['piernaD', 'piernaI'], off: [0, 1, 1] })
    const est = tipo === 'pared_iso' || tipo === 'profunda'
    const claves = est ? aguanta(dn, tipo === 'pared_iso' ? '⏸️ Aguanta con la espalda en la pared' : '⏸️ Aguanta abajo, respira')
      : tipo === 'silla' ? [
        { t: 0, fase: '⬇️ Siéntate despacio', p: up }, { t: .4, fase: '🪑 Sentado', p: dn }, { t: .55, fase: '⬆️ Levántate sin impulso', p: dn }, { t: 1, p: up },
      ] : rep(up, dn, tipo === 'banco' ? '⬇️ Baja hasta rozar el cajón' : '⬇️ Baja controlando, cadera atrás', '⬆️ Sube empujando el suelo', p.pausa === 'si' ? .2 : .1)
    const apoyo = { a: una ? conLadoH(['pieD'], p) : ['pieD', 'pieI'] }
    return {
      dur: est ? 4 : tipo === 'silla' ? 4.4 : 3.4, claves: conLado(claves, p), apoyo,
      cam: { alto: 12, dist: 245, y: 42 }, props: conLadoProps(props, p),
      musculos: [['cuadriceps', 'Cuádriceps'], ['gluteo', 'Glúteo mayor'], ['aductores', 'Aductores'], ['core', 'Core']],
    }
  },
}

// ── ZANCADA ──────────────────────────────────────────────────────────────────
const zancada: Movimiento = {
  id: 'zancada', nombre: 'Zancada',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['estatica', 'Estática (split)'], ['atras', 'Paso atrás'], ['adelante', 'Paso adelante'], ['bulgara', 'Búlgara (pie atrás en banco)'], ['deslizador_atras', 'Deslizando el pie atrás'], ['lateral', 'Lateral'], ['deslizador_lateral', 'Lateral deslizando']] },
    { id: 'carga', nombre: 'Carga', opciones: [['ninguna', 'Peso corporal'], ['mancuernas', 'Mancuernas'], ['barra_trasera', 'Barra a la espalda'], ['goblet_mancuerna', 'Mancuerna al pecho']] },
    { id: 'tronco', nombre: 'Tronco', opciones: [['recto', 'Recto'], ['rotacion', 'Con rotación']] },
    { id: 'elevado', nombre: 'Pie delantero elevado', opciones: [['no', 'No'], ['si', 'Sí']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'estatica', cargaId = p.carga || 'ninguna', carga = CARGAS[cargaId] || CARGAS.ninguna
    const brazosBase: Pose = cargaId === 'ninguna' ? sim('brazo', [0, 0, 10]) : carga.brazos(0)
    const props: Prop[] = [...carga.props]
    const mus: [string, string][] = [['cuadriceps', 'Cuádriceps'], ['gluteo', 'Glúteo mayor'], ['isquios', 'Isquiotibiales'], ['aductores', 'Aductores']]
    let claves: Clave[], apoyo: Apoyo = { a: ['pieD'] }, ikBulgara = false
    // Abajo en split: delantera (D) muslo horizontal, trasera (I) rodilla casi al suelo.
    const splitArr: Pose = { musloD: [-28, 0, 3], piernaD: [28, 0, 0], musloI: [22, 0, -3], piernaI: [14, 0, 0], pieI: [-8, 0, 0] }
    const splitAb: Pose = { musloD: [-84, 0, 3], piernaD: [86, 0, 0], pieD: [-2, 0, 0], musloI: [14, 0, -3], piernaI: [86, 0, 0], pieI: [-32, 0, 0] }
    const rot: Pose = p.tronco === 'rotacion' ? { lumbar: [0, 18, 0], pecho: [0, 22, 0] } : {}
    const brazosRot: Pose = p.tronco === 'rotacion' && cargaId === 'ninguna' ? sim('brazo', [-80, 0, -10]) : {}
    if (tipo === 'estatica') {
      claves = rep(une(splitArr, brazosBase), une(splitAb, brazosBase, rot, brazosRot), '⬇️ Baja la rodilla de atrás', '⬆️ Sube con el talón de delante')
      if (p.elevado === 'si') props.push({ tipo: 'cajon', bajo: 'pieD', clave: 0, hueco: 4, alto: 8 })
    } else if (tipo === 'atras' || tipo === 'adelante') {
      // De pie con los pies juntos, da el paso, baja, y vuelve. El pie que se queda
      // quieto es el apoyo: el de delante si el paso es atrás, el de atrás si es adelante.
      const pie: Pose = brazosBase
      const levanta: Pose = tipo === 'atras' ? { musloI: [8, 0, -2], piernaI: [62, 0, 0], pieI: [-12, 0, 0] } : { musloD: [-55, 0, 2], piernaD: [72, 0, 0] }
      claves = [
        { t: 0, fase: tipo === 'atras' ? '⬅️ Da un paso atrás y baja' : '➡️ Da un paso adelante y baja', p: pie },
        { t: .18, p: une(pie, levanta) },
        { t: .45, fase: '⬆️ Empuja y vuelve juntando los pies', p: une(splitAb, brazosBase, rot, brazosRot) },
        { t: .55, p: une(splitAb, brazosBase, rot, brazosRot) },
        { t: .8, p: une(pie, levanta) },
        { t: 1, p: pie },
      ]
      apoyo = { a: tipo === 'atras' ? ['pieD'] : ['pieI'] }
      
    } else if (tipo === 'bulgara') {
      // Pie de atrás encima del banco (empeine apoyado). Se busca la inclinación que lo
      // deja a la altura del banco.
      // Arriba: delantera casi estirada; la de atrás, con el empeine a la altura del banco.
      const arr: Pose = { musloD: [-14, 0, 3], piernaD: [10, 0, 0], musloI: [34, 0, -3], piernaI: [58, 0, 0], pieI: [90, 0, 0] }
      const ab: Pose = { raiz: [10, 0, 0], musloD: [-92, 0, 3], piernaD: [96, 0, 0], pieD: [-4, 0, 0], musloI: [40, 0, -3], piernaI: [90, 0, 0], pieI: [50, 0, 0] }
      claves = rep(une(arr, brazosBase), une(ab, brazosBase), '⬇️ Baja en vertical', '⬆️ Sube empujando con la de delante')
      apoyo = { a: ['pieD'] }
      // La pierna de atrás la coloca la IK: su pie se queda quieto encima del banco.
      ikBulgara = true
      props.push({ tipo: 'banco', bajo: 'pieI', clave: 0, hueco: 4, off: [0, 0, -6], rot: [0, 90, 0] })
    } else if (tipo === 'deslizador_atras') {
      // La delantera no se mueve; la de atrás se desliza estirada sobre el suelo.
      const arr: Pose = une({ musloI: [6, 0, -2], piernaI: [6, 0, 0], pieI: [0, 0, 0] }, brazosBase)
      const ab: Pose = une({ musloD: [-82, 0, 3], piernaD: [84, 0, 0], pieD: [-4, 0, 0], musloI: [50, 0, -3], piernaI: [14, 0, 0], pieI: [30, 0, 0], raiz: [12, 0, 0] }, brazosBase)
      claves = rep(arr, ab, '⬅️ Desliza el pie hacia atrás', '➡️ Tráelo de vuelta empujando con la de delante')
      apoyo = { a: ['pieD'] }
      props.push({ tipo: 'deslizador', en: 'pieI', off: [0, -4, 4] })
    } else {
      // Lateral: la pierna D se dobla, la I se queda estirada. El cuerpo se inclina
      // de lado (eje z) lo justo para que la estirada siga en el suelo.
      const desl = tipo === 'deslizador_lateral'
      const arr: Pose = desl ? une(brazosBase, { musloI: [0, 0, -4] }) : une({ musloD: [0, 0, 22], musloI: [0, 0, -22], pieD: [0, 0, -22], pieI: [0, 0, 22] }, brazosBase)
      const brazosAb = cargaId === 'ninguna' ? sim('brazo', [-70, 0, -4]) : carga.brazos(30)
      const ab: Pose = une({ raiz: [34, 0, 0], musloD: [-86, -8, 34], piernaD: [96, 0, 0], pieD: [-18, 0, -30], musloI: [-36, 0, -40], piernaI: [4, 0, 0], pieI: [0, 0, 44], cabeza: [-18, 0, 0] }, brazosAb)
      claves = rep(arr, ab, desl ? '↔️ Desliza el pie hacia fuera' : '↔️ Paso lateral, cadera atrás', '⬆️ Vuelve al centro')
      apoyo = { a: ['pieD'], b: ['pieI'], bY: 4.2, bEje: 'z' }
      if (desl) props.push({ tipo: 'deslizador', en: 'pieI', off: [0, -4, 4] })
      mus.splice(2, 2, ['aductores', 'Aductores'], ['isquios', 'Isquiotibiales'])
    }
    return {
      dur: tipo === 'atras' || tipo === 'adelante' ? 4.2 : 3.6, claves: conLado(claves, p),
      apoyo: { ...apoyo, a: conLadoH(apoyo.a, p), b: apoyo.b ? conLadoH(apoyo.b, p) : undefined },
      cam: { alto: 12, dist: 250, y: 42 }, props: conLadoProps(props, p), musculos: mus,
      ik: ikBulgara ? [{ pierna: ladoDe(p) === 'I' ? 'D' : 'I', pie: 190 }] : undefined,
    }
  },
}

// ── PESO MUERTO / BISAGRA ────────────────────────────────────────────────────
const pesoMuerto: Movimiento = {
  id: 'peso_muerto', nombre: 'Peso muerto / bisagra',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['rumano', 'Rumano (rodillas casi estiradas)'], ['convencional', 'Convencional (desde el suelo)'], ['sumo', 'Sumo'], ['buenos_dias', 'Buenos días'], ['una_pierna', 'A una pierna']] },
    { id: 'carga', nombre: 'Carga', opciones: [['barra', 'Barra'], ['mancuernas', 'Mancuernas'], ['mancuerna_contralateral', 'Una mancuerna en la mano contraria'], ['kettlebell', 'Kettlebell'], ['ninguna', 'Sin carga']] },
    { id: 'deficit', nombre: 'Desde déficit', opciones: [['no', 'No'], ['si', 'Sí (sobre un escalón)']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'rumano', carga = p.carga || (tipo === 'buenos_dias' ? 'ninguna' : 'barra')
    let ab: Pose, inc: number
    if (tipo === 'convencional') { inc = 52; ab = une({ raiz: [inc, 0, 0], cabeza: [-22, 0, 0] }, sim('muslo', [-96, 0, 6]), sim('pierna', [58, 0, 0]), sim('pie', [-14, 0, 0])) }
    else if (tipo === 'sumo') { inc = 42; ab = une({ raiz: [inc, 0, 0], cabeza: [-20, 0, 0] }, sim('muslo', [-92, 24, 30]), sim('pierna', [70, 0, 0]), sim('pie', [-14, 18, -30])) }
    else if (tipo === 'buenos_dias') { inc = 70; ab = une({ raiz: [inc, 0, 0], cabeza: [-16, 0, 0] }, sim('muslo', [-80, 0, 0]), sim('pierna', [14, 0, 0]), sim('pie', [-4, 0, 0])) }
    else if (tipo === 'una_pierna') { inc = 80; ab = { raiz: [inc, 0, 0], cabeza: [-14, 0, 0], musloD: [-92, 0, 0], piernaD: [16, 0, 0], pieD: [-4, 0, 0], musloI: [6, 0, -2], piernaI: [4, 0, 0], pieI: [-60, 0, 0] } }
    else { inc = 72; ab = une({ raiz: [inc, 0, 0], cabeza: [-18, 0, 0] }, sim('muslo', [-84, 0, 0]), sim('pierna', [16, 0, 0]), sim('pie', [-4, 0, 0])) }
    const arr: Pose = tipo === 'sumo' ? une(sim('muslo', [0, 24, 22]), sim('pie', [0, 18, -22])) : {}
    // Brazos y carga: colgando a plomo (compensan la inclinación), o en la nuca/espalda.
    const props: Prop[] = []
    let bArr: Pose, bAb: Pose
    if (tipo === 'buenos_dias') {
      const c = carga === 'barra' ? CARGAS.barra_trasera : CARGAS.manos_nuca
      bArr = c.brazos(0); bAb = c.brazos(inc); props.push(...c.props)
    } else {
      const ancho = tipo === 'sumo' ? 2 : 6
      bArr = sim('brazo', [0, 0, ancho]); bAb = sim('brazo', [-inc + 2, 0, ancho])
      if (carga === 'barra') props.push({ tipo: 'barra', entre: ['manoD', 'manoI'] })
      else if (carga === 'mancuernas') props.push({ tipo: 'mancuerna', en: 'manoD' }, { tipo: 'mancuerna', en: 'manoI' })
      else if (carga === 'mancuerna_contralateral') props.push({ tipo: 'mancuerna', en: 'manoI' })
      else if (carga === 'kettlebell') { props.push({ tipo: 'kettlebell', entre: ['manoD', 'manoI'], off: [0, -5, 0] }); bArr = sim('brazo', [0, 0, -6]); bAb = sim('brazo', [-inc + 2, 0, -6]) }
    }
    if (p.deficit === 'si') props.push({ tipo: 'cajon', bajo: 'pieD', clave: 0, hueco: 4, alto: 7, ancho: 70 })
    const claves = rep(une(arr, bArr), une(ab, bAb), '⬇️ Cadera atrás, espalda recta', '⬆️ Sube apretando glúteos')
    return {
      dur: 3.6, claves: conLado(claves, p), apoyo: { a: tipo === 'una_pierna' ? conLadoH(['pieD'], p) : ['pieD', 'pieI'] },
      cam: { alto: 10, dist: 245, y: 42 }, props: conLadoProps(props, p),
      musculos: [['isquios', 'Isquiotibiales'], ['gluteo', 'Glúteo mayor'], ['erectores', 'Erectores de la columna'], ['dorsal', 'Dorsal']],
    }
  },
}

// ── PRESS DE HOMBROS ─────────────────────────────────────────────────────────
const pressHombros: Movimiento = {
  id: 'press_hombros', nombre: 'Press de hombros',
  params: [
    { id: 'posicion', nombre: 'Posición', opciones: [['de_pie', 'De pie'], ['sentado', 'Sentado con respaldo']] },
    { id: 'carga', nombre: 'Carga', opciones: [['mancuernas', 'Mancuernas'], ['barra', 'Barra'], ['kettlebell', 'Kettlebell']] },
    { id: 'brazos', nombre: 'Brazos', opciones: [['dos', 'Los dos'], ['una', 'A una mano'], ['alterno', 'Alternos']] },
    LADO,
  ],
  crear(p) {
    const carga = p.carga || 'mancuernas', brazos = p.brazos || 'dos'
    const abajoB = (s: 'D' | 'I'): Pose => carga === 'barra'
      ? { ['brazo' + s]: [-60, 0, (s === 'D' ? 1 : -1) * 40], ['antebrazo' + s]: [-130, 0, 0] }
      : { ['brazo' + s]: [-18, 0, (s === 'D' ? 1 : -1) * 84], ['antebrazo' + s]: [0, 0, (s === 'D' ? 1 : -1) * 96] }
    const arribaB = (s: 'D' | 'I'): Pose => carga === 'barra'
      ? { ['brazo' + s]: [-168, 0, (s === 'D' ? 1 : -1) * 18], ['antebrazo' + s]: [-6, 0, 0] }
      : { ['brazo' + s]: [-6, 0, (s === 'D' ? 1 : -1) * 168], ['antebrazo' + s]: [0, 0, (s === 'D' ? 1 : -1) * 8] }
    const sentado: Pose = p.posicion === 'sentado' ? une(sim('muslo', [-88, 0, 10]), sim('pierna', [84, 0, 0])) : {}
    const libre: Pose = { brazoI: [-8, 0, -22], antebrazoI: [-50, 0, 0] }       // a una mano: la otra en la cadera
    let claves: Clave[]
    if (brazos === 'alterno') {
      claves = [
        { t: 0, fase: '⬆️ Sube un brazo', p: une(sentado, abajoB('D'), abajoB('I')) },
        { t: .22, p: une(sentado, arribaB('D'), abajoB('I')) },
        { t: .5, fase: '⬆️ Ahora el otro', p: une(sentado, abajoB('D'), abajoB('I')) },
        { t: .72, p: une(sentado, abajoB('D'), arribaB('I')) },
        { t: 1, p: une(sentado, abajoB('D'), abajoB('I')) },
      ]
    } else {
      const ab = une(sentado, abajoB('D'), brazos === 'una' ? libre : abajoB('I'))
      const ar = une(sentado, arribaB('D'), brazos === 'una' ? libre : arribaB('I'))
      claves = [{ t: 0, fase: '⬆️ Empuja hacia arriba', p: ab }, { t: .4, fase: '⬇️ Baja despacio hasta las orejas', p: ar }, { t: .52, fase: '⬇️ Baja despacio hasta las orejas', p: ar }, { t: 1, p: ab }]
    }
    const props: Prop[] = carga === 'barra' ? [{ tipo: 'barra', entre: ['manoD', 'manoI'] }]
      : carga === 'kettlebell' ? [{ tipo: 'kettlebell', en: 'manoD', off: [0, -2, -3] }, ...(brazos === 'una' ? [] : [{ tipo: 'kettlebell', en: 'manoI', off: [0, -2, -3] } as Prop])]
      : [{ tipo: 'mancuerna', en: 'manoD' }, ...(brazos === 'una' ? [] : [{ tipo: 'mancuerna', en: 'manoI' } as Prop])]
    if (p.posicion === 'sentado') props.push({ tipo: 'silla', bajo: 'cadera', clave: 0, hueco: 8, off: [0, 0, 3] })
    return {
      dur: brazos === 'alterno' ? 4.4 : 3, claves: conLado(claves, p), apoyo: p.posicion === 'sentado' ? PIES_SENTADO : { a: ['pieD', 'pieI'] },
      cam: { alto: 8, dist: 255, y: p.posicion === 'sentado' ? 40 : 50 }, props: conLadoProps(props, p),
      musculos: [['deltoides', 'Deltoides'], ['triceps', 'Tríceps'], ['trapecio', 'Trapecio'], ['core', 'Core']],
    }
  },
}

// ── PUENTE DE GLÚTEO / HIP THRUST ────────────────────────────────────────────
const puente: Movimiento = {
  id: 'puente', nombre: 'Puente de glúteo',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['suelo', 'En el suelo'], ['hip_thrust', 'Hip thrust (espalda en banco)'], ['pies_elevados', 'Con pies elevados'], ['talones', 'Sobre talones']] },
    { id: 'piernas', nombre: 'Piernas', opciones: [['dos', 'Las dos'], ['una', 'A una pierna']] },
    { id: 'carga', nombre: 'Carga', opciones: [['ninguna', 'Sin carga'], ['barra', 'Barra en la cadera'], ['disco', 'Disco en la cadera']] },
    { id: 'banda', nombre: 'Banda en rodillas', opciones: [['no', 'No'], ['si', 'Sí'], ['aperturas', 'Sí, con aperturas']] },
    { id: 'ritmo', nombre: 'Ritmo', opciones: [['dinamico', 'Subir y bajar'], ['estatico', 'Aguantar arriba']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'suelo', una = p.piernas === 'una', ht = tipo === 'hip_thrust'
    const base: Pose = { raiz: [-90, 0, 0], ...sim('brazo', [0, 0, 12]) }
    let ab: Pose = une(base, sim('muslo', [-62, 0, 4]), sim('pierna', [112, 0, 0]), sim('pie', [40, 0, 0]))
    let ar: Pose = une(base, sim('muslo', [-14, 0, 4]), sim('pierna', [100, 0, 0]), sim('pie', [4, 0, 0]))
    if (ht) {
      ab = une(base, sim('muslo', [-80, 0, 6]), sim('pierna', [100, 0, 0]), sim('pie', [70, 0, 0]), sim('brazo', [-30, 0, 30]))
      ar = une(base, sim('muslo', [-6, 0, 6]), sim('pierna', [92, 0, 0]), sim('pie', [4, 0, 0]), sim('brazo', [-10, 0, 30]))
    }
    if (tipo === 'pies_elevados') { ab = une(ab, sim('muslo', [-52, 0, 4]), sim('pierna', [96, 0, 0]), sim('pie', [30, 0, 0])); ar = une(ar, sim('muslo', [-2, 0, 4]), sim('pierna', [70, 0, 0]), sim('pie', [-10, 0, 0])) }
    if (tipo === 'talones') { ab = une(ab, sim('pie', [-10, 0, 0])); ar = une(ar, sim('pie', [-40, 0, 0])) }
    if (una) {
      // La libre, estirada en la línea del muslo de apoyo.
      ab = une(ab, { musloI: [-70, 0, -2], piernaI: [0, 0, 0], pieI: [0, 0, 0] })
      ar = une(ar, { musloI: [ar.musloD[0], 0, -2], piernaI: [0, 0, 0], pieI: [0, 0, 0] })
    }
    let claves: Clave[]
    if (p.ritmo === 'estatico') claves = aguanta(ar, '⏸️ Aguanta arriba apretando glúteos')
    else if (p.banda === 'aperturas') {
      const abre = une(ar, sim('muslo', [ar.musloD[0], 0, 26]))
      claves = [{ t: 0, fase: '⬆️ Eleva la cadera', p: ab }, { t: .3, fase: '↔️ Abre las rodillas contra la banda', p: ar }, { t: .45, p: abre }, { t: .6, p: ar }, { t: .75, p: abre }, { t: .88, fase: '⬇️ Baja despacio', p: ar }, { t: 1, p: ab }]
    } else claves = rep(ab, ar, '⬆️ Eleva la cadera', '⏸️ Aprieta glúteos y baja', .17)
    const props: Prop[] = []
    const pies = una ? ['pieD'] : ['pieD', 'pieI']
    let apoyo: Apoyo = { a: pies, aY: 4, b: ['brazoD', 'brazoI'], bY: 3.2 }
    if (ht) { apoyo = { a: pies, aY: 4, b: ['brazoD', 'brazoI'], bY: 25 }; props.push({ tipo: 'banco', bajo: 'pecho', clave: 1, hueco: 9, rot: [0, 90, 0] }) }
    if (tipo === 'pies_elevados') { apoyo = { a: pies, aY: 26, b: ['brazoD', 'brazoI'], bY: 3.2 }; props.push({ tipo: 'banco', bajo: 'pieD', clave: 0, hueco: 4, off: [-4, 0, 0], rot: [0, 90, 0] }) }
    if (p.carga === 'barra') props.push({ tipo: 'barra', en: 'cadera', off: [0, -2, 9] })
    if (p.carga === 'disco') props.push({ tipo: 'disco', en: 'cadera', off: [0, -2, 9], rot: [90, 0, 0] })
    if (p.banda && p.banda !== 'no') props.push({ tipo: 'banda', entre: ['piernaD', 'piernaI'], off: [0, 3, 0] })
    return {
      dur: p.banda === 'aperturas' ? 5 : 3.4, claves: conLado(claves, p), apoyo: { ...apoyo, a: conLadoH(apoyo.a, p) },
      suelo: true, cam: { alto: 30, dist: 200, y: 10 }, props: conLadoProps(props, p),
      musculos: [['gluteo', 'Glúteo mayor'], ['isquios', 'Isquiotibiales'], ['erectores', 'Erectores'], ['core', 'Core']],
    }
  },
}

// ── BIRD-DOG ─────────────────────────────────────────────────────────────────
const birdDog: Movimiento = {
  id: 'bird_dog', nombre: 'Bird-dog',
  params: [{ id: 'tipo', nombre: 'Qué se estira', opciones: [['completo', 'Brazo y pierna contrarios'], ['brazo', 'Solo el brazo'], ['pierna', 'Solo la pierna']] }, LADO],
  crear(p) {
    const tipo = p.tipo || 'completo'
    const cuatro: Pose = une({ raiz: [90, 0, 0] }, sim('muslo', [-90, 0, 0]), sim('pierna', [90, 0, 0]), sim('pie', [80, 0, 0]), sim('brazo', [-90, 0, 0]), sim('mano', [-90, 0, 0]))
    const estira: Pose = { ...cuatro }
    if (tipo !== 'pierna') Object.assign(estira, { brazoD: [-178, 0, 0], manoD: [0, 0, 0] })
    if (tipo !== 'brazo') Object.assign(estira, { musloI: [0, 0, 0], piernaI: [0, 0, 0], pieI: [20, 0, 0] })
    const claves = rep(cuatro, estira, tipo === 'brazo' ? '➡️ Estira el brazo' : tipo === 'pierna' ? '➡️ Estira la pierna' : '➡️ Estira brazo y pierna contrarios', '⏸️ Aguanta sin mover la espalda', .2)
    return {
      dur: 4, claves: conLado(claves, p), suelo: true, cam: { alto: 28, dist: 200, y: 14 },
      apoyo: { a: conLadoH(['piernaD'], p), aY: 2.6, b: conLadoH(['manoI'], p), bY: 2.2 },
      musculos: [['core', 'Core'], ['erectores', 'Multífidos y erectores'], ['gluteo', 'Glúteo mayor'], ['deltoides', 'Deltoides']],
    }
  },
}

// ════════════════════════════════════════════════════════════════════════════
// MÁS MOVIMIENTOS (noviembre 2026). Los que más ejercicios de la biblioteca cubren.
// Misma convención de ángulos que arriba. Truco de las piernas de pie: para que el
// pie quede plano, raiz + muslo + pierna + pie ≈ 0 (en x).
// 'alto' no es un hueso: sube o baja todo el cuerpo (talones, saltos). Ver motor.
// ════════════════════════════════════════════════════════════════════════════
const CAM_PIE = { alto: 8, dist: 250, y: 45 }
const DOS_PIES: Apoyo = { a: ['pieD', 'pieI'] }
/** Sentado: sin aY, los pies se quedaban a la altura que tenían de pie (flotando). */
const PIES_SENTADO: Apoyo = { a: ['pieD', 'pieI'], aY: 3.8 }
const MANCUERNAS: Prop[] = [{ tipo: 'mancuerna', en: 'manoD' }, { tipo: 'mancuerna', en: 'manoI' }]
const SENTADO: Pose = une(sim('muslo', [-88, 0, 10]), sim('pierna', [84, 0, 0]))
const SILLA: Prop = { tipo: 'silla', bajo: 'cadera', clave: 0, hueco: 8, off: [0, 0, 3] }
/** Inclinado hacia delante con las rodillas algo dobladas (remo, pájaro). */
const inclinado = (inc: number): Pose => une({ raiz: [inc, 0, 0], cabeza: [-inc * .5, 0, 0] }, sim('muslo', [-inc - 10, 0, 4]), sim('pierna', [18, 0, 0]), sim('pie', [-8, 0, 0]))
/** Tumbado boca arriba en un banco plano, pies en el suelo. */
const EN_BANCO: Pose = une({ raiz: [-90, 0, 0] }, sim('muslo', [30, 0, 10]), sim('pierna', [60, 0, 0]))
const APOYO_BANCO: Apoyo = { a: ['pieD', 'pieI'], aY: 4, b: ['pecho'], bY: 32 }
const BANCO_ESPALDA: Prop = { tipo: 'banco', bajo: 'pecho', clave: 0, hueco: 9, off: [0, 0, -8], rot: [0, 90, 0] }
/** A cuatro patas: rodillas bajo la cadera, manos bajo los hombros. */
const CUATRO: Pose = une({ raiz: [90, 0, 0] }, sim('muslo', [-90, 0, 0]), sim('pierna', [90, 0, 0]), sim('pie', [80, 0, 0]), sim('brazo', [-90, 0, 0]), sim('mano', [-90, 0, 0]))
/** Plancha: el cuerpo recto boca abajo. */
const PLANCHA: Pose = { raiz: [90, 0, 0], cabeza: [-10, 0, 0] }
/** Tumbado boca arriba con las rodillas dobladas (crunch, puente). */
const SUPINO_RODILLAS: Pose = une({ raiz: [-90, 0, 0] }, sim('muslo', [-30, 0, 6]), sim('pierna', [130, 0, 0]), sim('pie', [-10, 0, 0]))
/** Alternar brazos: la clave de un brazo, la del otro y vuelta. */
function alterna(base: Pose, d: Pose, i: Pose, f1: string, f2: string): Clave[] {
  return [{ t: 0, fase: f1, p: base }, { t: .22, p: une(base, d) }, { t: .5, fase: f2, p: base }, { t: .72, p: une(base, i) }, { t: 1, p: base }]
}

// ── REMO ─────────────────────────────────────────────────────────────────────
const remo: Movimiento = {
  id: 'remo', nombre: 'Remo',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['barra', 'Con barra, inclinado'], ['mancuernas', 'Con mancuernas, inclinado'], ['una_mano', 'A una mano apoyado en banco'], ['polea', 'En polea o con banda, de pie']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'barra'
    let claves: Clave[], props: Prop[] = []
    if (tipo === 'polea') {
      const piernas = une(sim('muslo', [-12, 0, 4]), sim('pierna', [14, 0, 0]), sim('pie', [-2, 0, 0]))
      claves = rep(une(piernas, sim('brazo', [-82, 0, 6])), une(piernas, sim('brazo', [18, 0, 12]), sim('antebrazo', [-96, 0, 0]), { pecho: [-6, 0, 0] }),
        '⬅️ Tira con los codos pegados', '➡️ Estira despacio', .12)
    } else {
      const inc = tipo === 'una_mano' ? 60 : 45, base = inclinado(inc), ancho = tipo === 'barra' ? 12 : 6
      const cuelga = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-inc + 2, 0, (s === 'D' ? 1 : -1) * ancho] })
      const tira = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-inc + 72, 0, (s === 'D' ? 1 : -1) * (ancho + 4)], ['antebrazo' + s]: [-72, 0, 0] })
      if (tipo === 'una_mano') {
        const apoya: Pose = { brazoI: [-inc + 2, 0, -4] }
        claves = rep(une(base, cuelga('D'), apoya), une(base, tira('D'), apoya), '⬆️ Lleva el codo hacia la cadera', '⬇️ Baja estirando el brazo')
        props = [{ tipo: 'mancuerna', en: 'manoD' }, { tipo: 'banco', bajo: 'manoI', clave: 0, hueco: 2, off: [0, 0, -10] }]
      } else {
        claves = rep(une(base, cuelga('D'), cuelga('I')), une(base, tira('D'), tira('I')), '⬆️ Tira hacia el ombligo, espalda recta', '⬇️ Baja controlando')
        props = tipo === 'barra' ? [{ tipo: 'barra', entre: ['manoD', 'manoI'] }] : [...MANCUERNAS]
      }
    }
    return {
      dur: 3.2, claves: conLado(claves, p), apoyo: DOS_PIES, cam: CAM_PIE, props: conLadoProps(props, p),
      musculos: [['dorsal', 'Dorsal'], ['trapecio', 'Trapecio y romboides'], ['biceps', 'Bíceps'], ['erectores', 'Erectores']],
    }
  },
}

// ── CURL DE BÍCEPS ───────────────────────────────────────────────────────────
const curl: Movimiento = {
  id: 'curl', nombre: 'Curl de bíceps',
  params: [
    { id: 'carga', nombre: 'Carga', opciones: [['mancuernas', 'Mancuernas'], ['barra', 'Barra'], ['polea', 'Polea o banda']] },
    { id: 'brazos', nombre: 'Brazos', opciones: [['dos', 'Los dos'], ['alterno', 'Alternos'], ['una', 'A una mano']] },
    { id: 'posicion', nombre: 'Posición', opciones: [['de_pie', 'De pie'], ['sentado', 'Sentado']] },
    LADO,
  ],
  crear(p) {
    const carga = p.carga || 'mancuernas', brazos = p.brazos || 'dos', sentado = p.posicion === 'sentado'
    const z = carga === 'barra' ? 10 : 5
    const ab = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-4, 0, (s === 'D' ? 1 : -1) * z], ['antebrazo' + s]: [-6, 0, 0] })
    const ar = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-14, 0, (s === 'D' ? 1 : -1) * z], ['antebrazo' + s]: [-138, 0, 0] })
    const piernas = sentado ? SENTADO : {}
    const libre: Pose = { brazoI: [-8, 0, -22], antebrazoI: [-50, 0, 0] }
    let claves: Clave[]
    if (brazos === 'alterno') claves = alterna(une(piernas, ab('D'), ab('I')), ar('D'), ar('I'), '⬆️ Sube un brazo sin mover el codo', '⬆️ Ahora el otro')
    else claves = rep(une(piernas, ab('D'), brazos === 'una' ? libre : ab('I')), une(piernas, ar('D'), brazos === 'una' ? libre : ar('I')), '⬆️ Sube sin mover los codos', '⬇️ Baja despacio')
    const props: Prop[] = carga === 'barra' ? [{ tipo: 'barra', entre: ['manoD', 'manoI'] }]
      : carga === 'polea' ? [] : brazos === 'una' ? [{ tipo: 'mancuerna', en: 'manoD' }] : [...MANCUERNAS]
    if (sentado) props.push(SILLA)
    return {
      dur: brazos === 'alterno' ? 4.2 : 3, claves: conLado(claves, p), apoyo: sentado ? PIES_SENTADO : DOS_PIES, cam: { ...CAM_PIE, y: sentado ? 38 : 45 }, props: conLadoProps(props, p),
      musculos: [['biceps', 'Bíceps'], ['deltoides', 'Deltoides anterior']],
    }
  },
}

// ── ELEVACIÓN DE TALONES ─────────────────────────────────────────────────────
const talones: Movimiento = {
  id: 'talones', nombre: 'Elevación de talones',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['suelo', 'En el suelo'], ['escalon', 'En un escalón (baja el talón)']] },
    { id: 'piernas', nombre: 'Piernas', opciones: [['dos', 'Las dos'], ['una', 'A una pierna']] },
    { id: 'carga', nombre: 'Carga', opciones: [['ninguna', 'Sin peso'], ['mancuernas', 'Mancuernas']] },
    LADO,
  ],
  crear(p) {
    const esc = p.tipo === 'escalon', una = p.piernas === 'una'
    const brazos: Pose = p.carga === 'mancuernas' ? sim('brazo', [0, 0, 6]) : sim('brazo', [-4, 0, 10])
    const libre: Pose = una ? { musloI: [10, 0, -2], piernaI: [70, 0, 0], pieI: [10, 0, 0] } : {}
    const pies = (a: number): Pose => una ? { pieD: [a, 0, 0] } : sim('pie', [a, 0, 0])
    const arriba = une(brazos, libre, pies(esc ? 34 : 30), { alto: [esc ? 8 : 7, 0, 0] })
    const abajo = une(brazos, libre, pies(esc ? -14 : 0), { alto: [esc ? -3 : 0, 0, 0] })
    const props: Prop[] = p.carga === 'mancuernas' ? (una ? [{ tipo: 'mancuerna', en: 'manoD' }] : [...MANCUERNAS]) : []
    if (esc) props.push({ tipo: 'cajon', bajo: 'pieD', clave: 0, hueco: 4, alto: 12, ancho: 60, off: una ? [-4, 0, 6] : [-7, 0, 6] })
    return {
      dur: 3, claves: conLado(rep(abajo, arriba, '⬆️ Sube de puntillas', '⬇️ Baja despacio' + (esc ? ' por debajo del escalón' : ''), .15), p),
      apoyo: { a: una ? conLadoH(['pieD'], p) : ['pieD', 'pieI'], aY: esc ? 16 : undefined },
      cam: CAM_PIE, props: conLadoProps(props, p),
      musculos: [['gemelos', 'Gemelos y sóleo']],
    }
  },
}

// ── ELEVACIÓN LATERAL / FRONTAL ──────────────────────────────────────────────
const elevacionBrazos: Movimiento = {
  id: 'elevacion_brazos', nombre: 'Elevación lateral o frontal',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['lateral', 'Lateral'], ['frontal', 'Frontal']] },
    { id: 'brazos', nombre: 'Brazos', opciones: [['dos', 'Los dos'], ['alterno', 'Alternos']] },
    { id: 'carga', nombre: 'Carga', opciones: [['mancuernas', 'Mancuernas'], ['disco', 'Un disco con las dos manos'], ['banda', 'Banda']] },
    { id: 'posicion', nombre: 'Posición', opciones: [['de_pie', 'De pie'], ['sentado', 'Sentado']] },
    LADO,
  ],
  crear(p) {
    const lat = (p.tipo || 'lateral') === 'lateral', disco = !lat && p.carga === 'disco', sentado = p.posicion === 'sentado'
    const ab = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [disco ? -10 : 0, 0, (s === 'D' ? 1 : -1) * (disco ? -6 : 8)], ['antebrazo' + s]: [-8, 0, 0] })
    const ar = (s: 'D' | 'I'): Pose => lat
      ? { ['brazo' + s]: [-4, 0, (s === 'D' ? 1 : -1) * 86], ['antebrazo' + s]: [-10, 0, 0] }
      : { ['brazo' + s]: [-90, 0, (s === 'D' ? 1 : -1) * (disco ? -8 : 6)], ['antebrazo' + s]: [-4, 0, 0] }
    const piernas = sentado ? SENTADO : {}
    const claves = p.brazos === 'alterno' && !disco
      ? alterna(une(piernas, ab('D'), ab('I')), ar('D'), ar('I'), '⬆️ Sube un brazo hasta el hombro', '⬆️ Ahora el otro')
      : rep(une(piernas, ab('D'), ab('I')), une(piernas, ar('D'), ar('I')), '⬆️ Sube hasta la altura del hombro', '⬇️ Baja despacio')
    const props: Prop[] = disco ? [{ tipo: 'disco', entre: ['manoD', 'manoI'], rot: [0, 90, 0] }] : p.carga === 'banda' ? [] : [...MANCUERNAS]
    if (sentado) props.push(SILLA)
    return {
      dur: p.brazos === 'alterno' ? 4.2 : 3.2, claves: conLado(claves, p), apoyo: sentado ? PIES_SENTADO : DOS_PIES, cam: { ...CAM_PIE, y: sentado ? 40 : 48 }, props: conLadoProps(props, p),
      musculos: [['deltoides', 'Deltoides'], ['trapecio', 'Trapecio']],
    }
  },
}

// ── EXTENSIÓN DE TRÍCEPS ─────────────────────────────────────────────────────
const triceps: Movimiento = {
  id: 'triceps', nombre: 'Extensión de tríceps',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['cabeza', 'Sobre la cabeza'], ['polea', 'En polea o banda (hacia abajo)'], ['frances', 'Press francés tumbado']] },
    { id: 'brazos', nombre: 'Brazos', opciones: [['dos', 'Los dos'], ['una', 'A una mano']] },
    { id: 'posicion', nombre: 'Posición', opciones: [['de_pie', 'De pie'], ['sentado', 'Sentado']] },
    LADO,
  ],
  crear(p) {
    const tipo = p.tipo || 'cabeza', una = p.brazos === 'una', sentado = p.posicion === 'sentado' && tipo === 'cabeza'
    const libre: Pose = { brazoI: [-8, 0, -22], antebrazoI: [-50, 0, 0] }
    let claves: Clave[], props: Prop[] = [], apoyo = DOS_PIES, cam = CAM_PIE, suelo = false
    if (tipo === 'frances') {
      const ab = une(EN_BANCO, sim('brazo', [-112, 0, 6]), sim('antebrazo', [-120, 0, 0]))
      const ar = une(EN_BANCO, sim('brazo', [-100, 0, 6]), sim('antebrazo', [-4, 0, 0]))
      claves = rep(ab, ar, '⬆️ Estira los codos sin moverlos', '⬇️ Baja hacia la frente')
      props = [BANCO_ESPALDA, { tipo: 'barra', entre: ['manoD', 'manoI'] }]
      apoyo = APOYO_BANCO; cam = { alto: 28, dist: 230, y: 28 }
    } else if (tipo === 'polea') {
      const ab = une(sim('brazo', [-14, 0, 4]), sim('antebrazo', [-100, 0, 0]), una ? libre : {})
      const ar = une(sim('brazo', [-8, 0, 4]), sim('antebrazo', [-4, 0, 0]), una ? libre : {})
      claves = rep(ab, ar, '⬇️ Empuja hacia abajo con los codos pegados', '⬆️ Sube despacio hasta 90°')
    } else {
      const piernas = sentado ? SENTADO : {}
      const s = (z: number): Pose => una ? { brazoD: [-168, 0, z], ...libre } : sim('brazo', [-168, 0, z])
      const ab = une(piernas, s(4), una ? { antebrazoD: [-135, 0, 0] } : sim('antebrazo', [-135, 0, 0]))
      const ar = une(piernas, s(4), una ? { antebrazoD: [-8, 0, 0] } : sim('antebrazo', [-8, 0, 0]))
      claves = rep(ab, ar, '⬆️ Estira hacia el techo', '⬇️ Baja detrás de la cabeza')
      props = una ? [{ tipo: 'mancuerna', en: 'manoD' }] : [{ tipo: 'mancuerna', entre: ['manoD', 'manoI'], rot: [90, 0, 0] }]
      if (sentado) { props.push(SILLA); apoyo = PIES_SENTADO }
    }
    return {
      dur: 3, claves: conLado(claves, p), apoyo, cam, suelo, props: conLadoProps(props, p),
      musculos: [['triceps', 'Tríceps']],
    }
  },
}

// ── PRESS DE BANCA ───────────────────────────────────────────────────────────
const pressBanca: Movimiento = {
  id: 'press_banca', nombre: 'Press de banca',
  params: [
    { id: 'carga', nombre: 'Carga', opciones: [['barra', 'Barra'], ['mancuernas', 'Mancuernas']] },
    { id: 'brazos', nombre: 'Brazos', opciones: [['dos', 'Los dos'], ['alterno', 'Alternos']] },
  ],
  crear(p) {
    const barra = (p.carga || 'barra') === 'barra'
    const ab = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-6, 0, (s === 'D' ? 1 : -1) * 72], ['antebrazo' + s]: [-90, 0, 0] })
    const ar = (s: 'D' | 'I'): Pose => ({ ['brazo' + s]: [-90, 0, (s === 'D' ? 1 : -1) * (barra ? 14 : 6)], ['antebrazo' + s]: [-2, 0, 0] })
    const claves = p.brazos === 'alterno'
      ? alterna(une(EN_BANCO, ab('D'), ab('I')), ar('D'), ar('I'), '⬆️ Empuja un brazo', '⬆️ Ahora el otro')
      : rep(une(EN_BANCO, ar('D'), ar('I')), une(EN_BANCO, ab('D'), ab('I')), '⬇️ Baja hasta el pecho', '⬆️ Empuja hacia el techo')
    return {
      dur: p.brazos === 'alterno' ? 4.2 : 3.2, claves, apoyo: APOYO_BANCO, cam: { alto: 30, dist: 230, y: 28 },
      props: [BANCO_ESPALDA, ...(barra ? [{ tipo: 'barra', entre: ['manoD', 'manoI'] } as Prop] : MANCUERNAS)],
      musculos: [['pectoral', 'Pectoral'], ['triceps', 'Tríceps'], ['deltoides', 'Deltoides anterior']],
    }
  },
}

// ── PLANCHA FRONTAL ──────────────────────────────────────────────────────────
const planchaFrontal: Movimiento = {
  id: 'plancha', nombre: 'Plancha frontal',
  params: [
    { id: 'tipo', nombre: 'Apoyo', opciones: [['antebrazos', 'Sobre los antebrazos'], ['manos', 'Sobre las manos'], ['rodillas', 'Con las rodillas apoyadas']] },
    { id: 'toques', nombre: 'Toques de hombro', opciones: [['no', 'No'], ['si', 'Sí']] },
  ],
  crear(p) {
    const tipo = p.tipo || 'antebrazos', toques = p.toques === 'si'
    const manos = tipo === 'manos' || toques
    const brazos: Pose = manos ? une(sim('brazo', [-90, 0, 4]), sim('mano', [-90, 0, 0])) : une(sim('brazo', [-90, 0, 4]), sim('antebrazo', [-90, 0, 0]))
    const piernas: Pose = tipo === 'rodillas' ? sim('pierna', [90, 0, 0]) : {}
    const base = une(PLANCHA, brazos, piernas)
    const claves = toques
      ? alterna(base, { brazoD: [-40, 0, -40], antebrazoD: [-120, 0, 0], manoD: [0, 0, 0] }, { brazoI: [-40, 0, 40], antebrazoI: [-120, 0, 0], manoI: [0, 0, 0] }, '✋ Toca el hombro contrario sin mover la cadera', '✋ Ahora con la otra mano')
      : aguanta(base, '⏸️ Aguanta con el cuerpo recto')
    const a = tipo === 'rodillas' ? ['piernaD', 'piernaI'] : ['pieD', 'pieI']
    return {
      dur: toques ? 4 : 4, claves, suelo: true, cam: { alto: 22, dist: 230, y: 14 },
      apoyo: { a, aY: tipo === 'rodillas' ? 3 : 9, b: manos ? ['manoD', 'manoI'] : ['antebrazoD', 'antebrazoI'], bY: manos ? 2.2 : 3 },
      musculos: [['core', 'Core'], ['deltoides', 'Deltoides'], ['pectoral', 'Pectoral'], ['cuadriceps', 'Cuádriceps']],
    }
  },
}

// ── PLANCHA LATERAL ──────────────────────────────────────────────────────────
const planchaLateral: Movimiento = {
  id: 'plancha_lateral', nombre: 'Plancha lateral',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['estatica', 'Aguantar'], ['elevacion', 'Bajar y subir la cadera']] },
    { id: 'rodillas', nombre: 'Rodillas apoyadas', opciones: [['no', 'No'], ['si', 'Sí']] },
    LADO,
  ],
  crear(p) {
    const rod = p.rodillas === 'si'
    // De costado sobre el lado D: girar sobre su eje (y) y tumbar (x). El apoyo inclina lo justo.
    const base: Pose = une({ raiz: [-80, 90, 0], brazoD: [0, 0, 88], antebrazoD: [-90, 0, 0], brazoI: [0, 0, -14], antebrazoI: [-40, 0, 0] },
      rod ? sim('pierna', [90, 0, 0]) : {}, rod ? sim('muslo', [-20, 0, 0]) : {})
    const baja = une(base, { lumbar: [0, 0, 14] })
    const claves = p.tipo === 'elevacion' ? rep(base, baja, '⬇️ Baja la cadera', '⬆️ Súbela hasta alinear', .1) : aguanta(base, '⏸️ Cadera arriba, cuerpo en línea')
    const lado = ladoDe(p)
    return {
      dur: p.tipo === 'elevacion' ? 3.4 : 4, claves: conLado(claves, p), suelo: true, cam: { alto: 14, dist: 230, y: 14 },
      apoyo: { a: rod ? conLadoH(['piernaD'], p) : conLadoH(['pieD'], p), aY: 4, b: lado === 'I' ? ['antebrazoI'] : ['antebrazoD'], bY: 3 },
      musculos: [['core', 'Oblicuos y core'], ['gluteo', 'Glúteo'], ['deltoides', 'Deltoides']],
    }
  },
}

// ── CRUNCH ───────────────────────────────────────────────────────────────────
const crunch: Movimiento = {
  id: 'crunch', nombre: 'Crunch abdominal',
  params: [{ id: 'manos', nombre: 'Manos', opciones: [['nuca', 'En la nuca'], ['pecho', 'Cruzadas al pecho'], ['rodillas', 'Hacia las rodillas']] }],
  crear(p) {
    const manos = p.manos || 'nuca'
    const br: Pose = manos === 'nuca' ? CARGAS.manos_nuca.brazos(0) : manos === 'pecho' ? une(sim('brazo', [-28, 0, -16]), sim('antebrazo', [-100, 0, -62])) : sim('brazo', [-40, 0, 8])
    const ab = une(SUPINO_RODILLAS, br, { cabeza: [6, 0, 0] })
    const ar = une(SUPINO_RODILLAS, br, { lumbar: [20, 0, 0], pecho: [18, 0, 0], cabeza: [14, 0, 0] }, manos === 'rodillas' ? sim('brazo', [-60, 0, 8]) : {})
    return {
      dur: 2.8, claves: rep(ab, ar, '⬆️ Despega los hombros, ombligo dentro', '⬇️ Baja despacio'),
      suelo: true, cam: { alto: 24, dist: 210, y: 12 }, apoyo: { a: ['cadera'], aY: 9 },
      musculos: [['core', 'Recto abdominal']],
    }
  },
}

// ── SUBIDA AL CAJÓN ──────────────────────────────────────────────────────────
const subidaCajon: Movimiento = {
  id: 'subida_cajon', nombre: 'Subida al cajón',
  params: [{ id: 'carga', nombre: 'Carga', opciones: [['ninguna', 'Sin peso'], ['mancuernas', 'Mancuernas']] }, LADO],
  crear(p) {
    const br: Pose = p.carga === 'mancuernas' ? sim('brazo', [0, 0, 6]) : sim('brazo', [0, 0, 10])
    const abajo = une(br, { raiz: [10, 0, 0], musloD: [-80, 0, 3], piernaD: [70, 0, 0], musloI: [-2, 0, -3], piernaI: [6, 0, 0], pieI: [-14, 0, 0] })
    const arriba = une(br, { musloI: [-70, 0, -3], piernaI: [80, 0, 0], pieI: [10, 0, 0] })
    const claves: Clave[] = [
      { t: 0, fase: '⬆️ Sube empujando con el pie del cajón', p: abajo }, { t: .42, p: arriba },
      { t: .55, fase: '⬇️ Baja despacio', p: arriba }, { t: 1, p: abajo },
    ]
    const props: Prop[] = [{ tipo: 'cajon', bajo: 'pieD', clave: 0, hueco: 4, alto: 15, ancho: 40, off: [0, 0, 4] }, ...(p.carga === 'mancuernas' ? MANCUERNAS : [])]
    return {
      dur: 3.6, claves: conLado(claves, p), apoyo: { a: conLadoH(['pieD'], p) }, cam: CAM_PIE, props: conLadoProps(props, p),
      musculos: [['cuadriceps', 'Cuádriceps'], ['gluteo', 'Glúteo mayor'], ['isquios', 'Isquiotibiales']],
    }
  },
}

// ── MARCHA LATERAL CON BANDA ─────────────────────────────────────────────────
const marchaLateral: Movimiento = {
  id: 'marcha_lateral', nombre: 'Marcha lateral con banda',
  params: [{ id: 'banda', nombre: 'Banda', opciones: [['rodillas', 'Encima de las rodillas'], ['tobillos', 'En los tobillos']] }, LADO],
  crear(p) {
    const base = une({ raiz: [14, 0, 0] }, sim('muslo', [-40, 0, 8]), sim('pierna', [44, 0, 0]), sim('pie', [-18, 0, 0]), sim('brazo', [-30, 0, 6]), sim('antebrazo', [-60, 0, 0]))
    const abre = une(base, { musloD: [-40, 0, 26], pieD: [-18, 0, -18] })
    return {
      dur: 2.6, claves: conLado(rep(base, abre, '↔️ Paso lateral contra la banda', '⬅️ Acerca el pie sin perder la tensión', .08), p),
      apoyo: { a: conLadoH(['pieI'], p) }, cam: { ...CAM_PIE, y: 36 },
      props: [{ tipo: 'banda', entre: p.banda === 'tobillos' ? ['pieD', 'pieI'] : ['piernaD', 'piernaI'], off: [0, p.banda === 'tobillos' ? 2 : 3, 0] }],
      musculos: [['gluteo', 'Glúteo medio y mayor'], ['cuadriceps', 'Cuádriceps']],
    }
  },
}

// ── FACE PULL / RETRACCIÓN ───────────────────────────────────────────────────
const facePull: Movimiento = {
  id: 'face_pull', nombre: 'Face pull',
  params: [],
  crear() {
    const ext = une(sim('brazo', [-88, 0, 8]), sim('antebrazo', [-4, 0, 0]))
    const tira = une(sim('brazo', [-90, 0, 84]), sim('antebrazo', [-90, 0, 0]))
    return {
      dur: 3.2, claves: rep(ext, tira, '⬅️ Tira hacia la cara abriendo los codos', '➡️ Estira despacio', .12), apoyo: DOS_PIES, cam: CAM_PIE,
      musculos: [['deltoides', 'Deltoides posterior'], ['trapecio', 'Trapecio y romboides']],
    }
  },
}

// ── ROTACIÓN EXTERNA / INTERNA DE HOMBRO ─────────────────────────────────────
const rotacionHombro: Movimiento = {
  id: 'rotacion_hombro', nombre: 'Rotación de hombro',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['externa', 'Externa'], ['interna', 'Interna']] },
    { id: 'posicion', nombre: 'Posición del brazo', opciones: [['pegado', 'Codo pegado al cuerpo'], ['a90', 'Brazo a 90° de abducción']] },
    LADO,
  ],
  crear(p) {
    const ext = (p.tipo || 'externa') === 'externa', a90 = p.posicion === 'a90'
    let ini: Pose, fin: Pose
    if (a90) { ini = { brazoD: [ext ? 0 : -60, 0, 88], antebrazoD: [-90, 0, 0] }; fin = { brazoD: [ext ? -80 : 60, 0, 88], antebrazoD: [-90, 0, 0] } }
    else { ini = { brazoD: [0, ext ? -10 : 40, 8], antebrazoD: [-90, 0, 0] }; fin = { brazoD: [0, ext ? 60 : -40, 8], antebrazoD: [-90, 0, 0] } }
    const otro: Pose = { brazoI: [0, 0, -8] }
    return {
      dur: 3, claves: conLado(rep(une(otro, ini), une(otro, fin), ext ? '↪️ Gira hacia fuera sin mover el codo' : '↩️ Gira hacia dentro sin mover el codo', '⬅️ Vuelve despacio', .1), p),
      apoyo: DOS_PIES, cam: { ...CAM_PIE, y: 50 },
      musculos: [['deltoides', 'Manguito rotador y deltoides']],
    }
  },
}

// ── ABDUCCIÓN / EXTENSIÓN DE CADERA DE PIE ───────────────────────────────────
const abduccionPie: Movimiento = {
  id: 'abduccion_pie', nombre: 'Abducción de cadera de pie',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['abduccion', 'Hacia el lado'], ['extension', 'Hacia atrás (patada)']] },
    { id: 'banda', nombre: 'Banda', opciones: [['no', 'Sin banda'], ['tobillos', 'En los tobillos'], ['rodillas', 'Sobre las rodillas']] },
    LADO,
  ],
  crear(p) {
    const ext = p.tipo === 'extension'
    const base: Pose = une(sim('brazo', [0, 0, 10]), { musloI: [-4, 0, -2], piernaI: [6, 0, 0], pieI: [-2, 0, 0] })
    const fin = une(base, ext ? { raiz: [10, 0, 0], musloD: [24, 0, 2], piernaD: [6, 0, 0] } : { musloD: [0, 0, 30], pieD: [0, 0, -6] })
    const props: Prop[] = p.banda === 'tobillos' ? [{ tipo: 'banda', entre: ['pieD', 'pieI'], off: [0, 2, 0] }] : p.banda === 'rodillas' ? [{ tipo: 'banda', entre: ['piernaD', 'piernaI'], off: [0, 3, 0] }] : []
    return {
      dur: 2.8, claves: conLado(rep(base, fin, ext ? '⬅️ Lleva la pierna atrás sin arquear' : '↔️ Abre la pierna sin inclinarte', '⬇️ Vuelve despacio'), p),
      apoyo: { a: conLadoH(['pieI'], p) }, cam: CAM_PIE, props: conLadoProps(props, p),
      musculos: [['gluteo', 'Glúteo medio y mayor'], ['core', 'Core']],
    }
  },
}

// ── FLEXIONES ────────────────────────────────────────────────────────────────
const flexiones: Movimiento = {
  id: 'flexiones', nombre: 'Flexiones',
  params: [{ id: 'rodillas', nombre: 'Rodillas apoyadas', opciones: [['no', 'No'], ['si', 'Sí']] }],
  crear(p) {
    const rod = p.rodillas === 'si'
    const piernas: Pose = rod ? sim('pierna', [90, 0, 0]) : {}
    const ar = une(PLANCHA, piernas, sim('brazo', [-86, 0, 12]), sim('mano', [-86, 0, 0]))
    const ab = une(PLANCHA, piernas, sim('brazo', [-10, 0, 50]), sim('antebrazo', [-84, 0, 0]), sim('mano', [-86, 0, 0]))
    return {
      dur: 3, claves: rep(ar, ab, '⬇️ Baja el pecho, cuerpo recto', '⬆️ Empuja el suelo'), suelo: true, cam: { alto: 18, dist: 230, y: 14 },
      apoyo: { a: rod ? ['piernaD', 'piernaI'] : ['pieD', 'pieI'], aY: rod ? 3 : 9, b: ['manoD', 'manoI'], bY: 2.2 },
      musculos: [['pectoral', 'Pectoral'], ['triceps', 'Tríceps'], ['deltoides', 'Deltoides anterior'], ['core', 'Core']],
    }
  },
}

// ── PÁJARO (APERTURAS INVERTIDAS) ────────────────────────────────────────────
const pajaro: Movimiento = {
  id: 'pajaro', nombre: 'Pájaro',
  params: [{ id: 'carga', nombre: 'Carga', opciones: [['mancuernas', 'Mancuernas'], ['banda', 'Banda']] }],
  crear(p) {
    const inc = 50, base = inclinado(inc)
    const ab = une(base, sim('brazo', [-inc + 2, 0, 6]), sim('antebrazo', [-14, 0, 0]))
    const ar = une(base, sim('brazo', [-inc, 0, 82]), sim('antebrazo', [-14, 0, 0]))
    return {
      dur: 3, claves: rep(ab, ar, '↔️ Abre los brazos juntando escápulas', '⬇️ Baja despacio'), apoyo: DOS_PIES, cam: CAM_PIE,
      props: p.carga === 'banda' ? [] : [...MANCUERNAS],
      musculos: [['deltoides', 'Deltoides posterior'], ['trapecio', 'Trapecio y romboides']],
    }
  },
}

// ── SWING CON KETTLEBELL ─────────────────────────────────────────────────────
const swing: Movimiento = {
  id: 'swing', nombre: 'Swing con kettlebell',
  params: [],
  crear() {
    const abajo = une({ raiz: [55, 0, 0], cabeza: [-30, 0, 0] }, sim('muslo', [-75, 0, 6]), sim('pierna', [28, 0, 0]), sim('pie', [-8, 0, 0]), sim('brazo', [-30, 0, -4]))
    const arriba = une(sim('brazo', [-90, 0, -4]))
    return {
      dur: 2.4, claves: [{ t: 0, fase: '💥 Empuja la cadera adelante', p: abajo }, { t: .42, p: arriba }, { t: .52, fase: '⬇️ Deja caer y cadera atrás', p: arriba }, { t: 1, p: abajo }],
      apoyo: DOS_PIES, cam: CAM_PIE, props: [{ tipo: 'kettlebell', entre: ['manoD', 'manoI'], off: [0, -5, 0] }],
      musculos: [['gluteo', 'Glúteo mayor'], ['isquios', 'Isquiotibiales'], ['erectores', 'Erectores'], ['core', 'Core']],
    }
  },
}

// ── GATO-CAMELLO ─────────────────────────────────────────────────────────────
const gatoCamello: Movimiento = {
  id: 'gato_camello', nombre: 'Gato-camello',
  params: [{ id: 'tipo', nombre: 'Tipo', opciones: [['completo', 'Redondear y arquear'], ['flexion', 'Solo redondear']] }],
  crear(p) {
    const gato = une(CUATRO, { lumbar: [18, 0, 0], pecho: [16, 0, 0], cabeza: [26, 0, 0] })
    const vaca = une(CUATRO, { lumbar: [-14, 0, 0], pecho: [-12, 0, 0], cabeza: [-26, 0, 0] })
    const claves = p.tipo === 'flexion' ? rep(CUATRO, gato, '⬆️ Redondea la espalda', '⬇️ Vuelve a neutra', .15)
      : [{ t: 0, fase: '⬆️ Redondea, mirada al ombligo', p: gato }, { t: .45, fase: '⬇️ Arquea, mirada al frente', p: vaca }, { t: 1, p: gato }]
    return {
      dur: 5, claves, suelo: true, cam: { alto: 18, dist: 210, y: 16 },
      apoyo: { a: ['piernaD', 'piernaI'], aY: 2.6, b: ['manoD', 'manoI'], bY: 2.2 },
      musculos: [['erectores', 'Erectores y multífidos'], ['core', 'Core']],
    }
  },
}

// ── ELEVACIÓN DE BRAZOS ASISTIDA (BASTÓN, PARED) ─────────────────────────────
const brazosAsistida: Movimiento = {
  id: 'brazos_asistida', nombre: 'Elevación de brazos asistida',
  params: [{ id: 'tipo', nombre: 'Tipo', opciones: [['baston', 'Con bastón'], ['pared', 'Deslizando en la pared']] }],
  crear(p) {
    if (p.tipo === 'pared') {
      const ab = une(sim('brazo', [-80, 0, 14]), sim('antebrazo', [-80, 0, 0]))
      const ar = une(sim('brazo', [-170, 0, 12]), sim('antebrazo', [-12, 0, 0]))
      return {
        dur: 4, claves: rep(ab, ar, '⬆️ Desliza los brazos hacia arriba', '⬇️ Baja despacio', .12), apoyo: DOS_PIES, cam: CAM_PIE,
        props: [{ tipo: 'pared', bajo: 'pieD', clave: 0, off: [-9, 0, 19], rot: [0, 180, 0] }],
        musculos: [['deltoides', 'Deltoides'], ['trapecio', 'Trapecio inferior']],
      }
    }
    const ab = une(sim('brazo', [-12, 0, 10]), sim('antebrazo', [-10, 0, 0]))
    const ar = une(sim('brazo', [-172, 0, 10]), sim('antebrazo', [-4, 0, 0]))
    return {
      dur: 4, claves: rep(ab, ar, '⬆️ Sube el bastón con los brazos estirados', '⬇️ Baja despacio', .12), apoyo: DOS_PIES, cam: CAM_PIE,
      props: [{ tipo: 'baston', entre: ['manoD', 'manoI'] }],
      musculos: [['deltoides', 'Deltoides'], ['trapecio', 'Trapecio']],
    }
  },
}

// ── MARCHA EN EL SITIO / PASEO DEL GRANJERO ──────────────────────────────────
const marcha: Movimiento = {
  id: 'marcha', nombre: 'Marcha',
  params: [{ id: 'carga', nombre: 'Carga', opciones: [['ninguna', 'Sin peso'], ['granjero', 'Paseo del granjero (mancuernas)']] }],
  crear(p) {
    const granjero = p.carga === 'granjero', k = granjero ? .6 : 1
    const brazo = (d: number, i: number): Pose => granjero ? sim('brazo', [0, 0, 6]) : { brazoD: [d, 0, 6], brazoI: [i, 0, -6], antebrazoD: [-30, 0, 0], antebrazoI: [-30, 0, 0] }
    const sube = (s: 'D' | 'I'): Pose => ({ ['muslo' + s]: [-50 * k, 0, 0], ['pierna' + s]: [70 * k, 0, 0], ['pie' + s]: [10, 0, 0] })
    return {
      dur: 2, claves: [
        { t: 0, fase: granjero ? '🚶 Camina erguido, hombros abajo' : '🚶 Sube las rodillas alternando', p: brazo(0, 0) },
        { t: .25, p: une(brazo(20, -25), sube('D')) }, { t: .5, p: brazo(0, 0) }, { t: .75, p: une(brazo(-25, 20), sube('I')) }, { t: 1, p: brazo(0, 0) },
      ],
      cam: CAM_PIE, props: granjero ? [...MANCUERNAS] : [],
      musculos: granjero ? [['trapecio', 'Trapecio'], ['core', 'Core'], ['gluteo', 'Glúteo']] : [['cuadriceps', 'Flexores de cadera y cuádriceps'], ['core', 'Core']],
    }
  },
}

// ── EQUILIBRIO A UNA PIERNA / ELEVACIÓN DE RODILLA ───────────────────────────
const unaPierna: Movimiento = {
  id: 'una_pierna', nombre: 'Equilibrio a una pierna',
  params: [{ id: 'tipo', nombre: 'Tipo', opciones: [['aguanta', 'Aguantar con la rodilla arriba'], ['rodilla', 'Subir y bajar la rodilla']] }, LADO],
  crear(p) {
    const base: Pose = sim('brazo', [0, 0, 24])
    const arriba = une(base, { musloI: [-80, 0, -2], piernaI: [90, 0, 0], pieI: [10, 0, 0] })
    const claves = p.tipo === 'rodilla' ? rep(base, arriba, '⬆️ Sube la rodilla a la altura de la cadera', '⬇️ Baja despacio') : aguanta(arriba, '⏸️ Aguanta sin que se mueva la cadera')
    return {
      dur: p.tipo === 'rodilla' ? 2.8 : 4, claves: conLado(claves, p), apoyo: { a: conLadoH(['pieD'], p) }, cam: CAM_PIE,
      musculos: [['gluteo', 'Glúteo medio'], ['core', 'Core'], ['gemelos', 'Tobillo y pie']],
    }
  },
}

// ── SALTOS EN EL SITIO ───────────────────────────────────────────────────────
const saltos: Movimiento = {
  id: 'saltos', nombre: 'Saltos en el sitio',
  params: [{ id: 'piernas', nombre: 'Piernas', opciones: [['dos', 'Las dos'], ['una', 'A una pierna']] }, LADO],
  crear(p) {
    const una = p.piernas === 'una'
    const libre: Pose = una ? { musloI: [-30, 0, -2], piernaI: [80, 0, 0] } : {}
    const de = une(libre, sim('brazo', [-6, 0, 10]))
    const flex = une(libre, { raiz: [12, 0, 0] }, una ? { musloD: [-36, 0, 3], piernaD: [42, 0, 0], pieD: [-18, 0, 0] } : une(sim('muslo', [-36, 0, 4]), sim('pierna', [42, 0, 0]), sim('pie', [-18, 0, 0])), sim('brazo', [20, 0, 10]))
    const aire = une(libre, { alto: [10, 0, 0] }, una ? { pieD: [26, 0, 0] } : sim('pie', [26, 0, 0]), sim('brazo', [-40, 0, 10]))
    return {
      dur: 1.4, claves: conLado([
        { t: 0, fase: '⬆️ Salta suave', p: de }, { t: .25, p: flex }, { t: .5, fase: '⬇️ Cae amortiguando', p: aire }, { t: .75, p: flex }, { t: 1, p: de },
      ], p),
      apoyo: { a: una ? conLadoH(['pieD'], p) : ['pieD', 'pieI'] }, cam: CAM_PIE,
      musculos: [['gemelos', 'Gemelos'], ['cuadriceps', 'Cuádriceps'], ['gluteo', 'Glúteo']],
    }
  },
}

const MOVIMIENTOS_MAS: Movimiento[] = [remo, curl, talones, elevacionBrazos, triceps, pressBanca, planchaFrontal, planchaLateral, crunch,
  subidaCajon, marchaLateral, facePull, rotacionHombro, abduccionPie, flexiones, pajaro, swing, gatoCamello, brazosAsistida, marcha, unaPierna, saltos]

// ════════════════════════════════════════════════════════════════════════════
// SACADOS DE LOS VÍDEOS DE LA CLÍNICA (noviembre 2026): mismas posturas, mismo ritmo.
// ════════════════════════════════════════════════════════════════════════════

// ── ESCALADORES CON DESLIZADORES ─────────────────────────────────────────────
// Vídeo «Escaladores 2 piernas»: plancha alta con los pies sobre deslizadores; las
// dos rodillas van juntas al pecho (la cadera sube) y vuelven a plancha. ~2 s por rep.
const escaladores: Movimiento = {
  id: 'escaladores', nombre: 'Escaladores',
  params: [
    { id: 'piernas', nombre: 'Piernas', opciones: [['juntas', 'Las dos a la vez (deslizadores)'], ['alternas', 'Alternando']] },
    { id: 'deslizadores', nombre: 'Deslizadores', opciones: [['si', 'Sí'], ['no', 'No']] },
  ],
  crear(p) {
    const plancha = une(PLANCHA, sim('brazo', [-84, 0, 6]), sim('mano', [-84, 0, 0]), sim('pie', [10, 0, 0]))
    const recogeD: Pose = { musloD: [-92, 0, 4], piernaD: [112, 0, 0], pieD: [-6, 0, 0] }
    const recogeI: Pose = { musloI: [-92, 0, -4], piernaI: [112, 0, 0], pieI: [-6, 0, 0] }
    const juntas = (p.piernas || 'juntas') === 'juntas'
    const claves: Clave[] = juntas
      ? rep(plancha, une(plancha, recogeD, recogeI, { lumbar: [14, 0, 0], pecho: [6, 0, 0] }), '⬅️ Lleva las rodillas al pecho deslizando', '➡️ Estira hasta la plancha', .06)
      : alterna(plancha, recogeD, recogeI, '⬅️ Rodilla al pecho', '⬅️ Ahora la otra')
    return {
      dur: juntas ? 2.2 : 1.6, claves, suelo: true, cam: { alto: 16, dist: 230, y: 18 },
      // Las manos no se mueven; el cuerpo se inclina lo justo para que los pies sigan en el suelo.
      apoyo: { a: ['manoD', 'manoI'], aY: 2.2, b: ['pieD', 'pieI'], bY: 6 },
      props: p.deslizadores === 'no' ? [] : [{ tipo: 'deslizador', en: 'pieD', off: [0, -3, 9], rot: [90, 0, 0] }, { tipo: 'deslizador', en: 'pieI', off: [0, -3, 9], rot: [90, 0, 0] }],
      musculos: [['core', 'Core'], ['deltoides', 'Hombros'], ['cuadriceps', 'Flexores de cadera'], ['pectoral', 'Pectoral']],
    }
  },
}

// ── ROTACIÓN DE CADERA SENTADO ───────────────────────────────────────────────
// Vídeo «Rotación interna de cadera sentado con pelota»: sentado en el cajón, pelota
// entre las rodillas (no se mueven) y los pies se abren hacia fuera y vuelven.
const rotacionCaderaSentado: Movimiento = {
  id: 'rotacion_cadera_sentado', nombre: 'Rotación de cadera sentado',
  params: [
    { id: 'tipo', nombre: 'Tipo', opciones: [['interna', 'Interna (pies hacia fuera)'], ['externa', 'Externa (pies hacia dentro)']] },
    { id: 'pelota', nombre: 'Pelota entre rodillas', opciones: [['si', 'Sí'], ['no', 'No']] },
  ],
  crear(p) {
    const int = (p.tipo || 'interna') === 'interna'
    const base = une(sim('muslo', [-86, 0, 8]), sim('pierna', [84, 0, 0]), sim('brazo', [-34, 0, 4]), sim('antebrazo', [-22, 0, 0]))
    const gira = une(base, sim('muslo', [-86, int ? -34 : 26, 8]))
    return {
      dur: 3, claves: rep(base, gira, int ? '↔️ Abre los pies, rodillas quietas' : '↔️ Cruza los pies, rodillas quietas', '⬅️ Vuelve despacio', .12),
      apoyo: { a: ['cadera'], aY: 52 }, cam: { alto: 10, dist: 270, y: 58 },
      props: [{ tipo: 'cajon', bajo: 'cadera', clave: 0, hueco: 9, alto: 43, ancho: 50 }, ...(p.pelota === 'no' ? [] : [{ tipo: 'pelota', entre: ['piernaD', 'piernaI'], off: [0, 1, 4] } as Prop])],
      musculos: [['gluteo', 'Rotadores de cadera'], ['aductores', 'Aductores']],
    }
  },
}

// ── FLEXOR DE CADERA CON PIE EN EL CAJÓN ─────────────────────────────────────
// Foto «Flexión de cadera sobre cajón»: pie de delante en el cajón, la pierna de atrás
// estirada, manos en la rodilla; la cadera se lleva adelante para estirar la de atrás.
const flexorCajon: Movimiento = {
  id: 'flexor_cajon', nombre: 'Flexor de cadera con pie en el cajón',
  params: [LADO],
  crear(p) {
    const brazos = une(sim('brazo', [-40, 0, -4]), sim('antebrazo', [-22, 0, 0]))
    const ini = une(brazos, { raiz: [6, 0, 0], cabeza: [-6, 0, 0], musloD: [-96, 0, 4], piernaD: [104, 0, 0], pieD: [-14, 0, 0], musloI: [30, 0, -3], piernaI: [6, 0, 0], pieI: [-42, 0, 0] })
    const fin = une(ini, { raiz: [10, 0, 0], musloD: [-112, 0, 4], piernaD: [110, 0, 0], pieD: [-8, 0, 0], musloI: [40, 0, -3], piernaI: [2, 0, 0], pieI: [-52, 0, 0] })
    return {
      dur: 4, claves: conLado(rep(ini, fin, '➡️ Lleva la cadera adelante', '⏸️ Nota el estiramiento delante de la cadera de atrás', .2), p),
      apoyo: { a: conLadoH(['pieI'], p) }, cam: CAM_PIE,
      props: conLadoProps([{ tipo: 'cajon', bajo: 'pieD', clave: 0, hueco: 4, alto: 40, ancho: 40, off: [0, 0, 6] }], p),
      musculos: [['cuadriceps', 'Psoas y recto femoral'], ['gluteo', 'Glúteo']],
    }
  },
}

MOVIMIENTOS_MAS.push(escaladores, rotacionCaderaSentado, flexorCajon)

/** Los props también cambian de lado cuando el ejercicio se hace con el izquierdo. */
function conLadoProps(props: Prop[], p: Record<string, string>): Prop[] {
  if (ladoDe(p) === 'D') return props
  const h = (x?: string) => x && /[DI]$/.test(x) ? otro(x) : x
  return props.map(o => ({ ...o, en: h(o.en), bajo: h(o.bajo), entre: o.entre ? [h(o.entre[0])!, h(o.entre[1])!] : undefined, off: o.off ? [-o.off[0], o.off[1], o.off[2]] : undefined }))
}

export const MOVIMIENTOS: Record<string, Movimiento> = Object.fromEntries(
  [sentadilla, zancada, pesoMuerto, pressHombros, puente, birdDog, ...MOVIMIENTOS_MAS].map(m => [m.id, m]))

/** Valores por defecto de los parámetros de un movimiento (la primera opción de cada uno). */
export function paramsPorDefecto(mov: string): Record<string, string> {
  const m = MOVIMIENTOS[mov]; if (!m) return {}
  return Object.fromEntries(m.params.map(x => [x.id, x.opciones[0][0]]))
}
