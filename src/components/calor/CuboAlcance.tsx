'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * EL CUBO DEL ALCANCE: la programación entera como un prisma que se gira con el dedo.
 *   · Largo = todas sus citas; "hoy" es un plano rojo quieto en su día.
 *   · Cada fase se marca con un plano fino donde empieza; las que no se preparan ahora, en sombra.
 *   · La línea blanca y redonda es la proyección: sube/baja con la intensidad y es más fina
 *     donde hay menos trabajo. Es una sola curva suave para toda la programación.
 * Se hace con CSS 3D y no con WebGL: es una figura simple y así no compite con el muñeco.
 * Doble clic: se amplía a casi toda la pantalla, translúcido, sin salir de la mesa.
 */
export interface MarcaFase { i: number, n: string, c: string }
export default function CuboAlcance({ n, hoy, marcas, sombras, linea, fechaIni, fechaFin, botones }: {
  n: number
  hoy: number
  marcas: MarcaFase[]
  sombras: [number, number][]
  linea: { v: number[], t: number[] } | null
  fechaIni: string
  fechaFin: string
  botones: React.ReactNode
}) {
  const esc = useRef<HTMLDivElement>(null)
  const cubo = useRef<HTMLDivElement>(null)
  const giro = useRef({ x: -24, y: -30 })
  const [grande, setGrande] = useState(false)
  const [tam, setTam] = useState(0)

  // Tamaño según el sitio que tenga (carta o pantalla)
  useEffect(() => {
    const el = esc.current
    if (!el) return
    const ro = new ResizeObserver(() => setTam(Math.min(el.clientWidth * 0.72, el.clientHeight * 2.4)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [grande])

  useEffect(() => {
    const c = cubo.current
    if (!c || !tam || !n) return
    const L = tam, A = Math.round(L * 0.22), P = Math.round(L * 0.24), X = (i: number) => i * L / n
    c.style.width = L + 'px'; c.style.height = A + 'px'
    const f = (w: number, h: number, extra: string, tr: string, dentro = '') =>
      `<div class="cb-f" style="width:${w}px;height:${h}px;${extra}transform:${tr}">${dentro}</div>`
    const somb = sombras.map(([a, b]) => `<div style="position:absolute;top:0;bottom:0;left:${X(a)}px;width:${X(b) - X(a)}px;background:rgba(38,40,37,.13)"></div>`).join('')
    const marcasH = marcas.map(m => {
      const x = X(m.i)
      return `<div style="position:absolute;top:0;left:${x - P / 2}px;width:${P}px;height:${A}px;border:1.5px solid ${m.c};background:${m.c}14;transform:rotateY(90deg)"></div>
        <div class="cb-tag" style="left:${x}px;color:${m.c};transform:translateZ(${P / 2}px) translateX(-50%)">${m.n}</div>`
    }).join('')
    const xh = X(hoy)
    c.innerHTML =
      f(L, A, '', `rotateY(180deg) translateZ(${P / 2}px)`) +
      f(L, P, `top:${(A - P) / 2}px;`, `rotateX(-90deg) translateZ(${A / 2}px)`) +
      f(P, A, `left:${(L - P) / 2}px;`, `rotateY(-90deg) translateZ(${L / 2}px)`) +
      `<div style="position:absolute;top:0;left:${xh - P / 2}px;width:${P}px;height:${A}px;background:rgba(228,87,46,.18);border:2px solid #E4572E;transform:rotateY(90deg)"></div>` +
      marcasH +
      tubo(linea, L, A, n) +
      f(L, P, `top:${(A - P) / 2}px;`, `rotateX(90deg) translateZ(${A / 2}px)`, somb) +
      f(P, A, `left:${(L - P) / 2}px;`, `rotateY(90deg) translateZ(${L / 2}px)`) +
      f(L, A, '', `translateZ(${P / 2}px)`, somb) +
      `<div class="cb-tag" style="left:${xh}px;color:#E4572E;transform:translateZ(${P / 2}px) translateX(-50%)">hoy</div>
       <div class="cb-fecha" style="top:${A + 8}px;left:0;transform:translateZ(${P / 2}px)">${fechaIni}</div>
       <div class="cb-fecha" style="top:${A + 8}px;right:0;transform:translateZ(${P / 2}px)">${fechaFin}</div>`
    c.style.transform = `rotateX(${giro.current.x}deg) rotateY(${giro.current.y}deg)`
  }, [tam, n, hoy, marcas, sombras, linea, fechaIni, fechaFin])

  // Girar arrastrando (ratón o dedo)
  const ini = useRef<any>(null)
  const abajo = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.cb-btn')) return
    ini.current = { px: e.clientX, py: e.clientY, ...giro.current }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const mover = (e: React.PointerEvent) => {
    const s = ini.current
    if (!s || !cubo.current) return
    giro.current = { y: s.y + (e.clientX - s.px) * 0.5, x: Math.max(-85, Math.min(85, s.x - (e.clientY - s.py) * 0.5)) }
    cubo.current.style.transform = `rotateX(${giro.current.x}deg) rotateY(${giro.current.y}deg)`
  }
  useEffect(() => {
    if (!grande) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setGrande(false) }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [grande])

  return (
    <div ref={esc} className={'cb-escena' + (grande ? ' grande' : '')}
      onPointerDown={abajo} onPointerMove={mover} onPointerUp={() => { ini.current = null }} onPointerCancel={() => { ini.current = null }}
      onDoubleClick={e => { if (!(e.target as HTMLElement).closest('.cb-btn')) setGrande(g => !g) }}>
      <div className="cb-btns">{botones}</div>
      {grande && <button className="cb-btn cb-mini" style={{ position: 'absolute', right: 12, top: 12 }} onClick={() => setGrande(false)}>✕</button>}
      <div ref={cubo} className="cb-cubo" />
    </div>
  )
}

/** Tubo redondo: curva suave (Catmull-Rom) troceada; dos planos cruzados para que se vea redondo al girar. */
function tubo(linea: { v: number[], t: number[] } | null, L: number, A: number, n: number) {
  if (!linea) return ''
  const idx = linea.v.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0)
  if (idx.length < 2) return ''
  const vs = idx.map(i => linea.v[i]), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1
  const pts = idx.map(i => ({ x: (i + 0.5) * L / n, y: A * (1 - (mx === mn ? 0.4 : 0.15 + 0.7 * (linea.v[i] - mn) / r)), w: 3 + (linea.t[i] ?? 1) * 6 }))
  const C: { x: number, y: number, w: number }[] = [], SUB = 8, M = pts.length
  for (let i = 0; i < M - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(M - 1, i + 2)]
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB, t2 = t * t, t3 = t2 * t
      const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3)
      C.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y), w: p1.w + (p2.w - p1.w) * t })
    }
  }
  C.push(pts[M - 1])
  let h = ''
  for (let i = 0; i < C.length - 1; i++) {
    const a = C[i], b = C[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y) + 0.6, ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
    for (const r2 of [0, 90]) h += `<div class="cb-haz" style="left:${a.x}px;top:${a.y - a.w / 2}px;width:${len}px;height:${a.w}px;transform:rotateZ(${ang}deg) rotateX(${r2}deg)"></div>`
  }
  return h
}
