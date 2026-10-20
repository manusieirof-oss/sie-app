import * as THREE from 'three'
import type { Animacion, Clave, Pose, Prop } from './tipos'

/**
 * EL VISOR 3D DE EJERCICIOS (sin React: el componente lo envuelve).
 *
 * El cuerpo es el del mapa corporal con esqueleto: `/anim/cuerpo-rig.json` trae la
 * malla, los huesos en las articulaciones y, por vértice, el peso de cada hueso y a
 * qué músculo pertenece (para encenderlo). Se genera fuera de la app (scripts de
 * modelado); aquí sólo se lee.
 *
 * Cada fotograma: pose interpolada entre claves → se coloca la raíz (cadera) para
 * que los apoyos no resbalen → cámara → render. La colocación de la raíz se calcula
 * una vez por animación (prepara) y luego sólo se interpola: así cuesta lo mismo una
 * sentadilla que una zancada con paso.
 */

export type Acabado = 'corporativo' | 'blanco' | 'cristal'
export type Vista = 'giro' | 'lado' | 'frente' | 'arriba'

interface Rig {
  pos: string, nor: string, idx: string, si: string, sw: string, mid: string, mm: string
  musculos: string[]
  huesos: { n: string, p: number, x: [number, number, number] }[]
}

let rigCache: Promise<Rig> | null = null
const cargaRig = (): Promise<Rig> => (rigCache ||= fetch('/anim/cuerpo-rig.json').then(r => { if (!r.ok) throw new Error('No se pudo cargar el cuerpo 3D'); return r.json() as Promise<Rig> }))

const dec = <T>(b: string, T: { new(buf: ArrayBuffer): T }) => {
  const s = atob(b), u = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i)
  return new T(u.buffer)
}
const rad = THREE.MathUtils.degToRad
const ez = (x: number) => x * x * (3 - 2 * x)
const VERDE = new THREE.Color('#5A969E')

/** Pose en el instante u (0–1) de la repetición, y el texto de fase vigente. */
export function poseEn(claves: Clave[], u: number): { p: Pose, fase: string } {
  let i = 0
  while (i < claves.length - 2 && u >= claves[i + 1].t) i++
  const a = claves[i], b = claves[i + 1] || a
  const k = ez(Math.min(1, Math.max(0, (u - a.t) / ((b.t - a.t) || 1))))
  const p: Pose = {}
  new Set([...Object.keys(a.p), ...Object.keys(b.p)]).forEach(n => {
    const va = a.p[n] || [0, 0, 0], vb = b.p[n] || [0, 0, 0]
    p[n] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k, va[2] + (vb[2] - va[2]) * k]
  })
  // La fase sigue siendo la última que se escribió (las claves de pausa no la repiten).
  let fase = ''
  for (let j = 0; j <= i; j++) if (claves[j].fase) fase = claves[j].fase!
  return { p, fase }
}

export interface Visor {
  poner(anim: Animacion): void
  acabado(a: Acabado): void
  vista(v: Vista): void
  pausa(on: boolean): void
  velocidad(v: number): void
  soloMusculo(id: string | null): void
  ir(u: number): void                                // se para en ese punto de la repetición (0–1)
  destruir(): void
}

export async function crearVisor(el: HTMLElement, eventos: { fase?: (t: string) => void, rep?: (n: number) => void, progreso?: (u: number) => void } = {}): Promise<Visor> {
  const RIG = await cargaRig()
  const W = () => el.clientWidth, H = () => el.clientHeight
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2)); r.setSize(W(), H(), false)
  r.domElement.style.cssText = 'display:block;width:100%;height:100%'
  el.prepend(r.domElement)
  const escena = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, W() / H(), 1, 2000)

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
  const H0: Record<string, THREE.Vector3> = {}
  RIG.huesos.forEach((h, i) => {
    const b = huesos[i], p = h.p >= 0 ? RIG.huesos[h.p].x : [0, 0, 0]
    b.position.set(h.x[0] - p[0], h.x[1] - p[1], h.x[2] - p[2]); H0[h.n] = b.position.clone()
    if (h.p >= 0) huesos[h.p].add(b)
  })
  const hueso: Record<string, THREE.Bone> = Object.fromEntries(huesos.map(b => [b.name, b]))
  const raiz = hueso.cadera
  // Músculos: cada vértice sabe de qué músculo es; el shader lo enciende con uM.
  const VERT = `#include <common>
    #include <skinning_pars_vertex>
    attribute float mid; attribute float mm;
    uniform float uM[${NM}];
    varying vec3 vN; varying vec3 vV; varying float vAct;
    void main(){
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 mv = modelViewMatrix*vec4(transformed,1.);
      vN = normalize(normalMatrix*objectNormal); vV = normalize(-mv.xyz);
      vAct = uM[int(mid + .5)] * mm;
      gl_Position = projectionMatrix*mv; }`
  const ACT = new THREE.Color('#F2784B')
  const solido = (color: string) => new THREE.ShaderMaterial({
    uniforms: { uM, base: { value: new THREE.Color(color) }, act: { value: ACT } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 base; uniform vec3 act; varying vec3 vN; varying vec3 vV; varying float vAct;
      void main(){ vec3 n = normalize(vN), v = normalize(vV);
        vec3 l1 = normalize(vec3(-.5,.8,.6)), l2 = normalize(vec3(.7,.2,.4));
        float d = max(dot(n,l1),0.)*.5 + max(dot(n,l2),0.)*.2 + .44 + .06*n.y;
        float rim = pow(1.-max(dot(n,v),0.), 3.);
        vec3 c = mix(base, act, clamp(vAct,0.,1.)*.9);
        c = c*d + rim*vec3(.12,.2,.2)*(1.-vAct) + act*vAct*.35;
        float spec = pow(max(dot(reflect(-l1,n),v),0.), 24.)*.12;
        gl_FragColor = vec4(c + spec, 1.); }`,
  })
  const cristal = (lado: THREE.Side, a0: number, a1: number) => new THREE.ShaderMaterial({
    uniforms: { uM, c: { value: VERDE }, act: { value: ACT }, a0: { value: a0 }, a1: { value: a1 } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 c; uniform vec3 act; uniform float a0; uniform float a1; varying vec3 vN; varying vec3 vV; varying float vAct;
      void main(){ vec3 n = normalize(vN);
        float f = pow(1.0-abs(dot(n,normalize(vV))), 2.2);
        float luz = 0.88 + 0.12*n.y;
        vec3 col = mix(mix(c*1.15, c*0.8, f)*luz, act, clamp(vAct,0.,1.)*.8);
        gl_FragColor = vec4(col, max(mix(a0,a1,f), vAct*.75)); }`,
    transparent: true, depthWrite: false, side: lado,
  })
  const MAT = { corporativo: solido('#9ACBD0'), blanco: solido('#F3F5F4'), cristal: cristal(THREE.FrontSide, .2, .92) }
  const dentro = new THREE.SkinnedMesh(geo, cristal(THREE.BackSide, .06, .25))
  const fuera = new THREE.SkinnedMesh(geo, MAT.corporativo)
  // El esqueleto cuelga de su propio grupo: si colgara de una malla oculta, lo que
  // lleva en las manos desaparecería con ella.
  const esq = new THREE.Group(); esq.add(raiz); escena.add(esq, dentro, fuera)
  esq.updateMatrixWorld(true)
  const esqueleto = new THREE.Skeleton(huesos)
  dentro.bind(esqueleto); fuera.bind(esqueleto)
  dentro.frustumCulled = fuera.frustumCulled = false
  dentro.visible = false

  // ── Suelo ──
  const aro = new THREE.Mesh(new THREE.RingGeometry(14, 14.8, 64), new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: .35, depthWrite: false }))
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: .12, depthWrite: false }))
  aro.rotation.x = sombra.rotation.x = -Math.PI / 2; escena.add(aro, sombra)
  const esterilla = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x8FC2B9, transparent: true, opacity: .45, depthWrite: false }))
  esterilla.rotation.x = -Math.PI / 2; esterilla.position.y = .05; escena.add(esterilla)

  // ── Props ──
  const mGris = new THREE.MeshLambertMaterial({ color: 0x3A4240 }), mMadera = new THREE.MeshLambertMaterial({ color: 0xC9B79A })
  const mTapiz = new THREE.MeshLambertMaterial({ color: 0x2F3B3A }), mPared = new THREE.MeshLambertMaterial({ color: 0xE6E2DA, transparent: true, opacity: .85 })
  const sol = new THREE.DirectionalLight(0xffffff, 1.2); sol.position.set(-40, 90, 60)
  escena.add(new THREE.HemisphereLight(0xffffff, 0xcfd8d6, 1.6), sol)
  function hazProp(p: Prop): THREE.Object3D {
    const g = new THREE.Group()
    const cil = (r: number, h: number, m: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), m)
    const caja = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    switch (p.tipo) {
      case 'mancuerna': { const b = cil(.55, 8, mGris); b.rotation.x = Math.PI / 2; g.add(b); [-1, 1].forEach(s => { const d = cil(2.3, 1.6, mGris); d.rotation.x = Math.PI / 2; d.position.z = s * 3.6; g.add(d) }); g.position.set(0, -3.6, 1.2); break }
      case 'kettlebell': { const b = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 14), mGris); b.position.y = -4; g.add(b); const a = new THREE.Mesh(new THREE.TorusGeometry(2.4, .6, 8, 20, Math.PI), mGris); a.position.y = -.5; g.add(a); break }
      case 'disco': { const d = cil(6, 1.6, mGris); d.rotation.x = Math.PI / 2; g.add(d); break }
      case 'barra': { const b = cil(.6, 100, mGris); b.rotation.z = Math.PI / 2; g.add(b); [-1, 1].forEach(s => { const d = cil(9, 2.2, mGris); d.rotation.z = Math.PI / 2; d.position.x = s * 42; g.add(d) }); break }
      case 'banco': { const t = caja(14, 3, 60, mTapiz); t.position.y = -1.5; g.add(t); const pa = caja(10, 19, 8, mGris); pa.position.set(0, -12, 0); g.add(pa); const pb = caja(12, 1, 40, mGris); pb.position.y = -22; g.add(pb); break }
      case 'cajon': { const h = p.alto || 22, w = p.ancho || 36; const c = caja(w, h, 28, mMadera); c.position.y = -h / 2; g.add(c); break }
      case 'silla': { const s = caja(22, 2.5, 22, mMadera); s.position.y = -1.25; g.add(s); const re = caja(22, 22, 2, mMadera); re.position.set(0, 10, -11); g.add(re); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => { const l = caja(1.6, 21, 1.6, mGris); l.position.set(x * 10, -12, z * 10); g.add(l) }); break }
      case 'pared': { const w = caja(80, 110, 2, mPared); w.position.y = 55; g.add(w); break }
      case 'deslizador': { const d = cil(4.5, .8, new THREE.MeshLambertMaterial({ color: 0xF2784B })); g.add(d); break }
      case 'cuna': { const sh = new THREE.Shape(); sh.moveTo(-6, 0); sh.lineTo(6, 0); sh.lineTo(-6, 4); sh.closePath(); const w = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 10, bevelEnabled: false }), mMadera); w.rotation.y = Math.PI / 2; w.position.set(-5, 0, 0); g.add(w); break }
      case 'pelota': { g.add(new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), new THREE.MeshLambertMaterial({ color: 0xF2C14E }))); break }
      case 'banda': { const b = cil(.5, 1, new THREE.MeshLambertMaterial({ color: 0xE2574C })); b.rotation.z = Math.PI / 2; g.add(b); g.userData.estira = true; break }
    }
    return g
  }

  // ── Estado ──
  let anim: Animacion | null = null
  let tabla: { pos: THREE.Vector3, rx: number, rz: number, ik?: Record<string, number> }[] = []
  let props: { def: Prop, obj: THREE.Object3D }[] = []
  let t0 = performance.now() / 1000, pausado = false, tPausa = 0, vel = 1, vistaAct: Vista = 'giro', reps = -1, solo: string | null = null
  let angulo = 0, alto = 12, arrastre: { x: number, y: number } | null = null, ultimoArrastre = -99
  const objetivo = new THREE.Vector3(0, 40, 0)
  const _v = new THREE.Vector3()
  const media = (ns: string[]) => { const m = new THREE.Vector3(); ns.forEach(n => m.add(hueso[n].getWorldPosition(_v))); return m.divideScalar(ns.length) }

  function aplica(p: Pose) {
    huesos.forEach(b => { b.rotation.set(0, 0, 0); b.position.copy(H0[b.name]) })
    for (const [n, v] of Object.entries(p)) { const b = n === 'raiz' ? raiz : hueso[n]; if (b) b.rotation.set(rad(v[0]), rad(v[1]), rad(v[2])) }
  }

  /**
   * Coloca la raíz a lo largo de toda la repetición para que los apoyos no resbalen.
   * Se recorre en orden: el pie que apoya se queda donde está; si cambia de apoyo
   * (en una zancada con paso) el nuevo se queda donde ha caído. Si hay apoyo "b",
   * se busca la inclinación del cuerpo (hacia delante o de lado) que lo deja a su
   * altura. Al final se reparte el pequeño desfase para que el bucle cierre y se
   * centra el cuerpo en el origen.
   */
  function prepara(a: Animacion) {
    const N = 160
    tabla = []
    const A = a.apoyo
    let plant: THREE.Vector3 | null = null, prev = H0.cadera.clone(), anclaPrev = ''
    for (let s = 0; s <= N; s++) {
      const u = s / N, { p } = poseEn(a.claves, u)
      aplica(p)
      if (!A) { tabla.push({ pos: H0.cadera.clone(), rx: 0, rz: 0 }); continue }
      const eje = A.bEje === 'z' ? 'z' : 'x'
      const base = eje === 'x' ? raiz.rotation.x : raiz.rotation.z
      const coloca = (d: number) => {
        if (eje === 'x') raiz.rotation.x = base + d; else raiz.rotation.z = base + d
        raiz.position.copy(prev)
        esq.updateMatrixWorld(true)
        const m = media(A.a)
        if (!plant || anclaPrev !== A.a.join()) plant = new THREE.Vector3(m.x, A.aY ?? m.y, m.z)
        raiz.position.x += plant.x - m.x; raiz.position.z += plant.z - m.z
        raiz.position.y += (A.aY ?? plant.y) - m.y
        esq.updateMatrixWorld(true)
        return A.b ? media(A.b).y - (A.bY ?? 0) : 0
      }
      let d = 0
      if (A.b) {
        let lo = -1, hi = 1, flo = coloca(lo), fhi = coloca(hi)
        if (flo * fhi > 0) { let best = 0, bv = Infinity; for (let x = -1; x <= 1; x += .05) { const v = Math.abs(coloca(x)); if (v < bv) { bv = v; best = x } } d = best }
        else { for (let it = 0; it < 20; it++) { const mid = (lo + hi) / 2, fm = coloca(mid); if (fm * flo > 0) { lo = mid; flo = fm } else hi = mid } d = (lo + hi) / 2 }
      }
      coloca(d)
      anclaPrev = A.a.join()
      prev = raiz.position.clone()
      tabla.push({ pos: raiz.position.clone(), rx: eje === 'x' ? d : 0, rz: eje === 'z' ? d : 0, ik: ikPierna(a, s) })
    }
    // Que el bucle cierre (en horizontal) y centrar en el origen.
    const des = tabla[N].pos.clone().sub(tabla[0].pos); des.y = 0
    tabla.forEach((f, i) => f.pos.addScaledVector(des, -i / N))
    const c = new THREE.Vector3(); tabla.forEach(f => c.add(f.pos)); c.divideScalar(tabla.length)
    tabla.forEach(f => { f.pos.x -= c.x; f.pos.z -= c.z })
  }
  /**
   * IK de pierna: el pie se queda clavado donde estaba al empezar (el de atrás en el
   * banco de la búlgara) y se calculan muslo y rodilla para llegar a él, sea cual sea
   * la altura de la cadera. Dos huesos en el plano de la pierna (ley del coseno).
   */
  const objetivosIk: Record<string, THREE.Vector3> = {}
  function ikPierna(a: Animacion, s: number): Record<string, number> | undefined {
    if (!a.ik?.length) return undefined
    const out: Record<string, number> = {}
    for (const k of a.ik) {
      const L = k.pierna, mu = hueso['muslo' + L], pi = hueso['pierna' + L], pe = hueso['pie' + L]
      if (s === 0) objetivosIk[L] = pe.getWorldPosition(new THREE.Vector3())
      const T = objetivosIk[L], H = mu.getWorldPosition(new THREE.Vector3())
      const q = new THREE.Quaternion(); raiz.getWorldQuaternion(q)
      const d = T.clone().sub(H).applyQuaternion(q.invert())
      const L1 = H0['pierna' + L].length(), L2 = H0['pie' + L].length()
      const D = Math.min(L1 + L2 - .01, Math.max(Math.abs(L1 - L2) + .01, Math.hypot(d.y, d.z)))
      const thT = Math.atan2(-d.z, -d.y)
      const al = Math.acos((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))
      const be = Math.PI - Math.acos((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2))
      out['muslo' + L] = thT - al; out['pierna' + L] = be
      out['pie' + L] = rad(k.pie ?? 0) - (thT - al + be)
      mu.rotation.x = out['muslo' + L]; pi.rotation.x = be; pe.rotation.x = out['pie' + L]
    }
    esq.updateMatrixWorld(true)
    return out
  }
  function colocaEn(u: number) {
    const f = u * (tabla.length - 1), i = Math.min(tabla.length - 2, Math.floor(f)), k = f - i
    const A = tabla[i], B = tabla[i + 1]
    raiz.position.lerpVectors(A.pos, B.pos, k)
    raiz.rotation.x += A.rx + (B.rx - A.rx) * k
    raiz.rotation.z += A.rz + (B.rz - A.rz) * k
    if (A.ik && B.ik) for (const n in A.ik) hueso[n].rotation.x = A.ik[n] + (B.ik[n] - A.ik[n]) * k
    esq.updateMatrixWorld(true)
  }

  function poner(a: Animacion) {
    anim = a; t0 = performance.now() / 1000; reps = -1
    props.forEach(p => p.obj.parent?.remove(p.obj)); props = []
    prepara(a)
    // Props: los "bajo" se colocan una vez, mirando la pose de su clave.
    for (const def of a.props || []) {
      const obj = hazProp(def)
      if (def.en && hueso[def.en]) { hueso[def.en].add(obj); if (def.off) obj.position.add(new THREE.Vector3(...def.off)); if (def.rot) obj.rotation.set(rad(def.rot[0]), rad(def.rot[1]), rad(def.rot[2])) }
      else if (def.bajo && hueso[def.bajo]) {
        const k = Math.max(0, Math.min(a.claves.length - 1, def.clave ?? 0)), u = a.claves[k].t
        aplica(poseEn(a.claves, u).p); colocaEn(u)
        const w = hueso[def.bajo].getWorldPosition(new THREE.Vector3())
        const off = def.off || [0, 0, 0]
        const y = def.tipo === 'pared' ? 0 : def.tipo === 'cuna' ? 0 : Math.max(0, w.y - (def.hueco ?? 4))
        obj.position.set(w.x + off[0], y, w.z + off[2])
        if (def.tipo === 'cajon' && !def.alto) obj.scale.y = Math.max(.1, y / 22)
        if (def.tipo === 'banco') obj.scale.y = Math.max(.3, y / 22)
        if (def.rot) obj.rotation.set(rad(def.rot[0]), rad(def.rot[1]), rad(def.rot[2]))
        escena.add(obj)
      } else { escena.add(obj); if (def.pos) obj.position.set(...def.pos) }
      props.push({ def, obj })
    }
    // Suelo y cámara según el ejercicio.
    aplica(poseEn(a.claves, 0).p); colocaEn(0)
    const c = media(['cadera', 'pecho'])
    esterilla.visible = !!a.suelo; esterilla.position.set(c.x, .05, c.z); esterilla.scale.set(34, 110, 1)
    aro.visible = sombra.visible = !a.suelo
    alto = a.cam?.alto ?? 12
  }
  // Los props "entre" (barra con las dos manos, banda entre rodillas) se recolocan cada fotograma.
  const _a = new THREE.Vector3(), _b = new THREE.Vector3()
  function propsEntre() {
    for (const { def, obj } of props) {
      if (!def.entre) continue
      hueso[def.entre[0]].getWorldPosition(_a); hueso[def.entre[1]].getWorldPosition(_b)
      obj.position.copy(_a).add(_b).multiplyScalar(.5)
      if (def.tipo === 'barra' || def.tipo === 'banda') {
        // Orientada de una mano a la otra (la barra mide lo suyo; la banda, lo que haya).
        const dir = _b.clone().sub(_a), L = dir.length(); dir.normalize()
        obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir)
        if (def.tipo === 'banda') obj.scale.set(L, 1, 1)
        // Desde la muñeca, la barra queda en la palma.
        obj.position.add(new THREE.Vector3(0, -3.2, 1))
      }
      if (def.off) obj.position.add(new THREE.Vector3(...def.off))
    }
  }

  // ── Interacción: arrastrar gira la cámara ──
  const abajo = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); arrastre = { x: e.clientX, y: e.clientY } }
  const mueve = (e: PointerEvent) => {
    if (!arrastre) return
    angulo -= (e.clientX - arrastre.x) * .008; alto = Math.max(-5, Math.min(80, alto + (e.clientY - arrastre.y) * .25))
    arrastre = { x: e.clientX, y: e.clientY }; ultimoArrastre = performance.now() / 1000; vistaAct = 'giro'
  }
  const suelta = () => { arrastre = null }
  el.addEventListener('pointerdown', abajo); el.addEventListener('pointermove', mueve)
  el.addEventListener('pointerup', suelta); el.addEventListener('pointercancel', suelta)
  const ro = new ResizeObserver(() => { if (!W() || !H()) return; r.setSize(W(), H(), false); cam.aspect = W() / H(); cam.updateProjectionMatrix() })
  ro.observe(el)
  // No pinta si no se ve (fuera de pantalla u otra pestaña): un visor en marcha
  // a 60 fps sin que nadie lo mire hace ir a tirones al resto de la web.
  let aLaVista = true
  const io = new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting })
  io.observe(el)

  let tAnt = performance.now() / 1000, raf = 0, vivo = true
  function bucle() {
    if (!vivo) return
    raf = requestAnimationFrame(bucle)
    if (!anim || !aLaVista || document.hidden) return
    const ahora = performance.now() / 1000, dt = Math.min(.1, ahora - tAnt); tAnt = ahora
    const tt = ((pausado ? tPausa : ahora) - t0) * vel
    const ciclo = tt / anim.dur, u = ciclo - Math.floor(ciclo)
    const { p, fase } = poseEn(anim.claves, u)
    aplica(p); colocaEn(u); propsEntre()
    const n = Math.floor(ciclo); if (n !== reps) { reps = n; eventos.rep?.(n) }
    eventos.fase?.(fase); eventos.progreso?.(u)
    // Parpadeo de los músculos que trabaja: los dos principales, más fuerte.
    const pulso = .55 + .45 * Math.sin(ahora * 6)
    uM.value.fill(0)
    anim.musculos.forEach(([id], i) => { const k = RIG.musculos.indexOf(id); if (k >= 0 && (!solo || solo === id)) uM.value[k] = (solo ? 1 : i < 2 ? 1 : .55) * pulso })
    // Cámara
    const c = media(['cadera', 'pecho'])
    objetivo.lerp(new THREE.Vector3(c.x, anim.suelo ? c.y : (anim.cam?.y ?? 42), c.z), .08)
    const suelo = !!anim.suelo
    if (vistaAct === 'giro') { if (!arrastre && ahora - ultimoArrastre > 3 && !pausado) angulo += dt * .45 }
    else {
      const angObj = vistaAct === 'frente' ? 0 : Math.PI / 2
      const altObj = vistaAct === 'arriba' ? 78 : vistaAct === 'frente' ? (suelo ? 20 : 6) : (suelo ? 8 : 6)
      // Por el camino corto hasta el ángulo pedido.
      const dA = ((angObj - angulo) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
      angulo += dA * .08; alto += (altObj - alto) * .08
    }
    const d = (anim.cam?.dist ?? 245) * (cam.aspect < .8 ? 1.35 : 1)
    cam.position.set(objetivo.x + Math.sin(angulo) * Math.cos(rad(alto)) * d, objetivo.y + Math.sin(rad(alto)) * d, objetivo.z + Math.cos(angulo) * Math.cos(rad(alto)) * d)
    cam.lookAt(objetivo)
    r.render(escena, cam)
  }
  bucle()

  return {
    poner,
    acabado(a) { fuera.material = MAT[a]; dentro.visible = a === 'cristal' },
    vista(v) { vistaAct = v },
    pausa(on) { if (on === pausado) return; if (on) tPausa = performance.now() / 1000; else t0 += performance.now() / 1000 - tPausa; pausado = on },
    velocidad(v) { const ahora = performance.now() / 1000, u = (ahora - t0) * vel; vel = v; t0 = ahora - u / vel },
    soloMusculo(id) { solo = id },
    ir(u) { if (!anim) return; pausado = true; tPausa = t0 + u * anim.dur / vel },
    destruir() {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      el.removeEventListener('pointerdown', abajo); el.removeEventListener('pointermove', mueve)
      el.removeEventListener('pointerup', suelta); el.removeEventListener('pointercancel', suelta)
      r.dispose(); geo.dispose(); r.domElement.remove()
    },
  }
}
