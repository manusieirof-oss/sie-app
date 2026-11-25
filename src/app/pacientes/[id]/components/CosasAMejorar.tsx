'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { propuestasDe, sugerenciasPara, crearObjetivoCon, anadirAObjetivo, cambiarEstado, type Propuesta } from '@/lib/propuestas'
import { VIAS, type ViaOrigen } from '@/lib/viasObjetivo'

// ---------------------------------------------------------------------------
// COSAS A MEJORAR, en la ficha (maqueta «Objetivos: cosas a mejorar»).
//
// Lo que han dicho sus tests y el taller, sin ser todavía objetivos. Se marcan las que
// se quieran y se juntan en un objetivo con su nombre, o se añaden a uno que ya tiene,
// o se descartan. Lo descartado se puede recuperar. Ver lib/propuestas.
// ---------------------------------------------------------------------------

export default function CosasAMejorar({ pacienteId, objetivos = [], puede, onCambio }: {
  pacienteId: string, objetivos: { id: string, nombre: string, logrado?: boolean }[], puede: boolean, onCambio: () => void
}) {
  const [props, setProps] = useState<Propuesta[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [sugs, setSugs] = useState<{ objetivo: { id: string, nombre: string }, ids: string[] }[]>([])
  const [form, setForm] = useState<null | { modo: 'nuevo' | 'anadir', nombre: string, via: ViaOrigen, base: string | null, destino: string | null }>(null)
  const [guardando, setGuardando] = useState(false)
  const [verDesc, setVerDesc] = useState(false)
  // PLEGADO DE ENTRADA: con muchas cosas a mejorar se comía la ficha. Se abre tocando el título.
  const [abierto, setAbierto] = useState(false)

  async function cargar() {
    const ps = await propuestasDe(pacienteId)
    setProps(ps)
    setSugs(await sugerenciasPara(ps, objetivos.map(o => o.id)))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [pacienteId, objetivos.map(o => o.id).join(',')])

  if (props === null) return null
  const pend = props.filter(p => p.estado === 'pendiente'), desc = props.filter(p => p.estado === 'descartada')
  if (!pend.length && !desc.length) return null
  const marcadas = pend.filter(p => sel.has(p.id))
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const fmt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

  // Por de dónde salió y cuándo: «Sentadilla · 12 nov».
  const grupos: { k: string, t: string, f: string, ps: Propuesta[] }[] = []
  pend.forEach(p => { const k = (p.origen || 'Test') + '|' + p.fecha; const g = grupos.find(x => x.k === k); if (g) g.ps.push(p); else grupos.push({ k, t: p.origen || 'Test', f: p.fecha, ps: [p] }) })

  async function guardar() {
    if (!form) return
    setGuardando(true)
    const r = form.modo === 'nuevo'
      ? await crearObjetivoCon(pacienteId, marcadas, { nombre: form.nombre, via: form.via, base: form.base })
      : await anadirAObjetivo(pacienteId, form.destino!, marcadas)
    setGuardando(false)
    if (!r.ok) { alert('No se ha podido guardar: ' + r.error); return }
    setForm(null); setSel(new Set()); await cargar(); onCambio()
  }

  return (
    <section className="cam">
      <style>{CSS}</style>
      <button type="button" className="cam-cab" onClick={() => setAbierto(a => !a)} aria-expanded={abierto}>
        <h3>Cosas a mejorar <small>{pend.length}</small></h3>
        <span>{abierto ? 'Lo que han dicho sus tests y el taller. Marca las que quieras y júntalas en un objetivo.' : 'Toca para verlas'}</span>
        <i style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}>▾</i>
      </button>
      {abierto && <>

      {puede && sugs.slice(0, 2).map(sg => (
        <div key={sg.objetivo.id} className="cam-sug">
          {sg.ids.length === 1 ? 'Una de estas encaja' : `${sg.ids.length} de estas encajan`} con <b>{sg.objetivo.nombre}</b> de la biblioteca.
          <button type="button" className="btn btn-p btn-sm" onClick={() => { setSel(new Set(sg.ids)); setForm({ modo: 'nuevo', nombre: sg.objetivo.nombre, via: 'test', base: sg.objetivo.id, destino: null }) }}>Crearlo con estas</button>
        </div>
      ))}

      {grupos.map(g => (
        <div key={g.k}>
          <div className="cam-gr">{g.t}<small>{fmt(g.f)}</small></div>
          {g.ps.map(p => (
            <button key={p.id} type="button" className={`cam-p ${sel.has(p.id) ? 'on' : ''}`} disabled={!puede} onClick={() => toggle(p.id)} aria-pressed={sel.has(p.id)}>
              {puede && <i>{sel.has(p.id) ? '✓' : ''}</i>}
              <b>{p.texto}</b>{p.lado && p.lado !== 'bilateral' && <span className="cam-lado">{p.lado}</span>}
            </button>
          ))}
        </div>
      ))}
      {!pend.length && <div className="cam-vacio">No hay nada pendiente.</div>}

      {puede && marcadas.length > 0 && (
        <div className="cam-barra">
          <span>{marcadas.length} marcada{marcadas.length === 1 ? '' : 's'}</span>
          <button type="button" className="btn btn-p btn-sm" onClick={() => setForm({ modo: 'nuevo', nombre: '', via: 'test', base: null, destino: null })}>Juntar en un objetivo</button>
          {objetivos.some(o => !o.logrado) && <button type="button" className="btn btn-s btn-sm" onClick={() => setForm({ modo: 'anadir', nombre: '', via: 'test', base: null, destino: objetivos.find(o => !o.logrado)!.id })}>Añadir a uno que tiene</button>}
          <button type="button" className="btn btn-t btn-sm" onClick={async () => { await cambiarEstado(marcadas.map(p => p.id), 'descartada'); setSel(new Set()); cargar() }}>Descartar</button>
        </div>
      )}

      {desc.length > 0 && <div className="cam-desc">
        <button type="button" onClick={() => setVerDesc(v => !v)}>Descartadas ({desc.length}) {verDesc ? '▾' : '▸'}</button>
        {verDesc && desc.map(p => (
          <div key={p.id}><span>{p.texto} <small>· {p.origen}</small></span>
            {puede && <button type="button" className="btn btn-t btn-sm" onClick={async () => { await cambiarEstado([p.id], 'pendiente'); cargar() }}>Recuperar</button>}</div>
        ))}
      </div>}

      </>}

      {form && createPortal(
        <div className="modal-bg" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="cam-modal">
            {form.modo === 'nuevo' ? <>
              <h2>Nuevo objetivo</h2>
              <p className="cam-nota">Con {marcadas.length} cosa{marcadas.length === 1 ? '' : 's'} a mejorar. Cuando sus tests salgan bien, se dan por resueltas solas.</p>
              <label>Nombre</label>
              <input className="input" autoFocus value={form.nombre} placeholder="Ej.: Sentadilla estable" onChange={e => setForm({ ...form, nombre: e.target.value })}/>
              {form.base && <p className="cam-nota">Es «{sugs.find(s => s.objetivo.id === form.base)?.objetivo.nombre}» de la biblioteca. Puedes cambiarle el nombre solo para este cliente.
                <button type="button" className="cam-link" onClick={() => setForm({ ...form, base: null })}>Hacer uno nuevo</button></p>}
              {!form.base && <p className="cam-nota">Se guarda también en la biblioteca, para proponerlo la próxima vez.</p>}
              <label>De dónde sale</label>
              <div className="cam-org">{VIAS.map(v => (
                <button key={v.valor} type="button" className={form.via === v.valor ? 'on' : ''} onClick={() => setForm({ ...form, via: v.valor })}
                  style={form.via === v.valor ? { borderColor: v.color, background: v.fondo } : undefined}>
                  <span className="cam-moneda" style={{ background: `radial-gradient(circle at 35% 30%, ${v.claro}, ${v.oscuro})` }}/>{v.nombre}</button>
              ))}</div>
            </> : <>
              <h2>Añadir a un objetivo que tiene</h2>
              <p className="cam-nota">Las {marcadas.length} marcadas pasan a ser parte de ese objetivo.</p>
              {objetivos.filter(o => !o.logrado).map(o => (
                <button key={o.id} type="button" className={`cam-p ${form.destino === o.id ? 'on' : ''}`} onClick={() => setForm({ ...form, destino: o.id })}><i>{form.destino === o.id ? '✓' : ''}</i><b>{o.nombre}</b></button>
              ))}
            </>}
            <label>Lo que junta</label>
            <div className="cam-lista">{marcadas.map(p => <div key={p.id}>· {p.texto}{p.lado && p.lado !== 'bilateral' ? ` (${p.lado})` : ''} <small>— {p.origen}</small></div>)}</div>
            <div className="cam-pie">
              <button type="button" className="btn btn-s" onClick={() => setForm(null)}>Cancelar</button>
              <button type="button" className="btn btn-p" disabled={guardando || (form.modo === 'nuevo' ? !form.nombre.trim() : !form.destino)} onClick={guardar}>
                {guardando ? 'Guardando…' : form.modo === 'nuevo' ? 'Crear objetivo' : 'Añadir'}</button>
            </div>
          </div>
        </div>, document.body)}
    </section>
  )
}

const CSS = `
  .cam { border:1px solid var(--bd); border-radius:16px; padding:14px 16px; background:#fff; margin:0 0 16px }
  .cam-cab { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; width:100%; background:none; border:0; padding:0; text-align:left; font-family:inherit; cursor:pointer }
  .cam-cab h3 { margin:0; font-size:15px; font-weight:600; color:var(--n) }
  .cam-cab h3 small { font-size:12px; font-weight:600; color:#fff; background:var(--g); border-radius:99px; padding:1px 8px; margin-left:4px }
  .cam-cab i { font-style:normal; margin-left:auto; color:var(--gr); transition:transform .15s }
  .cam-cab span { font-size:12.5px; color:var(--gr) }
  .cam-sug { background:var(--ambl); border:1px solid #E7D29A; border-radius:12px; padding:9px 12px; font-size:13px; color:#6B5214; margin-bottom:8px; display:flex; flex-wrap:wrap; align-items:center; gap:8px }
  .cam-sug b { color:#4E3C0E }
  .cam-gr { font-size:12.5px; font-weight:600; color:var(--gd); margin:10px 0 5px; display:flex; gap:8px }
  .cam-gr small { font-weight:400; color:var(--grl) }
  .cam-p { display:flex; align-items:center; gap:9px; width:100%; text-align:left; font-family:inherit; padding:8px 10px; border-radius:11px; border:1.5px solid var(--bd); background:#fff; margin-bottom:5px; cursor:pointer; color:var(--n) }
  .cam-p:disabled { cursor:default }
  .cam-p.on { border-color:var(--gd); background:var(--gl) }
  .cam-p i { font-style:normal; flex-shrink:0; width:20px; height:20px; border-radius:6px; border:2px solid var(--bd); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px }
  .cam-p.on i { background:var(--gd); border-color:var(--gd) }
  .cam-p b { font-weight:500; font-size:13.5px }
  .cam-lado { font-size:11px; padding:1px 7px; border-radius:99px; background:var(--bl); color:var(--gr) }
  .cam-vacio { font-size:13px; color:var(--grl); padding:6px 0 }
  .cam-barra { position:sticky; bottom:12px; z-index:5; margin-top:10px; background:var(--n); color:#fff; border-radius:14px; padding:9px 12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap }
  .cam-barra span { flex:1; font-size:13px; min-width:110px }
  .cam-barra .btn-t { color:#fff; border-color:rgba(255,255,255,.4) }
  .cam-desc { margin-top:10px; font-size:13px }
  .cam-desc > button { font-family:inherit; font-size:12.5px; color:var(--gr); background:none; border:0; padding:2px 0; cursor:pointer }
  .cam-desc > div { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:5px 0; border-top:1px solid var(--bl); color:var(--gr) }
  .cam-modal { width:min(500px, 94vw); max-height:90vh; overflow:auto; background:#fff; border-radius:20px; padding:20px 22px; box-shadow:0 18px 44px rgba(38,40,37,.25) }
  .cam-modal h2 { margin:0 0 4px; font-size:18px; font-weight:600 }
  .cam-modal label { display:block; font-size:12.5px; font-weight:600; color:var(--gr); margin:14px 0 5px }
  .cam-modal .input { width:100% }
  .cam-nota { font-size:12.5px; color:var(--gr); margin:6px 0 0; line-height:1.45 }
  .cam-link { font-family:inherit; font-size:12.5px; background:none; border:0; color:var(--gd); text-decoration:underline; cursor:pointer; padding:0 0 0 6px }
  .cam-org { display:grid; grid-template-columns:repeat(3,1fr); gap:6px }
  .cam-org button { font-family:inherit; font-size:12.5px; padding:9px 6px; border-radius:12px; border:1.5px solid var(--bd); background:#fff; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; color:var(--n) }
  .cam-moneda { width:22px; height:22px; border-radius:99px; box-shadow:inset 0 -3px 5px rgba(0,0,0,.18) }
  .cam-lista { font-size:13px; background:var(--bl); border-radius:12px; padding:8px 12px }
  .cam-lista div { padding:2px 0 } .cam-lista small { color:var(--grl) }
  .cam-pie { display:flex; justify-content:flex-end; gap:8px; margin-top:18px }
`
