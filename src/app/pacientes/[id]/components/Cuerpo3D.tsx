'use client'
import { useEffect, useRef, useState } from 'react'
import type { MarcaCuerpo } from './Silueta'

/**
 * Un punto del cuerpo con todo lo que cae en él. Lo arma `Silueta`, que ya sabía
 * agrupar y decidir el color; aquí solo se pinta.
 */
export type Foco3D = {
  clave: string
  p: [number, number, number]
  n: [number, number, number]
  color: string
  /** Resuelto: se ve, pero sin latir y más pequeño, para que no compita con lo activo. */
  apagado?: boolean
  marcas: MarcaCuerpo[]
}

// El verde de la clínica (--g y --gd en globals.css). Va en hex porque el shader no
// entiende variables CSS.
const VERDE = '#5A969E'

// Una vuelta completa cada ~22 s: se nota que gira, pero no marea mientras se lee.
const VEL_GIRO = 0.28
// Tras soltar el arrastre, cuánto espera antes de volver a girar solo.
const PAUSA_TRAS_TOCAR = 3000

export default function Cuerpo3D({ focos, onAbrir, onFallo, alto = 520 }: {
  focos: Foco3D[]
  onAbrir?: (m: MarcaCuerpo[]) => void
  /** Sin WebGL (equipos viejos) se vuelve a la silueta plana. */
  onFallo?: () => void
  alto?: number
}) {
  const caja = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Foco3D | null>(null)
  const [cargando, setCargando] = useState(true)

  // Las props cambian sin rehacer la escena: el bucle las lee de refs.
  const onAbrirRef = useRef(onAbrir); onAbrirRef.current = onAbrir
  const onFalloRef = useRef(onFallo); onFalloRef.current = onFallo
  // `ponerFocos` lo rellena la escena cuando está lista; antes, los focos esperan.
  const ponerFocos = useRef<((f: Foco3D[]) => void) | null>(null)
  const focosRef = useRef(focos); focosRef.current = focos

  useEffect(() => {
    let vivo = true
    let limpiar = () => {}

    ;(async () => {
      // Import dinámico: three pesa y solo hace falta al abrir el mapa corporal.
      const THREE = await import('three')
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
      const el = caja.current
      if (!vivo || !el) return

      let renderer: InstanceType<typeof THREE.WebGLRenderer>
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      } catch {
        onFalloRef.current?.()
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      const ancho = () => el.clientWidth || 300
      renderer.setSize(ancho(), alto)
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.touchAction = 'pan-y'   // en el móvil se puede seguir haciendo scroll
      el.appendChild(renderer.domElement)

      const escena = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(30, ancho() / alto, 1, 1000)
      cam.position.set(0, 47, 190)
      cam.lookAt(0, 44, 0)

      // Todo lo que gira cuelga de este grupo: cuerpo y marcas a la vez.
      const cuerpo = new THREE.Group()
      escena.add(cuerpo)

      // Material de "cristal": casi transparente de frente y marcado en los bordes
      // (efecto fresnel). Así se lee la forma del cuerpo y a la vez se ve lo que hay
      // detrás. Se pinta dos veces: primero las caras de dentro, muy suaves, para que
      // se intuya el volumen al girar; luego las de fuera.
      const verde = new THREE.Color(VERDE)
      const cristal = (lado: typeof THREE.FrontSide | typeof THREE.BackSide, a0: number, a1: number) =>
        new THREE.ShaderMaterial({
          uniforms: { c: { value: verde }, a0: { value: a0 }, a1: { value: a1 } },
          vertexShader: `varying vec3 vN; varying vec3 vV;
            void main(){ vec4 mv = modelViewMatrix*vec4(position,1.);
              vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
              gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `uniform vec3 c; uniform float a0; uniform float a1; varying vec3 vN; varying vec3 vV;
            void main(){ vec3 n = normalize(vN);
              float f = pow(1.0-abs(dot(n,normalize(vV))), 2.2);
              float luz = 0.88 + 0.12*n.y;
              gl_FragColor = vec4(mix(c*1.15, c*0.8, f)*luz, mix(a0,a1,f)); }`,
          transparent: true, depthWrite: false, side: lado,
        })

      // Peana: un aro y una sombra suave, para que el cuerpo no flote en el vacío.
      const aro = new THREE.Mesh(new THREE.RingGeometry(9, 9.6, 64),
        new THREE.MeshBasicMaterial({ color: verde, transparent: true, opacity: .35, depthWrite: false }))
      aro.rotation.x = -Math.PI / 2
      const sombra = new THREE.Mesh(new THREE.CircleGeometry(9, 48),
        new THREE.MeshBasicMaterial({ color: verde, transparent: true, opacity: .08, depthWrite: false }))
      sombra.rotation.x = -Math.PI / 2
      escena.add(aro, sombra)

      // Halo de las marcas: un degradado radial en blanco que luego se tiñe.
      const halo = (() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128
        const x = cv.getContext('2d')!
        const g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)')
        x.fillStyle = g; x.fillRect(0, 0, 128, 128)
        return new THREE.CanvasTexture(cv)
      })()

      type Obj = {
        f: Foco3D
        brillo: InstanceType<typeof THREE.Sprite>
        nucleo: InstanceType<typeof THREE.Mesh>
        toque: InstanceType<typeof THREE.Mesh>
      }
      let objs: Obj[] = []
      const geoNucleo = new THREE.SphereGeometry(1.1, 20, 14)
      const geoToque = new THREE.SphereGeometry(2.6, 10, 8)
      const matToque = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })

      ponerFocos.current = (fs: Foco3D[]) => {
        objs.forEach(o => {
          cuerpo.remove(o.brillo, o.nucleo, o.toque)
          ;(o.brillo.material as any).dispose(); (o.nucleo.material as any).dispose()
        })
        objs = fs.map(f => {
          // depthTest:false = se ven siempre, también a través del cuerpo. Que estén
          // delante o detrás lo cuenta la opacidad, que se recalcula al girar.
          const brillo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: f.color, transparent: true, depthTest: false, depthWrite: false }))
          const nucleo = new THREE.Mesh(geoNucleo, new THREE.MeshBasicMaterial({ color: f.color, transparent: true, depthTest: false, depthWrite: false }))
          const toque = new THREE.Mesh(geoToque, matToque)
          ;[brillo, nucleo, toque].forEach(o => o.position.set(...f.p))
          brillo.renderOrder = 5; nucleo.renderOrder = 6
          cuerpo.add(brillo, nucleo, toque)
          return { f, brillo, nucleo, toque }
        })
      }
      ponerFocos.current(focosRef.current)

      try {
        const gltf = await new GLTFLoader().loadAsync('/cuerpo3d.glb')
        if (!vivo) { renderer.dispose(); return }
        const malla = gltf.scene.getObjectByProperty('type', 'Mesh') as InstanceType<typeof THREE.Mesh>
        malla.geometry.computeVertexNormals()
        const dentro = new THREE.Mesh(malla.geometry, cristal(THREE.BackSide, 0.06, 0.25))
        const fuera = new THREE.Mesh(malla.geometry, cristal(THREE.FrontSide, 0.2, 0.92))
        dentro.renderOrder = 1; fuera.renderOrder = 2
        cuerpo.add(dentro, fuera)
      } catch {
        onFalloRef.current?.()
      }
      if (vivo) setCargando(false)

      // ── Interacción ─────────────────────────────────────────────────────────
      const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      let giro = 0
      let arrastre: { x: number, total: number } | null = null
      let pausaHasta = 0
      let encima: Obj | null = null
      const ray = new THREE.Raycaster()
      const ptr = new THREE.Vector2()

      const tocado = (e: PointerEvent): Obj | null => {
        const r = renderer.domElement.getBoundingClientRect()
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ptr, cam)
        const hit = ray.intersectObjects(objs.map(o => o.toque), false)[0]
        return hit ? objs.find(o => o.toque === hit.object) || null : null
      }
      const cv = renderer.domElement
      const abajo = (e: PointerEvent) => { arrastre = { x: e.clientX, total: 0 }; cv.setPointerCapture?.(e.pointerId) }
      const mover = (e: PointerEvent) => {
        if (arrastre) {
          const dx = e.clientX - arrastre.x
          arrastre.x = e.clientX; arrastre.total += Math.abs(dx)
          giro += dx * 0.012
          pausaHasta = performance.now() + PAUSA_TRAS_TOCAR
        }
        const o = tocado(e)
        if (o !== encima) { encima = o; setHover(o ? o.f : null) }
        cv.style.cursor = o ? 'pointer' : arrastre ? 'grabbing' : 'grab'
      }
      const arriba = (e: PointerEvent) => {
        // Un clic de verdad, no el final de un arrastre.
        if (arrastre && arrastre.total < 6) {
          const o = tocado(e)
          // En pantallas táctiles no hay "pasar por encima": el toque muestra la etiqueta.
          if (e.pointerType !== 'mouse') { encima = o; setHover(o ? o.f : null) }
          if (o) onAbrirRef.current?.(o.f.marcas)
        }
        arrastre = null
        pausaHasta = performance.now() + PAUSA_TRAS_TOCAR
      }
      const salir = () => { if (encima) { encima = null; setHover(null) } }
      cv.addEventListener('pointerdown', abajo)
      cv.addEventListener('pointermove', mover)
      cv.addEventListener('pointerup', arriba)
      cv.addEventListener('pointerleave', salir)

      const ro = new ResizeObserver(() => {
        renderer.setSize(ancho(), alto)
        cam.aspect = ancho() / alto
        cam.updateProjectionMatrix()
      })
      ro.observe(el)

      // Sin pintar cuando no se ve (fuera de pantalla al bajar en la ficha, o en otra
      // pestaña): antes giraba a 60 fotogramas por segundo todo el rato que la ficha
      // estaba abierta, y eso es lo que hacía que el resto de la web fuera a tirones.
      let aLaVista = true
      const io = new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting })
      io.observe(el)

      // ── Bucle ───────────────────────────────────────────────────────────────
      let raf = 0
      let antes = performance.now()
      const v = new THREE.Vector3()
      const bucle = (ahora: number) => {
        raf = requestAnimationFrame(bucle)
        if (!aLaVista || document.hidden) { antes = ahora; return }
        const dt = Math.min((ahora - antes) / 1000, 0.1); antes = ahora
        // Gira solo si nadie lo está tocando ni mirando una marca.
        if (!quieto && !arrastre && !encima && ahora > pausaHasta) giro += dt * VEL_GIRO
        cuerpo.rotation.y = giro

        const cos = Math.cos(giro), sin = Math.sin(giro)
        objs.forEach(o => {
          // ¿La zona mira hacia la cámara? Con la cámara en +z basta la z de la normal
          // ya girada. De cara: nítida y grande. De espaldas: se transparenta.
          const [nx, , nz] = o.f.n
          const zc = nz * cos - nx * sin
          const t = Math.min(1, Math.max(0, (zc + 0.35) / 0.6))
          const late = o.f.apagado ? 1 : 1 + 0.12 * Math.sin(ahora / 320)
          const base = o.f.apagado ? 5 : 6.5
          o.brillo.scale.setScalar((base + 2.5 * t) * late * (o === encima ? 1.25 : 1))
          ;(o.brillo.material as any).opacity = 0.28 + 0.62 * t
          ;(o.nucleo.material as any).opacity = 0.35 + 0.65 * t
        })

        // La etiqueta sigue a la marca mientras gira (sin re-render de React).
        if (encima && tipRef.current) {
          o2screen(encima.nucleo, v)
          tipRef.current.style.transform = `translate(${v.x}px, ${v.y}px) translate(-50%, calc(-100% - 14px))`
        }
        renderer.render(escena, cam)
      }
      const o2screen = (obj: InstanceType<typeof THREE.Object3D>, out: InstanceType<typeof THREE.Vector3>) => {
        obj.getWorldPosition(out).project(cam)
        out.set((out.x + 1) / 2 * ancho(), (1 - out.y) / 2 * alto, 0)
      }
      raf = requestAnimationFrame(bucle)

      limpiar = () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        io.disconnect()
        cv.removeEventListener('pointerdown', abajo)
        cv.removeEventListener('pointermove', mover)
        cv.removeEventListener('pointerup', arriba)
        cv.removeEventListener('pointerleave', salir)
        escena.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
        halo.dispose()
        renderer.dispose()
        cv.remove()
        ponerFocos.current = null
      }
    })()

    return () => { vivo = false; limpiar() }
  }, [alto])

  // Cuando cambian las molestias (se añade o se resuelve una) solo se rehacen las marcas.
  useEffect(() => { ponerFocos.current?.(focos) }, [focos])

  return (
    <div ref={caja} style={{ position: 'relative', width: '100%', height: alto, userSelect: 'none' }}>
      {cargando && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--grl)' }}>
          Cargando cuerpo…
        </div>
      )}
      {hover && (
        <div ref={tipRef} style={{
          position: 'absolute', left: 0, top: 0, pointerEvents: 'none',
          background: 'var(--n)', color: '#fff', padding: '7px 10px', borderRadius: 7,
          whiteSpace: 'nowrap', fontSize: 12, lineHeight: 1.5, zIndex: 4, boxShadow: 'var(--sh-md)',
        }}>
          {hover.marcas.map(m => (
            <div key={m.id}>
              {m.titulo}
              {m.detalle && <span style={{ color: 'rgba(255,255,255,.6)' }}> · {m.detalle}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
