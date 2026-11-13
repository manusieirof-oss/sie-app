import * as THREE from 'three'
import { cargaRig, dec } from './motor'

/**
 * EL CUERPO DEL FILTRO DE LA BIBLIOTECA (sin React: lo envuelve components/FiltroCuerpo).
 *
 * El mismo cuerpo que las animaciones y el mapa de calor, de pie y girando solo. Se
 * arrastra para girarlo a mano. Los músculos elegidos se encienden (grupos de la malla
 * de cuerpo-rig.json) y las articulaciones elegidas son una esfera de luz.
 *
 * Las ETIQUETAS NO SE PINTAN AQUÍ: son HTML encima (para que siempre se lean de
 * izquierda a derecha). Cada fotograma se avisa de dónde cae cada ancla en pantalla y
 * cuánto mira hacia delante (0 detrás, 1 delante), y el componente las coloca.
 */

export interface Ancla { k: string, p: [number, number, number] }
/** Dónde cae en pantalla el rótulo (x, y, en su órbita) y su zona (ax, ay), y cuánto mira hacia delante. */
export interface Proyeccion { k: string, x: number, y: number, ax: number, ay: number, frente: number }
export interface CuerpoFiltro3D {
  anclas(a: Ancla[]): void
  musculos(grupos: string[]): void
  articulaciones(puntos: [number, number, number][]): void
  destruir(): void
}

const VEL_GIRO = 0.22
const PAUSA = 2500

export async function crearCuerpoFiltro(el: HTMLElement, alFotograma: (l: Proyeccion[]) => void): Promise<CuerpoFiltro3D> {
  const RIG = await cargaRig()
  const W = () => el.clientWidth || 400, H = () => el.clientHeight || 500
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.setSize(W(), H(), false)
  // Encima de los rótulos de detrás (z 5) y debajo de los de delante (z 30+): así el cuerpo los tapa.
  r.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none;position:relative;z-index:20'
  el.prepend(r.domElement)
  const escena = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(28, W() / H(), 1, 2000)
  cam.position.set(0, 46, 205); cam.lookAt(0, 44, 0)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(dec(RIG.pos, Float32Array), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(dec(RIG.nor, Float32Array), 3))
  geo.setIndex(new THREE.BufferAttribute(dec(RIG.idx, Uint16Array), 1))
  geo.setAttribute('mid', new THREE.BufferAttribute(dec(RIG.mid, Float32Array), 1))
  geo.setAttribute('mm', new THREE.BufferAttribute(dec(RIG.mm, Float32Array), 1))
  const NM = RIG.musculos.length
  const uM = { value: new Array(NM).fill(0) }
  // Cuerpo de "cristal" verde (como en la ficha) y los músculos elegidos en ámbar.
  const mat = new THREE.ShaderMaterial({
    uniforms: { uM, base: { value: new THREE.Color('#5A969E') }, luz: { value: new THREE.Color('#E0B24F') } },
    vertexShader: `attribute float mid; attribute float mm; uniform float uM[${NM}];
      varying vec3 vN; varying vec3 vV; varying float vC;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.);
        vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        vC = uM[int(mid + .5)] * mm; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 base; uniform vec3 luz; varying vec3 vN; varying vec3 vV; varying float vC;
      void main(){ vec3 n = normalize(vN), v = normalize(vV);
        float f = pow(1.0-abs(dot(n,v)), 2.0);
        float d = .78 + .22*n.y;
        vec3 c = mix(base*1.12, base*.78, f) * d;
        c = mix(c, luz, smoothstep(0., .4, vC) * .9);
        float a = mix(.35, .95, f); a = max(a, smoothstep(0., .4, vC) * .92);
        gl_FragColor = vec4(c, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  const cuerpo = new THREE.Group()
  cuerpo.add(new THREE.Mesh(geo, mat))
  escena.add(cuerpo)
  const aro = new THREE.Mesh(new THREE.RingGeometry(11, 11.6, 64), new THREE.MeshBasicMaterial({ color: '#5A969E', transparent: true, opacity: .35, depthWrite: false }))
  aro.rotation.x = -Math.PI / 2; escena.add(aro)

  // Esferas de las articulaciones elegidas.
  const esfGeo = new THREE.SphereGeometry(1.6, 20, 14)
  let esferas: THREE.Mesh[] = []
  let lista: Ancla[] = []
  /* LOS RÓTULOS GIRAN CON EL CUERPO, EN ÓRBITA. Cada uno va en un círculo alrededor del
     cuerpo, a la altura de su zona y en su dirección: al girar pasan por delante (grandes)
     y por detrás (pequeños), sin saltos. Los que caen a la misma altura y casi en la misma
     dirección se separan un poco en el círculo para no ir encima unos de otros. */
  const RADIO = 25
  let angulos: Record<string, number> = {}
  const repartir = (a: Ancla[]) => {
    const out: Record<string, number> = {}
    const conAng = a.map(x => ({ k: x.k, y: x.p[1], t: Math.atan2(x.p[0], x.p[2]) }))
    const SEP = 0.5, BANDA = 7
    // Por franjas de altura: dentro de cada una, separación mínima en el círculo.
    const ys = conAng.slice().sort((p, q) => p.y - q.y)
    const usados = new Set<string>()
    ys.forEach(base => {
      if (usados.has(base.k)) return
      const grupo = ys.filter(o => !usados.has(o.k) && Math.abs(o.y - base.y) < BANDA)
      grupo.forEach(o => usados.add(o.k))
      const g = grupo.sort((p, q) => p.t - q.t)
      for (let it = 0; it < 30; it++) {
        for (let i = 1; i < g.length; i++) {
          const d = g[i].t - g[i - 1].t
          if (d < SEP) { const m = (SEP - d) / 2; g[i - 1].t -= m; g[i].t += m }
        }
      }
      g.forEach(o => { out[o.k] = o.t })
    })
    return out
  }

  // ── Girar: solo, o arrastrando ──
  let giro = 0, arr: { x: number } | null = null, pausa = 0
  const cv = r.domElement
  const abajo = (e: PointerEvent) => { arr = { x: e.clientX }; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = 'grabbing' }
  const mover = (e: PointerEvent) => { if (!arr) return; giro += (e.clientX - arr.x) * 0.012; arr.x = e.clientX; pausa = performance.now() + PAUSA }
  const arriba = () => { arr = null; pausa = performance.now() + PAUSA; cv.style.cursor = 'grab' }
  cv.addEventListener('pointerdown', abajo); cv.addEventListener('pointermove', mover); cv.addEventListener('pointerup', arriba); cv.addEventListener('pointercancel', arriba)
  const ro = new ResizeObserver(() => { r.setSize(W(), H(), false); cam.aspect = W() / H(); cam.updateProjectionMatrix() })
  ro.observe(el)

  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const v = new THREE.Vector3()
  let raf = 0, antes = performance.now()
  const bucle = (ahora: number) => {
    raf = requestAnimationFrame(bucle)
    if (document.hidden) { antes = ahora; return }
    const dt = Math.min((ahora - antes) / 1000, .1); antes = ahora
    if (!quieto && !arr && ahora > pausa) giro += dt * VEL_GIRO
    cuerpo.rotation.y = giro
    const late = 1 + .15 * Math.sin(ahora / 300)
    esferas.forEach(s => s.scale.setScalar(late))
    // Dónde cae cada ancla y si mira hacia delante.
    const c = Math.cos(giro), s = Math.sin(giro)
    const out: Proyeccion[] = lista.map(a => {
      const [x, y, z] = a.p
      // La zona, girada.
      v.set(x * c + z * s, y, -x * s + z * c).project(cam)
      const ax = (v.x + 1) / 2 * W(), ay = (1 - v.y) / 2 * H()
      // El rótulo, en su órbita.
      const t = (angulos[a.k] ?? Math.atan2(x, z)) + giro
      v.set(RADIO * Math.sin(t), y, RADIO * Math.cos(t)).project(cam)
      const frente = (Math.cos(t) + 1) / 2
      return { k: a.k, x: (v.x + 1) / 2 * W(), y: (1 - v.y) / 2 * H(), ax, ay, frente }
    })
    alFotograma(out)
    r.render(escena, cam)
  }
  raf = requestAnimationFrame(bucle)

  return {
    anclas(a) {
      const firma = a.map(x => x.k).join(',')
      if (firma !== lista.map(x => x.k).join(',')) angulos = repartir(a)
      lista = a
    },
    musculos(grupos) {
      uM.value = RIG.musculos.map(m => grupos.includes(m) ? 1 : 0)
      mat.uniforms.uM.value = uM.value
    },
    articulaciones(puntos) {
      esferas.forEach(e => { cuerpo.remove(e); (e.material as any).dispose() }); esferas = []
      puntos.forEach(p => {
        // Las dos del par (derecha e izquierda) si no está en el centro.
        const lados = Math.abs(p[0]) > .5 ? [p, [-p[0], p[1], p[2]] as [number, number, number]] : [p]
        lados.forEach(q => {
          const m = new THREE.Mesh(esfGeo, new THREE.MeshBasicMaterial({ color: '#E0B24F', transparent: true, opacity: .85, depthTest: false }))
          m.position.set(...q); m.renderOrder = 5; cuerpo.add(m); esferas.push(m)
        })
      })
    },
    destruir() {
      cancelAnimationFrame(raf); ro.disconnect()
      cv.removeEventListener('pointerdown', abajo); cv.removeEventListener('pointermove', mover); cv.removeEventListener('pointerup', arriba); cv.removeEventListener('pointercancel', arriba)
      esferas.forEach(e => (e.material as any).dispose()); esfGeo.dispose(); geo.dispose(); mat.dispose(); r.dispose(); cv.remove()
    },
  }
}
