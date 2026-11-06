'use client'
import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// LA NEBULOSA DE SU PROGRAMACIÓN (ficha). La misma idea que el cubo del calor, pero en
// vez de paredes, una niebla tipo gel que se gira con el dedo:
//   · un tramo por cita, de izquierda (lo pasado) a derecha (lo programado);
//   · el HAZ de luz dentro: más alto, más trabajo; más grueso, más intenso;
//   · la NIEBLA se estrecha donde faltó o canceló y se abre donde vino de más;
//   · si estuvo un tiempo SIN VENIR (baja, pausa), la niebla se corta y el hueco es tan
//     largo como lo que tardó en volver;
//   · HOY es un aro fino naranja.
// Y unas VISTAS que pintan dentro otra cosa (cambios, sesiones, objetivos, molestias).
// Three.js y no CSS: la niebla son cientos de motas blandas que se mueven despacio.
// ---------------------------------------------------------------------------

export type CitaNeb = {
  t: number                 // fecha en ms
  trabajo: number, intens: number, escala: number
  estado: string            // realizada | falta | cancelada | programada
  movida: boolean           // se cambió de día u hora
  cambioSesion: boolean     // se le cambió la sesión
  ses: string               // letra de su sesión en este tramo ('' si no tiene)
  objs: string[]            // objetivos que trabaja su sesión
  rojo: number              // 0..1: molestia ese día (o la huella que dejó)
}
export type VistaNeb = 'normal' | 'cambios' | 'sesiones' | 'objetivos' | 'molestias'
export const PALETA = [0x5A969E, 0xE8A33D, 0x8E6FB5, 0x7C9A6B, 0xC9667A, 0x4A7FC1, 0xB58B5A, 0x6B8E8E]
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
export const COL_CAMBIO = { falta: 0xB05A5A, cancelada: 0x8A8C88, movida: 0x4A7FC1, sesion: 0x8E6FB5 }
/** Más de esto sin ninguna cita es una pausa: la niebla se corta. */
const PAUSA_DIAS = 14
const DIA = 864e5

export default function NebulosaPrograma({ citas, vista, colSes, colObj, hoy, alerta, fechaIni, fechaFin, onToque }: {
  citas: CitaNeb[], vista: VistaNeb, colSes: Record<string, number>, colObj: Record<string, number>
  hoy: number, alerta: boolean, fechaIni: string, fechaFin: string
  /** Un toque sin arrastrar (para ampliarla). */
  onToque?: () => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  // El giro se guarda fuera: al cambiar de vista o de fechas se rehace la escena y no
  // queremos que vuelva a la posición de inicio cada vez.
  const giro = useRef({ x: 0.35, y: -0.55 })
  const toque = useRef(onToque); toque.current = onToque
  useEffect(() => {
    const el = caja.current
    if (!el || citas.length < 2) return
    let vivo = true, raf = 0, limpiar = () => {}
    ;(async () => {
      const THREE = await import('three')
      if (!vivo) return
      const N = citas.length
      const interp = (a: number[], u: number) => { const p = u * (N - 1), i = Math.floor(p), j = Math.min(N - 1, i + 1), t = p - i, s = (1 - Math.cos(Math.PI * t)) / 2; return a[i] + (a[j] - a[i]) * s }
      const LARGO = 8, RADIO = 1.7
      const trabajo = citas.map(c => c.trabajo), intens = citas.map(c => c.intens), rojo = citas.map(c => c.rojo)

      // DÓNDE VA CADA CITA. Entre citas normales, todas ocupan lo mismo; en una pausa, el
      // hueco cuenta los días que pasaron en "citas que habría tenido" a su ritmo habitual.
      const pasos: number[] = []; for (let i = 1; i < N; i++) pasos.push((citas[i].t - citas[i - 1].t) / DIA)
      const normal = [...pasos].sort((a, b) => a - b)[Math.floor(pasos.length / 2)] || 2
      const huecos: { i: number, dias: number }[] = []
      const pos = [0]
      pasos.forEach((p, k) => { const largo = p > PAUSA_DIAS ? Math.max(1, p / normal) : 1; if (p > PAUSA_DIAS) huecos.push({ i: k, dias: p }); pos.push(pos[k] + largo) })
      const tot = pos[N - 1] || 1, unidad = LARGO / tot, X = pos.map(v => (v / tot - 0.5) * LARGO)
      const enHueco = (i: number) => huecos.some(h => h.i === i)
      // x de un punto con decimales; si cae en un hueco se pega al borde más cercano.
      const xF = (f: number) => { const i = Math.max(0, Math.min(Math.floor(f), N - 2)), t = f - i
        if (enHueco(i)) return t < 0.5 ? X[i] + t * unidad : X[i + 1] - (1 - t) * unidad
        return X[i] + t * (X[i + 1] - X[i]) }
      // Al llegar a un corte la niebla se va cerrando, para que no acabe de golpe.
      const escala = citas.map((c, i) => c.escala * (enHueco(i) || enHueco(i - 1) ? 0.55 : 1))

      const sc = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100)
      cam.position.set(0, 0.4, 9.2)
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.setSize(el.clientWidth, el.clientHeight); el.appendChild(r.domElement)
      const grupo = new THREE.Group(); sc.add(grupo); grupo.rotation.set(giro.current.x, giro.current.y, 0)
      const tirar: { dispose(): void }[] = []
      const poner = <T,>(o: T) => { grupo.add(o as any); const m = o as any; if (m.geometry) tirar.push(m.geometry); if (m.material) tirar.push(m.material); return o }

      // Mota blanda (degradado radial) para que se fundan en una masa, no en puntitos.
      const cv = document.createElement('canvas'); cv.width = cv.height = 64
      const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(0.7, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      const tx = new THREE.CanvasTexture(cv); tirar.push(tx)
      // Texto como imagen (letras de sesión, "6 semanas sin venir").
      const rotulo = (txt: string, color: string, w = 64, h = 64, px = 40) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const k = c.getContext('2d')!
        k.font = `600 ${px}px system-ui, sans-serif`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillStyle = color; k.fillText(txt, w / 2, h / 2 + 2)
        const t = new THREE.CanvasTexture(c); tirar.push(t); return t
      }

      // LA NIEBLA. El color de cada mota depende de la vista y de la cita en la que cae.
      const NP = 2000, p3 = new Float32Array(NP * 3), col = new Float32Array(NP * 3)
      const sem = Array.from({ length: NP }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.pow(Math.random(), 0.9) * 0.85 }))
      const base = new THREE.Color(alerta ? 0xC46E6E : 0x5A969E), rojoC = new THREE.Color(0xC0392B), tmp = new THREE.Color()
      sem.forEach((s, i) => {
        const c = citas[Math.round(s.u * (N - 1))]
        if (vista === 'sesiones') tmp.set(c.estado === 'falta' || c.estado === 'cancelada' ? 0xC9C6BF : colSes[c.ses] ?? 0xC9C6BF)
        else if (vista === 'molestias') tmp.set(0x5A969E).lerp(rojoC, interp(rojo, s.u) * 0.85)
        else tmp.copy(base)
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b
      })
      const gN = new THREE.BufferGeometry(); gN.setAttribute('position', new THREE.BufferAttribute(p3, 3)); gN.setAttribute('color', new THREE.BufferAttribute(col, 3))
      poner(new THREE.Points(gN, new THREE.PointsMaterial({ size: 2.1, map: tx, transparent: true, opacity: 0.075, depthWrite: false, vertexColors: true })))

      // EL HAZ: un tubo por cada tramo seguido (en una pausa también se corta),
      // por la curva del trabajo y engordado según la intensidad.
      const mn = Math.min(...trabajo), mx = Math.max(...trabajo), rg = mx - mn || 1
      const cortes = [-1, ...huecos.map(h => h.i), N - 1]
      for (let k = 0; k < cortes.length - 1; k++) {
        const a = cortes[k] + 1, z = cortes[k + 1]; if (z - a < 1) continue
        const M = Math.max(8, (z - a) * 6)
        const pts = Array.from({ length: M + 1 }, (_, j) => { const f = a + (z - a) * j / M; return new THREE.Vector3(xF(f), ((interp(trabajo, f / (N - 1)) - mn) / rg - 0.5) * 1.4, 0) })
        const curva = new THREE.CatmullRomCurve3(pts), SEG = Math.max(20, (z - a) * 5), RAD = 10
        const gH = new THREE.TubeGeometry(curva, SEG, 0.1, RAD, false)
        const P = gH.attributes.position, cen = curva.getSpacedPoints(SEG)
        for (let q = 0; q <= SEG; q++) {
          const kk = 0.35 + interp(intens, (a + (z - a) * q / SEG) / (N - 1)) * 1.3, c = cen[q]
          for (let j = 0; j <= RAD; j++) { const id = q * (RAD + 1) + j; P.setXYZ(id, c.x + (P.getX(id) - c.x) * kk, c.y + (P.getY(id) - c.y) * kk, c.z + (P.getZ(id) - c.z) * kk) }
        }
        poner(new THREE.Mesh(gH, new THREE.MeshBasicMaterial({ color: 0xffffff })))
      }
      // Debajo de cada corte: cuánto tardó en volver.
      huecos.forEach(h => {
        const sem = Math.round(h.dias / 7), txt = sem < 9 ? `${sem} semanas sin venir` : `${Math.round(h.dias / 30)} meses sin venir`
        const sp = poner(new THREE.Sprite(new THREE.SpriteMaterial({ map: rotulo(txt, '#8A8C88', 512, 64, 40), transparent: true, depthWrite: false })))
        sp.scale.set(2.8, 0.35, 1); sp.position.set((X[h.i] + X[h.i + 1]) / 2, -RADIO * 1.15, 0)
      })

      const aroEn = (x: number, radio: number, color: number, op: number) => {
        const a = poner(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, k) => { const t = k / 48 * Math.PI * 2; return new THREE.Vector3(0, Math.sin(t) * radio, Math.cos(t) * radio) })),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })))
        a.position.x = x
      }
      // Hoy: aro fino naranja (solo si hoy cae dentro de lo que se mira).
      if (hoy >= 0 && hoy < N) aroEn(X[hoy], RADIO * 1.25, 0xE4572E, 0.8)

      // VISTA CAMBIOS: un aro en cada falta, cancelada, cambio de día u hora o de sesión.
      if (vista === 'cambios') citas.forEach((c, i) => {
        const color = c.estado === 'falta' ? COL_CAMBIO.falta : c.estado === 'cancelada' ? COL_CAMBIO.cancelada : c.movida ? COL_CAMBIO.movida : c.cambioSesion ? COL_CAMBIO.sesion : 0
        if (color) aroEn(X[i], RADIO * 0.75, color, 0.75)
      })
      // VISTA SESIONES: la letra encima de cada día (× si faltó). Con muchas no caben.
      if (vista === 'sesiones' && N <= 60) citas.forEach((c, i) => {
        const hizo = c.estado === 'realizada' || c.estado === 'programada'
        if (hizo && !c.ses) return
        const sp = poner(new THREE.Sprite(new THREE.SpriteMaterial({ map: rotulo(hizo ? c.ses : '×', hizo ? hex(colSes[c.ses] ?? 0x8A8C88) : '#B05A5A'), transparent: true, depthWrite: false, opacity: c.estado === 'programada' ? 0.5 : 1 })))
        sp.scale.set(0.32, 0.32, 1); sp.position.set(X[i], RADIO * 1.05 * escala[i], 0)
      })
      // VISTA OBJETIVOS: una luz en cada día que se trabajó, más grande y más viva cuanto
      // más veces lleva hecho ese objetivo. Lo programado, apagado: aún no se ha hecho.
      const luces: { sp: any, a: number, op: number }[] = []
      if (vista === 'objetivos') {
        const ids = Object.keys(colObj)
        const max = Math.max(1, ...ids.map(o => citas.filter(c => c.estado === 'realizada' && c.objs.includes(o)).length))
        ids.forEach((o, k) => {
          const a0 = k * Math.PI * 2 / ids.length; let hechas = 0
          citas.forEach((c, i) => {
            if (!c.objs.includes(o) || c.estado === 'falta' || c.estado === 'cancelada') return
            if (c.estado === 'realizada') hechas++
            const f = hechas / max, prog = c.estado === 'programada'
            const sp = poner(new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: colObj[o], transparent: true, depthWrite: false, opacity: prog ? 0.1 : 0.12 + 0.6 * f })))
            const s = prog ? 0.25 : 0.25 + 0.45 * f; sp.scale.set(s, s, 1)
            sp.position.set(X[i], Math.sin(a0) * 0.6, Math.cos(a0) * 0.6)
            luces.push({ sp, a: a0, op: sp.material.opacity })
          })
        })
      }

      // Girar arrastrando; un toque sin arrastrar es "ampliar".
      let ini: any = null
      const abajo = (e: PointerEvent) => { ini = { x: e.clientX, y: e.clientY, rx: grupo.rotation.x, ry: grupo.rotation.y }; el.setPointerCapture(e.pointerId) }
      const mover = (e: PointerEvent) => { if (!ini) return
        grupo.rotation.y = ini.ry + (e.clientX - ini.x) * 0.008; grupo.rotation.x = Math.max(-1.4, Math.min(1.4, ini.rx + (e.clientY - ini.y) * 0.008))
        giro.current = { x: grupo.rotation.x, y: grupo.rotation.y } }
      const arriba = (e: PointerEvent) => { const movio = ini && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 4; ini = null; if (!movio) toque.current?.() }
      el.addEventListener('pointerdown', abajo); el.addEventListener('pointermove', mover); el.addEventListener('pointerup', arriba)
      const ro = new ResizeObserver(() => { cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); r.setSize(el.clientWidth, el.clientHeight) })
      ro.observe(el)

      const bucle = (t = 0) => {
        for (let i = 0; i < NP; i++) {
          const s = sem[i]; s.a += 0.004
          const f = s.u * (N - 1), k = interp(escala, s.u) * RADIO * s.r
          p3[i * 3] = xF(f); p3[i * 3 + 1] = Math.sin(s.a) * k; p3[i * 3 + 2] = Math.cos(s.a) * k
        }
        gN.attributes.position.needsUpdate = true
        // Las luces de los objetivos giran despacio dentro y laten un poco.
        luces.forEach(l => { l.a += 0.006; l.sp.position.y = Math.sin(l.a) * 0.55; l.sp.position.z = Math.cos(l.a) * 0.55; l.sp.material.opacity = l.op * (0.8 + 0.2 * Math.sin(t / 700 + l.sp.position.x)) })
        r.render(sc, cam); raf = requestAnimationFrame(bucle)
      }
      bucle()
      limpiar = () => {
        cancelAnimationFrame(raf); ro.disconnect()
        el.removeEventListener('pointerdown', abajo); el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', arriba)
        tirar.forEach(x => x.dispose()); r.dispose(); r.domElement.remove()
      }
    })()
    return () => { vivo = false; limpiar() }
  }, [citas, vista, colSes, colObj, hoy, alerta])

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div ref={caja} style={{ position: 'absolute', inset: 0, cursor: 'grab', touchAction: 'none' }}/>
      <span style={{ position: 'absolute', left: 8, bottom: 4, fontSize: 10.5, color: 'var(--grl)' }}>{fechaIni}</span>
      <span style={{ position: 'absolute', right: 8, bottom: 4, fontSize: 10.5, color: 'var(--grl)' }}>{fechaFin}</span>
    </div>
  )
}
