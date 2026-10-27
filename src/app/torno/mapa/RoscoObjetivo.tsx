'use client'
import { useEffect, useState } from 'react'
import { FAMILIAS_BUSCA, buscaDe } from '@/lib/ejercicioObjetivos'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { ordenAnatomico } from '@/lib/anatomia'
import { categoriaDe } from '@/lib/etiquetas'
import { subirImagenObjetivo } from '@/lib/ejercicios'
import { testsDeObjetivo, fijarTestsDeObjetivo, type Evaluador } from '@/lib/objetivosTests'
import EspecificosEnPestanas from '@/app/entrenamiento/components/EspecificosObjetivo'
import SelectorEvaluadores from '@/app/entrenamiento/components/SelectorEvaluadores'
import { PatologiasObjetivo } from '@/app/entrenamiento/components/ModalObjetivo'

// ---------------------------------------------------------------------------
// EL OBJETIVO, EN QUESITOS (torno → mapa → tocar el objetivo del centro).
//
// Lo mismo que el formulario de la biblioteca (ModalObjetivo), pero como se amasa un
// ejercicio: la esfera en el centro y alrededor un quesito por cosa que tiene. Cada
// quesito se rellena de color cuando ya tiene lo suyo; al tocarlo se abre al lado su
// editor. Así se ve de un vistazo qué le falta, sin un formulario largo.
//
// Se guarda igual que en la biblioteca: los datos en `objetivos`, la imagen en el
// almacén y los tests de cada específico en `objetivos_tests` (fijarTestsDeObjetivo).
// ---------------------------------------------------------------------------

const C = 300, R0 = 168, R1 = 286, HUECO = 1.6
const polar = (r: number, a: number) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)]
function quesito(a0: number, a1: number) {
  const [x0, y0] = polar(R1, a0), [x1, y1] = polar(R1, a1), [x2, y2] = polar(R0, a1), [x3, y3] = polar(R0, a0)
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${R1},${R1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${R0},${R0} 0 ${g} 0 ${x3},${y3} Z`
}

type Clave = 'nombre' | 'descripcion' | 'zona' | 'busca' | 'imagen' | 'especificos' | 'patologia'

export default function RoscoObjetivo({ objetivo, etiquetas, tests, onGuardado, onCerrar, onCambiado, onPanel, tam = 520 }: {
  objetivo: any | null, etiquetas: any[], tests: any[],
  onGuardado: (id: string) => void,
  /** Solo si se puede salir sin más (uno nuevo): en el mapa no hay "salir", se viaja a otro. */
  onCerrar?: () => void,
  /** Avisa de si hay cambios sin guardar: el mapa pregunta antes de viajar a otro. */
  onCambiado?: (v: boolean) => void,
  /** Avisa de si el panel lateral está abierto: el mapa se aparta para que no lo tape. */
  onPanel?: (v: boolean) => void,
  /** Diámetro del rosco, en px: lo decide el mapa según la pantalla. */
  tam?: number,
}) {
  const [d, setD] = useState<any>({
    id: objetivo?.id || '', nombre: objetivo?.nombre || '', descripcion: objetivo?.descripcion || '',
    articulacion_id: objetivo?.articulacion_id || '', etiquetas: objetivo?.etiquetas || [],
    movimientos: objetivo?.movimientos || [], busca: Array.isArray(objetivo?.busca) ? objetivo.busca : [], imagen_url: objetivo?.imagen_url || '', imagen_file: null as File | null,
  })
  const [evaluadores, setEvaluadores] = useState<Evaluador[]>([])
  const [abierto, setAbierto] = useState<Clave | null>(objetivo ? null : 'nombre')
  const [encima, setEncima] = useState<Clave | null>(null)
  const [eligiendo, setEligiendo] = useState<string | null | undefined>(undefined)
  const [cambiado, setCambiado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => { if (objetivo?.id) testsDeObjetivo(objetivo.id).then(setEvaluadores) }, [objetivo?.id])
  const set = (k: string, v: any) => { setD((p: any) => ({ ...p, [k]: v })); setCambiado(true); setAviso('') }

  const deCategoria = (cat: string) => etiquetas.filter((e: any) => categoriaDe(etiquetas, e) === cat)
  const articulaciones = deCategoria('articulacion').sort((a: any, b: any) => ordenAnatomico(a.nombre, b.nombre))
  const nombreEt = (id: string) => etiquetas.find((e: any) => e.id === id)?.nombre
  const patologias = (d.etiquetas || []).filter((id: string) => deCategoria('patologia').some((e: any) => e.id === id))
  const nMov = (d.movimientos || []).length

  const QUESITOS: { k: Clave, t: string, ic: string, lleno: boolean, sub: string, opcional?: boolean }[] = [
    { k: 'nombre', t: 'Nombre', ic: 'editar', lleno: !!d.nombre.trim(), sub: d.nombre || 'Sin nombre' },
    { k: 'descripcion', t: 'Descripción', ic: 'nota', lleno: !!d.descripcion.trim(), sub: d.descripcion ? 'Escrita' : 'Vacía' },
    { k: 'zona', t: 'Zona', ic: 'ubicacion', lleno: !!d.articulacion_id, sub: nombreEt(d.articulacion_id) || 'Sin zona' },
    // QUE BUSCA (fuerza, movilidad…): la segunda comprobacion del cruce con los ejercicios.
    // Sin guardar, se deduce del nombre y sale "propuesto".
    { k: 'busca', t: 'Busca', ic: 'objetivo', lleno: (d.busca || []).length > 0,
      sub: (d.busca || []).length ? FAMILIAS_BUSCA.filter(f => d.busca.includes(f[0])).map(f => f[1]).join(', ')
        : buscaDe({ nombre: d.nombre }).length ? 'Propuesto: ' + FAMILIAS_BUSCA.filter(f => buscaDe({ nombre: d.nombre }).includes(f[0])).map(f => f[1]).join(', ') : 'Sin decir' },
    { k: 'especificos', t: 'Específicos', ic: 'lista', lleno: nMov > 0, sub: nMov ? `${nMov} parte${nMov === 1 ? '' : 's'}` : 'El objetivo entero', opcional: true },
    { k: 'imagen', t: 'Imagen', ic: 'camara', lleno: !!d.imagen_url, sub: d.imagen_url ? 'Con imagen' : 'Esfera', opcional: true },
    { k: 'patologia', t: 'Patología', ic: 'patologia', lleno: patologias.length > 0, sub: patologias.length ? `${patologias.length} puesta${patologias.length === 1 ? '' : 's'}` : 'Ninguna', opcional: true },
  ]
  const paso = 360 / QUESITOS.length
  const necesarios = QUESITOS.filter(q => !q.opcional)
  const llenos = necesarios.filter(q => q.lleno).length

  async function guardar() {
    if (!d.nombre.trim()) { setAviso('Falta el nombre'); setAbierto('nombre'); return }
    setGuardando(true)
    const payload: any = { nombre: d.nombre.trim(), descripcion: d.descripcion, articulacion_id: d.articulacion_id || null,
      etiquetas: d.etiquetas || [], movimientos: d.movimientos || [], busca: d.busca || [] }
    let id = d.id
    if (id) {
      const r = await supabase.from('objetivos').update(payload).eq('id', id)
      if (r.error) { setGuardando(false); setAviso(r.error.message); return }
    } else {
      const r = await supabase.from('objetivos').insert({ ...payload, activo: true }).select('id').single()
      if (r.error || !r.data) { setGuardando(false); setAviso(r.error?.message || 'No se pudo crear'); return }
      id = r.data.id
    }
    if (d.imagen_file) {
      const ri = await subirImagenObjetivo(id, d.imagen_file)
      if (ri.ok === false) setAviso('Guardado, pero la imagen no: ' + ri.error)
      else await supabase.from('objetivos').update({ imagen_url: ri.url }).eq('id', id)
    } else if (d.id && !d.imagen_url && objetivo?.imagen_url) {
      await supabase.from('objetivos').update({ imagen_url: null }).eq('id', id)
    }
    // Los tests de cada específico. Si se quitó un específico, se van sus tests con él.
    const vivos = (d.movimientos || []) as string[]
    const re = await fijarTestsDeObjetivo(id, evaluadores.filter(e => e.movimiento == null || vivos.includes(e.movimiento)))
    setGuardando(false)
    if (re.ok === false) { setAviso('Guardado, pero sus tests no: ' + re.error); return }
    setCambiado(false); setAviso('✓ Guardado')
    setD((p: any) => ({ ...p, id, imagen_file: null }))
    onGuardado(id)
  }

  /** Lo que comprueba cada parte (o el objetivo entero), en pastillas que se quitan. */
  const evaluacion = (mov: string | null) => {
    const suyos = evaluadores.map((e, k) => ({ e, k })).filter(({ e }) => (e.movimiento || null) === mov)
    if (!suyos.length) return <div style={{ fontSize: 12, color: 'var(--grl)' }}>Sin nada con lo que comprobarlo.</div>
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {suyos.map(({ e, k }) => (
          <span key={k} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 99, background: 'var(--ambl)', color: '#7A5800', display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            {tests.find((t: any) => t.id === e.test_id)?.nombre || 'Test'}
            {(e.item || e.banda) && <span style={{ opacity: .7 }}>· {e.item || e.banda}</span>}
            <span style={{ cursor: 'pointer', opacity: .7 }} title="Quitar" onClick={() => { setEvaluadores(p => p.filter((_, i) => i !== k)); setCambiado(true) }}>✕</span>
          </span>
        ))}
      </div>
    )
  }

  const editor = (k: Clave) => {
    if (k === 'busca') {
      const prop = buscaDe({ nombre: d.nombre })
      const val: string[] = (d.busca || []).length ? d.busca : prop
      return (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FAMILIAS_BUSCA.map(([id, t]) => {
              const on = val.includes(id)
              return <button key={id} type="button" className={`chip-sel ${on ? 'on' : ''}`} style={{ fontSize: 13 }}
                onClick={() => set('busca', on ? val.filter(x => x !== id) : [...val, id])}>{t}</button>
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 8, lineHeight: 1.5 }}>
            {(d.busca || []).length ? 'Un ejercicio cuenta para este objetivo si admite alguna de estas y mueve lo que pide.'
              : prop.length ? 'Propuesto por el nombre. Toca para confirmar o cambiar.' : 'Elige qué capacidad busca este objetivo.'}
          </div>
        </>
      )
    }
    if (k === 'nombre') return (
      <>
        <input className="input" autoFocus value={d.nombre} onChange={e => set('nombre', e.target.value)}
          placeholder="ej. Movilidad de tobillo, Aprender el puente de glúteo" style={{ fontSize: 15 }}/>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 6 }}>Empieza por un verbo, y sin lado: el lado se elige al asignárselo a un paciente.</div>
      </>
    )
    if (k === 'descripcion') return (
      <textarea className="input" autoFocus value={d.descripcion} onChange={e => set('descripcion', e.target.value)}
        placeholder="Qué se busca y cuándo se da por conseguido" style={{ minHeight: 140, resize: 'vertical' }}/>
    )
    if (k === 'zona') return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[{ id: '', nombre: 'Sin zona concreta' }, ...articulaciones].map((a: any) => {
          const on = (d.articulacion_id || '') === a.id
          return (
            <button key={a.id || 'nada'} type="button" onClick={() => set('articulacion_id', a.id)}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 12px', borderRadius: 99,
                background: on ? 'var(--g)' : 'var(--bl)', color: on ? '#fff' : 'var(--n)' }}>{a.nombre}</button>
          )
        })}
      </div>
    )
    if (k === 'imagen') return (
      <div>
        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 16, overflow: 'hidden', background: 'var(--bl)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          {d.imagen_url ? <img src={d.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{ color: 'var(--grl)' }}><Ic name="objetivo" size={56}/></span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-s btn-sm" style={{ cursor: 'pointer' }}>
            <Ic name="camara" size={12}/> {d.imagen_url ? 'Cambiar' : 'Subir'}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { set('imagen_file', f); set('imagen_url', URL.createObjectURL(f)) } }}/>
          </label>
          {d.imagen_url && <button className="btn btn-t btn-sm" onClick={() => { set('imagen_url', ''); set('imagen_file', null) }}>Quitar</button>}
        </div>
      </div>
    )
    if (k === 'especificos') return (
      <>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Las partes concretas del objetivo (dorsiflexión, eversión…). Cada una puede tener su propio test.
        </div>
        <EspecificosEnPestanas ids={d.movimientos || []} objetivoId={d.id} etiquetas={etiquetas} tests={tests}
          onChange={(ids: string[]) => { set('movimientos', ids); setEvaluadores(p => p.filter(e => e.movimiento == null || ids.includes(e.movimiento))) }}
          onEvaluar={(mov: string | null) => setEligiendo(mov)} evaluacion={evaluacion}/>
        {nMov > 0 && (
          <div style={{ border: '1px solid var(--bd)', borderRadius: 12, padding: '10px 12px', marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--gr)' }}>El objetivo entero</span>
              <button className="btn btn-s btn-sm" onClick={() => setEligiendo(null)}>+ Añadir test</button>
            </div>
            {evaluacion(null)}
          </div>
        )}
      </>
    )
    return (
      <PatologiasObjetivo todas={deCategoria('patologia')} puestas={d.etiquetas || []} onChange={(ids: string[]) => set('etiquetas', ids)}/>
    )
  }

  const q = QUESITOS.find(x => x.k === abierto)
  useEffect(() => { onCambiado?.(cambiado) }, [cambiado]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onPanel?.(!!q) }, [!!q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`ro ${q ? 'ro-abierto' : ''}`}>
      <style>{`
        .ro { position:relative }
        .ro-rosco { position:relative; aspect-ratio:1; flex-shrink:0; transition: width .5s ease }
        .ro-q { cursor:pointer; transform-box:view-box; transform-origin:300px 300px;
                transition: transform .22s ease, fill .2s ease; animation: ro-sale .55s cubic-bezier(.2,.9,.3,1.25) backwards }
        @keyframes ro-sale { from { transform: scale(.55) rotate(-25deg); opacity:0 } to { transform:none; opacity:1 } }
        .ro-et { position:absolute; transform:translate(-50%,-50%); text-align:center; pointer-events:none; width:96px; animation: ro-et .5s ease backwards }
        @keyframes ro-et { from { opacity:0 } to { opacity:1 } }
        .ro-panel { position:fixed; right:24px; top:110px; z-index:30; width:min(440px, 40vw); max-height:calc(100vh - 200px); overflow:auto; background:#fff; border-radius:20px; padding:18px 20px;
                    box-shadow:0 18px 44px rgba(38,40,37,.16); animation: ro-panel .4s cubic-bezier(.2,.9,.3,1.1) backwards }
        @keyframes ro-panel { from { opacity:0; transform: translateX(40px) scale(.96) } to { opacity:1; transform:none } }
      `}</style>

      <div className="ro-rosco" style={{ width: tam }}>
        <svg viewBox="0 0 600 600" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {QUESITOS.map((x, i) => {
            const a0 = -90 + i * paso + HUECO, a1 = -90 + (i + 1) * paso - HUECO
            const mid = (a0 + a1) / 2 * Math.PI / 180
            const fuera = encima === x.k || abierto === x.k ? 10 : 0
            return (
              <path key={x.k} className="ro-q" d={quesito(a0, a1)}
                style={{ animationDelay: `${i * 55}ms`, transform: `translate(${Math.cos(mid) * fuera}px, ${Math.sin(mid) * fuera}px)` }}
                fill={abierto === x.k ? 'var(--g)' : x.lleno ? 'var(--gl)' : '#fff'} fillOpacity={x.opcional && !x.lleno && abierto !== x.k ? .6 : 1}
                stroke={x.lleno ? 'var(--gm)' : 'var(--bd)'} strokeWidth={1.2}
                onMouseEnter={() => setEncima(x.k)} onMouseLeave={() => setEncima(null)}
                onClick={() => setAbierto(abierto === x.k ? null : x.k)}/>
            )
          })}
        </svg>
        {QUESITOS.map((x, i) => {
          const mid = (-90 + (i + .5) * paso) * Math.PI / 180
          const r = (R0 + R1) / 2 / 600 * 100
          const on = abierto === x.k
          const fuera = encima === x.k || on ? 1.6 : 0
          return (
            <div key={x.k} className="ro-et" style={{ left: `${50 + Math.cos(mid) * (r + fuera)}%`, top: `${50 + Math.sin(mid) * (r + fuera)}%`,
              color: on ? '#fff' : x.lleno ? 'var(--gd)' : 'var(--gr)', animationDelay: `${300 + i * 55}ms` }}>
              <Ic name={x.ic} size={18}/>
              <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.15 }}>{x.t}</div>
              <div style={{ fontSize: 9.5, opacity: .75, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.sub}</div>
            </div>
          )
        })}
        {/* LA ESFERA: el objetivo, con su imagen si la tiene. */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '50%', height: '50%', borderRadius: '50%', overflow: 'hidden',
          boxShadow: '0 10px 34px rgba(38,40,37,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: d.imagen_url ? 'var(--bl)' : 'radial-gradient(circle at 33% 28%, #fff 0%, #A8CDD1 20%, #3E7179 58%, #23474D 100%)',
          color: '#fff', textShadow: '0 1px 3px #23474D' }}>
          {/* EL NOMBRE, DENTRO DE LA ESFERA: es lo que se mira, y la inicial sola no decía cuál
              era. El tamaño de letra baja si el nombre es largo, hasta tres líneas. */}
          {d.imagen_url ? <>
              <img src={d.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: '14%', padding: '6px 18%', textAlign: 'center', fontSize: Math.round(tam * .045),
                fontWeight: 500, color: '#fff', background: 'rgba(35,71,77,.55)' }}>{d.nombre}</span>
            </>
            : <span style={{ padding: '0 14%', textAlign: 'center', lineHeight: 1.18, fontWeight: 500,
                fontSize: Math.round(tam * ((d.nombre || '').length > 40 ? .05 : (d.nombre || '').length > 22 ? .06 : .075)),
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {d.nombre || 'Objetivo nuevo'}</span>}
        </div>
      </div>

      {/* Panel, selector y barra van al <body>: el mapa mueve y escala el rosco con
          transform, y dentro de un transform un position:fixed deja de ser fijo a la
          pantalla (la barra salía pegada al rosco). */}
      {typeof document !== 'undefined' && createPortal(<>
      {q && (
        <div key={q.k} className="ro-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: -18, zIndex: 3,
            background: '#fff', margin: '-18px -20px 12px', padding: '14px 20px 10px', borderRadius: '20px 20px 0 0', boxShadow: '0 6px 10px -8px rgba(38,40,37,.18)' }}>
            <span style={{ color: 'var(--g)', lineHeight: 0 }}><Ic name={q.ic} size={18}/></span>
            <span style={{ flex: 1, fontSize: 15 }}>{q.t}</span>
            <button className="btn btn-p btn-sm" onClick={() => setAbierto(null)}>Hecho</button>
          </div>
          {editor(q.k)}
        </div>
      )}

      {eligiendo !== undefined && (
        <SelectorEvaluadores etiquetas={etiquetas} onCerrar={() => setEligiendo(undefined)}
          ya={evaluadores.filter(e => (e.movimiento || null) === eligiendo && e.item == null && e.banda == null).map(e => e.test_id)}
          onElegir={(ids: string[]) => { setEvaluadores(p => [...p, ...ids.map(id => ({ test_id: id, item: null, movimiento: eligiendo ?? null }))]); setCambiado(true) }}/>
      )}

      {/* GUARDAR, abajo y fijo, como al amasar. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 99,
          padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
          <span style={{ fontSize: 12.5, color: aviso.startsWith('✓') ? 'var(--gd)' : aviso ? 'var(--red)' : 'var(--gr)' }}>
            {aviso || (!d.nombre.trim() ? 'Falta el nombre' : cambiado ? 'Sin guardar' : `${llenos} de ${necesarios.length} · todo guardado`)}
          </span>
          {onCerrar && <button className="btn btn-t btn-sm" onClick={() => { if (cambiado && !confirm('Hay cambios sin guardar. ¿Salir igualmente?')) return; onCerrar() }}>Cancelar</button>}
          <button className="btn btn-p btn-sm" disabled={guardando || !cambiado} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
      </>, document.body)}
    </div>
  )
}
