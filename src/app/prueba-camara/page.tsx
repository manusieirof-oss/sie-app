'use client'
import { useEffect, useRef, useState } from 'react'

// PRUEBA: MEDIR RANGO ARTICULAR CON LA CÁMARA DEL iPad / iPhone.
//
// Detecta los puntos del cuerpo con MediaPipe (de Google) EN EL PROPIO APARATO: el vídeo
// no sale de él ni se guarda. Con hombro, codo, cadera, rodilla y tobillo calcula el
// ángulo de la articulación en cada fotograma y se queda con el máximo de la medición.
//
// Es 2D: el ángulo sale bien si la cámara está PERPENDICULAR al plano del movimiento
// (de lado para flexiones, de frente para abducción). Por eso cada test dice cómo
// colocarse. Si la prueba en sala sale bien, se lleva a la ficha y se apunta en el test.

const VERSION = '0.10.14'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

// Índices de MediaPipe: el lado es el DEL PACIENTE (su izquierda), no el de la imagen.
const P = {
  izq: { hombro: 11, codo: 13, muneca: 15, cadera: 23, rodilla: 25, tobillo: 27 },
  der: { hombro: 12, codo: 14, muneca: 16, cadera: 24, rodilla: 26, tobillo: 28 },
}
type Lado = 'izq' | 'der'
type Pt = { x: number, y: number, visibility?: number }

/** Ángulo entre dos vectores, en grados (0–180). */
function entre(a: Pt, b: Pt, c: Pt, d: Pt) {
  const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: d.x - c.x, y: d.y - c.y }
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI
}

interface Test { id: string, nombre: string, vista: string, puntos: (keyof typeof P.izq)[], angulo: (l: Record<string, Pt>) => number, normal: string }
// Cada ángulo da 0 en la posición neutra y crece con el movimiento, como con el goniómetro.
const TESTS: Test[] = [
  { id: 'hombro_flex', nombre: 'Flexión de hombro', vista: 'Cámara DE LADO, a la altura del hombro. Brazo estirado, sube por delante hasta arriba.', normal: '≈ 180°',
    puntos: ['cadera', 'hombro', 'codo'], angulo: l => entre(l.hombro, l.cadera, l.hombro, l.codo) },
  { id: 'hombro_abd', nombre: 'Abducción de hombro', vista: 'Cámara DE FRENTE. Brazo estirado, sube por el lado hasta arriba.', normal: '≈ 180°',
    puntos: ['cadera', 'hombro', 'codo'], angulo: l => entre(l.hombro, l.cadera, l.hombro, l.codo) },
  { id: 'cadera_flex', nombre: 'Flexión de cadera', vista: 'Cámara DE LADO. Tumbado boca arriba (o de pie), lleva la rodilla al pecho.', normal: '≈ 120°',
    puntos: ['hombro', 'cadera', 'rodilla'], angulo: l => entre(l.hombro, l.cadera, l.cadera, l.rodilla) },
  { id: 'rodilla_flex', nombre: 'Flexión de rodilla', vista: 'Cámara DE LADO. Tumbado boca arriba, desliza el talón hacia el glúteo.', normal: '≈ 135°',
    puntos: ['cadera', 'rodilla', 'tobillo'], angulo: l => entre(l.cadera, l.rodilla, l.rodilla, l.tobillo) },
  { id: 'codo_flex', nombre: 'Flexión de codo', vista: 'Cámara DE LADO. Brazo pegado al cuerpo, dobla el codo al máximo.', normal: '≈ 145°',
    puntos: ['hombro', 'codo', 'muneca'], angulo: l => entre(l.hombro, l.codo, l.codo, l.muneca) },
]

export default function CamaraRango() {
  const video = useRef<HTMLVideoElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const det = useRef<any>(null)
  const [estado, setEstado] = useState('Cargando el detector…')
  const [test, setTest] = useState<Test>(TESTS[0])
  const [lado, setLado] = useState<Lado>('der')
  const [ahora, setAhora] = useState<number | null>(null)
  const [midiendo, setMidiendo] = useState(false)
  const [max, setMax] = useState<number | null>(null)
  const [resultados, setResultados] = useState<{ test: string, lado: Lado, grados: number }[]>([])
  const [camara, setCamara] = useState<'environment' | 'user'>('environment')
  const cfg = useRef({ test, lado, midiendo }); cfg.current = { test, lado, midiendo }
  const ventana = useRef<number[]>([])
  const maxRef = useRef<number | null>(null)

  // ---- Cargar MediaPipe desde su CDN (no va en el paquete de la app: pesa varios MB) ----
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const vision: any = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs` as any)
        const files = await vision.FilesetResolver.forVisionTasks(WASM)
        det.current = await vision.PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODELO, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1,
        })
        if (vivo) setEstado('')
      } catch (e: any) { if (vivo) setEstado('No se ha podido cargar el detector: ' + (e?.message || e)) }
    })()
    return () => { vivo = false }
  }, [])

  // ---- Cámara ----
  useEffect(() => {
    let flujo: MediaStream | null = null
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: camara, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(s => { flujo = s; if (video.current) { video.current.srcObject = s; video.current.play() } })
      .catch(e => setEstado('Sin acceso a la cámara: ' + e.message))
    return () => flujo?.getTracks().forEach(t => t.stop())
  }, [camara])

  // ---- Bucle: detectar, dibujar y medir en cada fotograma ----
  useEffect(() => {
    let raf = 0, ultimo = -1
    const bucle = () => {
      raf = requestAnimationFrame(bucle)
      const v = video.current, cv = lienzo.current
      if (!v || !cv || !det.current || v.readyState < 2 || v.currentTime === ultimo) return
      ultimo = v.currentTime
      cv.width = v.videoWidth; cv.height = v.videoHeight
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      const r = det.current.detectForVideo(v, performance.now())
      const lm: Pt[] | undefined = r?.landmarks?.[0]
      if (!lm) { setAhora(null); return }
      const { test, lado, midiendo } = cfg.current
      const idx = P[lado]
      const l: Record<string, Pt> = {}
      for (const k of Object.keys(idx) as (keyof typeof idx)[]) l[k] = lm[idx[k]]
      const visibles = test.puntos.every(k => (l[k].visibility ?? 1) > 0.6)
      // Dibujo: los tres puntos del test y sus segmentos.
      const px = (p: Pt) => [p.x * cv.width, p.y * cv.height] as const
      ctx.lineWidth = 6; ctx.strokeStyle = visibles ? '#5FAEB9' : '#D4A24E'; ctx.fillStyle = '#fff'
      ctx.beginPath(); test.puntos.forEach((k, i) => { const [x, y] = px(l[k]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }); ctx.stroke()
      test.puntos.forEach(k => { const [x, y] = px(l[k]); ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill() })
      if (!visibles) { setAhora(null); return }
      // Mediana de los últimos 5 fotogramas: quita los saltos sueltos del detector.
      const w = ventana.current; w.push(test.angulo(l)); if (w.length > 5) w.shift()
      const med = [...w].sort((a, b) => a - b)[Math.floor(w.length / 2)]
      setAhora(Math.round(med))
      if (midiendo && w.length >= 5 && (maxRef.current == null || med > maxRef.current)) { maxRef.current = med; setMax(Math.round(med)) }
    }
    raf = requestAnimationFrame(bucle)
    return () => cancelAnimationFrame(raf)
  }, [])

  const empezar = () => { maxRef.current = null; ventana.current = []; setMax(null); setMidiendo(true) }
  const parar = () => {
    setMidiendo(false)
    if (maxRef.current != null) setResultados(p => [{ test: test.nombre, lado, grados: Math.round(maxRef.current!) }, ...p])
  }

  const boton = (on: boolean): React.CSSProperties => ({ border: 0, borderRadius: 99, padding: '8px 14px', fontSize: 14, cursor: 'pointer',
    background: on ? '#3E7179' : '#E8E7E1', color: on ? '#fff' : '#333', fontFamily: 'inherit' })

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, margin: '4px 0 10px' }}>Rango articular con la cámara · prueba</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {TESTS.map(t => <button key={t.id} style={boton(t.id === test.id)} onClick={() => { setTest(t); setMax(null); ventana.current = [] }}>{t.nombre}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#6B6D6A' }}>Lado del paciente:</span>
        <button style={boton(lado === 'izq')} onClick={() => setLado('izq')}>Izquierdo</button>
        <button style={boton(lado === 'der')} onClick={() => setLado('der')}>Derecho</button>
        <span style={{ flex: 1 }}/>
        <button style={boton(false)} onClick={() => setCamara(c => c === 'environment' ? 'user' : 'environment')}>Cambiar cámara</button>
      </div>
      <div style={{ fontSize: 13, background: '#EBF4F5', color: '#3E7179', padding: '8px 12px', borderRadius: 8, marginBottom: 10 }}>
        {test.vista} <b>Lado {lado === 'izq' ? 'izquierdo' : 'derecho'}</b> hacia la cámara. Normal {test.normal}.
      </div>

      <div style={{ position: 'relative', background: '#111', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={video} playsInline muted style={{ width: '100%', display: 'block', transform: camara === 'user' ? 'scaleX(-1)' : undefined }}/>
        <canvas ref={lienzo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: camara === 'user' ? 'scaleX(-1)' : undefined }}/>
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 10, padding: '8px 14px' }}>
          <div style={{ fontSize: 12, opacity: .8 }}>Ahora</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{ahora != null ? `${ahora}°` : '—'}</div>
        </div>
        {(midiendo || max != null) && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: midiendo ? 'rgba(176,90,90,.9)' : 'rgba(62,113,121,.9)', color: '#fff', borderRadius: 10, padding: '8px 14px', textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: .9 }}>{midiendo ? 'Midiendo · máximo' : 'Máximo'}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{max != null ? `${max}°` : '—'}</div>
          </div>
        )}
        {estado && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', padding: 20, textAlign: 'center' }}>{estado}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {!midiendo
          ? <button style={{ ...boton(true), padding: '12px 22px', fontSize: 16 }} onClick={empezar} disabled={!!estado}>● Empezar a medir</button>
          : <button style={{ ...boton(true), background: '#B05A5A', padding: '12px 22px', fontSize: 16 }} onClick={parar}>■ Parar y guardar</button>}
        <span style={{ fontSize: 12, color: '#6B6D6A', alignSelf: 'center' }}>Los puntos en naranja = el detector no ve bien esa zona: no cuenta.</span>
      </div>

      {resultados.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <b style={{ fontSize: 14 }}>Medidas de esta prueba</b>
          {resultados.map((r, i) => <div key={i} style={{ fontSize: 14, padding: '4px 0', borderBottom: '1px solid #eee' }}>{r.test} · {r.lado === 'izq' ? 'izquierdo' : 'derecho'} · <b>{r.grados}°</b></div>)}
        </div>
      )}
    </div>
  )
}
