'use client'
import { useEffect, useRef, useState } from 'react'
import { REGIMENES } from '@/lib/capacidades'
import { itemMarcado } from '@/lib/ejecucion'
import { camposSerie, UNIDAD } from '@/lib/medida'
import { urlFotoPaciente } from '@/lib/fotos'

// ---------------------------------------------------------------------------
// TALLER · TODOS LOS ENTRENOS A LA VEZ.
//
// Una columna por paciente de la sala y la franja, con su foto y nombre arriba. En cada
// ejercicio, una casilla por serie con lo que toca hoy (lo que hizo la última vez, o lo
// prescrito si nunca lo hizo) y una flechita con cuánto cambia respecto a la última vez.
//   · Un toque en la serie: hecha tal cual.
//   · Doble toque: un velo para cambiar pesos y repeticiones con calma.
//   · El botón bajo la foto del ejercicio: un velo con nota, ejecución, lateralidad,
//     feedback, "no lo hizo" y cambiar de ejercicio (solo hoy).
//   · ⤢ junto a la foto del paciente: su taller completo, uno a uno.
// Todo usa las mismas funciones que el taller de uno en uno: se guarda igual.
// ---------------------------------------------------------------------------

const LADOS = ['Bilateral', 'Unilateral', 'Alterno']
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : null }
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const COLS = ['#5A969E', '#E8A33D', '#8C6BB1', '#D9663A', '#3F7880', '#B5527A', '#6E9F5A', '#4C7CB5']

export interface AccionesTodos {
  confirmar: (pid: string, ei: number, si: number, si_: boolean) => void
  mutar: (pid: string, ei: number, si: number, campo: string, val: string) => void
  addSerie: (pid: string, ei: number) => void
  quitarSerie: (pid: string, ei: number, si: number) => void
  regimen: (pid: string, ei: number, val: string) => void
  lado: (pid: string, ei: number, val: string) => void
  coment: (pid: string, ei: number, val: string) => void
  item: (pid: string, ei: number, ii: number) => void
  noHecho: (pid: string, sid: string, ei: number) => void
  noHechos: (pid: string, sid: string) => number[]
  sustituir: (pid: string, ei: number) => void
  abrir: (pid: string) => void
  // Ejecucion: marcar todos los items y activar el objetivo de un item que no cumple.
  todosItems: (pid: string, ei: number, v: boolean) => void
  objetivo: (pid: string, oid: string, ejId?: string, ejNombre?: string) => void
  objetivosLib: any[]
  objsPac: (pid: string) => any[]
}

export default function TodosTaller({ seleccion, nombrePac, a }: { seleccion: any[], nombrePac: (p: any) => string, a: AccionesTodos }) {
  const [fotos, setFotos] = useState<Record<string, string | null>>({})
  useEffect(() => {
    seleccion.forEach(s => {
      const p = s.paciente
      if (!p?.foto_url || fotos[p.id] !== undefined) return
      urlFotoPaciente(p.foto_url).then(u => setFotos(f => ({ ...f, [p.id]: u })))
    })
  }, [seleccion]) // eslint-disable-line react-hooks/exhaustive-deps
  const [opc, setOpc] = useState<{ pid: string, ei: number } | null>(null)
  const [ser, setSer] = useState<{ pid: string, ei: number } | null>(null)
  const clic = useRef<any>(null)

  const s0 = (pid: string) => seleccion.find(s => s.paciente.id === pid)
  const hechaSerie = (e: any, si: number) => Object.keys(e.hoy || {}).some(k => k.startsWith(si + '.'))
  const campos = (e: any) => camposSerie(e.tipo_medida, { isometrico: /isom/i.test(e.regimen || e.plan?.regimen || '') && !(e.series?.[0]?.reps) })

  /** Lo que se ve en la casilla: "16 kg × 10", "40 s"… */
  const textoSerie = (e: any, x: any) => campos(e).map(c => {
    const v = x?.[c]; if (v == null || String(v) === '') return ''
    return c === 'peso' ? `${v} kg` : c === 'reps' ? `× ${v}` : c === 'segundos' ? `${v} s` : c === 'metros' ? `${v} m` : String(v)
  }).filter(Boolean).join(' ') || '—'
  /** Cuánto cambia respecto a la última vez (peso, si no reps, si no tiempo). */
  const cambio = (e: any, si: number) => {
    const prev = e.ultimo?.[si], cur = e.series?.[si]
    if (!prev || !cur) return null
    for (const c of ['peso', 'reps', 'segundos', 'metros']) {
      const p = num(prev[c]), q = num(cur[c])
      if (p != null && q != null && p > 0) { const d = (q - p) / p * 100; return Math.abs(d) < 0.5 ? null : d }
    }
    return null
  }

  return (
    <div className="tt">
      <style>{CSS}</style>
      <div className="tt-cols">
        {seleccion.map((s, pi) => {
          const p = s.paciente, sid = s.sesionId, nh = sid ? a.noHechos(p.id, sid) : []
          const datos: any[] = s.datos || []
          const tot = datos.reduce((n, e, ei) => n + (nh.includes(ei) ? 0 : (e.series?.length || 0)), 0)
          const hechas = datos.reduce((n, e, ei) => n + (nh.includes(ei) ? 0 : (e.series || []).filter((_: any, si: number) => hechaSerie(e, si)).length), 0)
          const ahora = datos.findIndex((e, ei) => !nh.includes(ei) && (e.series || []).some((_: any, si: number) => !hechaSerie(e, si)))
          const ses = (s.sesiones || []).find((x: any) => x.id === sid)
          const edad = p.fecha_nacimiento ? Math.floor((Date.now() - +new Date(p.fecha_nacimiento)) / (365.25 * 864e5)) : null
          const ini = nombrePac(p).split(' ').filter(Boolean).slice(0, 2).map((x: string) => x[0]).join('')
          let parteAnt = ''
          return <div key={p.id} className={'tt-col' + (s.finalizado ? ' fin' : '')}>
            <div className="tt-cab">
              <div className="tt-per">
                <div className="tt-foto" style={{ background: COLS[pi % COLS.length] }}>{fotos[p.id] ? <img src={fotos[p.id]!} alt="" /> : ini}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="tt-nom">{nombrePac(p)}</div>
                  <div className="tt-sub">{edad != null ? `${edad} años · ` : ''}{ses?.nombre || (sid ? 'Sesión' : 'Sin sesión')}</div>
                </div>
                <button className="tt-abrir" title="Su taller completo, uno a uno" onClick={() => a.abrir(p.id)}>⤢</button>
              </div>
              {s.finalizado ? <div className="tt-ok">✓ Finalizado</div> : tot > 0 && <div className="tt-prog">
                <span>{ahora >= 0 ? datos[ahora]?.parte || '' : 'Todo hecho'}</span>
                <span className="b"><i style={{ width: (hechas / tot * 100) + '%' }} /></span><b>{hechas}/{tot}</b></div>}
            </div>
            {!sid && <div className="tt-vacio">Sin sesión para hoy. <button className="btn btn-t btn-sm" onClick={() => a.abrir(p.id)}>Asignar</button></div>}
            {datos.map((e, ei) => {
              const no = nh.includes(ei), cab = e.parte && e.parte !== parteAnt ? e.parte : ''
              parteAnt = e.parte || parteAnt
              const todas = (e.series || []).length > 0 && (e.series || []).every((_: any, si: number) => hechaSerie(e, si))
              return <div key={ei}>
                {cab && <div className="tt-parte">{cab}</div>}
                <div className={'tt-ej' + (no ? ' no' : todas ? ' hecho' : '') + (ei === ahora ? ' ahora' : '')}>
                  <div className="tt-izq">
                    <div className="tt-img">{e.imagen_url ? <img src={e.imagen_url} alt="" /> : null}
                      {(e.items || []).length > 0 && (() => { const t = e.items.length, m = e.items.filter((it: any, ii: number) => itemMarcado(e.items_evaluados, typeof it === 'string' ? it : it?.texto, ii)).length
                        return <span className={'tt-cnt' + (m === t ? ' ok' : m ? ' med' : '')} title="Ejecución correcta">{m}/{t}</span> })()}</div>
                    <button className="tt-mas" title="Nota, ejecución, feedback, no lo hizo, cambiar" onClick={() => setOpc({ pid: p.id, ei })}>•••</button>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="tt-nm">{e.nombre}{e.sustituye ? <span className="tt-hoy">solo hoy</span> : null}{ei === ahora && !s.finalizado ? <span className="tt-ahora">ahora</span> : null}</div>
                    {/* EJECUCION Y LATERALIDAD A LA VISTA: es lo que hay que saber para hacer el
                        ejercicio, no puede quedar dentro de un menu. Un toque pasa a la siguiente;
                        con borde discontinuo si hoy se hace distinto a lo prescrito. */}
                    {(() => {
                      const reg = e.regimen || e.plan?.regimen || 'Concéntrico', lado = e.lado || e.plan?.lado || 'Bilateral'
                      const sig = (l: string[], v: string) => l[(l.indexOf(v) + 1) % l.length]
                      return <div className="tt-tags">
                        <button className={'tt-tag eje' + (e.regimen && e.regimen !== (e.plan?.regimen || 'Concéntrico') ? ' cambio' : '')}
                          title="Ejecución · toca para cambiar" onClick={() => a.regimen(p.id, ei, sig(REGIMENES as unknown as string[], reg))}>{reg}</button>
                        <button className={'tt-tag lado' + (e.lado && e.lado !== (e.plan?.lado || 'Bilateral') ? ' cambio' : '')}
                          title="Lateralidad · toca para cambiar" onClick={() => a.lado(p.id, ei, sig(LADOS, lado))}>{lado}</button>
                        {e.comentario ? <span className="tt-meta">📝</span> : null}
                      </div>
                    })()}
                    {no ? <div className="tt-meta" style={{ color: '#C0504D' }}>No lo hizo</div> :
                      <div className="tt-series">{(e.series || []).map((x: any, si: number) => {
                        const d = cambio(e, si), ok = hechaSerie(e, si)
                        return <button key={si} className={'tt-s' + (ok ? ' ok' : '')}
                          onClick={() => { clearTimeout(clic.current); clic.current = setTimeout(() => a.confirmar(p.id, ei, si, !ok), 230) }}
                          onDoubleClick={() => { clearTimeout(clic.current); setSer({ pid: p.id, ei }) }}>
                          {textoSerie(e, x)}
                          {d != null && <small className={d > 0 ? 'sube' : 'baja'}>{d > 0 ? '▲' : '▼'}{fmt(Math.abs(d))}%</small>}
                        </button>
                      })}</div>}
                  </div>
                </div>
              </div>
            })}
          </div>
        })}
      </div>
      <div className="tt-nota">Toca una serie para darla por hecha · doble toque para cambiar pesos y repeticiones · ••• bajo la foto: nota, ejecución, feedback, no lo hizo o cambiar · la flechita es cuánto cambia respecto a la última vez.</div>

      {opc && (() => {
        const s = s0(opc.pid), e = s?.datos?.[opc.ei]
        if (!s || !e) return null
        const no = s.sesionId ? a.noHechos(s.paciente.id, s.sesionId).includes(opc.ei) : false
        const reg = e.regimen || e.plan?.regimen || 'Concéntrico', lado = e.lado || e.plan?.lado || 'Bilateral'
        return <Velo titulo={e.nombre} sub={nombrePac(s.paciente)} onCerrar={() => setOpc(null)}>
          <div className="tt-lbl">Ejecución</div>
          <div className="tt-chips">{REGIMENES.map(r => <button key={r} className={reg === r ? 'on' : ''} onClick={() => a.regimen(s.paciente.id, opc.ei, r)}>{r}</button>)}</div>
          <div className="tt-lbl">Lateralidad</div>
          <div className="tt-chips">{LADOS.map(r => <button key={r} className={lado === r ? 'on' : ''} onClick={() => a.lado(s.paciente.id, opc.ei, r)}>{r}</button>)}</div>
          {/* LOS CLICS DE EJECUCION: lo mismo que la chapa de la vista individual. Cada item
              es un punto de la tecnica; marcado = lo hace bien. Vienen marcados como la
              ultima vez que se evaluo, porque la tecnica no cambia de un dia para otro. */}
          {(() => {
            const items = e.items || [], t = items.length
            const m = items.filter((it: any, ii: number) => itemMarcado(e.items_evaluados, txt(it), ii)).length
            const fbs = (e.feedbacks || []).filter((f: any) => txt(f))
            const objsP = a.objsPac(s.paciente.id)
            return <>
              <div className="tt-lbl" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>¿Lo ejecuta bien?{t ? ` · ${m}/${t}` : ''}</span>
                {t > 0 && <button className={'tt-todo' + (m === t ? ' on' : '')} onClick={() => a.todosItems(s.paciente.id, opc.ei, m < t)}>{m === t ? '✓ Todo correcto' : 'Marcar todo'}</button>}
              </div>
              {t === 0 ? <div className="tt-ant">Este ejercicio no tiene ítems de ejecución en la biblioteca.</div> :
                <div className="tt-items">{items.map((it: any, ii: number) => {
                  const on = itemMarcado(e.items_evaluados, txt(it), ii)
                  const objs = (it?.objetivos || []).map((oid: string) => a.objetivosLib.find((o: any) => o.id === oid)).filter(Boolean)
                  return <div key={ii}>
                    <button className={'tt-item' + (on ? ' on' : '')} onClick={() => a.item(s.paciente.id, opc.ei, ii)}>
                      <span className="cx">{on ? '✓' : ''}</span>{txt(it)}</button>
                    {/* Si no lo cumple, se puede activar el objetivo que lo trabaja. */}
                    {!on && objs.length > 0 && <div className="tt-objs">{objs.map((o: any) => {
                      const ya = objsP.some((po: any) => po.objetivo_id === o.id)
                      return <button key={o.id} className={ya ? 'on' : ''} onClick={() => a.objetivo(s.paciente.id, o.id, e.ejercicio_id, e.nombre)}>{ya ? '✓ ' : '+ '}{o.nombre}</button>
                    })}</div>}
                  </div>
                })}</div>}
              {e.ultimaEvalFecha && <div className="tt-meta">Marcado como la última evaluación ({new Date(e.ultimaEvalFecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}).</div>}
              {fbs.length > 0 && <>
                <div className="tt-lbl">Cómo hacerlo mejor</div>
                <div className="tt-fbs">{fbs.map((f: any, fi: number) => <span key={fi}>«{txt(f)}»</span>)}</div>
              </>}
            </>
          })()}
          <div className="tt-lbl">Nota de hoy</div>
          <textarea className="input" rows={3} value={e.comentario || ''} onChange={ev => a.coment(s.paciente.id, opc.ei, ev.target.value)} placeholder="Cómo lo ha hecho, molestias, qué cambiar la próxima vez…" />
          {(e.comentarios || []).length > 0 && <div className="tt-ant">{e.comentarios.map((c: any, i: number) => <div key={i}><b>{new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b> {c.texto}</div>)}</div>}
          {e.plan?.nota && <div className="tt-ant"><b>De la sesión:</b> {e.plan.nota}</div>}
          <div className="tt-pie">
            {s.sesionId && <button className={'btn btn-sm ' + (no ? 'btn-p' : 'btn-s')} onClick={() => a.noHecho(s.paciente.id, s.sesionId, opc.ei)}>{no ? '✓ No lo hizo (deshacer)' : 'No lo hizo'}</button>}
            <button className="btn btn-s btn-sm" onClick={() => { setOpc(null); a.sustituir(s.paciente.id, opc.ei) }}>↻ Cambiar ejercicio (solo hoy)</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-p btn-sm" onClick={() => setOpc(null)}>Listo</button>
          </div>
        </Velo>
      })()}

      {ser && (() => {
        const s = s0(ser.pid), e = s?.datos?.[ser.ei]
        if (!s || !e) return null
        const cs = campos(e)
        const paso = (c: string) => (c === 'peso' ? 2.5 : c === 'segundos' ? 5 : c === 'metros' ? 5 : 1)
        const cambiar = (si: number, c: string, d: number) => { const v = num(e.series[si]?.[c]) ?? 0; a.mutar(s.paciente.id, ser.ei, si, c, fmt(Math.max(0, v + d)).replace(',', '.')) }
        return <Velo titulo={e.nombre} sub={`${nombrePac(s.paciente)} · series de hoy`} onCerrar={() => setSer(null)}>
          <table className="tt-tabla"><thead><tr><th></th>{cs.map(c => <th key={c}>{UNIDAD[c] || c}</th>)}<th>Última vez</th><th></th></tr></thead><tbody>
            {(e.series || []).map((x: any, si: number) => <tr key={si} className={hechaSerie(e, si) ? 'ok' : ''}>
              <td><b>S{si + 1}</b></td>
              {cs.map(c => <td key={c}>{c === 'banda' ? <input className="input" value={x?.[c] || ''} onChange={ev => a.mutar(s.paciente.id, ser.ei, si, c, ev.target.value)} style={{ width: 110 }} /> :
                <span className="tt-paso"><button onClick={() => cambiar(si, c, -paso(c))}>−</button>
                  <input className="input" inputMode="decimal" value={x?.[c] ?? ''} onChange={ev => a.mutar(s.paciente.id, ser.ei, si, c, ev.target.value)} />
                  <button onClick={() => cambiar(si, c, paso(c))}>+</button></span>}</td>)}
              <td className="tt-ult">{e.ultimo?.[si] ? textoSerie(e, e.ultimo[si]) : '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {si < e.series.length - 1 && <button className="btn btn-t btn-sm" title="Copiar a las siguientes" onClick={() => { for (let k = si + 1; k < e.series.length; k++) cs.forEach(c => a.mutar(s.paciente.id, ser.ei, k, c, String(x?.[c] ?? ''))) }}>↓ igual</button>}
                <button className="btn btn-t btn-sm" title="Quitar serie" onClick={() => a.quitarSerie(s.paciente.id, ser.ei, si)}>✕</button>
              </td>
            </tr>)}
          </tbody></table>
          <div className="tt-pie">
            <button className="btn btn-s btn-sm" onClick={() => a.addSerie(s.paciente.id, ser.ei)}>+ Serie</button>
            {e.plan && <span className="tt-ant" style={{ margin: 0 }}>Prescrito: {[e.plan.series && `${e.plan.series} series`, e.plan.peso && `${e.plan.peso} kg`, e.plan.reps && `× ${e.plan.reps}`, e.plan.tiempo && `${e.plan.tiempo} s`].filter(Boolean).join(' ')}</span>}
            <span style={{ flex: 1 }} />
            <button className="btn btn-p btn-sm" onClick={() => setSer(null)}>Listo</button>
          </div>
        </Velo>
      })()}
    </div>
  )
}

const txt = (it: any) => typeof it === 'string' ? it : it?.texto

function Velo({ titulo, sub, onCerrar, children }: { titulo: string, sub?: string, onCerrar: () => void, children: React.ReactNode }) {
  useEffect(() => { const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onCerrar])
  return <div className="tt-velo-bg" onClick={ev => { if (ev.target === ev.currentTarget) onCerrar() }}>
    <div className="tt-velo">
      <div className="tt-vh"><b>{titulo}</b>{sub && <span>{sub}</span>}<span style={{ flex: 1 }} /><button className="tt-x" onClick={onCerrar}>✕</button></div>
      {children}
    </div>
  </div>
}

const CSS = `
.tt-cols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(270px,1fr);gap:12px;overflow-x:auto;align-items:start;padding-bottom:6px}
.tt-col{background:#fff;border-radius:18px;box-shadow:0 2px 12px rgba(38,40,37,.07);min-width:0}
.tt-col.fin{opacity:.6}
.tt-cab{position:sticky;top:0;background:#fff;z-index:5;padding:12px 12px 10px;border-bottom:1px solid var(--bd);border-radius:18px 18px 0 0}
.tt-per{display:flex;align-items:center;gap:10px}
.tt-foto{width:46px;height:46px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:700;color:#fff;font-size:16px;overflow:hidden;box-shadow:0 0 0 3px #fff,0 0 0 4.5px #9FCFD3}
.tt-foto img{width:100%;height:100%;object-fit:cover}
.tt-nom{font-size:15px;font-weight:700;line-height:1.15;color:var(--n)}
.tt-sub{font-size:11px;color:var(--grl);margin-top:1px}
.tt-abrir{width:32px;height:32px;border-radius:10px;border:1px solid var(--bd);background:#fff;color:var(--gd);font-size:16px;flex:none;cursor:pointer}
.tt-abrir:hover{border-color:var(--g);background:var(--gl)}
.tt-prog{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--gr)}
.tt-prog .b{flex:1;height:6px;border-radius:6px;background:var(--bl);overflow:hidden}.tt-prog .b i{display:block;height:100%;background:var(--g);border-radius:6px;transition:width .3s}
.tt-ok{margin-top:8px;font-size:11.5px;color:var(--gd);font-weight:600}
.tt-vacio{padding:14px;font-size:12px;color:var(--grl)}
.tt-parte{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);font-weight:700;margin:10px 12px 4px}
.tt-ej{display:grid;grid-template-columns:44px 1fr;gap:8px;padding:6px 8px;margin:0 4px;border-radius:12px}
.tt-ej.ahora{background:var(--gl);box-shadow:inset 3px 0 0 var(--g)}
.tt-ej.hecho .tt-nm{color:var(--grl)}.tt-ej.no{opacity:.55}.tt-ej.no .tt-nm{text-decoration:line-through}
.tt-izq{display:flex;flex-direction:column;align-items:center;gap:4px}
.tt-img{position:relative;width:44px;height:44px;border-radius:9px;overflow:hidden;background:linear-gradient(135deg,#E7F1F2,#D3E6E8)}.tt-img img{width:100%;height:100%;object-fit:cover}
.tt-mas{width:44px;height:20px;border-radius:7px;border:1px solid var(--bd);background:#fff;color:var(--gd);font-size:10px;letter-spacing:1px;cursor:pointer;line-height:1}
.tt-mas:hover{border-color:var(--g);background:var(--gl)}
.tt-nm{font-size:12.5px;font-weight:600;line-height:1.2;color:var(--n)}
.tt-hoy{font-size:9px;font-weight:700;color:#fff;background:#E8A33D;border-radius:99px;padding:1px 6px;margin-left:5px;vertical-align:2px}
.tt-ahora{font-size:9px;font-weight:700;color:var(--gd);border:1px solid var(--g);background:#fff;border-radius:99px;padding:0 6px;margin-left:5px;vertical-align:2px}
.tt-meta{font-size:10.5px;color:var(--grl);margin-top:1px}
.tt-tags{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:3px 0 2px}
.tt-tag{border:1.5px solid transparent;border-radius:99px;padding:2px 9px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;line-height:1.35}
.tt-tag.eje{background:#E7F1F2;color:#3F7880}
.tt-tag.lado{background:#F3ECDD;color:#7A5800}
.tt-tag.cambio{border-style:dashed;border-color:currentColor}
.tt-series{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.tt-s{position:relative;min-width:58px;min-height:32px;border-radius:9px;border:1.5px solid var(--bd);background:#fff;font-size:11.5px;color:var(--gr);padding:3px 7px 9px;cursor:pointer;font-family:inherit;user-select:none}
.tt-s.ok{background:var(--g);border-color:var(--g);color:#fff;font-weight:600}
.tt-s small{position:absolute;right:4px;bottom:1px;font-size:8.5px;font-weight:700}
.tt-s small.sube{color:#3F9A5A}.tt-s small.baja{color:#D9822B}
.tt-s.ok small.sube{color:#D8F2DF}.tt-s.ok small.baja{color:#FFE2C2}
.tt-nota{font-size:11.5px;color:var(--grl);margin:10px 4px}
.tt-velo-bg{position:fixed;inset:0;z-index:120;background:rgba(244,243,239,.6);backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px}
.tt-velo{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(38,40,37,.2);padding:20px 22px;display:flex;flex-direction:column;gap:6px}
.tt-vh{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}.tt-vh b{font-size:19px}.tt-vh span{color:var(--gr)}
.tt-x{width:30px;height:30px;border-radius:50%;border:1px solid var(--bd);background:#fff;cursor:pointer}
.tt-cnt{position:absolute;right:1px;bottom:1px;font-size:9px;font-weight:700;padding:1px 5px;border-radius:99px;background:var(--bm,#ddd);color:var(--gr);border:1.5px solid #fff}
.tt-cnt.ok{background:#5A969E;color:#fff}.tt-cnt.med{background:#C9A227;color:#fff}
.tt-todo{margin-left:auto;font-size:11px;text-transform:none;letter-spacing:0;padding:3px 10px;border-radius:99px;border:1px solid var(--bd);background:#fff;color:var(--gr);cursor:pointer;font-family:inherit}
.tt-todo.on{background:var(--gl);border-color:var(--g);color:var(--gd)}
.tt-items{display:flex;flex-direction:column;gap:2px}
.tt-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:transparent;padding:7px 4px;font-size:14px;cursor:pointer;font-family:inherit;color:var(--n);border-radius:8px}
.tt-item:hover{background:var(--bl)}
.tt-item .cx{width:22px;height:22px;border-radius:6px;flex-shrink:0;border:1.5px solid var(--bd);display:grid;place-items:center;color:#fff;font-size:13px}
.tt-item.on .cx{background:var(--g);border-color:var(--g)}
.tt-objs{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 4px 36px}
.tt-objs button{font-size:11px;padding:2px 9px;border-radius:99px;border:1px solid var(--g);background:#fff;color:var(--gd);cursor:pointer;font-family:inherit}
.tt-objs button.on{background:var(--g);color:#fff}
.tt-fbs{display:flex;flex-wrap:wrap;gap:6px}.tt-fbs span{font-size:13px;padding:4px 11px;border-radius:99px;background:var(--bl);line-height:1.4}
.tt-lbl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);font-weight:700;margin-top:8px}
.tt-chips{display:flex;gap:6px;flex-wrap:wrap}
.tt-chips button{padding:7px 13px;border-radius:99px;border:1.5px solid var(--bd);background:#fff;font-size:13px;cursor:pointer;font-family:inherit}
.tt-chips button.on{background:var(--g);border-color:var(--g);color:#fff}
.tt-ant{font-size:12px;color:var(--gr);background:var(--bl);border-radius:10px;padding:8px 10px;margin-top:4px;line-height:1.5}
.tt-pie{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
.tt-tabla{width:100%;border-collapse:collapse}
.tt-tabla th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--grl);text-align:left;padding:6px}
.tt-tabla td{padding:6px;border-top:1px dashed var(--bd)}
.tt-tabla tr.ok td:first-child b{color:var(--gd)}
.tt-paso{display:inline-flex;align-items:center;gap:4px}
.tt-paso button{width:36px;height:36px;border-radius:10px;border:1px solid var(--bd);background:#fff;font-size:17px;color:var(--gd);cursor:pointer}
.tt-paso input{width:70px;text-align:center;font-size:15px;padding:6px}
.tt-ult{font-size:12px;color:var(--grl);white-space:nowrap}
`
