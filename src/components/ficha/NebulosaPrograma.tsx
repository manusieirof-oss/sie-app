'use client'
import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// LA NEBULOSA DE SU PROGRAMACIÓN (ficha). La misma idea que el cubo del calor, pero en
// vez de paredes, una niebla tipo gel que se gira con el dedo:
//   · un tramo por cita, de izquierda (lo pasado) a derecha (lo programado);
//   · el HAZ de luz dentro: más alto, más trabajo; más grueso, más intenso;
//   · la NIEBLA se estrecha donde faltó o canceló y se abre donde vino de más;
//   · con alerta, la niebla en rojo atenuado; si no, el color de la clínica;
//   · HOY es un aro fino naranja.
// Three.js y no CSS: la niebla son cientos de motas blandas que se mueven despacio.
// ---------------------------------------------------------------------------

export default function NebulosaPrograma({ trabajo, intens, escala, hoy, alerta, fechaIni, fechaFin }: {
  /** Por cita, 0..1 aprox. */
  trabajo: number[], intens: number[], escala: number[]
  hoy: number, alerta: boolean, fechaIni: string, fechaFin: string
}) {
  const caja = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = caja.current
    if (!el || trabajo.length < 2) return
    let vivo = true, raf = 0, limpiar = () => {}
    ;(async () => {
      const THREE = await import('three')
      if (!vivo) return
      const N = trabajo.length
      const interp = (a: number[], u: number) => { const p = u * (N - 1), i = Math.floor(p), j = Math.min(N - 1, i + 1), t = p - i, s = (1 - Math.cos(Math.PI * t)) / 2; return a[i] + (a[j] - a[i]) * s }
      const LARGO = 8, RADIO = 1.7
      const sc = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100)
      cam.position.set(0, 0.4, 9.2)
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.setSize(el.clientWidth, el.clientHeight); el.appendChild(r.domElement)
      const grupo = new THREE.Group(); sc.add(grupo); grupo.rotation.set(0.35, -0.55, 0)

      // Mota blanda (degradado radial) para que se fundan en una masa, no en puntitos.
      const cv = document.createElement('canvas'); cv.width = cv.height = 64
      const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(0.7, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
      const tx = new THREE.CanvasTexture(cv)

      const NP = 2000, pos = new Float32Array(NP * 3)
      const sem = Array.from({ length: NP }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.pow(Math.random(), 0.9) * 0.85 }))
      const gN = new THREE.BufferGeometry(); gN.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mN = new THREE.PointsMaterial({ size: 2.1, map: tx, transparent: true, opacity: 0.075, depthWrite: false, color: alerta ? 0xC46E6E : 0x5A969E })
      grupo.add(new THREE.Points(gN, mN))

      // El haz: tubo por la curva del trabajo, engordado según la intensidad.
      const mn = Math.min(...trabajo), mx = Math.max(...trabajo), rg = mx - mn || 1
      const pts = Array.from({ length: 121 }, (_, i) => { const u = i / 120; return new THREE.Vector3((u - 0.5) * LARGO, ((interp(trabajo, u) - mn) / rg - 0.5) * 1.4, 0) })
      const curva = new THREE.CatmullRomCurve3(pts)
      const SEG = 200, RAD = 10, gH = new THREE.TubeGeometry(curva, SEG, 0.1, RAD, false)
      const P = gH.attributes.position, cen = curva.getSpacedPoints(SEG)
      for (let s = 0; s <= SEG; s++) {
        const k = 0.35 + interp(intens, s / SEG) * 1.3, c = cen[s]
        for (let j = 0; j <= RAD; j++) { const id = s * (RAD + 1) + j; P.setXYZ(id, c.x + (P.getX(id) - c.x) * k, c.y + (P.getY(id) - c.y) * k, c.z + (P.getZ(id) - c.z) * k) }
      }
      grupo.add(new THREE.Mesh(gH, new THREE.MeshBasicMaterial({ color: 0xffffff })))
      // Sin halo: sobre la niebla quedaba como una sombra gris; el haz va blanco y limpio.

      // Hoy: aro fino.
      const aro = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, k) => { const a = k / 64 * Math.PI * 2; return new THREE.Vector3(0, Math.sin(a) * RADIO * 1.25, Math.cos(a) * RADIO * 1.25) })),
        new THREE.LineBasicMaterial({ color: 0xE4572E, transparent: true, opacity: 0.8 }))
      aro.position.x = (Math.min(hoy, N - 1) / (N - 1) - 0.5) * LARGO; grupo.add(aro)

      // Girar arrastrando.
      let ini: any = null
      const abajo = (e: PointerEvent) => { ini = { x: e.clientX, y: e.clientY, rx: grupo.rotation.x, ry: grupo.rotation.y }; el.setPointerCapture(e.pointerId) }
      const mover = (e: PointerEvent) => { if (!ini) return; grupo.rotation.y = ini.ry + (e.clientX - ini.x) * 0.008; grupo.rotation.x = Math.max(-1.4, Math.min(1.4, ini.rx + (e.clientY - ini.y) * 0.008)) }
      const arriba = () => { ini = null }
      el.addEventListener('pointerdown', abajo); el.addEventListener('pointermove', mover); el.addEventListener('pointerup', arriba)
      const ro = new ResizeObserver(() => { cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); r.setSize(el.clientWidth, el.clientHeight) })
      ro.observe(el)

      const bucle = () => {
        for (let i = 0; i < NP; i++) {
          const s = sem[i]; s.a += 0.004
          const k = interp(escala, s.u) * RADIO * s.r
          pos[i * 3] = (s.u - 0.5) * LARGO; pos[i * 3 + 1] = Math.sin(s.a) * k; pos[i * 3 + 2] = Math.cos(s.a) * k
        }
        gN.attributes.position.needsUpdate = true
        r.render(sc, cam); raf = requestAnimationFrame(bucle)
      }
      bucle()
      limpiar = () => {
        cancelAnimationFrame(raf); ro.disconnect()
        el.removeEventListener('pointerdown', abajo); el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', arriba)
        r.dispose(); gN.dispose(); gH.dispose(); tx.dispose(); r.domElement.remove()
      }
    })()
    return () => { vivo = false; limpiar() }
  }, [trabajo, intens, escala, hoy, alerta])

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div ref={caja} style={{ position: 'absolute', inset: 0, cursor: 'grab', touchAction: 'none' }}/>
      <span style={{ position: 'absolute', left: 8, bottom: 4, fontSize: 10.5, color: 'var(--grl)' }}>{fechaIni}</span>
      <span style={{ position: 'absolute', right: 8, bottom: 4, fontSize: 10.5, color: 'var(--grl)' }}>{fechaFin}</span>
    </div>
  )
}
