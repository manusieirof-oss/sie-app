// ---------------------------------------------------------------------------
// DIBUJO PLANO → SVG, EN EL NAVEGADOR
//
// Las ilustraciones hechas con IA (silueta verde, material gris, fondo blanco) se
// suben como PNG/JPG y al ampliarlas se ven borrosas. Al subirlas se detecta si son
// un dibujo de pocos colores y, si lo son, se redibujan como vector: sin fondo y
// nítidas a cualquier tamaño. Una foto de verdad (miles de colores) no se toca.
//
// Cómo:
//   1. Se amplía a ~2000 px con suavizado: los bordes quedan como degradados finos.
//   2. Paleta: los colores que más se repiten (máx. 6). Si el blanco es el fondo y
//      esos colores cubren casi toda la imagen, es un dibujo.
//   3. Cada píxel va a su color de la paleta. Los de borde son mezcla de dos colores
//      y van al extremo más cercano (si no, salía un halo gris alrededor).
//   4. imagetracerjs traza cada color; se quitan los trazos del blanco y se recorta
//      al dibujo.
// Los colores casi iguales a los de la casa se igualan a ellos, para que todas las
// figuras tengan exactamente el mismo verde, gris y amarillo.
// ---------------------------------------------------------------------------

type Col = { r: number, g: number, b: number, c: number }
const CASA = ['#5A969E', '#5E5B55', '#D9D6CC', '#D9B44A'].map(h => ({
  r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16),
}))
const dist = (a: { r: number, g: number, b: number }, b: { r: number, g: number, b: number }) =>
  Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)

/** El núcleo, sobre los píxeles. Devuelve el SVG o '' si no es un dibujo plano. */
export function vectorizarDatos(img: ImageData, ImageTracer: any): string {
  const { width: W, height: H, data: D } = img
  const n = W * H

  // 2. Paleta
  const bins = new Map<number, Col>()
  for (let i = 0; i < n; i++) {
    const r = D[i * 4], g = D[i * 4 + 1], b = D[i * 4 + 2]
    const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4)
    const e = bins.get(k)
    if (e) { e.c++; e.r += r; e.g += g; e.b += b } else bins.set(k, { c: 1, r, g, b })
  }
  const orden = Array.from(bins.values()).sort((a, b) => b.c - a.c)
  const pal: Col[] = []
  for (const e of orden) {
    if (e.c < n * 0.002) break
    const col = { r: e.r / e.c, g: e.g / e.c, b: e.b / e.c, c: e.c }
    const cerca = pal.find(p => dist(p, col) < 48)
    if (cerca) {
      const t = cerca.c + col.c
      cerca.r = (cerca.r * cerca.c + col.r * col.c) / t; cerca.g = (cerca.g * cerca.c + col.g * col.c) / t
      cerca.b = (cerca.b * cerca.c + col.b * col.c) / t; cerca.c = t
    } else if (pal.length < 6) pal.push(col)
  }
  const cubre = pal.reduce((s, p) => s + p.c, 0) / n
  const iBlanco = pal.findIndex(p => p.r > 235 && p.g > 235 && p.b > 235)
  if (iBlanco < 0 || pal[iBlanco].c / n < 0.2 || cubre < 0.85) return ''

  const P = pal.map((p, i) => {
    if (i === iBlanco) return { r: 255, g: 255, b: 255, a: 255 }
    const casa = CASA.find(c => dist(c, p) < 40)
    const q = casa || p
    return { r: Math.round(q.r), g: Math.round(q.g), b: Math.round(q.b), a: 255 }
  })

  // 3. Cada píxel a su color (y los de borde al extremo de su mezcla)
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let i = 0; i < n; i++) {
    const px = { r: D[i * 4], g: D[i * 4 + 1], b: D[i * 4 + 2] }
    let m = 0, md = 1e9
    for (let k = 0; k < pal.length; k++) { const d = dist(pal[k], px); if (d < md) { md = d; m = k } }
    if (md > 18) {
      let mejor = md
      for (let a = 0; a < pal.length; a++) for (let c = a + 1; c < pal.length; c++) {
        const A = pal[a], B = pal[c]
        const vx = B.r - A.r, vy = B.g - A.g, vz = B.b - A.b, L = vx * vx + vy * vy + vz * vz
        const t = Math.max(0, Math.min(1, ((px.r - A.r) * vx + (px.g - A.g) * vy + (px.b - A.b) * vz) / L))
        const res = Math.hypot(A.r + t * vx - px.r, A.g + t * vy - px.g, A.b + t * vz - px.b)
        if (res < 14 && res < mejor) { mejor = res; m = t < 0.5 ? a : c }
      }
    }
    D[i * 4] = P[m].r; D[i * 4 + 1] = P[m].g; D[i * 4 + 2] = P[m].b; D[i * 4 + 3] = 255
    if (m !== iBlanco) {
      const x = i % W, y = (i / W) | 0
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  if (x1 <= x0 || y1 <= y0) return ''

  // 4. Trazar, quitar el fondo y recortar
  let svg: string = ImageTracer.imagedataToSVG(img, {
    pal: P, numberofcolors: P.length, colorquantcycles: 1, ltres: 2, qtres: 2,
    pathomit: 40, blurradius: 0, roundcoords: 1, strokewidth: 0, linefilter: true, viewbox: true,
  })
  svg = svg.replace(/<path[^>]*fill="rgb\(255,255,255\)"[^>]*\/>/g, '')
  const M = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04)
  svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${x0 - M} ${y0 - M} ${x1 - x0 + 2 * M} ${y1 - y0 + 2 * M}"`)
    .replace(/ width="\d+" height="\d+"/, '').replace(/ desc="[^"]*"/, '')
  return svg
}

/**
 * Si el archivo es un dibujo plano, lo devuelve convertido a SVG; si no (una foto),
 * null y se sube como siempre. Nunca lanza: ante cualquier fallo, null.
 */
export async function vectorizarSiDibujo(file: File): Promise<File | null> {
  try {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return null
    const bmp = await createImageBitmap(file)
    const s = Math.min(2.5, 2048 / Math.max(bmp.width, bmp.height))
    const W = Math.round(bmp.width * s), H = Math.round(bmp.height * s)
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    // Un poco de desenfoque suaviza la escalera de píxeles (Safari lo ignora: da igual).
    ctx.filter = 'blur(1.5px)'
    ctx.drawImage(bmp, 0, 0, W, H)
    // UMD: según el empaquetador llega como default o como el módulo entero.
    const mod: any = await import('imagetracerjs')
    const ImageTracer = mod.default || mod
    const svg = vectorizarDatos(ctx.getImageData(0, 0, W, H), ImageTracer)
    return svg ? new File([svg], 'figura.svg', { type: 'image/svg+xml' }) : null
  } catch {
    return null
  }
}
