import * as THREE from 'three'
import { cargaRig, dec } from './motor'
import { RAMPA, colorCalor } from '@/lib/rampaCalor'

/**
 * EL CUERPO DEL MAPA DE CALOR (sin React: lo envuelve components/MapaTrabajo).
 *
 * El mismo cuerpo que las animaciones, quieto y girando sobre fondo blanco:
 *   · La malla se tiñe por músculo (los grupos de cuerpo-rig.json) según su parte del
 *     trabajo: de blanco a amarillo, naranja y rojo.
 *   · Cada zona articular es una esfera de luz en su articulación, más grande y más roja
 *     cuanto más trabajo lleva. Se ven a través del cuerpo para que la espalda o la
 *     cadera no se escondan al girar.
 * Tocar una esfera la elige: el cuerpo deja de girar y la cámara se acerca a ella.
 */

export interface ValorZona { v: number, huesos: string[], off?: [number, number, number] }
export interface MapaCalor3D {
  poner(datos: { musculos: Record<string, number>, zonas: Record<string, ValorZona> }): void
  enfocar(zona: string | null): void
  destruir(): void
}


export async function crearMapaCalor(el: HTMLElement, ev: { zona?: (k: string | null) => void, encima?: (k: string | null) => void } = {}): Promise<MapaCalor3D> {
  const RIG = await cargaRig()
  const W = () => el.clientWidth, H = () => el.clientHeight
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.setSize(W(), H(), false)
  r.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab'
  el.prepend(r.domElement)
  const escena = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, W() / H(), 1, 2000)

  // Malla en reposo (de pie, brazos caídos): no hace falta esqueleto.
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(dec(RIG.pos, Float32Array), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(dec(RIG.nor, Float32Array), 3))
  geo.setIndex(new THREE.BufferAttribute(dec(RIG.idx, Uint16Array), 1))
  geo.setAttribute('mid', new THREE.BufferAttribute(dec(RIG.mid, Float32Array), 1))
  geo.setAttribute('mm', new THREE.BufferAttribute(dec(RIG.mm, Float32Array), 1))
  const NM = RIG.musculos.length
  const uM = { value: new Array(NM).fill(0) }
  const rampa = RAMPA.map(c => new THREE.Color(c))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uM, r0: { value: rampa[0] }, r1: { value: rampa[1] }, r2: { value: rampa[2] }, r3: { value: rampa[3] }, r4: { value: rampa[4] } },
    vertexShader: `attribute float mid; attribute float mm; uniform float uM[${NM}];
      varying vec3 vN; varying vec3 vV; varying float vC;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        vC = uM[int(mid + .5)] * mm; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 r0; uniform vec3 r1; uniform vec3 r2; uniform vec3 r3; uniform vec3 r4;
      varying vec3 vN; varying vec3 vV; varying float vC;
      vec3 rampa(float x){ x = clamp(x,0.,1.)*4.;
        if (x < 1.) return mix(r0,r1,x); if (x < 2.) return mix(r1,r2,x-1.); if (x < 3.) return mix(r2,r3,x-2.); return mix(r3,r4,x-3.); }
      void main(){ vec3 n = normalize(vN), v = normalize(vV);
        vec3 l1 = normalize(vec3(-.5,.8,.6)), l2 = normalize(vec3(.7,.2,.4));
        float d = max(dot(n,l1),0.)*.45 + max(dot(n,l2),0.)*.2 + .5;
        float rim = pow(1.-max(dot(n,v),0.), 3.)*.12;
        // El tinte del músculo entra suave: poco trabajo apenas colorea, mucho llega al rojo.
        vec3 c = mix(r0, rampa(.15 + vC*.8), smoothstep(0., .3, vC));
        gl_FragColor = vec4(c*d + rim, 1.); }`,
  })
  const cuerpo = new THREE.Group()
  cuerpo.add(new THREE.Mesh(geo, mat))
  escena.add(cuerpo)

  // Dónde está cada articulación (en reposo, sin girar).
  const H0: Record<string, THREE.Vector3> = {}
  RIG.huesos.forEach(h => { H0[h.n] = new THREE.Vector3(...h.x) })
  const centro = new THREE.Vector3(0, 41, 0)

  // ── Esferas de las zonas ──
  const esferaGeo = new THREE.SphereGeometry(1, 24, 16)
  let esferas: { k: string, nucleo: THREE.Mesh, halo: THREE.Mesh, v: number }[] = []
  const quitarEsferas = () => { esferas.forEach(e => { cuerpo.remove(e.nucleo); cuerpo.remove(e.halo); (e.nucleo.material as any).dispose(); (e.halo.material as any).dispose() }); esferas = [] }

  // ── Cámara y giro ──
  let giro = 0.4, autoGiro = true, pausaHasta = 0
  let dist = 200, distObj = 200
  const mira = centro.clone(), miraObj = centro.clone()
  let enfocada: string | null = null
  let arrastre: { x: number } | null = null, movido = 0
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2()
  const tocada = (e: PointerEvent): string | null => {
    const b = r.domElement.getBoundingClientRect()
    ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1)
    ray.setFromCamera(ptr, cam)
    const hit = ray.intersectObjects(esferas.flatMap(x => [x.halo, x.nucleo]))[0]
    return hit ? (hit.object.userData.k as string) : null
  }
  let encima: string | null = null
  const abajo = (e: PointerEvent) => { r.domElement.setPointerCapture(e.pointerId); arrastre = { x: e.clientX }; movido = 0; r.domElement.style.cursor = 'grabbing' }
  const mueve = (e: PointerEvent) => {
    if (arrastre) { const dx = e.clientX - arrastre.x; giro += dx * 0.01; movido += Math.abs(dx); arrastre = { x: e.clientX }; pausaHasta = performance.now() + 4000; return }
    const k = tocada(e)
    if (k !== encima) { encima = k; r.domElement.style.cursor = k ? 'pointer' : 'grab'; ev.encima?.(k) }
  }
  const arriba = (e: PointerEvent) => {
    r.domElement.style.cursor = 'grab'
    const fue = arrastre; arrastre = null
    if (fue && movido < 5) ev.zona?.(tocada(e))   // un toque, no un arrastre
  }
  r.domElement.addEventListener('pointerdown', abajo)
  r.domElement.addEventListener('pointermove', mueve)
  r.domElement.addEventListener('pointerup', arriba)
  const ro = new ResizeObserver(() => { if (!W() || !H()) return; r.setSize(W(), H(), false); cam.aspect = W() / H(); cam.updateProjectionMatrix() })
  ro.observe(el)
  let aLaVista = true
  const io = new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting })
  io.observe(el)

  let raf = 0, antes = performance.now(), vivo = true
  const bucle = (ahora: number) => {
    if (!vivo) return
    raf = requestAnimationFrame(bucle)
    if (!aLaVista || document.hidden) { antes = ahora; return }
    const dt = Math.min(0.1, (ahora - antes) / 1000); antes = ahora
    if (autoGiro && !arrastre && ahora > pausaHasta) giro += dt * 0.3
    cuerpo.rotation.y = giro
    dist += (distObj - dist) * Math.min(1, dt * 4)
    mira.lerp(miraObj, Math.min(1, dt * 4))
    cam.position.set(mira.x, mira.y + 8, mira.z + dist)
    cam.lookAt(mira)
    // Las esferas laten un poco; la elegida, más.
    esferas.forEach(e => {
      const late = 1 + (e.k === enfocada ? 0.15 : 0.05) * Math.sin(ahora / 300)
      // Más pequeñas de cerca: al acercarse a una zona no deben taparla.
      const base = (0.7 + 1.5 * e.v) * (0.55 + 0.45 * Math.min(1, dist / 200))
      e.nucleo.scale.setScalar(base * late)
      e.halo.scale.setScalar(base * 1.8 * late)
    })
    r.render(escena, cam)
  }
  raf = requestAnimationFrame(bucle)

  const api: MapaCalor3D = {
    poner({ musculos, zonas }) {
      RIG.musculos.forEach((id, i) => { uM.value[i] = Math.max(0, Math.min(1, musculos[id] || 0)) })
      quitarEsferas()
      Object.entries(zonas).forEach(([k, z]) => {
        if (!(z.v > 0)) return
        const color = new THREE.Color(colorCalor(0.25 + z.v * 0.75))
        z.huesos.forEach(hn => {
          const h = H0[hn]; if (!h) return
          const p = h.clone().add(new THREE.Vector3(...(z.off || [0, 0, 0])))
          // Encima del cuerpo siempre (depthTest apagado): se ve también lo de detrás.
          const nucleo = new THREE.Mesh(esferaGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }))
          const halo = new THREE.Mesh(esferaGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthTest: false }))
          nucleo.position.copy(p); halo.position.copy(p)
          nucleo.renderOrder = 3; halo.renderOrder = 2
          nucleo.userData.k = k; halo.userData.k = k
          cuerpo.add(halo); cuerpo.add(nucleo)
          esferas.push({ k, nucleo, halo, v: z.v })
        })
      })
      if (enfocada && !zonas[enfocada]) api.enfocar(null)
    },
    enfocar(zona) {
      enfocada = zona
      const e = zona ? esferas.find(x => x.k === zona) : null
      if (e) {
        // Se gira el cuerpo para que esa articulación quede de cara (o de lado si es lateral).
        const p = e.nucleo.position
        autoGiro = false
        giro = Math.abs(p.x) > 6 ? (p.x > 0 ? -Math.PI / 4 : Math.PI / 4) : 0
        miraObj.set(p.x * Math.cos(giro) + p.z * Math.sin(giro), p.y, 0)
        distObj = 85
      } else {
        autoGiro = true; miraObj.copy(centro); distObj = 200
      }
    },
    destruir() {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      r.domElement.removeEventListener('pointerdown', abajo)
      r.domElement.removeEventListener('pointermove', mueve)
      r.domElement.removeEventListener('pointerup', arriba)
      quitarEsferas(); esferaGeo.dispose(); geo.dispose(); mat.dispose(); r.dispose(); r.domElement.remove()
    },
  }
  return api
}
