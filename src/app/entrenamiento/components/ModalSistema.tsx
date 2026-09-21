'use client'
import { useState } from 'react'
import { Ic, ICON_NAMES } from '@/lib/icons'
import { PROGRESIONES, guardarSistema, guardarFase, borrarFase,
         fijarObjetivosDeFase, fijarSesionesDeFase } from '@/lib/sistemas'

// ---------------------------------------------------------------------------
// CREAR Y EDITAR UN SISTEMA
//
// La progresión del sistema decide QUÉ SE LE PIDE A CADA FASE, y nada más: días
// si va por calendario, objetivos si va por logros. Todo lo demás —nombre, color,
// sesiones de cada fase— es igual en los tres casos. Por eso no hay tres editores.
// ---------------------------------------------------------------------------

const COLORES = ['#5A969E','#C486A0','#C9A84C','#6E7CA8','#7EA98F','#C08457','#B05A5A','#A0689C']

function Fila({ etiqueta, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--gr)', marginBottom: 4 }}>{etiqueta}</div>
      {children}
    </div>
  )
}

export default function ModalSistema({ sistema, objetivos = [], sesiones = [], onCerrar, onGuardado }: {
  sistema: any | null
  objetivos: any[]
  sesiones: any[]
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [f, setF] = useState<any>({
    id: sistema?.id, nombre: sistema?.nombre || '', descripcion: sistema?.descripcion || '',
    color: sistema?.color || '#5A969E', icono: sistema?.icono || '',
    progresion: sistema?.progresion || 'tiempo', activo: sistema?.activo !== false,
  })
  const [fases, setFases] = useState<any[]>(
    (sistema?.fases || []).map((x: any) => ({ ...x, objetivos: x.objetivos || [], sesiones: x.sesiones || [] }))
  )
  const [borradas, setBorradas] = useState<string[]>([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const porTiempo = f.progresion === 'tiempo' || f.progresion === 'fecha_fin'
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))
  const setFase = (i: number, k: string, v: any) =>
    setFases(p => p.map((x, j) => j === i ? { ...x, [k]: v } : x))

  function anadirFase() {
    setFases(p => [...p, { nombre: `Fase ${p.length + 1}`, dias: porTiempo ? 28 : null, objetivos: [], sesiones: [], orden: p.length }])
  }
  function quitarFase(i: number) {
    const x = fases[i]
    if (x.id) setBorradas(b => [...b, x.id])
    setFases(p => p.filter((_, j) => j !== i))
  }
  function mover(i: number, d: number) {
    const j = i + d
    if (j < 0 || j >= fases.length) return
    setFases(p => { const c = [...p]; const [x] = c.splice(i, 1); c.splice(j, 0, x); return c })
  }

  async function guardar() {
    setError(''); setGuardando(true)
    const r = await guardarSistema(f)
    if (!r.ok || !r.id) { setError(r.error || 'No se pudo guardar.'); setGuardando(false); return }
    for (const id of borradas) await borrarFase(id)
    for (let i = 0; i < fases.length; i++) {
      const x = fases[i]
      const rf = await guardarFase({ ...x, sistema_id: r.id, orden: i })
      if (!rf.ok || !rf.id) { setError(rf.error || 'No se pudo guardar una fase.'); setGuardando(false); return }
      await fijarObjetivosDeFase(rf.id, x.objetivos || [])
      await fijarSesionesDeFase(rf.id, x.sesiones || [])
    }
    setGuardando(false); onGuardado(); onCerrar()
  }

  const nombreObj = (id: string) => objetivos.find(o => o.id === id)?.nombre || '—'
  const nombreSes = (id: string) => sesiones.find(s => s.id === id)?.nombre || '—'

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '94vw', maxWidth: 820,
                    maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: 'var(--sh-md)' }}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: f.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {f.icono ? <Ic name={f.icono} size={13}/> : null}
          </span>
          <div style={{ flex: 1, fontSize: 14 }}>{f.id ? 'Editar sistema' : 'Nuevo sistema'}</div>
          <button onClick={onCerrar} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--bd)',
            background: 'var(--w)', cursor: 'pointer', fontSize: 13, color: 'var(--gr)' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          <Fila etiqueta="Nombre">
            <input className="inp" value={f.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Embarazo, Vuelta de lesión, Reto 8 semanas…"/>
          </Fila>

          <Fila etiqueta="Descripción">
            <input className="inp" value={f.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Para qué sirve y a quién se le pone"/>
          </Fila>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Fila etiqueta="Color">
              <div style={{ display: 'flex', gap: 6 }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => set('color', c)} title={c}
                    style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer',
                      border: f.color === c ? '2px solid var(--n)' : '1px solid var(--bd)' }}/>
                ))}
              </div>
            </Fila>
            <Fila etiqueta="Icono">
              <select className="inp" style={{ width: 150 }} value={f.icono} onChange={e => set('icono', e.target.value)}>
                <option value="">Sin icono</option>
                {ICON_NAMES.map((n: string) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Fila>
          </div>

          <Fila etiqueta="Cómo avanza">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {PROGRESIONES.map(p => (
                <button key={p.valor} onClick={() => set('progresion', p.valor)}
                  className={`pill ${f.progresion === p.valor ? 'pill-o on' : 'pill-soft'}`}
                  style={{ border: 'none', cursor: 'pointer' }} title={p.ayuda}>{p.nombre}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 5 }}>
              {PROGRESIONES.find(p => p.valor === f.progresion)?.ayuda}
            </div>
          </Fila>

          <div style={{ borderTop: '1px solid var(--bd)', marginTop: 14, paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--n)' }}>Fases</div>
              <button className="btn btn-s btn-sm" onClick={anadirFase}>+ Añadir fase</button>
            </div>

            {fases.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--gr)' }}>
                Sin fases todavía. Un sistema sin fases sirve igual: es un cúmulo de sesiones sin tramos.
              </div>
            )}

            {fases.map((x, i) => (
              <div key={i} style={{ border: '1px solid var(--bd)', borderLeft: `3px solid ${f.color}`,
                borderRadius: 7, padding: 11, marginBottom: 8 }}>

                <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 8 }}>
                  <input className="inp" style={{ flex: 1 }} value={x.nombre}
                    onChange={e => setFase(i, 'nombre', e.target.value)} placeholder="Nombre de la fase"/>
                  {porTiempo && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <input className="inp" style={{ width: 70 }} type="number" min={1} value={x.dias ?? ''}
                        onChange={e => setFase(i, 'dias', e.target.value)}/>
                      <span style={{ fontSize: 11, color: 'var(--gr)' }}>días</span>
                    </span>
                  )}
                  <button className="btn btn-s btn-sm" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn btn-s btn-sm" onClick={() => mover(i, 1)} disabled={i === fases.length - 1}>↓</button>
                  <button className="btn btn-s btn-sm" onClick={() => quitarFase(i)} title="Quitar fase">✕</button>
                </div>

                {f.progresion === 'objetivos' && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: 'var(--gr)', marginBottom: 4 }}>
                      Se sale de esta fase cuando TODOS estos objetivos estén logrados
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                      {(x.objetivos || []).map((id: string) => (
                        <span key={id} className="pill pill-o on" style={{ cursor: 'pointer' }}
                          onClick={() => setFase(i, 'objetivos', x.objetivos.filter((o: string) => o !== id))}>
                          {nombreObj(id)} ✕
                        </span>
                      ))}
                    </div>
                    <select className="inp" value="" onChange={e => {
                      if (e.target.value) setFase(i, 'objetivos', [...(x.objetivos || []), e.target.value])
                    }}>
                      <option value="">Añadir objetivo…</option>
                      {objetivos.filter(o => !(x.objetivos || []).includes(o.id))
                        .map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, color: 'var(--gr)', marginBottom: 4 }}>Sesiones de esta fase</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                    {(x.sesiones || []).map((id: string) => (
                      <span key={id} className="pill pill-o on" style={{ cursor: 'pointer' }}
                        onClick={() => setFase(i, 'sesiones', x.sesiones.filter((s: string) => s !== id))}>
                        {nombreSes(id)} ✕
                      </span>
                    ))}
                  </div>
                  <select className="inp" value="" onChange={e => {
                    if (e.target.value) setFase(i, 'sesiones', [...(x.sesiones || []), e.target.value])
                  }}>
                    <option value="">Añadir sesión…</option>
                    {sesiones.filter(s => !(x.sesiones || []).includes(s.id))
                      .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar sistema'}
          </button>
        </div>
      </div>
    </div>
  )
}
