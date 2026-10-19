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
      dur: brazos === 'alterno' ? 4.4 : 3, claves: conLado(claves, p), apoyo: { a: ['pieD', 'pieI'] },
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

/** Los props también cambian de lado cuando el ejercicio se hace con el izquierdo. */
function conLadoProps(props: Prop[], p: Record<string, string>): Prop[] {
  if (ladoDe(p) === 'D') return props
  const h = (x?: string) => x && /[DI]$/.test(x) ? otro(x) : x
  return props.map(o => ({ ...o, en: h(o.en), bajo: h(o.bajo), entre: o.entre ? [h(o.entre[0])!, h(o.entre[1])!] : undefined, off: o.off ? [-o.off[0], o.off[1], o.off[2]] : undefined }))
}

export const MOVIMIENTOS: Record<string, Movimiento> = Object.fromEntries(
  [sentadilla, zancada, pesoMuerto, pressHombros, puente, birdDog].map(m => [m.id, m]))

/** Valores por defecto de los parámetros de un movimiento (la primera opción de cada uno). */
export function paramsPorDefecto(mov: string): Record<string, string> {
  const m = MOVIMIENTOS[mov]; if (!m) return {}
  return Object.fromEntries(m.params.map(x => [x.id, x.opciones[0][0]]))
}
