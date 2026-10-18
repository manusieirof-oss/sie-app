'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { cargarEvaluadores } from '@/lib/objetivosTests'
import RoscoObjetivo from '../../RoscoObjetivo'
import RoscoTest from '../../RoscoTest'

// ---------------------------------------------------------------------------
// LA RED DE OBJETIVOS Y TESTS (torno → Objetivos y tests).
//
// Una sola pantalla que no se cambia nunca: se VIAJA por ella. En el centro, lo que se
// está mirando, abierto en quesitos para editarlo (RoscoObjetivo / RoscoTest). Alrededor,
// pequeños y unidos con una línea, los que se relacionan con él: sus tests si es un
// objetivo, sus objetivos si es un test. Y más afuera, apagados, los del siguiente salto.
//
// Tocar uno de fuera es ir a él: la cámara se acerca a ese planeta, pasa al centro y se
// abre en quesitos, y el de antes se queda fuera, pequeño, unido por su línea. Como
// flotar de planeta en planeta. Todo se carga una vez (objetivos, tests y enlaces), así
// que viajar no espera a nadie.
//
// Los enlaces son filas de `objetivos_tests` (ver lib/objetivosTests). Quitar uno quita
// también las partes (ítem o específico) que colgaran de él, y se avisa.
// ---------------------------------------------------------------------------

type Tipo = 'objetivo' | 'test'
type Foco = { tipo: Tipo, id: string }
const ES_ARCH = (x: any) => x?.archivado_el != null
const otroDe = (t: Tipo): Tipo => t === 'objetivo' ? 'test' : 'objetivo'

/** Un planeta: esfera verde para objetivos, disco arena para tests. */
function Planeta({ tipo, x, tam }: { tipo: Tipo, x: any, tam: number }) {
  const base: any = { width: tam, height: tam, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(38,40,37,.18)', opacity: ES_ARCH(x) ? .45 : 1 }
  if (x?.imagen_url) return <span style={{ ...base, background: 'var(--bl)' }}><img src={x.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/></span>
  if (tipo === 'objetivo') return (
    <span style={{ ...base, color: '#fff', fontSize: tam * .38, fontWeight: 500, textShadow: '0 1px 2px #23474D',
      background: 'radial-gradient(circle at 33% 28%, #fff 0%, #A8CDD1 20%, #3E7179 58%, #23474D 100%)' }}>
      {String(x?.nombre || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
  return (
    <span style={{ ...base, color: '#7A5800', background: 'radial-gradient(circle at 33% 28%, #fff 0%, #FBF1DC 35%, #E6CF8E 100%)' }}>
      <Ic name={x?.tipo === 'cuestionario' ? 'anamnesis' : 'test'} size={tam * .42}/>
    </span>
  )
}

export default function MapaPage() {
  const params = useParams() as { tipo: string, id: string }
  const router = useRouter()

  const [foco, setFoco] = useState<Foco>({ tipo: params.tipo === 'test' ? 'test' : 'objetivo', id: params.id })
  const [enlazarA, setEnlazarA] = useState<string | null>(null) // al crear uno nuevo desde el "+": a quién engancharlo
  const [objetivos, setObjetivos] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [enlaces, setEnlaces] = useState<any[]>([])
  const [cargado, setCargado] = useState(false)
  const [dim, setDim] = useState({ w: 1200, h: 800 })
  const [camara, setCamara] = useState<{ x: number, y: number, s: number, anim: boolean }>({ x: 0, y: 0, s: 1, anim: false })
  const [llegando, setLlegando] = useState(true)      // los de fuera, saliendo del centro tras un viaje
  const [menuMas, setMenuMas] = useState(false)
  const [busca, setBusca] = useState('')
  const [panel, setPanel] = useState(false)           // panel de un quesito abierto (a la derecha)
  const sinGuardar = useRef(false)
  const lienzo = useRef<HTMLDivElement>(null)

  // Al entrar desde el "+ nuevo" de otro, viene ?enlazar=<id>.
  useEffect(() => { setEnlazarA(new URLSearchParams(window.location.search).get('enlazar')) }, [])

  async function cargar() {
    const [o, t, e, r] = await Promise.all([
      supabase.from('objetivos').select('*').order('nombre'),
      cargarEvaluadores(),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
      supabase.from('objetivos_tests').select('objetivo_id,test_id,item,movimiento,banda'),
    ])
    setObjetivos(o.data || []); setTests(t || []); setEtiquetas(e.data || []); setEnlaces(r.data || [])
    setCargado(true)
  }
  useEffect(() => { cargar() }, [])

  // El lienzo ocupa la pantalla: todo se coloca en píxeles respecto a su centro.
  useEffect(() => {
    const medir = () => { const r = lienzo.current?.getBoundingClientRect(); if (r) setDim({ w: r.width, h: r.height }) }
    medir(); window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [cargado])

  // La URL sigue al foco, sin recargar: compartir o recargar lleva al mismo planeta.
  useEffect(() => { window.history.replaceState(null, '', `/torno/mapa/${foco.tipo}/${foco.id}`) }, [foco])

  const listaDe = (t: Tipo) => t === 'objetivo' ? objetivos : tests
  const centro = foco.id === 'nuevo' ? null : listaDe(foco.tipo).find(x => x.id === foco.id)
  const vecinosDe = (f: Foco): string[] => Array.from(new Set(enlaces
    .filter(e => (f.tipo === 'objetivo' ? e.objetivo_id : e.test_id) === f.id)
    .map(e => f.tipo === 'objetivo' ? e.test_id : e.objetivo_id)))
  const otro = otroDe(foco.tipo)
  const vecinos = useMemo(() => foco.id === 'nuevo' ? [] : vecinosDe(foco).map(id => listaDe(otro).find(x => x.id === id)).filter(Boolean) as any[],
    [foco, enlaces, objetivos, tests]) // eslint-disable-line react-hooks/exhaustive-deps
  const partesDe = (idOtro: string) => enlaces.filter(e => (foco.tipo === 'objetivo' ? e.objetivo_id === foco.id && e.test_id === idOtro : e.test_id === foco.id && e.objetivo_id === idOtro)
    && (e.item || e.movimiento || e.banda)).length

  // ---- Geometría ---------------------------------------------------------------
  // Con el panel de un quesito abierto (fijo a la derecha), el centro se aparta a la izquierda.
  const anchoUtil = panel ? Math.max(dim.w - 480, dim.w * .55) : dim.w
  const cx = anchoUtil / 2, cy = dim.h / 2 + 10
  const D = Math.max(260, Math.min(480, dim.h * .56, anchoUtil * .5))  // diámetro del rosco
  const R1 = D / 2 + 92                                                // anillo de los vecinos
  const R2 = R1 + 96                                                   // los del siguiente salto
  const nAnillo = vecinos.length + 1                                    // + el "+"
  const angulo = (i: number) => (-90 + (360 / nAnillo) * i) * Math.PI / 180
  const en = (r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })

  // ---- Viajar a otro planeta ----------------------------------------------------
  function viajar(destino: Foco, desde?: { x: number, y: number }) {
    if (destino.id === foco.id && destino.tipo === foco.tipo) return
    if (sinGuardar.current && !confirm('Hay cambios sin guardar en este. ¿Irte igualmente?')) return
    sinGuardar.current = false
    setMenuMas(false); setBusca(''); setPanel(false)
    if (!desde) { setFoco(destino); setLlegando(true); setTimeout(() => setLlegando(false), 60); return }
    // La cámara se acerca al planeta tocado; al llegar, ese pasa al centro y todo se recoloca.
    setCamara({ x: cx - desde.x, y: cy - desde.y, s: 1.7, anim: true })
    setTimeout(() => {
      setCamara({ x: 0, y: 0, s: 1, anim: false })
      setFoco(destino); setLlegando(true)
      setTimeout(() => setLlegando(false), 60)
    }, 520)
  }
  useEffect(() => { if (cargado) setTimeout(() => setLlegando(false), 80) }, [cargado])

  async function enlazar(idOtro: string) {
    const fila = foco.tipo === 'objetivo' ? { objetivo_id: foco.id, test_id: idOtro } : { objetivo_id: idOtro, test_id: foco.id }
    const { error } = await supabase.from('objetivos_tests').insert(fila)
    if (error) { alert('No se ha podido enlazar: ' + error.message); return }
    setMenuMas(false); setBusca('')
    setEnlaces(p => [...p, { ...fila, item: null, movimiento: null, banda: null }])
  }
  async function quitar(idOtro: string, nombre: string) {
    const n = partesDe(idOtro)
    if (!confirm(`¿Quitar «${nombre}» de «${centro?.nombre}»?${n ? `\n\nTambién se quitan ${n} parte${n > 1 ? 's' : ''} (ítems o específicos) que colgaban de este enlace.` : ''}`)) return
    const q = supabase.from('objetivos_tests').delete()
    const { error } = foco.tipo === 'objetivo' ? await q.eq('objetivo_id', foco.id).eq('test_id', idOtro) : await q.eq('test_id', foco.id).eq('objetivo_id', idOtro)
    if (error) { alert('No se ha podido quitar: ' + error.message); return }
    setEnlaces(p => p.filter(e => !(foco.tipo === 'objetivo' ? e.objetivo_id === foco.id && e.test_id === idOtro : e.test_id === foco.id && e.objetivo_id === idOtro)))
  }

  /** Al guardar el del centro: si era nuevo, pasa a ser él (y se engancha a quien lo pidió). */
  async function trasGuardar(id: string) {
    if (foco.id === 'nuevo' && enlazarA) {
      const fila = foco.tipo === 'objetivo' ? { objetivo_id: id, test_id: enlazarA } : { objetivo_id: enlazarA, test_id: id }
      await supabase.from('objetivos_tests').insert(fila)
    }
    await cargar()
    if (foco.id === 'nuevo') { setEnlazarA(null); sinGuardar.current = false; setFoco({ tipo: foco.tipo, id }) }
  }

  const candidatos = listaDe(otro).filter(x => !vecinos.some(v => v.id === x.id) && !ES_ARCH(x) && (busca.trim() ? contiene(x.nombre, busca) : true)).slice(0, 8)
  const TAM_V = Math.max(56, Math.min(78, D * .16)), TAM_2 = 30
  const lejanosDe = (v: any) => vecinosDe({ tipo: otro, id: v.id }).filter(id => id !== foco.id).slice(0, 4)
  const abanico = (n: number) => Math.min(14, 40 / Math.max(1, n)) * Math.PI / 180

  return (
    <div style={{ background: '#fff', margin: '-16px -18px', height: 'calc(100vh - 32px)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .esp-fondo { position:absolute; inset:0; pointer-events:none;
          background-image: radial-gradient(rgba(90,150,158,.13) 1px, transparent 1.2px); background-size: 26px 26px }
        .esp-nodo { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center;
          transition: left .55s cubic-bezier(.2,.9,.3,1.15), top .55s cubic-bezier(.2,.9,.3,1.15), opacity .4s ease }
        .esp-flota { animation: esp-flota 6s ease-in-out infinite }
        @keyframes esp-flota { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        .esp-plan { cursor:pointer; position:relative }
        .esp-plan > span:first-child { transition: transform .2s ease }
        .esp-plan:hover > span:first-child { transform: scale(1.08) }
        .esp-plan .esp-x { opacity:0; transition: opacity .15s }
        .esp-plan:hover .esp-x { opacity:1 }
        .esp-linea { transition: x1 .55s cubic-bezier(.2,.9,.3,1.15), y1 .55s cubic-bezier(.2,.9,.3,1.15), x2 .55s cubic-bezier(.2,.9,.3,1.15), y2 .55s cubic-bezier(.2,.9,.3,1.15), opacity .4s }
        .esp-pop { position:absolute; top:calc(100% + 8px); left:50%; transform:translateX(-50%); z-index:25; width:260px;
          background:#fff; border-radius:14px; padding:6px; box-shadow:0 12px 30px rgba(38,40,37,.18) }
        @keyframes esp-centro { from { transform: translate(-50%,-50%) scale(.6); opacity:0 } to { transform: translate(-50%,-50%) scale(1); opacity:1 } }
      `}</style>
      <div className="esp-fondo"/>

      {/* Cabecera flotante: volver, y qué se está mirando. */}
      <div style={{ position: 'absolute', top: 16, left: 22, right: 22, display: 'flex', alignItems: 'center', gap: 10, zIndex: 20, pointerEvents: 'none' }}>
        <button onClick={() => { if (sinGuardar.current && !confirm('Hay cambios sin guardar. ¿Salir igualmente?')) return; router.push('/torno?que=mapa') }} title="Volver al torno"
          style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: '#fff', color: 'var(--gd)', borderRadius: 99, padding: '9px 15px 9px 11px', fontSize: 13, boxShadow: '0 3px 14px rgba(38,40,37,.14)' }}>
          <Ic name="atras" size={15}/> Torno
        </button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: 'var(--grl)', background: 'rgba(255,255,255,.85)', padding: '4px 10px', borderRadius: 99 }}>
          {foco.tipo === 'objetivo' ? 'Objetivo · alrededor, los tests que lo evalúan' : 'Test · alrededor, los objetivos que evalúa'} · toca uno para ir a él
        </span>
      </div>

      <div ref={lienzo} style={{ position: 'absolute', inset: 0 }}>
        {!cargado ? <div className="muted" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>Cargando…</div>
          : !centro && foco.id !== 'nuevo' ? <div className="muted" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>No encuentro este {foco.tipo}.</div>
          : (
          // EL MUNDO: lo que mueve la cámara al viajar.
          <div style={{ position: 'absolute', inset: 0, transformOrigin: `${cx}px ${cy}px`,
            transform: `translate(${camara.x}px, ${camara.y}px) scale(${camara.s})`,
            transition: camara.anim ? 'transform .52s cubic-bezier(.5,0,.3,1)' : 'none' }}>

            {/* Las líneas: del centro a cada vecino, y de cada vecino a los suyos. */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              {vecinos.map((v: any, i: number) => {
                const p = llegando ? { x: cx, y: cy } : en(R1, angulo(i))
                const lej = lejanosDe(v), sp = abanico(lej.length)
                return (
                  <g key={v.id}>
                    <line className="esp-linea" x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#9FC3C8" strokeWidth={1.4} opacity={llegando ? 0 : 1}/>
                    {lej.map((lid, k) => {
                      const q = llegando ? p : en(R2, angulo(i) + (k - (lej.length - 1) / 2) * sp)
                      return <line key={lid} className="esp-linea" x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#C9DDE0" strokeWidth={1} strokeDasharray="3 4" opacity={llegando ? 0 : .8}/>
                    })}
                  </g>
                )
              })}
            </svg>

            {/* EL SIGUIENTE SALTO: pequeños y apagados. Tocar uno también es ir a él. */}
            {vecinos.map((v: any, i: number) => {
              const lej = lejanosDe(v), sp = abanico(lej.length)
              return lej.map((lid, k) => {
                const x = listaDe(foco.tipo).find(o => o.id === lid)
                if (!x) return null
                const pv = en(R1, angulo(i))
                const p = llegando ? pv : en(R2, angulo(i) + (k - (lej.length - 1) / 2) * sp)
                return (
                  <div key={v.id + lid} className="esp-nodo" style={{ left: p.x, top: p.y, opacity: llegando ? 0 : .55, zIndex: 2 }}>
                    <div className="esp-plan esp-flota" title={x.nombre} style={{ animationDelay: `${(k + i) * .7}s` }}
                      onClick={() => viajar({ tipo: foco.tipo, id: lid }, p)}>
                      <Planeta tipo={foco.tipo} x={x} tam={TAM_2}/>
                    </div>
                  </div>
                )
              })
            })}

            {/* LOS VECINOS */}
            {vecinos.map((v: any, i: number) => {
              const p = llegando ? { x: cx, y: cy } : en(R1, angulo(i))
              const partes = partesDe(v.id)
              return (
                <div key={v.id} className="esp-nodo" style={{ left: p.x, top: p.y, opacity: llegando ? 0 : 1, transitionDelay: `${i * 40}ms`, zIndex: 5 }}>
                  <div className="esp-plan esp-flota" style={{ animationDelay: `${i * .9}s` }} title={`Ir a «${v.nombre}»`}
                    onClick={() => viajar({ tipo: otro, id: v.id }, p)}>
                    <Planeta tipo={otro} x={v} tam={TAM_V}/>
                    {partes > 0 && <span title="Enganchado por partes (ítems o específicos)" style={{ position: 'absolute', top: -2, right: -2, fontSize: 10, fontWeight: 600,
                      minWidth: 18, height: 18, borderRadius: 99, background: 'var(--g)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{partes}</span>}
                    {/* Quitar la relación: discreto, aparece al pasar por encima. */}
                    <span className="esp-x" title="Quitar la relación" onClick={e => { e.stopPropagation(); quitar(v.id, v.nombre) }}
                      style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 99, background: '#fff', color: 'var(--red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 5px rgba(38,40,37,.25)' }}><Ic name="cerrar" size={11}/></span>
                  </div>
                  <div style={{ width: 120, marginTop: 6, fontSize: 11.5, lineHeight: 1.25, color: 'var(--n)', textAlign: 'center', background: 'rgba(255,255,255,.8)', borderRadius: 6,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.nombre}</div>
                </div>
              )
            })}

            {/* EL "+": crear uno nuevo o enganchar uno que ya existe. */}
            {foco.id !== 'nuevo' && (() => {
              const p = llegando ? { x: cx, y: cy } : en(R1, angulo(vecinos.length))
              return (
                <div className="esp-nodo" style={{ left: p.x, top: p.y, opacity: llegando ? 0 : 1, zIndex: menuMas ? 26 : 5 }}>
                  <button type="button" onClick={() => setMenuMas(v => !v)} title={`Añadir ${otro === 'test' ? 'un test' : 'un objetivo'}`}
                    style={{ width: 52, height: 52, borderRadius: '50%', border: '2px dashed var(--gm)', background: menuMas ? 'var(--gl)' : '#fff',
                      color: 'var(--g)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ic name="mas" size={19}/>
                  </button>
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--grl)' }}>{otro === 'test' ? 'Test' : 'Objetivo'}</div>
                  {menuMas && (
                    <div className="esp-pop">
                      <button type="button" onClick={() => { setEnlazarA(foco.id); viajar({ tipo: otro, id: 'nuevo' }) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 9px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, borderRadius: 8, textAlign: 'left' }}>
                        <Ic name="mas" size={13}/> {otro === 'test' ? 'Crear un test nuevo' : 'Crear un objetivo nuevo'}
                      </button>
                      <div style={{ borderTop: '1px solid var(--bl)', margin: '4px 0', padding: '6px 4px 2px' }}>
                        <input className="input" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                          placeholder={otro === 'test' ? 'O engancha un test que ya existe…' : 'O engancha un objetivo que ya existe…'} style={{ fontSize: 12.5, padding: '7px 9px' }}/>
                      </div>
                      {candidatos.map(c => (
                        <div key={c.id} onClick={() => enlazar(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer', borderRadius: 8 }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--bl)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                          <Planeta tipo={otro} x={c} tam={24}/>
                          <span style={{ fontSize: 12.5 }}>{c.nombre}</span>
                        </div>
                      ))}
                      {candidatos.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--grl)', padding: '4px 9px' }}>Nada que enganchar con ese nombre.</div>}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* EL CENTRO: abierto en quesitos. Cambia de clave al viajar, así entra de nuevo. */}
            <div key={foco.tipo + foco.id} style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%,-50%)', zIndex: 10,
              transition: 'left .45s ease', animation: 'esp-centro .5s cubic-bezier(.2,.9,.3,1.2) backwards' }}>
              {foco.tipo === 'objetivo'
                ? <RoscoObjetivo objetivo={centro || null} etiquetas={etiquetas} tests={tests} tam={D}
                    onGuardado={trasGuardar} onCambiado={v => { sinGuardar.current = v }} onPanel={setPanel}
                    onCerrar={foco.id === 'nuevo' ? () => router.push('/torno?que=mapa') : undefined}/>
                : <RoscoTest test={centro || null} etiquetas={etiquetas} objetivos={objetivos} tam={D}
                    onGuardado={trasGuardar} onCambiado={v => { sinGuardar.current = v }} onPanel={setPanel}
                    onCerrar={foco.id === 'nuevo' ? () => router.push('/torno?que=mapa') : undefined}/>}
            </div>
          </div>
        )}
      </div>

      {cargado && centro && vecinos.length === 0 && !panel && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 86, textAlign: 'center', fontSize: 12.5, color: 'var(--gr)', pointerEvents: 'none' }}>
          {foco.tipo === 'objetivo'
            ? 'Aún no hay ningún test que lo evalúe: sin él no se puede abrir ni cerrar. Toca el + para crearlo o engancharlo.'
            : 'Este test todavía no evalúa ningún objetivo. Toca el + para enlazarlo.'}
        </div>
      )}
    </div>
  )
}
