'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { cargarEvaluadores } from '@/lib/objetivosTests'
import RoscoObjetivo from '../../RoscoObjetivo'
import ModalTest from '@/app/entrenamiento/components/ModalTest'

// ---------------------------------------------------------------------------
// EL MAPA DE UN OBJETIVO O DE UN TEST (torno → Objetivos y tests).
//
// La relación objetivo ↔ test es directa: el test es lo que abre y cierra el objetivo.
// Así que se dibuja como es: el objetivo en el centro y, al abrirse, sus tests se
// despliegan alrededor como pequeños círculos; un test en el centro, y alrededor los
// objetivos que evalúa. Tocar uno de fuera lo lleva al centro: se navega por la red.
//
// El círculo "+" crea uno nuevo o engancha uno que ya existe. El del centro se edita
// con el mismo formulario de la biblioteca (ModalObjetivo / ModalTest): un solo sitio
// donde vive cada cosa, dos puertas para llegar.
//
// Los enlaces son filas de `objetivos_tests` (ver lib/objetivosTests). Quitar un enlace
// quita también las partes (ítem o específico) que colgaran de él, y se avisa.
// ---------------------------------------------------------------------------

type Tipo = 'objetivo' | 'test'
const ES_ARCH = (x: any) => x?.archivado_el != null

/** Un círculo: esfera verde para objetivos, disco arena para tests. */
function Circulo({ tipo, x, tam, sel }: { tipo: Tipo, x: any, tam: number, sel?: boolean }) {
  const base: any = { width: tam, height: tam, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    boxShadow: sel ? '0 0 0 3px #fff, 0 0 0 5px var(--g), 0 8px 22px rgba(38,40,37,.22)' : '0 4px 14px rgba(38,40,37,.18)',
    opacity: ES_ARCH(x) ? .45 : 1, transition: 'box-shadow .15s' }
  if (x?.imagen_url) return <span style={{ ...base, background: 'var(--bl)' }}><img src={x.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/></span>
  if (tipo === 'objetivo') return (
    <span style={{ ...base, color: '#fff', fontSize: tam * .36, fontWeight: 500, textShadow: '0 1px 2px #23474D',
      background: 'radial-gradient(circle at 33% 28%, #fff 0%, #A8CDD1 20%, #3E7179 58%, #23474D 100%)' }}>
      {String(x?.nombre || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
  return (
    <span style={{ ...base, color: '#7A5800', background: 'radial-gradient(circle at 33% 28%, #fff 0%, #FBF1DC 35%, #E6CF8E 100%)' }}>
      <Ic name={x?.tipo === 'cuestionario' ? 'anamnesis' : 'test'} size={tam * .4}/>
    </span>
  )
}

export default function MapaPage() {
  const params = useParams() as { tipo: string, id: string }
  const router = useRouter()
  const tipo: Tipo = params.tipo === 'test' ? 'test' : 'objetivo'
  const otro: Tipo = tipo === 'objetivo' ? 'test' : 'objetivo'
  const nuevo = params.id === 'nuevo'

  const [objetivos, setObjetivos] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [enlaces, setEnlaces] = useState<any[]>([])
  const [cargado, setCargado] = useState(false)
  const [abierto, setAbierto] = useState(false)      // los de alrededor, desplegados
  const [menu, setMenu] = useState<string | null>(null) // id del círculo con su menú abierto, '+' o 'centro'
  const [busca, setBusca] = useState('')
  const [editar, setEditar] = useState(false)          // el objetivo del centro, en quesitos
  const [crear, setCrear] = useState<Tipo | null>(null) // modal de crear (uno de fuera, o el centro si es nuevo)
  const escena = useRef<HTMLDivElement>(null)

  async function cargar() {
    const [o, t, e] = await Promise.all([
      supabase.from('objetivos').select('*').order('nombre'),
      cargarEvaluadores(),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
    ])
    setObjetivos(o.data || []); setTests(t || []); setEtiquetas(e.data || [])
    if (!nuevo) {
      const col = tipo === 'objetivo' ? 'objetivo_id' : 'test_id'
      const { data } = await supabase.from('objetivos_tests').select('objetivo_id,test_id,item,movimiento,banda').eq(col, params.id)
      setEnlaces(data || [])
    }
    setCargado(true)
  }
  useEffect(() => {
    setAbierto(false); setMenu(null); setBusca(''); setCargado(false); setEditar(false)
    cargar().then(() => setTimeout(() => setAbierto(true), 120))
    // Un objetivo nuevo nace en quesitos; un test nuevo, con su formulario.
    if (nuevo) { if (tipo === 'objetivo') setEditar(true); else setCrear('test') }
  }, [params.tipo, params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tocar fuera cierra el menú de un círculo.
  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('[data-mapa-menu]')) setMenu(null) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [menu])

  const lista = tipo === 'objetivo' ? objetivos : tests
  const listaOtro = tipo === 'objetivo' ? tests : objetivos
  const centro = lista.find(x => x.id === params.id)
  // Los de alrededor, una vez cada uno aunque tengan varias filas (por ítem o específico).
  const idsFuera = Array.from(new Set(enlaces.map(e => tipo === 'objetivo' ? e.test_id : e.objetivo_id)))
  const fuera = idsFuera.map(id => listaOtro.find(x => x.id === id)).filter(Boolean)
  const partesDe = (id: string) => enlaces.filter(e => (tipo === 'objetivo' ? e.test_id : e.objetivo_id) === id && (e.item || e.movimiento || e.banda)).length

  const ir = (t: Tipo, id: string) => router.push(`/torno/mapa/${t}/${id}`)

  async function enlazar(idOtro: string) {
    const fila = tipo === 'objetivo' ? { objetivo_id: params.id, test_id: idOtro } : { objetivo_id: idOtro, test_id: params.id }
    const { error } = await supabase.from('objetivos_tests').insert(fila)
    if (error) { alert('No se ha podido enlazar: ' + error.message); return }
    setMenu(null); setBusca(''); await cargar()
  }
  async function quitar(idOtro: string, nombre: string) {
    const n = partesDe(idOtro)
    if (!confirm(`¿Quitar «${nombre}» de «${centro?.nombre}»?${n ? `\n\nTambién se quitan ${n} parte${n > 1 ? 's' : ''} (ítems o específicos) que colgaban de este enlace.` : ''}`)) return
    const q = supabase.from('objetivos_tests').delete()
    const { error } = tipo === 'objetivo' ? await q.eq('objetivo_id', params.id).eq('test_id', idOtro) : await q.eq('test_id', params.id).eq('objetivo_id', idOtro)
    if (error) { alert('No se ha podido quitar: ' + error.message); return }
    setMenu(null); await cargar()
  }

  // ---- Geometría: el centro y un anillo con los de fuera más el "+" ----------
  const n = fuera.length + 1
  const TAM_C = 150, TAM_F = 74
  const pos = (i: number) => {
    const ang = (-90 + (360 / n) * i) * Math.PI / 180
    const r = n <= 4 ? 36 : n <= 8 ? 40 : 43 // % del lienzo
    return { x: 50 + r * Math.cos(ang), y: 50 + r * Math.sin(ang) }
  }

  const pop: any = { position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
    background: '#fff', borderRadius: 12, padding: 6, boxShadow: '0 10px 28px rgba(38,40,37,.18)', minWidth: 200, textAlign: 'left' }
  const opcion = (icono: string, texto: string, fn: () => void, rojo?: boolean) => (
    <button type="button" onClick={fn}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 9px', border: 'none', background: 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: rojo ? 'var(--red)' : 'var(--n)', borderRadius: 8, textAlign: 'left' }}
      onMouseOver={e => (e.currentTarget.style.background = 'var(--bl)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
      <Ic name={icono} size={13}/> {texto}
    </button>
  )
  const etiqueta = (x: any, ancho: number) => (
    <div style={{ width: ancho, marginTop: 6, fontSize: 11.5, lineHeight: 1.25, color: 'var(--n)', textAlign: 'center',
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x?.nombre}</div>
  )
  const candidatos = listaOtro.filter(x => !idsFuera.includes(x.id) && !ES_ARCH(x) && (busca.trim() ? contiene(x.nombre, busca) : true)).slice(0, 8)

  return (
    // Fondo blanco, como el resto del torno (amasar, tornear): el arena era el de la app.
    <div style={{ background: '#fff', margin: '-16px -18px', minHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 22px 120px', overflow: 'hidden' }}>
      <style>{`.mp-sale{transition:left .5s cubic-bezier(.2,.9,.3,1.2),top .5s cubic-bezier(.2,.9,.3,1.2),opacity .35s ease}
        .mp-linea{transition:stroke-dashoffset .5s ease .1s}`}</style>

      <div style={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/torno?que=mapa')} title="Volver al torno"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: '#fff', color: 'var(--gd)', borderRadius: 99, padding: '9px 15px 9px 11px', fontSize: 13,
            boxShadow: '0 3px 14px rgba(38,40,37,.14)' }}><Ic name="atras" size={15}/> Torno</button>
        <div style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>
          {editar ? 'Objetivo · toca un quesito para cambiarlo' : tipo === 'objetivo' ? 'Objetivo · alrededor, los tests que lo evalúan' : 'Test · alrededor, los objetivos que evalúa'}
        </span>
      </div>

      {!cargado ? <div className="muted" style={{ padding: 60 }}>Cargando…</div> : editar && tipo === 'objetivo' ? (
        <RoscoObjetivo key={centro?.id || 'nuevo'} objetivo={nuevo ? null : centro} etiquetas={etiquetas} tests={tests}
          onGuardado={async (id: string) => {
            // Nuevo: si se creó desde el + de un test, se engancha a él; y pasa a su mapa.
            if (nuevo) {
              const desde = new URLSearchParams(window.location.search).get('enlazar')
              if (desde) await supabase.from('objetivos_tests').insert({ objetivo_id: id, test_id: desde })
              router.replace(`/torno/mapa/objetivo/${id}`); return
            }
            await cargar()
          }}
          onCerrar={() => { if (nuevo) router.push('/torno?que=mapa'); else { setEditar(false); cargar() } }}/>
      ) : !centro && !nuevo ? (
        <div className="muted" style={{ padding: 60 }}>No encuentro este {tipo}.</div>
      ) : centro && !editar && (
        <div ref={escena} style={{ position: 'relative', width: 'min(620px, 92vw)', aspectRatio: '1', marginTop: 10 }}>
          {/* Las líneas del centro a cada uno: la relación, dibujada. */}
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {fuera.map((x: any, i: number) => {
              const p = pos(i)
              return <line key={x.id} className="mp-linea" x1="50" y1="50" x2={p.x} y2={p.y} stroke="var(--gm)" strokeWidth=".35"
                strokeDasharray="60" strokeDashoffset={abierto ? 0 : 60}/>
            })}
          </svg>

          {/* EL CENTRO */}
          <div data-mapa-menu style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 5 }}>
            <div style={{ cursor: 'pointer' }} title={tipo === 'objetivo' ? 'Tocar para editarlo' : undefined}
              onClick={() => tipo === 'objetivo' ? setEditar(true) : setMenu(m => m === 'centro' ? null : 'centro')}>
              <Circulo tipo={tipo} x={centro} tam={TAM_C} sel={menu === 'centro'}/>
            </div>
            <div style={{ marginTop: 10, fontSize: 15, color: 'var(--n)', textAlign: 'center', maxWidth: 220 }}>{centro.nombre}</div>
            {ES_ARCH(centro) && <div style={{ fontSize: 11, color: 'var(--grl)' }}>Archivado</div>}
            {menu === 'centro' && (
              <div style={{ ...pop, top: 'calc(100% + 4px)' }}>
                {centro.descripcion && <div style={{ fontSize: 11.5, color: 'var(--gr)', padding: '4px 9px 8px', lineHeight: 1.45, maxWidth: 260 }}>{centro.descripcion}</div>}
                {opcion('editar', 'Editar el test en la biblioteca', () => router.push(`/entrenamiento?tab=tests&test=${centro.id}`))}
              </div>
            )}
          </div>

          {/* LOS DE ALREDEDOR, que salen del centro al abrirse */}
          {fuera.map((x: any, i: number) => {
            const p = abierto ? pos(i) : { x: 50, y: 50 }
            const partes = partesDe(x.id)
            return (
              <div key={x.id} data-mapa-menu className="mp-sale"
                style={{ position: 'absolute', left: p.x + '%', top: p.y + '%', transform: 'translate(-50%,-50%)', opacity: abierto ? 1 : 0,
                  transitionDelay: `${i * 45}ms`, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: menu === x.id ? 15 : 6 }}>
                <div style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setMenu(m => m === x.id ? null : x.id)}>
                  <Circulo tipo={otro} x={x} tam={TAM_F} sel={menu === x.id}/>
                  {partes > 0 && <span title="Enganchado por partes (ítems o específicos)" style={{ position: 'absolute', top: -2, right: -2, fontSize: 10, fontWeight: 600,
                    minWidth: 18, height: 18, borderRadius: 99, background: 'var(--g)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{partes}</span>}
                </div>
                {etiqueta(x, 110)}
                {menu === x.id && (
                  <div style={pop}>
                    {opcion(otro === 'objetivo' ? 'objetivo' : 'test', `Ir a su mapa`, () => ir(otro, x.id))}
                    {opcion('cerrar', 'Quitar la relación', () => quitar(x.id, x.nombre), true)}
                  </div>
                )}
              </div>
            )
          })}

          {/* EL "+" : crear uno nuevo o enganchar uno que ya existe */}
          {(() => {
            const p = abierto ? pos(fuera.length) : { x: 50, y: 50 }
            return (
              <div data-mapa-menu className="mp-sale"
                style={{ position: 'absolute', left: p.x + '%', top: p.y + '%', transform: 'translate(-50%,-50%)', opacity: abierto ? 1 : 0,
                  transitionDelay: `${fuera.length * 45}ms`, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: menu === '+' ? 15 : 6 }}>
                <button type="button" onClick={() => setMenu(m => m === '+' ? null : '+')} title={`Añadir ${otro === 'test' ? 'un test' : 'un objetivo'}`}
                  style={{ width: 56, height: 56, borderRadius: '50%', border: '2px dashed var(--gm)', background: menu === '+' ? 'var(--gl)' : '#fff',
                    color: 'var(--g)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ic name="mas" size={20}/>
                </button>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--grl)' }}>{otro === 'test' ? 'Test' : 'Objetivo'}</div>
                {menu === '+' && (
                  <div style={{ ...pop, width: 260 }}>
                    {opcion('mas', otro === 'test' ? 'Crear un test nuevo' : 'Crear un objetivo nuevo', () => {
                      setMenu(null)
                      // Un objetivo se crea en quesitos, en su propio mapa, y se engancha a este test al guardarlo.
                      if (otro === 'objetivo') router.push(`/torno/mapa/objetivo/nuevo?enlazar=${params.id}`)
                      else setCrear('test')
                    })}
                    <div style={{ borderTop: '1px solid var(--bl)', margin: '4px 0', padding: '6px 4px 2px' }}>
                      <input className="input" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                        placeholder={otro === 'test' ? 'O engancha un test que ya existe…' : 'O engancha un objetivo que ya existe…'} style={{ fontSize: 12.5, padding: '7px 9px' }}/>
                    </div>
                    {candidatos.map(c => (
                      <div key={c.id} onClick={() => enlazar(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer', borderRadius: 8 }}
                        onMouseOver={e => (e.currentTarget.style.background = 'var(--bl)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                        <Circulo tipo={otro} x={c} tam={24}/>
                        <span style={{ fontSize: 12.5 }}>{c.nombre}</span>
                      </div>
                    ))}
                    {candidatos.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--grl)', padding: '4px 9px' }}>Nada que enganchar con ese nombre.</div>}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {centro && !editar && fuera.length === 0 && abierto && (
        <div style={{ fontSize: 12.5, color: 'var(--gr)', marginTop: 4, textAlign: 'center', maxWidth: 420 }}>
          {tipo === 'objetivo'
            ? 'Aún no hay ningún test que lo evalúe: sin él no se puede abrir ni cerrar. Toca el + para crearlo o engancharlo.'
            : 'Este test todavía no evalúa ningún objetivo. Toca el + para enlazarlo.'}
        </div>
      )}

      {crear === 'test' && (
        <ModalTest etiquetas={etiquetas} objetivos={objetivos}
          onCerrar={() => { setCrear(null); if (nuevo) router.push('/torno?que=mapa') }}
          onCreado={async (t: any) => {
            setCrear(null)
            if (!t?.id) return
            if (nuevo) { router.replace(`/torno/mapa/test/${t.id}`); return }
            await enlazar(t.id)
          }}/>
      )}
    </div>
  )
}
