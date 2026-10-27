'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarResultadoTest } from '@/lib/tests'
import { PROTOCOLOS, Protocolo, Medida, Lado, Cuerpo, Pt, IDX, cuerpo, itemDe, itemPorEdad, mediana } from '@/lib/camara'

// TESTS GRABADOS CON LA CÁMARA (iPad / iPhone).
//
// Paciente → test de la biblioteca → cada medida, por lados si el test va por lados →
// revisar → se apunta en su ficha con `registrarResultadoTest`, igual que un test pasado
// a mano: misma evaluación, mismos objetivos, misma cronología. El vídeo no se guarda:
// MediaPipe corre en el propio aparato y solo se quedan los números.

const VERSION = '0.10.14'
const MODELO = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
type Res = { valor?: number, marcas?: Record<string, boolean | undefined>, datos?: string[] }
const LADO_SIE: Record<Lado, string> = { izq: 'izquierdo', der: 'derecho' }
const edadDe = (f?: string | null) => { if (!f) return null; const d = new Date(f + 'T12:00:00'), h = new Date(); let e = h.getFullYear() - d.getFullYear(); if (h < new Date(h.getFullYear(), d.getMonth(), d.getDate())) e--; return e }
const nombrePac = (p: any) => (p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim()

export default function CamaraTests() {
  // ---- Paciente y test ----
  const [busca, setBusca] = useState('')
  const [pacs, setPacs] = useState<any[]>([])
  const [pac, setPac] = useState<any>(null)
  const [tests, setTests] = useState<any[]>([])
  const [prot, setProt] = useState<Protocolo | null>(null)
  const [elegidas, setElegidas] = useState<string[]>([])
  const [ladoUnico, setLadoUnico] = useState<Lado>('der')
  const [res, setRes] = useState<Record<string, Res>>({})       // `${medida}|${lado}`
  const [paso, setPaso] = useState<{ m: Medida, lado: Lado } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    supabase.from('tests').select('*').is('archivado_el', null).then(({ data }) => setTests(data || []))
  }, [])
  useEffect(() => {
    if (busca.trim().length < 2) { setPacs([]); return }
    const t = setTimeout(() => {
      const q = `%${busca.trim()}%`
      supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,fecha_nacimiento,foto_url')
        .or(`nombre.ilike.${q},apellidos.ilike.${q},nombre_clinica.ilike.${q}`).limit(8).then(({ data }) => setPacs(data || []))
    }, 250)
    return () => clearTimeout(t)
  }, [busca])

  const disponibles = PROTOCOLOS.filter(p => tests.some(t => t.nombre === p.test))
  const test = prot ? tests.find(t => t.nombre === prot.test) : null
  const lados: Lado[] = prot?.porLados ? ['der', 'izq'] : [ladoUnico]
  const pasos = prot ? prot.medidas.filter(m => elegidas.includes(m.id)).flatMap(m => lados.map(lado => ({ m, lado }))) : []

  // ---- Guardar: un resultado por lado, con el otro lado para la asimetría ----
  function itemsDe(lado: Lado) {
    const edad = edadDe(pac?.fecha_nacimiento)
    const items = (test?.items || []).map((i: any) => ({ ...i, valor: '', marcado: false }))
    const obs: string[] = []
    for (const m of prot!.medidas) {
      const r = res[`${m.id}|${lado}`]; if (!r) continue
      const it = m.item === '@edad' ? itemPorEdad(items, edad) : m.item ? itemDe(items, m.item) : null
      if (it && r.valor != null) it.valor = String(r.valor)
      const marcas = { ...(r.marcas || {}), ...(m.marcar && r.valor != null ? m.marcar(r.valor) : {}) }
      for (const [pref, si] of Object.entries(marcas)) { const x = itemDe(items, pref); if (x && si) x.marcado = true }
      if (r.datos?.length) obs.push(`${m.nombre}: ${r.datos.join(', ')}`)
    }
    return { items, obs }
  }
  async function guardar() {
    if (!pac || !test || !prot) return
    setGuardando(true); setAviso('')
    try {
      const hechos = lados.filter(l => prot.medidas.some(m => res[`${m.id}|${l}`]))
      for (const l of hechos) {
        const { items, obs } = itemsDe(l)
        const otro = hechos.find(x => x !== l)
        const r = await registrarResultadoTest(pac.id, test, {
          items, otrosItems: otro ? itemsDe(otro).items : null,
          lado: prot.porLados ? LADO_SIE[l] : 'bilateral',
          observaciones: ['Grabado con la cámara', ...obs].join(' · '), contexto: 'la cámara',
        })
        if (!r.ok) throw new Error(r.error)
      }
      setAviso(`Guardado en la ficha de ${nombrePac(pac)}.`)
      setRes({})
    } catch (e: any) { setAviso('No se ha podido guardar: ' + e.message) }
    setGuardando(false)
  }

  const btn = (on = false): React.CSSProperties => ({ border: 0, borderRadius: 99, padding: '9px 15px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#3E7179' : '#E8E7E1', color: on ? '#fff' : '#333' })
  const caja: React.CSSProperties = { background: '#fff', border: '1px solid #E4E0D6', borderRadius: 12, padding: 14, marginBottom: 12 }

  if (paso) return <Grabar key={`${paso.m.id}|${paso.lado}`} m={paso.m} lado={paso.lado}
    onListo={r => { setRes(p => ({ ...p, [`${paso.m.id}|${paso.lado}`]: r })); const i = pasos.findIndex(x => x.m.id === paso.m.id && x.lado === paso.lado); setPaso(pasos[i + 1] && !res[`${pasos[i + 1].m.id}|${pasos[i + 1].lado}`] ? pasos[i + 1] : null) }}
    onSalir={() => setPaso(null)}/>

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 21, margin: '4px 0 12px' }}>Tests con la cámara</h1>

      <div style={caja}>
        <b style={{ fontSize: 14 }}>1 · Paciente</b>
        {pac ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 15 }}>{nombrePac(pac)}{edadDe(pac.fecha_nacimiento) != null ? ` · ${edadDe(pac.fecha_nacimiento)} años` : ''}</span>
            <button style={btn()} onClick={() => { setPac(null); setRes({}) }}>Cambiar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Nombre…" value={busca} onChange={e => setBusca(e.target.value)} style={{ marginTop: 8, width: '100%', fontSize: 16, padding: 10 }}/>
            {pacs.map(p => <button key={p.id} style={{ ...btn(), display: 'block', width: '100%', textAlign: 'left', marginTop: 6, borderRadius: 8 }} onClick={() => { setPac(p); setBusca('') }}>{nombrePac(p)}</button>)}
          </>
        )}
      </div>

      {pac && (
        <div style={caja}>
          <b style={{ fontSize: 14 }}>2 · Test</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {disponibles.map(p => <button key={p.test} style={btn(prot?.test === p.test)} onClick={() => { setProt(p); setElegidas(p.medidas.map(m => m.id)); setRes({}); setAviso('') }}>{p.test}</button>)}
          </div>
        </div>
      )}

      {pac && prot && (
        <div style={caja}>
          <b style={{ fontSize: 14 }}>3 · Medidas</b>
          {prot.nota && <div style={{ fontSize: 13, color: '#6B6D6A', marginTop: 4 }}>{prot.nota}</div>}
          {!prot.porLados && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 13, color: '#6B6D6A' }}>Lado que mira a la cámara / pie de apoyo:</span>
              <button style={btn(ladoUnico === 'izq')} onClick={() => setLadoUnico('izq')}>Izquierdo</button>
              <button style={btn(ladoUnico === 'der')} onClick={() => setLadoUnico('der')}>Derecho</button>
            </div>
          )}
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {prot.medidas.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid #E4E0D6', borderRadius: 8 }}>
                <input type="checkbox" checked={elegidas.includes(m.id)} onChange={e => setElegidas(p => e.target.checked ? [...p, m.id] : p.filter(x => x !== m.id))}/>
                <span style={{ flex: 1, minWidth: 160, fontSize: 14 }}>{m.nombre} <span style={{ color: '#6B6D6A', fontSize: 12 }}>· {m.vista === 'lado' ? 'de lado' : 'de frente'}{m.aprox ? ' · aproximado' : ''}</span></span>
                {lados.map(l => {
                  const r = res[`${m.id}|${l}`]
                  return (
                    <button key={l} disabled={!elegidas.includes(m.id)} style={{ ...btn(!!r), borderRadius: 8, minWidth: 110 }} onClick={() => setPaso({ m, lado: l })}>
                      {prot.porLados ? (l === 'izq' ? 'Izq. ' : 'Der. ') : ''}{r ? resumen(m, r) : '● Grabar'}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={btn(true)} onClick={() => setPaso(pasos.find(p => !res[`${p.m.id}|${p.lado}`]) || null)}>Grabar lo que falta, en orden</button>
            <button style={{ ...btn(true), background: '#2F6B4F' }} disabled={guardando || !Object.keys(res).length} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar en su ficha'}</button>
          </div>
          {aviso && <div style={{ marginTop: 10, fontSize: 14, color: aviso.startsWith('No') ? '#B05A5A' : '#3E7179' }}>{aviso}</div>}
          {Object.keys(res).length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: '#6B6D6A' }}>
              {Object.entries(res).map(([k, r]) => r.datos?.length ? <div key={k}>{prot.medidas.find(m => k.startsWith(m.id + '|'))?.nombre} ({k.endsWith('izq') ? 'izq.' : 'der.'}): {r.datos.join(' · ')}</div> : null)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function resumen(m: Medida, r: Res) {
  if (m.modo === 'analisis') { const n = Object.values(r.marcas || {}).filter(Boolean).length; return r.valor != null ? `${r.valor}°` : n ? `${n} hallazgo${n > 1 ? 's' : ''}` : 'Sin hallazgos' }
  if (m.modo === 'crono') return `${r.valor} s`
  if (m.modo === 'reps') return `${r.valor} reps`
  return `${r.valor}°`
}

// ===========================================================================
// GRABAR UNA MEDIDA
// ===========================================================================
let detector: any = null
async function cargarDetector() {
  if (detector) return detector
  const vision: any = await import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs` as any)
  const files = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`)
  detector = await vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODELO, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1 })
  return detector
}

function Grabar({ m, lado, onListo, onSalir }: { m: Medida, lado: Lado, onListo: (r: Res) => void, onSalir: () => void }) {
  const video = useRef<HTMLVideoElement>(null), lienzo = useRef<HTMLCanvasElement>(null)
  const [estado, setEstado] = useState('Cargando el detector…')
  const [camara, setCamara] = useState<'environment' | 'user'>('environment')
  const [grabando, setGrabando] = useState(false)
  const [ahora, setAhora] = useState<number | null>(null)
  const [mejor, setMejor] = useState<number | null>(null)
  const [reloj, setReloj] = useState<number | null>(null)
  const g = useRef({ grabando: false, ini: null as Cuerpo | null, max: null as number | null, ventana: [] as number[], fot: [] as Cuerpo[],
    reps: 0, fase: '' as '' | 'abajo' | 'arriba', t0: 0, enAire: false, bajadas: 0, fin: false })

  useEffect(() => { cargarDetector().then(() => setEstado('')).catch(e => setEstado('No se ha podido cargar el detector: ' + e.message)) }, [])
  useEffect(() => {
    let flujo: MediaStream | null = null
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: camara, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(s => { flujo = s; if (video.current) { video.current.srcObject = s; video.current.play() } })
      .catch(e => setEstado('Sin acceso a la cámara: ' + e.message))
    return () => flujo?.getTracks().forEach(t => t.stop())
  }, [camara])

  function terminar() {
    const s = g.current; if (s.fin) return; s.fin = true; s.grabando = false; setGrabando(false)
    if (m.modo === 'max') onListo({ valor: s.max != null ? Math.round(s.max) : undefined })
    else if (m.modo === 'reps') onListo({ valor: s.reps })
    else if (m.modo === 'crono') onListo({ valor: s.t0 ? Math.round((performance.now() - s.t0) / 100) / 10 : 0 })
    else { const r = m.analizar!(s.fot); onListo({ marcas: r.marcas, datos: r.datos, valor: r.valor }) }
  }

  useEffect(() => {
    let raf = 0, ultimo = -1
    const bucle = () => {
      raf = requestAnimationFrame(bucle)
      const vd = video.current, cv = lienzo.current
      if (!vd || !cv || !detector || vd.readyState < 2 || vd.currentTime === ultimo) return
      ultimo = vd.currentTime
      cv.width = vd.videoWidth; cv.height = vd.videoHeight
      const ctx = cv.getContext('2d')!; ctx.clearRect(0, 0, cv.width, cv.height)
      const lm: Pt[] | undefined = detector.detectForVideo(vd, performance.now())?.landmarks?.[0]
      if (!lm) { setAhora(null); return }
      const c = cuerpo(lm, lado, cv.width, cv.height)
      const ok = m.puntos.every(k => (c.s[k].visibility ?? 1) > 0.55)
      ctx.lineWidth = 6; ctx.strokeStyle = ok ? '#5FAEB9' : '#D4A24E'; ctx.fillStyle = '#fff'
      ctx.beginPath(); m.puntos.forEach((k, i) => i ? ctx.lineTo(c.s[k].x, c.s[k].y) : ctx.moveTo(c.s[k].x, c.s[k].y)); ctx.stroke()
      m.puntos.forEach(k => { ctx.beginPath(); ctx.arc(c.s[k].x, c.s[k].y, 9, 0, 7); ctx.fill() })
      const s = g.current
      if (!s.grabando) { s.ini = c; return }
      if (m.modo === 'analisis') { if (ok) s.fot.push(c); return }
      if (m.modo === 'crono') {
        const pierna = Math.hypot(c.s.cadera.x - c.s.tobillo.x, c.s.cadera.y - c.s.tobillo.y)
        const alto = (c.s.tobillo.y - c.o.tobillo.y) / pierna   // el pie libre más alto que el de apoyo
        if (!s.enAire && alto > 0.06) { s.enAire = true; s.t0 = performance.now() }
        if (s.enAire) {
          s.bajadas = alto < 0.025 ? s.bajadas + 1 : 0
          const t = (performance.now() - s.t0) / 1000; setReloj(Math.round(t * 10) / 10)
          if (s.bajadas >= 3 || t >= 60) terminar()
        }
        return
      }
      if (!ok || !m.valor) { setAhora(null); return }
      const x = m.valor(c, s.ini || undefined); if (x == null) { setAhora(null); return }
      s.ventana.push(x); if (s.ventana.length > 5) s.ventana.shift()
      const med = mediana(s.ventana); setAhora(Math.round(med))
      if (m.modo === 'max') { if (s.ventana.length >= 5 && (s.max == null || med > s.max)) { s.max = med; setMejor(Math.round(med)) } }
      if (m.modo === 'reps') {
        const f = m.fases!
        if (f.abajo(med)) s.fase = 'abajo'
        else if (f.arriba(med) && s.fase === 'abajo') { s.fase = 'arriba'; s.reps++; setMejor(s.reps) }
        const t = (performance.now() - s.t0) / 1000; setReloj(Math.max(0, Math.ceil(f.segundos - t)))
        if (t >= f.segundos) terminar()
      }
    }
    raf = requestAnimationFrame(bucle)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const empezar = () => {
    const s = g.current
    Object.assign(s, { grabando: true, max: null, ventana: [], fot: [], reps: 0, fase: '', t0: performance.now(), enAire: false, bajadas: 0, fin: false })
    setMejor(null); setReloj(null); setGrabando(true)
  }
  const etiqueta = m.modo === 'crono' ? 'Tiempo' : m.modo === 'reps' ? 'Repeticiones' : 'Máximo'
  const btn: React.CSSProperties = { border: 0, borderRadius: 99, padding: '12px 22px', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', color: '#fff' }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 12, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button onClick={onSalir} style={{ ...btn, background: '#E8E7E1', color: '#333', padding: '8px 14px', fontSize: 14 }}>← Volver</button>
        <b style={{ fontSize: 17 }}>{m.nombre} · {lado === 'izq' ? 'lado izquierdo' : 'lado derecho'}</b>
        <span style={{ flex: 1 }}/>
        <button onClick={() => setCamara(c => c === 'environment' ? 'user' : 'environment')} style={{ ...btn, background: '#E8E7E1', color: '#333', padding: '8px 14px', fontSize: 14 }}>Cambiar cámara</button>
      </div>
      <div style={{ fontSize: 14, background: '#EBF4F5', color: '#3E7179', padding: '9px 12px', borderRadius: 8, marginBottom: 8 }}>
        <b>{m.vista === 'lado' ? 'De lado' : 'De frente'}</b>, {lado === 'izq' ? 'el lado izquierdo' : 'el lado derecho'} hacia la cámara. {m.como}
      </div>
      <div style={{ position: 'relative', background: '#111', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={video} playsInline muted style={{ width: '100%', display: 'block', transform: camara === 'user' ? 'scaleX(-1)' : undefined }}/>
        <canvas ref={lienzo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: camara === 'user' ? 'scaleX(-1)' : undefined }}/>
        {m.modo !== 'analisis' && m.modo !== 'crono' && (
          <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 10, padding: '8px 14px' }}>
            <div style={{ fontSize: 12, opacity: .8 }}>Ahora</div><div style={{ fontSize: 32, fontWeight: 700 }}>{ahora != null ? `${ahora}°` : '—'}</div>
          </div>
        )}
        {grabando && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(176,90,90,.9)', color: '#fff', borderRadius: 10, padding: '8px 14px', textAlign: 'right' }}>
            <div style={{ fontSize: 12 }}>{m.modo === 'analisis' ? 'Grabando' : etiqueta}{m.modo === 'reps' && reloj != null ? ` · quedan ${reloj} s` : ''}</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{m.modo === 'crono' ? `${reloj ?? 0} s` : m.modo === 'reps' ? (mejor ?? 0) : m.modo === 'max' ? (mejor != null ? `${mejor}°` : '—') : '●'}</div>
          </div>
        )}
        {estado && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', padding: 20, textAlign: 'center' }}>{estado}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        {!grabando
          ? <button style={{ ...btn, background: '#3E7179' }} disabled={!!estado} onClick={empezar}>● Empezar</button>
          : <button style={{ ...btn, background: '#B05A5A' }} onClick={terminar}>■ Terminar</button>}
        <span style={{ fontSize: 12.5, color: '#6B6D6A' }}>En naranja = el detector no ve bien esa zona y ese momento no cuenta.</span>
      </div>
    </div>
  )
}
