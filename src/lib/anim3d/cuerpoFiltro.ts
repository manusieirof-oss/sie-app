import * as THREE from 'three'
import { cargaRig, dec } from './motor'
import type { Pose } from './tipos'

/**
 * EL CUERPO DEL FILTRO DE LA BIBLIOTECA (sin React: lo envuelve components/FiltroCuerpo).
 *
 * El mismo cuerpo que las animaciones, CON ESQUELETO: gira solo, se arrastra para girarlo
 * a mano y se pone en la postura de lo que se filtra (sentado, tumbado, a cuatro patas,
 * a una pierna…), pasando de una a otra suavemente. Los músculos elegidos se encienden
 * (grupos de la malla de cuerpo-rig.json) y las articulaciones elegidas son una luz.
 *
 * Las ETIQUETAS NO SE PINTAN AQUÍ: son HTML encima (para que siempre se lean de
 * izquierda a derecha). Cada fotograma se avisa de dónde cae cada ancla en pantalla y
 * cuánto mira hacia delante. Las anclas van pegadas a su hueso: si el cuerpo se tumba,
 * las etiquetas se van con él.
 */

type P3 = [number, number, number]
export interface Ancla { k: string, p: P3 }
/** Dónde cae en pantalla el rótulo (x, y, en su órbita) y su zona (ax, ay), y cuánto mira hacia delante. */
export interface Proyeccion { k: string, x: number, y: number, ax: number, ay: number, frente: number }
export interface CuerpoFiltro3D {
  anclas(a: Ancla[]): void
  musculos(grupos: string[]): void
  articulaciones(puntos: P3[]): void
  /** Acercarse a una zona (deja de girar y la pone de frente) o volver (null). */
  enfocar(p: P3 | null): void
  /** Acercarse a un hueso, siga donde siga con la postura (la mano para el agarre). */
  enfocarHueso(nombre: string | null): void
  /** La postura del cuerpo (ángulos por hueso, como las animaciones). {} = de pie. */
  postura(p: Pose): void
  destruir(): void
}

const VEL_GIRO = 0.22
const PAUSA = 2500
const rad = THREE.MathUtils.degToRad

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

  // ── Cuerpo con esqueleto ──
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(dec(RIG.pos, Float32Array), 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(dec(RIG.nor, Float32Array), 3))
  geo.setIndex(new THREE.BufferAttribute(dec(RIG.idx, Uint16Array), 1))
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(dec(RIG.si, Uint16Array), 4))
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(dec(RIG.sw, Float32Array), 4))
  geo.setAttribute('mid', new THREE.BufferAttribute(dec(RIG.mid, Float32Array), 1))
  geo.setAttribute('mm', new THREE.BufferAttribute(dec(RIG.mm, Float32Array), 1))
  const NM = RIG.musculos.length
  const uM = { value: new Array(NM).fill(0) }
  const huesos = RIG.huesos.map(h => { const b = new THREE.Bone(); b.name = h.n; return b })
  const H0: Record<string, THREE.Vector3> = {}          // posición local en reposo
  const W0: Record<string, THREE.Vector3> = {}          // posición en el cuerpo en reposo
  RIG.huesos.forEach((h, i) => {
    const b = huesos[i], p = h.p >= 0 ? RIG.huesos[h.p].x : [0, 0, 0]
    b.position.set(h.x[0] - p[0], h.x[1] - p[1], h.x[2] - p[2]); H0[h.n] = b.position.clone()
    W0[h.n] = new THREE.Vector3(...h.x)
    if (h.p >= 0) huesos[h.p].add(b)
  })
  const hueso: Record<string, THREE.Bone> = Object.fromEntries(huesos.map(b => [b.name, b]))
  const raiz = hueso.cadera
  const VERT = `#include <common>
    #include <skinning_pars_vertex>
    attribute float mid; attribute float mm;
    uniform float uM[${NM}];
    varying vec3 vN; varying vec3 vV; varying float vC;
    void main(){
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 mv = modelViewMatrix*vec4(transformed,1.);
      vN = normalize(normalMatrix*objectNormal); vV = normalize(-mv.xyz);
      vC = uM[int(mid + .5)] * mm;
      gl_Position = projectionMatrix*mv; }`
  // Cuerpo de "cristal" verde (como en la ficha) y los músculos elegidos en ámbar.
  const mat = new THREE.ShaderMaterial({
    uniforms: { uM, base: { value: new THREE.Color('#5A969E') }, luz: { value: new THREE.Color('#E0B24F') } },
    vertexShader: VERT,
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
  const malla = new THREE.SkinnedMesh(geo, mat)
  const esq = new THREE.Group(); esq.add(raiz)
  cuerpo.add(esq, malla); escena.add(cuerpo)
  esq.updateMatrixWorld(true)
  malla.bind(new THREE.Skeleton(huesos)); malla.frustumCulled = false
  const aro = new THREE.Mesh(new THREE.RingGeometry(11, 11.6, 64), new THREE.MeshBasicMaterial({ color: '#5A969E', transparent: true, opacity: .35, depthWrite: false }))
  aro.rotation.x = -Math.PI / 2; escena.add(aro)

  /* CADA ANCLA, PEGADA A SU HUESO. Se busca el trozo de esqueleto más cercano (de un
     hueso al siguiente; los del final, prolongados) y se guarda la distancia a ese hueso:
     así, aunque el cuerpo cambie de postura, el punto sigue en su sitio del cuerpo. */
  const PUNTA: Record<string, P3> = { cabeza: [0, 10, 0], manoD: [1.2, -7, 0], manoI: [-1.2, -7, 0], pieD: [0, -3, 7], pieI: [0, -3, 7] }
  const trozos: { b: string, a: THREE.Vector3, z: THREE.Vector3 }[] = []
  RIG.huesos.forEach(h => {
    const hijos = RIG.huesos.filter(x => x.p >= 0 && RIG.huesos[x.p].n === h.n)
    hijos.forEach(c => trozos.push({ b: h.n, a: W0[h.n], z: W0[c.n] }))
    if (PUNTA[h.n]) trozos.push({ b: h.n, a: W0[h.n], z: W0[h.n].clone().add(new THREE.Vector3(...PUNTA[h.n])) })
  })
  const seg = new THREE.Line3(), cerca = new THREE.Vector3()
  const pegar = (p: P3) => {
    const q = new THREE.Vector3(...p)
    let mejor = trozos[0], dist = Infinity
    trozos.forEach(t => { seg.set(t.a, t.z); seg.closestPointToPoint(q, true, cerca); const d = cerca.distanceTo(q); if (d < dist) { dist = d; mejor = t } })
    return { b: mejor.b, off: q.sub(W0[mejor.b]) }
  }
  const tmp = new THREE.Vector3(), inv = new THREE.Matrix4()
  /** Dónde está ahora un punto pegado, en coordenadas del cuerpo (sin el giro). */
  const ahoraEn = (pg: { b: string, off: THREE.Vector3 }, out: THREE.Vector3) => {
    out.copy(pg.off); hueso[pg.b].localToWorld(out)
    return out.applyMatrix4(inv.copy(cuerpo.matrixWorld).invert())
  }

  // Esferas de las articulaciones elegidas (pegadas a su hueso).
  const esfGeo = new THREE.SphereGeometry(1.6, 20, 14)
  let esferas: { m: THREE.Mesh, pg: { b: string, off: THREE.Vector3 } }[] = []
  let lista: (Ancla & { pg: { b: string, off: THREE.Vector3 } })[] = []

  /* LOS RÓTULOS GIRAN CON EL CUERPO, EN ÓRBITA. Cada uno va en un círculo alrededor del
     cuerpo, a la altura de su zona y en su dirección: al girar pasan por delante (grandes)
     y por detrás (pequeños), sin saltos. Los que caen a la misma altura y casi en la misma
     dirección se separan un poco en el círculo para no ir encima unos de otros. */
  const RADIO = 25
  let separa: Record<string, number> = {}       // cuánto se aparta cada uno de su dirección
  const repartir = (a: Ancla[]) => {
    const out: Record<string, number> = {}
    const conAng = a.map(x => ({ k: x.k, y: x.p[1], t0: Math.atan2(x.p[0], x.p[2]), t: Math.atan2(x.p[0], x.p[2]) }))
    const SEP = 0.5, BANDA = 7
    const ys = conAng.slice().sort((p, q) => p.y - q.y)
    const usados = new Set<string>()
    ys.forEach(base => {
      if (usados.has(base.k)) return
      const grupo = ys.filter(o => !usados.has(o.k) && Math.abs(o.y - base.y) < BANDA)
      grupo.forEach(o => usados.add(o.k))
      const g = grupo.sort((p, q) => p.t - q.t)
      for (let it = 0; it < 30; it++) for (let i = 1; i < g.length; i++) {
        const d = g[i].t - g[i - 1].t
        if (d < SEP) { const m = (SEP - d) / 2; g[i - 1].t -= m; g[i].t += m }
      }
      g.forEach(o => { out[o.k] = o.t - o.t0 })
    })
    return out
  }

  // ── Postura: de la actual a la pedida, suavemente ──
  const NOMBRES = ['raiz', ...RIG.huesos.map(h => h.n).filter(n => n !== 'cadera')]
  const actual: Record<string, THREE.Vector3> = Object.fromEntries(NOMBRES.map(n => [n, new THREE.Vector3()]))
  let objetivo: Pose = {}
  const PUNTOS_SUELO = ['cadera', 'lumbar', 'pecho', 'cuello', 'cabeza', 'brazoD', 'brazoI', 'antebrazoD', 'antebrazoI', 'manoD', 'manoI', 'musloD', 'musloI', 'piernaD', 'piernaI', 'pieD', 'pieI']
  const colocar = (dt: number) => {
    const k = Math.min(1, dt * 3)
    NOMBRES.forEach(n => {
      const o = objetivo[n] || [0, 0, 0], a = actual[n]
      a.x += (o[0] - a.x) * k; a.y += (o[1] - a.y) * k; a.z += (o[2] - a.z) * k
      const b = n === 'raiz' ? raiz : hueso[n]
      if (b) b.rotation.set(rad(a.x), rad(a.y), rad(a.z))
    })
    // Que apoye en el suelo: lo más bajo del esqueleto, a la altura del tobillo de pie.
    raiz.position.copy(H0.cadera)
    cuerpo.updateMatrixWorld(true)
    let min = Infinity
    PUNTOS_SUELO.forEach(n => { ahoraEn({ b: n, off: new THREE.Vector3() }, tmp); min = Math.min(min, tmp.y) })
    Object.entries(PUNTA).forEach(([n, off]) => { ahoraEn({ b: n, off: new THREE.Vector3(...off) }, tmp); min = Math.min(min, tmp.y + 2) })
    raiz.position.y += 3.8 - min
    cuerpo.updateMatrixWorld(true)
  }

  // ── Girar: solo, o arrastrando ──
  let giro = 0, arr: { x: number } | null = null, pausa = 0
  // ACERCARSE: el cuerpo gira hasta poner la zona de frente y la cámara se acerca a ella.
  let foco: { p?: P3, hueso?: string } | null = null
  const camPos = new THREE.Vector3(0, 46, 205), camMira = new THREE.Vector3(0, 44, 0)
  const camPosObj = camPos.clone(), camMiraObj = camMira.clone()
  const cv = r.domElement
  const abajo = (e: PointerEvent) => { arr = { x: e.clientX }; cv.setPointerCapture?.(e.pointerId); cv.style.cursor = 'grabbing' }
  const mover = (e: PointerEvent) => { if (!arr) return; giro += (e.clientX - arr.x) * 0.012; arr.x = e.clientX; pausa = performance.now() + PAUSA }
  const arriba = () => { arr = null; pausa = performance.now() + PAUSA; cv.style.cursor = 'grab' }
  cv.addEventListener('pointerdown', abajo); cv.addEventListener('pointermove', mover); cv.addEventListener('pointerup', arriba); cv.addEventListener('pointercancel', arriba)
  const ro = new ResizeObserver(() => { r.setSize(W(), H(), false); cam.aspect = W() / H(); cam.updateProjectionMatrix() })
  ro.observe(el)

  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const v = new THREE.Vector3(), q = new THREE.Vector3()
  let raf = 0, antes = performance.now()
  const bucle = (ahora: number) => {
    raf = requestAnimationFrame(bucle)
    if (document.hidden) { antes = ahora; return }
    const dt = Math.min((ahora - antes) / 1000, .1); antes = ahora
    colocar(dt)

    // Encuadre: el cuerpo entero, de pie o tumbado (lo que ocupa a lo alto y a lo ancho).
    let ymin = Infinity, ymax = -Infinity, rmax = 0
    PUNTOS_SUELO.forEach(n => { ahoraEn({ b: n, off: new THREE.Vector3() }, tmp); ymin = Math.min(ymin, tmp.y); ymax = Math.max(ymax, tmp.y); rmax = Math.max(rmax, Math.hypot(tmp.x, tmp.z)) })
    ymax += 10
    // El punto al que acercarse, si lo hay (ya en su postura).
    let pf: THREE.Vector3 | null = null
    if (foco?.hueso && hueso[foco.hueso]) pf = ahoraEn({ b: foco.hueso, off: new THREE.Vector3(...(PUNTA[foco.hueso] || [0, 0, 0])).multiplyScalar(.4) }, q)
    else if (foco?.p) pf = ahoraEn(pegar(foco.p), q)
    if (pf) {
      const rr = Math.hypot(pf.x, pf.z)
      if (foco?.hueso) {
        // UN HUESO (la mano): de lado, para que se vea entera y no de punta hacia la cámara.
        const giroFoco = Math.PI / 2 - Math.atan2(pf.x, pf.z)
        let d = giroFoco - giro; d = Math.atan2(Math.sin(d), Math.cos(d))
        if (!arr) giro += d * Math.min(1, dt * 4)
        camPosObj.set(rr * .75, pf.y + 4, 72); camMiraObj.set(rr * .75, pf.y, 0)
      } else {
        const giroFoco = -Math.atan2(pf.x, pf.z)
        let d = giroFoco - giro; d = Math.atan2(Math.sin(d), Math.cos(d))
        if (!arr) giro += d * Math.min(1, dt * 4)
        camPosObj.set(0, pf.y + 2, rr + 62); camMiraObj.set(0, pf.y, rr * .5)
      }
    } else {
      if (!quieto && !arr && ahora > pausa) giro += dt * VEL_GIRO
      const cy = (ymin + ymax) / 2, alto = ymax - ymin + 6
      const dist = Math.max(alto * 2.3, rmax * 2 * 1.75, 150)
      camPosObj.set(0, cy + 2, dist); camMiraObj.set(0, cy, 0)
    }
    cuerpo.rotation.y = giro
    camPos.lerp(camPosObj, Math.min(1, dt * 3.5)); camMira.lerp(camMiraObj, Math.min(1, dt * 3.5))
    cam.position.copy(camPos); cam.lookAt(camMira)
    cuerpo.updateMatrixWorld(true)

    const late = 1 + .15 * Math.sin(ahora / 300)
    esferas.forEach(s => { ahoraEn(s.pg, s.m.position); s.m.scale.setScalar(late) })
    // Dónde cae cada ancla y su rótulo en órbita.
    const c = Math.cos(giro), s = Math.sin(giro)
    const out: Proyeccion[] = lista.map(a => {
      const p = ahoraEn(a.pg, tmp)
      const x = p.x, y = p.y, z = p.z
      v.set(x * c + z * s, y, -x * s + z * c).project(cam)
      const ax = (v.x + 1) / 2 * W(), ay = (1 - v.y) / 2 * H()
      const t = Math.atan2(x, z) + (separa[a.k] || 0) + giro
      v.set(RADIO * Math.sin(t), y, RADIO * Math.cos(t)).project(cam)
      return { k: a.k, x: (v.x + 1) / 2 * W(), y: (1 - v.y) / 2 * H(), ax, ay, frente: (Math.cos(t) + 1) / 2 }
    })
    alFotograma(out)
    r.render(escena, cam)
  }
  raf = requestAnimationFrame(bucle)

  return {
    anclas(a) {
      const firma = a.map(x => x.k).join(',')
      if (firma !== lista.map(x => x.k).join(',')) separa = repartir(a)
      lista = a.map(x => ({ ...x, pg: pegar(x.p) }))
    },
    musculos(grupos) {
      uM.value = RIG.musculos.map(m => grupos.includes(m) ? 1 : 0)
      mat.uniforms.uM.value = uM.value
    },
    articulaciones(puntos) {
      esferas.forEach(e => { cuerpo.remove(e.m); (e.m.material as any).dispose() }); esferas = []
      puntos.forEach(p => {
        // Las dos del par (derecha e izquierda) si no está en el centro.
        const lados: P3[] = Math.abs(p[0]) > .5 ? [p, [-p[0], p[1], p[2]]] : [p]
        lados.forEach(qq => {
          const m = new THREE.Mesh(esfGeo, new THREE.MeshBasicMaterial({ color: '#E0B24F', transparent: true, opacity: .85, depthTest: false }))
          m.renderOrder = 5; cuerpo.add(m); esferas.push({ m, pg: pegar(qq) })
        })
      })
    },
    enfocar(p) { foco = p ? { p } : null; if (!p) pausa = performance.now() + 800 },
    enfocarHueso(n) { foco = n ? { hueso: n } : null; if (!n) pausa = performance.now() + 800 },
    postura(p) { objetivo = p || {} },
    destruir() {
      cancelAnimationFrame(raf); ro.disconnect()
      cv.removeEventListener('pointerdown', abajo); cv.removeEventListener('pointermove', mover); cv.removeEventListener('pointerup', arriba); cv.removeEventListener('pointercancel', arriba)
      esferas.forEach(e => (e.m.material as any).dispose()); esfGeo.dispose(); geo.dispose(); mat.dispose(); r.dispose(); cv.remove()
    },
  }
}
