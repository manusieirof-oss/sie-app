'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { supabase } from '@/lib/supabase'
import { partesMedida } from '@/lib/medida'

// ---------------------------------------------------------------------------
// EL ROSCO DEL EJERCICIO, EN EL TALLER (maqueta «Taller · rosco del ejercicio», nov 2026).
//
// En la tarjeta solo quedan la foto y las series. Todo lo demás se abre tocando la foto:
// un rosco como el del torno con sus quesitos alrededor.
//   Bien hecho · Feedbacks · Notas · Gráfica · No lo hizo · Cambiar
// «No lo hizo» se marca directo. «Cambiar» abre la ventana de siempre, que pregunta
// si es solo hoy o para siempre; solo sale a quien puede cambiar ejercicios (nivel 2+;
// para siempre, nivel 3: lo decide esa ventana). En el centro, el ejercicio (su cromo).
// ---------------------------------------------------------------------------

const C = 300, R0 = 168, R1 = 286
const polar = (r: number, a: number) => [C + r * Math.cos(a * Math.PI / 180), C + r * Math.sin(a * Math.PI / 180)]
function quesito(a0: number, a1: number) {
  const [x0, y0] = polar(R1, a0), [x1, y1] = polar(R1, a1), [x2, y2] = polar(R0, a1), [x3, y3] = polar(R0, a0)
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${R1},${R1} 0 ${g} 1 ${x1},${y1} L${x2},${y2} A${R0},${R0} 0 ${g} 0 ${x3},${y3} Z`
}
const textoDe = (it: any) => typeof it === 'string' ? it : it?.texto
const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null }

type K = 'bien' | 'fb' | 'notas' | 'graf' | 'no' | 'cambiar'

export default function RoscoEjercicio(p: {
  ej: any, ei: number, pacienteId: string, noLoHizo: boolean
  itemMarcado: (iv: any, texto: string, i: number) => boolean
  onToggle: (ii: number) => void, onTodos: (v: boolean) => void
  objetivosLib?: any[], objsPac?: any[], onObjetivo?: (oid: string) => void
  setComent: (pid: string, ei: number, v: string) => void
  onNoHecho?: () => void, onCambiar?: () => void, onVer?: () => void, onRevisar?: () => void
  onCerrar: () => void
}) {
  const { ej } = p
  const [abierto, setAbierto] = useState<K | null>(null)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onCerrar() }
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [p])

  const items = ej.items || []
  const bien = items.filter((it: any, i: number) => p.itemMarcado(ej.items_evaluados, textoDe(it), i)).length
  const fbs = (ej.feedbacks || []).filter((f: any) => textoDe(f))
  const notaPlan = String(ej.plan?.nota || '').trim(), notaHoy = String(ej.comentario || '').trim()
  const nNotas = (notaPlan ? 1 : 0) + (notaHoy ? 1 : 0) + (ej.comentarios || []).length

  const QS: { k: K, t: string, extra: string, rojo?: boolean }[] = [
    { k: 'bien', t: 'Bien hecho', extra: items.length ? `${bien}/${items.length}` : '' },
    { k: 'fb', t: 'Feedbacks', extra: fbs.length ? String(fbs.length) : '' },
    { k: 'notas', t: 'Notas', extra: nNotas ? `${nNotas} anotada${nNotas === 1 ? '' : 's'}` : '' },
    { k: 'graf', t: 'Gráfica', extra: '' },
    ...(p.onNoHecho ? [{ k: 'no' as K, t: p.noLoHizo ? 'Sí lo hizo' : 'No lo hizo', extra: p.noLoHizo ? 'marcado' : '', rojo: true }] : []),
    ...(p.onCambiar ? [{ k: 'cambiar' as K, t: 'Cambiar', extra: '' }] : []),
  ]
  const paso = 360 / QS.length

  function tocar(k: K) {
    if (k === 'no') { p.onNoHecho?.(); p.onCerrar(); return }
    if (k === 'cambiar') { p.onCerrar(); p.onCambiar?.(); return }
    setAbierto(a => a === k ? null : k)
  }

  return createPortal(
    <div className="re-velo" onClick={e => { if (e.target === e.currentTarget) p.onCerrar() }}>
      <style>{CSS}</style>
      <div className={`re-zona ${abierto ? 'abierto' : ''}`} onClick={e => { if (e.target === e.currentTarget) p.onCerrar() }}>
        <div className="re-rosco">
          <svg viewBox="0 0 600 600" className="re-q">
            {QS.map((q, i) => {
              const a0 = -90 + i * paso + 1, a1 = -90 + (i + 1) * paso - 1, am = (a0 + a1) / 2
              const [tx, ty] = polar((R0 + R1) / 2, am)
              const on = abierto === q.k
              const fill = on ? 'var(--g)' : q.rojo && p.noLoHizo ? '#F3DCDC' : q.extra ? 'var(--gl)' : '#fff'
              const tinta = on ? '#fff' : q.rojo ? 'var(--red)' : 'var(--n)'
              return (
                <g key={q.k}>
                  <path d={quesito(a0, a1)} fill={fill} className="re-qs" style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => tocar(q.k)} role="button" aria-label={q.t}><title>{q.t}</title></path>
                  <text x={tx} y={ty + (q.extra ? -4 : 6)} fontSize="19" fontWeight="600" fill={tinta} textAnchor="middle" style={{ pointerEvents: 'none' }}>{q.t}</text>
                  {q.extra && <text x={tx} y={ty + 19} fontSize="14" fill={on ? '#fff' : 'var(--gd)'} textAnchor="middle" style={{ pointerEvents: 'none' }}>{q.extra}</text>}
                </g>
              )
            })}
          </svg>
          {/* EN EL CENTRO, EL EJERCICIO: tocarlo abre su cromo (cómo se hace, su animación). */}
          <button type="button" className="re-centro" onClick={p.onVer} title="Ver el ejercicio">
            <ImagenEjercicio insignias={false} relleno radio={0} src={ej.imagen_url} ejercicioId={ej.ejercicio_id} icono={40} alt={ej.nombre}/>
            <b>{ej.nombre}{ej.variante ? <small>{ej.variante}</small> : null}</b>
          </button>
          <button type="button" className="re-cerrar" onClick={p.onCerrar} aria-label="Cerrar">✕</button>
        </div>

        {abierto && (
          <div className="re-panel">
            {abierto === 'bien' && <>
              <h2>Bien hecho</h2>
              <p className="re-sub">Toca lo que hace bien hoy. En la tarjeta sale cuántas: {bien}/{items.length}.</p>
              {items.length === 0 && <p className="re-sub">Este ejercicio no tiene ítems de ejecución.</p>}
              {items.map((it: any, ii: number) => {
                const ok = p.itemMarcado(ej.items_evaluados, textoDe(it), ii)
                const objs = (it.objetivos || []).map((oid: string) => (p.objetivosLib || []).find((o: any) => o.id === oid)).filter(Boolean)
                return (
                  <div key={ii}>
                    <button type="button" className={`re-op ${ok ? 'on' : ''}`} onClick={() => p.onToggle(ii)}><i>{ok ? '✓' : ''}</i>{textoDe(it)}</button>
                    {!ok && p.onObjetivo && objs.length > 0 && (
                      <div className="re-objs">{objs.map((o: any) => {
                        const ya = (p.objsPac || []).some((po: any) => po.objetivo_id === o.id)
                        return <button key={o.id} type="button" className={ya ? 'on' : ''} onClick={() => p.onObjetivo!(o.id)}
                          title={ya ? 'Quitar objetivo del paciente' : 'Activar este objetivo'}>{ya ? '✓ ' : '+ '}{o.nombre}</button>
                      })}</div>
                    )}
                  </div>
                )
              })}
              {items.length > 0 && <button type="button" className="btn btn-s btn-sm" style={{ marginTop: 6 }} onClick={() => p.onTodos(bien < items.length)}>
                {bien === items.length ? 'Quitar todo' : 'Todo bien'}</button>}
            </>}

            {abierto === 'fb' && <>
              <h2>Feedbacks</h2>
              <p className="re-sub">Cómo decirle que lo haga mejor.</p>
              {fbs.length === 0 && <p className="re-sub">Este ejercicio no tiene feedbacks en la biblioteca.</p>}
              {fbs.map((f: any, i: number) => <div key={i} className="re-fb">«{textoDe(f)}»</div>)}
            </>}

            {abierto === 'notas' && <>
              <h2>Notas</h2>
              {notaPlan && <><div className="re-rot">De la planificación</div><div className="re-nota">{notaPlan}</div></>}
              <div className="re-rot">Hoy</div>
              <textarea value={ej.comentario || ''} rows={4} autoFocus placeholder="Qué ha pasado hoy…"
                onChange={e => p.setComent(p.pacienteId, p.ei, e.target.value)} className="re-txt"/>
              {(ej.comentarios || []).length > 0 && <>
                <div className="re-rot">Días anteriores</div>
                {(ej.comentarios || []).map((c: any, k: number) => (
                  <div key={k} className="re-ant"><span>{c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}</span>{c.texto}</div>
                ))}
              </>}
              {p.onRevisar && <button type="button" className="re-revisar" onClick={() => { p.onCerrar(); p.onRevisar!() }}>⚑ Algo está mal en este ejercicio (foto, nombre, cómo se mide…)</button>}
            </>}

            {abierto === 'graf' && <Grafica pacienteId={p.pacienteId} ej={ej}/>}
          </div>
        )}
      </div>
    </div>, document.body)
}

/** Sus últimas veces: la mejor serie de cada día. Con peso, la línea es el peso y cada
    punto dice peso × repes (o × segundos); sin peso, la línea son las repes o el tiempo. */
function Grafica({ pacienteId, ej }: { pacienteId: string, ej: any }) {
  const [filas, setFilas] = useState<{ fecha: string, v: number, et: string }[] | null>(null)
  const { carga, volumen } = partesMedida(ej.tipo_medida)
  const vol = volumen === 'segundos' ? 'segundos' : volumen === 'metros' ? 'metros' : 'reps'
  const uVol = vol === 'segundos' ? 's' : vol === 'metros' ? 'm' : ''
  const conPeso = carga === 'kg'
  useEffect(() => {
    if (!ej.ejercicio_id) { setFilas([]); return }
    supabase.from('registros_ejercicio').select('fecha,series').eq('paciente_id', pacienteId).eq('ejercicio_id', ej.ejercicio_id)
      .eq('finalizado', true).order('fecha', { ascending: false }).limit(12)
      .then(({ data }) => {
        const out: { fecha: string, v: number, et: string }[] = []
        ;(data || []).forEach((r: any) => {
          // La mejor serie del día: más peso y, a igual peso, más repes (o tiempo).
          let mejor: any = null
          ;((r.series || []) as any[]).forEach(x => {
            const pe = num(x?.peso), vo = num(x?.[vol])
            if (pe == null && vo == null) return
            const k = conPeso ? [pe ?? -1, vo ?? -1] : [vo ?? -1, 0]
            if (!mejor || k[0] > mejor.k[0] || (k[0] === mejor.k[0] && k[1] > mejor.k[1])) mejor = { k, pe, vo, banda: x?.banda }
          })
          if (!mejor) return
          const v = conPeso ? mejor.pe : mejor.vo
          if (v == null) return
          const f = (n: number) => String(n).replace('.', ',')
          const et = conPeso
            ? `${f(mejor.pe)} kg${mejor.vo != null ? ` × ${f(mejor.vo)}${uVol ? ' ' + uVol : ''}` : ''}`
            : `${carga === 'banda' && mejor.banda ? mejor.banda + ' · ' : ''}${f(mejor.vo)}${uVol ? ' ' + uVol : ''}`
          out.push({ fecha: r.fecha, v, et })
        })
        setFilas(out.reverse())
      })
  }, [pacienteId, ej.ejercicio_id, vol, conPeso, carga, uVol])
  const w = 380, h = 210
  const queMide = conPeso ? `peso × ${vol === 'segundos' ? 'segundos' : vol === 'metros' ? 'metros' : 'repes'}` : vol === 'segundos' ? 'segundos' : vol === 'metros' ? 'metros' : 'repes'
  return <>
    <h2>Gráfica</h2>
    {filas === null ? <p className="re-sub">Trayendo sus veces…</p>
      : filas.length < 2 ? <p className="re-sub">{filas.length === 1 ? `Solo lo ha hecho una vez: ${filas[0].et}.` : 'Aún no hay veces guardadas de este ejercicio.'}</p>
      : (() => {
          const max = Math.max(...filas.map(f => f.v)) * 1.18 || 1
          const pts = filas.map((f, i) => [34 + i * (w - 68) / (filas.length - 1), h - 30 - f.v / max * (h - 62)])
          return <>
            <p className="re-sub">Sus últimas {filas.length} veces: la mejor serie de cada día ({queMide}).</p>
            <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Evolución: ${queMide}`}>
              <polyline points={pts.map(x => x.join(',')).join(' ')} fill="none" stroke="var(--g)" strokeWidth="3" strokeLinejoin="round"/>
              {pts.map((x, i) => <g key={i}>
                <circle cx={x[0]} cy={x[1]} r="5" fill="#fff" stroke="var(--gd)" strokeWidth="2.5"/>
                {/* Con muchos puntos, la etiqueta se alterna arriba y abajo para que no se monten. */}
                <text x={x[0]} y={filas.length > 6 && i % 2 ? x[1] + 20 : x[1] - 11} fontSize="11.5" textAnchor="middle" fill="var(--gd)" fontWeight="600">{filas[i].et}</text>
                {(i === 0 || i === filas.length - 1) && <text x={x[0]} y={h - 6} fontSize="11" textAnchor="middle" fill="var(--grl)">
                  {new Date(filas[i].fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</text>}
              </g>)}
            </svg>
            <div className="re-tabla">
              {filas.slice().reverse().map((f, i) => <div key={i}><span>{new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span><b>{f.et}</b></div>)}
            </div>
          </>
        })()}
  </>
}

const CSS = `
  .re-velo { position:fixed; inset:0; z-index:140; background:rgba(38,40,37,.36); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; padding:16px }
  .re-zona { display:flex; align-items:center; justify-content:center; gap:24px; width:100%; height:100% }
  .re-rosco { position:relative; width:min(500px, 86vw, 80vh); aspect-ratio:1; flex-shrink:0; transition:width .35s ease }
  .re-zona.abierto .re-rosco { width:min(420px, 46vw, 80vh) }
  .re-q { position:absolute; inset:0; width:100%; height:100% }
  .re-qs { cursor:pointer; stroke:#fff; stroke-width:4; transform-box:view-box; transform-origin:300px 300px;
           transition: transform .2s ease, fill .2s; animation: re-sale .5s cubic-bezier(.2,.9,.3,1.25) backwards }
  .re-qs:hover { transform:scale(1.035) }
  @keyframes re-sale { from { transform:scale(.55) rotate(-25deg); opacity:0 } to { transform:none; opacity:1 } }
  .re-centro { position:absolute; left:50%; top:50%; width:52%; height:52%; transform:translate(-50%,-50%); border-radius:50%; overflow:hidden; border:0; padding:0;
               background:#fff; box-shadow:0 10px 34px rgba(38,40,37,.22); cursor:zoom-in; display:block }
  .re-centro > b { position:absolute; left:0; right:0; bottom:0; background:rgba(255,255,255,.93); padding:7px 12px 16px; font-size:14px; font-weight:600; color:var(--n); line-height:1.25 }
  .re-centro small { display:block; font-size:11.5px; font-weight:500; color:var(--gd) }
  .re-cerrar { position:absolute; top:0; right:0; width:42px; height:42px; border-radius:99px; border:0; background:#fff; cursor:pointer; box-shadow:0 4px 14px rgba(38,40,37,.2); font-size:17px; color:var(--gr) }
  .re-panel { width:min(400px, 44vw); max-height:84vh; overflow:auto; background:#fff; border-radius:20px; padding:18px 20px; box-shadow:0 18px 44px rgba(38,40,37,.2);
              animation: re-panel .3s cubic-bezier(.2,.9,.3,1.1); text-align:left }
  @keyframes re-panel { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:none } }
  .re-panel h2 { font-size:17px; font-weight:600; margin:0 0 4px; color:var(--n) }
  .re-sub { font-size:12.5px; color:var(--gr); margin:0 0 12px; line-height:1.4 }
  .re-op { display:flex; align-items:center; gap:10px; width:100%; text-align:left; font-family:inherit; font-size:14px; padding:11px 12px; margin-bottom:7px;
           border-radius:12px; border:1.5px solid var(--bd); background:#fff; cursor:pointer; color:var(--n) }
  .re-op.on { border-color:var(--gd); background:var(--gl) }
  .re-op i { font-style:normal; width:22px; height:22px; border-radius:6px; border:2px solid var(--bd); flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; color:#fff }
  .re-op.on i { background:var(--gd); border-color:var(--gd) }
  .re-objs { display:flex; flex-wrap:wrap; gap:5px; margin:-2px 0 9px 34px }
  .re-objs button { font-family:inherit; font-size:11.5px; padding:3px 9px; border-radius:99px; border:1px solid var(--g); background:#fff; color:var(--gd); cursor:pointer }
  .re-objs button.on { background:var(--g); color:#fff }
  .re-fb { font-size:14px; background:var(--bl); border-radius:12px; padding:10px 12px; margin-bottom:7px; line-height:1.4 }
  .re-rot { font-size:12px; font-weight:600; color:var(--gr); margin:12px 0 5px }
  .re-nota { font-size:13.5px; color:#7A5800; background:var(--ambl); border:1px solid var(--amb); border-radius:10px; padding:9px 11px; line-height:1.45 }
  .re-txt { width:100%; font-family:inherit; font-size:14px; line-height:1.45; padding:9px 10px; border:1.5px solid var(--bd); border-radius:12px; resize:vertical; min-height:80px }
  .re-ant { font-size:13px; color:var(--gr); padding:5px 0; border-top:1px solid var(--bl); display:flex; gap:9px; line-height:1.4 }
  .re-ant span { flex-shrink:0; width:50px; color:var(--grl); font-size:12px }
  .re-tabla { margin-top:8px; font-size:13px }
  .re-tabla div { display:flex; justify-content:space-between; padding:5px 2px; border-top:1px solid var(--bl) }
  .re-tabla span { color:var(--grl) }
  .re-revisar { margin-top:16px; font-family:inherit; font-size:12.5px; color:var(--gr); background:none; border:0; padding:4px 0; cursor:pointer; text-align:left }
  .re-revisar:hover { color:var(--n) }
  @media (max-width:820px) { .re-zona.abierto { flex-direction:column; justify-content:flex-start; overflow:auto } .re-zona.abierto .re-rosco { width:min(300px, 76vw) } .re-panel { width:100%; max-height:none } }
`
