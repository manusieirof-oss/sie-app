// TESTS GRABADOS CON LA CÁMARA: geometría y protocolos.
//
// MediaPipe da 33 puntos del cuerpo por fotograma (x, y normalizados a la imagen).
// Aquí está, para cada test de la biblioteca que se puede grabar, QUÉ se mide, desde
// DÓNDE se graba y a QUÉ ítem del test va. La pantalla (app/camara) solo recorre esto.
//
// Todo es 2D: el ángulo sale bien si la cámara está perpendicular al plano del
// movimiento. Por eso cada medida lleva su vista (de lado / de frente) y se dice.

export type Pt = { x: number, y: number, visibility?: number }
export type Lado = 'izq' | 'der'

// Índices de MediaPipe. El lado es el DEL PACIENTE.
export const IDX = {
  izq: { oreja: 7, ojo: 2, hombro: 11, codo: 13, muneca: 15, cadera: 23, rodilla: 25, tobillo: 27, talon: 29, pie: 31 },
  der: { oreja: 8, ojo: 5, hombro: 12, codo: 14, muneca: 16, cadera: 24, rodilla: 26, tobillo: 28, talon: 30, pie: 32 },
}
export const NARIZ = 0
export type Parte = keyof typeof IDX.izq

/** Puntos de un lado en PÍXELES (si no, la imagen 16:9 deforma los ángulos). */
export interface Cuerpo { s: Record<Parte, Pt>, o: Record<Parte, Pt>, nariz: Pt, w: number, h: number }
export function cuerpo(lm: Pt[], lado: Lado, w: number, h: number): Cuerpo {
  const px = (p: Pt) => ({ x: p.x * w, y: p.y * h, visibility: p.visibility })
  const de = (l: Lado) => Object.fromEntries(Object.entries(IDX[l]).map(([k, i]) => [k, px(lm[i])])) as Record<Parte, Pt>
  return { s: de(lado), o: de(lado === 'izq' ? 'der' : 'izq'), nariz: px(lm[NARIZ]), w, h }
}

const v = (a: Pt, b: Pt) => ({ x: b.x - a.x, y: b.y - a.y })
const len = (p: { x: number, y: number }) => Math.hypot(p.x, p.y) || 1
/** Ángulo entre dos vectores (0–180). */
export function ang(u: { x: number, y: number }, w: { x: number, y: number }) {
  const c = (u.x * w.x + u.y * w.y) / (len(u) * len(w))
  return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI
}
const ABAJO = { x: 0, y: 1 }, ARRIBA = { x: 0, y: -1 }
const medio = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const vis = (...p: Pt[]) => p.every(x => (x.visibility ?? 1) > 0.55)

/**
 * ÁNGULO DEL PLANO FRONTAL de la rodilla (FPPA): cuánto se va la rodilla hacia DENTRO
 * de la línea cadera-tobillo, en grados. Positivo = valgo (hacia la línea media).
 */
export function valgo(c: Cuerpo, lado: 'mismo' | 'otro' = 'mismo') {
  const L = lado === 'mismo' ? c.s : c.o, O = lado === 'mismo' ? c.o : c.s
  const a = 180 - ang(v(L.rodilla, L.cadera), v(L.rodilla, L.tobillo))
  // ¿Hacia dónde se ha ido la rodilla respecto a la recta cadera-tobillo?
  const t = (L.rodilla.y - L.cadera.y) / ((L.tobillo.y - L.cadera.y) || 1)
  const xRecta = L.cadera.x + t * (L.tobillo.x - L.cadera.x)
  const haciaMedio = Math.sign(O.cadera.x - L.cadera.x)   // dónde queda la otra cadera
  return Math.sign((L.rodilla.x - xRecta) * haciaMedio) * a
}

// ---------------------------------------------------------------------------
// MEDIDAS. Cada una lee un fotograma y devuelve un número (o null si no ve bien).
// `modo` dice cómo se resume la grabación: el MÁXIMO (rangos), un CRONO (equilibrio),
// un CONTADOR (repeticiones) o un ANÁLISIS por fases (sentadillas).
// ---------------------------------------------------------------------------
export type Vista = 'lado' | 'frente'
export interface Medida {
  id: string, nombre: string, vista: Vista, como: string
  item?: string              // ítem del test que recibe el valor (inicio del nombre)
  modo: 'max' | 'crono' | 'reps' | 'analisis'
  puntos: Parte[]            // los que se dibujan y tienen que verse
  valor?: (c: Cuerpo, ini?: Cuerpo) => number | null
  /** Para 'reps': cuándo está "arriba" y cuándo "abajo". */
  fases?: { abajo: (x: number) => boolean, arriba: (x: number) => boolean, segundos: number }
  /** Para 'analisis': de los fotogramas grabados, qué casillas del test se marcan. */
  analizar?: (fot: Cuerpo[]) => { marcas: Record<string, boolean | undefined>, datos: string[], valor?: number }
  /** Para pasar un ángulo a casillas (SLR, Thomas, Ober). */
  marcar?: (valor: number) => Record<string, boolean>
  aprox?: boolean
}

// Ángulos de uso común, todos con 0 en la posición neutra.
const flexHombro = (c: Cuerpo) => vis(c.s.hombro, c.s.cadera, c.s.codo) ? ang(v(c.s.hombro, c.s.cadera), v(c.s.hombro, c.s.codo)) : null
const flexCadera = (c: Cuerpo) => vis(c.s.hombro, c.s.cadera, c.s.rodilla) ? ang(v(c.s.hombro, c.s.cadera), v(c.s.cadera, c.s.rodilla)) : null
const flexRodilla = (c: Cuerpo) => vis(c.s.cadera, c.s.rodilla, c.s.tobillo) ? ang(v(c.s.cadera, c.s.rodilla), v(c.s.rodilla, c.s.tobillo)) : null
const flexCodo = (c: Cuerpo) => vis(c.s.hombro, c.s.codo, c.s.muneca) ? ang(v(c.s.hombro, c.s.codo), v(c.s.codo, c.s.muneca)) : null
/** Ángulo pierna-pie: 90° en neutro. */
const piePierna = (c: Cuerpo) => vis(c.s.rodilla, c.s.tobillo, c.s.talon, c.s.pie) ? ang(v(c.s.tobillo, c.s.rodilla), v(c.s.talon, c.s.pie)) : null
/** Cuánto ha girado un segmento desde la postura de salida (rotaciones). */
const desdeInicio = (seg: (c: Cuerpo) => [Pt, Pt] | null) => (c: Cuerpo, ini?: Cuerpo) => {
  const a = seg(c), b = ini && seg(ini)
  return a && b && vis(...a, ...b) ? ang(v(a[0], a[1]), v(b[0], b[1])) : null
}
const tronco = (c: Cuerpo) => [medio(c.s.cadera, c.o.cadera), medio(c.s.hombro, c.o.hombro)] as [Pt, Pt]

export interface Protocolo { test: string, medidas: Medida[], porLados: boolean, nota?: string }

export const PROTOCOLOS: Protocolo[] = [
  { test: 'Hombro · movilidad', porLados: true, medidas: [
    { id: 'hf', nombre: 'Flexión', item: 'Flexión', vista: 'lado', modo: 'max', puntos: ['cadera', 'hombro', 'codo'], valor: flexHombro,
      como: 'De pie, de lado a la cámara. Brazo estirado, súbelo por delante hasta arriba.' },
    { id: 'he', nombre: 'Extensión', item: 'Extensión', vista: 'lado', modo: 'max', puntos: ['cadera', 'hombro', 'codo'], valor: flexHombro,
      como: 'De pie, de lado. Brazo estirado, llévalo hacia atrás sin inclinar el tronco.' },
    { id: 'ha', nombre: 'Abducción', item: 'Abducción', vista: 'frente', modo: 'max', puntos: ['cadera', 'hombro', 'codo'], valor: flexHombro,
      como: 'De pie, de frente. Brazo estirado, súbelo por el lado hasta arriba.' },
    { id: 'hre', nombre: 'Rotación externa', item: 'Rotación externa', vista: 'lado', modo: 'max', puntos: ['hombro', 'codo', 'muneca'], aprox: true,
      valor: desdeInicio(c => [c.s.codo, c.s.muneca]),
      como: 'Tumbado boca arriba, de lado a la cámara: hombro a 90°, codo a 90° y antebrazo vertical al empezar. Gira llevando la mano hacia la cabeza.' },
    { id: 'hri', nombre: 'Rotación interna', item: 'Rotación interna', vista: 'lado', modo: 'max', puntos: ['hombro', 'codo', 'muneca'], aprox: true,
      valor: desdeInicio(c => [c.s.codo, c.s.muneca]),
      como: 'Igual que la externa, empezando con el antebrazo vertical: gira llevando la mano hacia los pies.' },
  ] },
  { test: 'Cadera · movilidad', porLados: true, medidas: [
    { id: 'cf', nombre: 'Flexión', item: 'Flexión', vista: 'lado', modo: 'max', puntos: ['hombro', 'cadera', 'rodilla'], valor: flexCadera,
      como: 'Tumbado boca arriba, de lado a la cámara. Lleva la rodilla al pecho.' },
    { id: 'ce', nombre: 'Extensión', item: 'Extensión', vista: 'lado', modo: 'max', puntos: ['hombro', 'cadera', 'rodilla'], valor: flexCadera,
      como: 'Boca abajo, de lado a la cámara. Eleva la pierna estirada sin despegar la pelvis.' },
    { id: 'cab', nombre: 'Abducción', item: 'abducción', vista: 'frente', modo: 'max', puntos: ['hombro', 'cadera', 'rodilla'], valor: flexCadera,
      como: 'Tumbado boca arriba, cámara desde los pies o desde arriba. Separa la pierna estirada hacia fuera.' },
    { id: 'cad', nombre: 'Aducción', item: 'Adducción', vista: 'frente', modo: 'max', puntos: ['hombro', 'cadera', 'rodilla'], valor: flexCadera,
      como: 'Igual, cruzando la pierna por encima de la otra.' },
    { id: 'cri', nombre: 'Rotación interna', item: 'Rotación interna', vista: 'frente', modo: 'max', puntos: ['rodilla', 'tobillo'],
      valor: desdeInicio(c => [c.s.rodilla, c.s.tobillo]),
      como: 'Sentado al borde de la camilla, de frente. Pierna colgando al empezar; lleva el pie hacia fuera.' },
    { id: 'cre', nombre: 'Rotación externa', item: 'Rotación externa', vista: 'frente', modo: 'max', puntos: ['rodilla', 'tobillo'],
      valor: desdeInicio(c => [c.s.rodilla, c.s.tobillo]),
      como: 'Igual; lleva el pie hacia dentro.' },
  ] },
  { test: 'Codo · movilidad', porLados: true, medidas: [
    { id: 'kf', nombre: 'Flexión', item: 'Flexión', vista: 'lado', modo: 'max', puntos: ['hombro', 'codo', 'muneca'], valor: flexCodo,
      como: 'De lado, brazo pegado al cuerpo. Dobla el codo al máximo.' },
  ] },
  { test: 'Movilidad rodilla - VALD', porLados: true, medidas: [
    { id: 'rfs', nombre: 'Flexión sentado', item: 'Flexión sentado', vista: 'lado', modo: 'max', puntos: ['cadera', 'rodilla', 'tobillo'], valor: flexRodilla,
      como: 'Sentado, de lado. Lleva el pie hacia atrás debajo de la silla.' },
    { id: 'rfp', nombre: 'Flexión prono', item: 'Flexión prono', vista: 'lado', modo: 'max', puntos: ['cadera', 'rodilla', 'tobillo'], valor: flexRodilla,
      como: 'Boca abajo, de lado a la cámara. Lleva el talón al glúteo.' },
  ] },
  { test: 'Tobillo · movilidad', porLados: true, medidas: [
    { id: 'td', nombre: 'Dorsiflexión', item: 'Dorsiflexión', vista: 'lado', modo: 'max', puntos: ['rodilla', 'tobillo', 'talon', 'pie'],
      valor: c => { const a = piePierna(c); return a == null ? null : Math.max(0, 90 - a) },
      como: 'Sentado con la pierna estirada, de lado. Lleva la punta del pie hacia ti.' },
    { id: 'tp', nombre: 'Flexión plantar', item: 'Flexión plantar', vista: 'lado', modo: 'max', puntos: ['rodilla', 'tobillo', 'talon', 'pie'],
      valor: c => { const a = piePierna(c); return a == null ? null : Math.max(0, a - 90) },
      como: 'Igual; estira la punta del pie lejos.' },
  ] },
  { test: 'Lunge de tobillo · con la rodilla en el suelo', porLados: true, medidas: [
    { id: 'lr', nombre: 'Inclinación de la tibia', item: 'Distancia de la rodilla a la pared', vista: 'lado', modo: 'max', puntos: ['rodilla', 'tobillo'],
      valor: c => vis(c.s.rodilla, c.s.tobillo) ? ang(v(c.s.tobillo, c.s.rodilla), ARRIBA) : null,
      como: 'Rodilla de atrás en el suelo, de lado a la cámara. Lleva la rodilla de delante hacia delante sin levantar el talón. Se mide el ángulo de la tibia con la vertical.' },
  ] },
  { test: 'Movilidad cervical', porLados: false, medidas: [
    { id: 'cvl', nombre: 'Flexión lateral', item: 'Flexión lateral', vista: 'frente', modo: 'max', puntos: ['hombro', 'oreja'],
      valor: (c, i) => { if (!i || !vis(c.s.oreja, c.o.oreja, i.s.oreja, i.o.oreja)) return null; return ang(v(c.o.oreja, c.s.oreja), v(i.o.oreja, i.s.oreja)) },
      como: 'Sentado, de frente, mirando al frente. Lleva la oreja al hombro sin subir el hombro.' },
    { id: 'cvf', nombre: 'Flexión', item: 'Flexión', vista: 'lado', modo: 'max', puntos: ['hombro', 'oreja'], aprox: true,
      valor: (c, i) => { if (!i || !vis(c.s.oreja, c.s.ojo, i.s.oreja, i.s.ojo)) return null; return ang(v(c.s.oreja, c.s.ojo), v(i.s.oreja, i.s.ojo)) },
      como: 'Sentado, de lado. Lleva la barbilla al pecho.' },
    { id: 'cve', nombre: 'Extensión', item: 'Extensión', vista: 'lado', modo: 'max', puntos: ['hombro', 'oreja'], aprox: true,
      valor: (c, i) => { if (!i || !vis(c.s.oreja, c.s.ojo, i.s.oreja, i.s.ojo)) return null; return ang(v(c.s.oreja, c.s.ojo), v(i.s.oreja, i.s.ojo)) },
      como: 'Sentado, de lado. Mira al techo.' },
  ] },
  { test: 'Movilidad del tronco (flexión lateral y rotación)', porLados: true, medidas: [
    { id: 'tfl', nombre: 'Flexión lateral', item: 'Flexión lateral', vista: 'frente', modo: 'max', puntos: ['cadera', 'hombro'],
      valor: c => { const [a, b] = tronco(c); return vis(c.s.cadera, c.o.cadera, c.s.hombro, c.o.hombro) ? ang(v(a, b), ARRIBA) : null },
      como: 'De pie, de frente. Desliza la mano por el muslo hacia la rodilla, sin girar.' },
  ] },
  { test: 'Straight Leg Raise', porLados: true, medidas: [
    { id: 'slr', nombre: 'Elevación de la pierna recta', vista: 'lado', modo: 'max', puntos: ['hombro', 'cadera', 'rodilla', 'tobillo'], valor: flexCadera,
      marcar: g => ({ 'La pierna que se levanta no alcanza': g < 90 }),
      como: 'Boca arriba, de lado a la cámara. Eleva la pierna con la rodilla estirada.' },
  ] },
  { test: 'Thomas · flexores de cadera', porLados: true, medidas: [
    { id: 'thm', nombre: 'Muslo y rodilla al final', vista: 'lado', modo: 'analisis', puntos: ['hombro', 'cadera', 'rodilla', 'tobillo'],
      como: 'Tumbado al borde de la camilla, de lado a la cámara, abrazando la otra rodilla. La pierna medida cuelga relajada. Graba 3-4 segundos quieto.',
      analizar: f => {
        const ok = f.filter(c => flexCadera(c) != null && flexRodilla(c) != null)
        if (!ok.length) return { marcas: {}, datos: ['No se ha visto bien'] }
        const cad = mediana(ok.map(c => flexCadera(c)!)), rod = mediana(ok.map(c => flexRodilla(c)!))
        // Con el tronco en la camilla, el muslo "apoya" si sigue la línea del tronco (≈0°).
        return { marcas: { 'El muslo no llega a apoyar': cad > 10, 'La rodilla no mantiene los 90': rod < 80 },
          datos: [`Muslo elevado ${Math.round(cad)}°`, `Rodilla ${Math.round(rod)}° de flexión`] }
      } },
  ] },
  { test: 'Ober · tensor de la fascia lata', porLados: true, medidas: [
    { id: 'obr', nombre: 'Muslo respecto a la horizontal', item: 'Grados que le faltan', vista: 'frente', modo: 'analisis', puntos: ['cadera', 'rodilla'],
      como: 'Tumbado de lado, cámara por detrás. Con la cadera en extensión, deja caer la pierna de arriba. Graba 3-4 segundos quieto.',
      analizar: f => {
        const ok = f.filter(c => vis(c.s.cadera, c.s.rodilla))
        if (!ok.length) return { marcas: {}, datos: ['No se ha visto bien'] }
        // Positivo hacia arriba: la rodilla por encima de la cadera.
        const g = mediana(ok.map(c => { const d = v(c.s.cadera, c.s.rodilla); return Math.atan2(-d.y, Math.abs(d.x)) * 180 / Math.PI }))
        return { marcas: { 'La pierna no baja de la horizontal': g > 0 }, datos: [`${Math.round(g)}° por encima de la horizontal`], valor: Math.max(0, Math.round(g)) }
      } },
  ] },
  { test: 'Sentadilla profunda con brazos arriba', porLados: false, nota: 'Haz las dos vistas: de lado (talones, tronco, brazos, profundidad) y de frente (rodillas).', medidas: [
    { id: 'sp_l', nombre: 'Vista de lado · 3-5 repeticiones', vista: 'lado', modo: 'analisis', puntos: ['hombro', 'cadera', 'rodilla', 'tobillo', 'talon', 'pie'],
      como: 'De pie, de lado a la cámara, brazos estirados arriba. Baja lo más profundo que puedas y sube, 3-5 veces.',
      analizar: f => {
        const ok = f.filter(c => flexRodilla(c) != null && vis(c.s.talon, c.s.pie, c.s.hombro, c.s.codo))
        if (ok.length < 10) return { marcas: {}, datos: ['No se ha visto bien'] }
        const pie0 = ok.slice(0, 5).map(c => c.s.pie.y - c.s.talon.y)
        const base = mediana(pie0), largo = mediana(ok.map(c => len(v(c.s.talon, c.s.pie))))
        const maxR = Math.max(...ok.map(c => flexRodilla(c)!))
        const fondo = ok.filter(c => flexRodilla(c)! > maxR * 0.85)
        const talon = Math.max(...ok.map(c => ((c.s.pie.y - c.s.talon.y) - base) / largo))
        const troncoTib = mediana(fondo.map(c => ang(v(...tronco(c)), ARRIBA) - ang(v(c.s.tobillo, c.s.rodilla), ARRIBA)))
        const brazos = mediana(fondo.map(c => flexHombro(c) ?? 180))
        const cadAlta = mediana(fondo.map(c => (c.s.rodilla.y - c.s.cadera.y) / largo))
        return {
          marcas: { 'Los talones se levantan': talon > 0.15, 'El tronco se inclina': troncoTib > 15, 'Los brazos caen': brazos < 150, 'Queda la pelvis': cadAlta > 0.1 },
          datos: [`Rodilla ${Math.round(maxR)}° en lo más bajo`, `Tronco ${Math.round(troncoTib)}° más inclinado que la tibia`, `Brazos a ${Math.round(brazos)}°`, `Talón sube ${Math.round(talon * 100)}% del pie`],
        }
      } },
    { id: 'sp_f', nombre: 'Vista de frente · 3-5 repeticiones', vista: 'frente', modo: 'analisis', puntos: ['cadera', 'rodilla', 'tobillo'],
      como: 'De frente a la cámara, igual: 3-5 sentadillas profundas con los brazos arriba.',
      analizar: f => {
        const ok = f.filter(c => vis(c.s.cadera, c.s.rodilla, c.s.tobillo, c.o.cadera, c.o.rodilla, c.o.tobillo))
        if (ok.length < 10) return { marcas: {}, datos: ['No se ha visto bien'] }
        const vg = Math.max(...ok.map(c => Math.max(valgo(c, 'mismo'), valgo(c, 'otro'))))
        return { marcas: { 'Las rodillas caen hacia dentro': vg > 12 }, datos: [`Valgo máximo ${Math.round(vg)}°`] }
      } },
  ] },
  { test: 'Sentadilla unipodal', porLados: true, medidas: [
    { id: 'su', nombre: 'De frente · 3-5 repeticiones', vista: 'frente', modo: 'analisis', puntos: ['cadera', 'rodilla', 'tobillo'],
      como: 'De frente a la cámara, apoyado en la pierna medida. Baja y sube 3-5 veces, la otra pierna en el aire.',
      analizar: f => {
        const ok = f.filter(c => vis(c.s.cadera, c.s.rodilla, c.s.tobillo, c.o.cadera, c.o.tobillo))
        if (ok.length < 10) return { marcas: {}, datos: ['No se ha visto bien'] }
        const vg = Math.max(...ok.map(c => valgo(c, 'mismo')))
        // Pelvis: la cadera del lado libre más baja que la de apoyo.
        const caida = Math.max(...ok.map(c => Math.atan2(c.o.cadera.y - c.s.cadera.y, Math.abs(c.o.cadera.x - c.s.cadera.x)) * 180 / Math.PI))
        const pierna = mediana(ok.map(c => len(v(c.s.cadera, c.s.tobillo))))
        const apoya = ok.some(c => Math.abs(c.o.tobillo.y - c.s.tobillo.y) < pierna * 0.04)
        return { marcas: { 'La rodilla se cae hacia adentro': vg > 10, 'La cadera del lado libre desciende': caida > 5, 'Pierde el equilibrio': apoya },
          datos: [`Valgo máximo ${Math.round(vg)}°`, `Caída de pelvis ${Math.round(caida)}°`, apoya ? 'Ha apoyado el otro pie' : 'Sin apoyar el otro pie'] }
      } },
  ] },
  { test: 'Equilibrio unipodal ojos abiertos', porLados: true, medidas: [
    { id: 'eua', nombre: 'Tiempo sobre un pie', item: '@edad', vista: 'frente', modo: 'crono', puntos: ['cadera', 'rodilla', 'tobillo'],
      como: 'De frente, ojos abiertos. El crono arranca solo al levantar el otro pie y para al apoyarlo (máx. 60 s).' },
  ] },
  { test: 'Equilibrio unipodal ojos cerrados', porLados: false, medidas: [
    { id: 'euc', nombre: 'Tiempo sobre un pie', item: '@edad', vista: 'frente', modo: 'crono', puntos: ['cadera', 'rodilla', 'tobillo'],
      como: 'De frente, ojos cerrados. El crono arranca solo al levantar el pie y para al apoyarlo (máx. 60 s).' },
  ] },
  { test: 'Senior Fitness Test (Rikli & Jones)', porLados: false, nota: 'Solo las dos pruebas de 30 s; el resto se apunta a mano.', medidas: [
    { id: 'sts', nombre: 'Sentarse y levantarse en 30 s', item: 'Sentarse y levantarse', vista: 'lado', modo: 'reps', puntos: ['cadera', 'rodilla', 'tobillo'],
      valor: flexRodilla, fases: { abajo: x => x > 70, arriba: x => x < 25, segundos: 30 },
      como: 'Sentado en la silla, de lado a la cámara, brazos cruzados. Al pulsar empieza la cuenta de 30 s.' },
    { id: 'ccd', nombre: 'Flexión de codo en 30 s', item: 'Flexion de codo', vista: 'lado', modo: 'reps', puntos: ['hombro', 'codo', 'muneca'],
      valor: flexCodo, fases: { abajo: x => x < 30, arriba: x => x > 110, segundos: 30 },
      como: 'Sentado, de lado, con la mancuerna. Al pulsar empieza la cuenta de 30 s.' },
  ] },
]

export function mediana(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }

/** El ítem del test cuyo nombre empieza por `pref` (sin tildes ni mayúsculas). */
const n = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export function itemDe(items: any[], pref: string) { return (items || []).find(i => n(i.nombre).startsWith(n(pref))) }

/** Equilibrio unipodal: el ítem según la edad (están por tramos). */
export function itemPorEdad(items: any[], edad: number | null) {
  const p = edad == null ? 'Menores' : edad < 60 ? 'Menores' : edad <= 65 ? 'De 60' : 'Mayores'
  return itemDe(items, p)
}
