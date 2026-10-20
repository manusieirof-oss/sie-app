'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import {
  CLAVE_AJUSTE, CONFIG_DEFECTO, FAMILIAS, leerConfigTrabajo, segundosSerie, segundosPorRep, textoSegundos,
  type ConfigTrabajo, type Intensidad, type Ejecucion,
} from '@/lib/trabajo'

// ---------------------------------------------------------------------------
// AJUSTES DEL ENTRENADOR: con qué se mide el trabajo (ver lib/trabajo).
//   - Intensidades: para qué es el trabajo y con qué reps/tiempo suele hacerse.
//   - Ejecuciones: cómo se hace; cada una con sus segundos por repetición, o por tiempo.
//   - Tiempo: valores por defecto para lo que no se apunta.
// De aquí sale la unidad común del mapa de calor (segundos de trabajo efectivo).
// Se guarda con el botón general de Ajustes, como el resto.
// ---------------------------------------------------------------------------

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const nuevoId = () => Math.random().toString(36).slice(2, 9)

export default function EntrenadorTab({ ajustes, set }: { ajustes: Record<string, string>, set: (k: string, v: string) => void }) {
  const cfg = leerConfigTrabajo(ajustes)
  const poner = (c: ConfigTrabajo) => set(CLAVE_AJUSTE, JSON.stringify(c))
  const updInt = (i: number, p: Partial<Intensidad>) => poner({ ...cfg, intensidades: cfg.intensidades.map((x, j) => j === i ? { ...x, ...p } : x) })
  const updEje = (id: string, p: Partial<Ejecucion>) => poner({ ...cfg, ejecuciones: cfg.ejecuciones.map(x => x.id === id ? { ...x, ...p } : x) })

  const inp: React.CSSProperties = { fontSize: 12.5, padding: '5px 7px' }
  const corto: React.CSSProperties = { ...inp, width: 58, textAlign: 'center' }
  const etq: React.CSSProperties = { fontSize: 10.5, color: 'var(--grl)', display: 'block', marginBottom: 2 }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span className="ct-l"><Ic name="fuerza"/> Intensidades</span>
          <button className="btn btn-t btn-sm" onClick={() => { if (confirm('¿Volver a las intensidades de partida?')) poner({ ...cfg, intensidades: CONFIG_DEFECTO.intensidades }) }}>Restaurar</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Para qué es el trabajo. Las repeticiones y el tiempo son lo habitual de cada una: sirven para proponer la dosis y para
          reconocer la intensidad de lo que ya está hecho. "Carga" apagado = pinta la zona en el mapa pero no suma como carga (masajes).
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {cfg.intensidades.map((x, i) => (
            <div key={x.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 8, padding: '8px 10px', borderRadius: 10,
              background: '#fff', boxShadow: '0 1px 5px rgba(38,40,37,.08)', borderLeft: `4px solid ${x.color}` }}>
              <label style={{ flex: '1 1 170px' }}><span style={etq}>Nombre</span>
                <input className="input" style={inp} value={x.nombre} onChange={e => updInt(i, { nombre: e.target.value })}/></label>
              <label style={{ flex: '0 1 130px' }}><span style={etq}>Tipo</span>
                <select className="input" style={inp} value={x.familia} onChange={e => updInt(i, { familia: e.target.value as any })}>
                  {FAMILIAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select></label>
              <label><span style={etq}>Reps</span>
                <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input className="input" style={corto} value={x.repsMin ?? ''} placeholder="–" onChange={e => updInt(i, { repsMin: num(e.target.value) })}/>
                  <span style={{ fontSize: 11, color: 'var(--grl)' }}>a</span>
                  <input className="input" style={corto} value={x.repsMax ?? ''} placeholder={x.repsMin != null ? '∞' : '–'} onChange={e => updInt(i, { repsMax: num(e.target.value) })}/>
                </span></label>
              <label><span style={etq}>Tiempo (s)</span>
                <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input className="input" style={corto} value={x.segMin ?? ''} placeholder="–" onChange={e => updInt(i, { segMin: num(e.target.value) })}/>
                  <span style={{ fontSize: 11, color: 'var(--grl)' }}>a</span>
                  <input className="input" style={corto} value={x.segMax ?? ''} placeholder="–" onChange={e => updInt(i, { segMax: num(e.target.value) })}/>
                </span></label>
              <label><span style={etq}>Descanso (s)</span>
                <input className="input" style={corto} value={x.descanso ?? ''} placeholder="–" onChange={e => updInt(i, { descanso: num(e.target.value) })}/></label>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={etq}>Carga</span>
                <input type="checkbox" checked={x.carga} onChange={e => updInt(i, { carga: e.target.checked })} style={{ width: 18, height: 18, margin: '5px 0' }}/></label>
              <label><span style={etq}>Color</span>
                <input type="color" value={x.color} onChange={e => updInt(i, { color: e.target.value })} style={{ width: 34, height: 28, border: 'none', background: 'none', padding: 0 }}/></label>
              <button className="btn btn-t btn-sm" title="Quitar" style={{ padding: '4px 8px' }}
                onClick={() => poner({ ...cfg, intensidades: cfg.intensidades.filter((_, j) => j !== i) })}><Ic name="cerrar" size={11}/></button>
            </div>
          ))}
          <button className="btn btn-s btn-sm" style={{ justifySelf: 'start' }}
            onClick={() => poner({ ...cfg, intensidades: [...cfg.intensidades, { id: nuevoId(), nombre: 'Nueva intensidad', familia: 'fuerza', carga: true, color: '#888888' }] })}>+ Añadir intensidad</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span className="ct-l"><Ic name="regla"/> Ejecuciones</span>
          <button className="btn btn-t btn-sm" onClick={() => { if (confirm('¿Volver a las ejecuciones de partida?')) poner({ ...cfg, ejecuciones: CONFIG_DEFECTO.ejecuciones }) }}>Restaurar</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Cómo se hace. Son combinables: si un ejercicio es concéntrico + excéntrico, la repetición dura la suma de las dos.
          Las que van "por tiempo" cuentan los segundos de la serie.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          {(['fuerza', 'estiramiento'] as const).map(g => (
            <div key={g}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>{g === 'fuerza' ? 'Fuerza y control' : 'Estiramientos'}</div>
              <div style={{ display: 'grid', gap: 5 }}>
                {cfg.ejecuciones.filter(x => x.grupo === g).map(x => (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 10, background: '#fff', boxShadow: '0 1px 5px rgba(38,40,37,.08)' }}>
                    <input className="input" style={{ ...inp, flex: 1, minWidth: 0 }} value={x.nombre} onChange={e => updEje(x.id, { nombre: e.target.value })}/>
                    <select className="input" style={{ ...inp, width: 118 }} value={x.segRep == null ? 'tiempo' : 'rep'}
                      onChange={e => updEje(x.id, { segRep: e.target.value === 'tiempo' ? null : 2 })}>
                      <option value="rep">Por repetición</option>
                      <option value="tiempo">Por tiempo</option>
                    </select>
                    {x.segRep != null && <>
                      <input className="input" style={{ ...corto, width: 50 }} value={x.segRep} onChange={e => updEje(x.id, { segRep: num(e.target.value) ?? 0 })}/>
                      <span style={{ fontSize: 11, color: 'var(--grl)' }}>s</span>
                    </>}
                    <button className="btn btn-t btn-sm" title="Quitar" style={{ padding: '3px 7px' }}
                      onClick={() => poner({ ...cfg, ejecuciones: cfg.ejecuciones.filter(y => y.id !== x.id) })}><Ic name="cerrar" size={11}/></button>
                  </div>
                ))}
                <button className="btn btn-s btn-sm" style={{ justifySelf: 'start' }}
                  onClick={() => poner({ ...cfg, ejecuciones: [...cfg.ejecuciones, { id: nuevoId(), nombre: 'Nueva', grupo: g, segRep: 2 }] })}>+ Añadir</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="reloj"/> Tiempo de trabajo</span></div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Lo que se usa cuando no está apuntado. Lo calculado con estos valores sale marcado como estimado.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 13 }}>"Aguanta lo que puedas" ={' '}
            <input className="input" style={{ ...corto, display: 'inline-block' }} value={cfg.aguantaSeg} onChange={e => poner({ ...cfg, aguantaSeg: num(e.target.value) ?? 0 })}/> s</label>
          <label style={{ fontSize: 13 }}>Repetición sin ejecución elegida ={' '}
            <input className="input" style={{ ...corto, display: 'inline-block' }} value={cfg.segRepDefecto} onChange={e => poner({ ...cfg, segRepDefecto: num(e.target.value) ?? 0 })}/> s</label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={cfg.contarDescanso} onChange={e => poner({ ...cfg, contarDescanso: e.target.checked })}/> Contar también el descanso</label>
        </div>
        <Ejemplo cfg={cfg}/>
      </div>
    </div>
  )
}

/** Calculadora de prueba: para ver qué saldría con los valores de arriba. */
function Ejemplo({ cfg }: { cfg: ConfigTrabajo }) {
  const [series, setSeries] = useState('3')
  const [reps, setReps] = useState('10')
  const [seg, setSeg] = useState('')
  const [ejs, setEjs] = useState<string[]>(['conc', 'exc'])
  const s = segundosSerie(cfg, { reps, segundos: seg, ejecuciones: ejs, aguanta: !reps && !seg })
  const n = Number(series) || 0
  const corto: React.CSSProperties = { fontSize: 12.5, padding: '5px 7px', width: 52, textAlign: 'center', display: 'inline-block' }
  return (
    <div style={{ background: 'var(--bl)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Prueba</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 8 }}>
        <input className="input" style={corto} value={series} onChange={e => setSeries(e.target.value)}/> series de
        <input className="input" style={corto} value={reps} placeholder="–" onChange={e => setReps(e.target.value)}/> reps o
        <input className="input" style={corto} value={seg} placeholder="–" onChange={e => setSeg(e.target.value)}/> s
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {cfg.ejecuciones.map(e => (
          <span key={e.id} className={`chip-sel ${ejs.includes(e.id) ? 'on' : ''}`} style={{ fontSize: 11.5 }}
            onClick={() => setEjs(ejs.includes(e.id) ? ejs.filter(x => x !== e.id) : [...ejs, e.id])}>{e.nombre}</span>
        ))}
      </div>
      <div style={{ fontSize: 13 }}>
        {Number(seg) > 0 ? `${n} × ${seg} s` : reps ? `${n} × ${reps} reps × ${segundosPorRep(cfg, ejs)} s` : `${n} × ${cfg.aguantaSeg} s (aguanta lo que puedas)`}
        {' = '}<b>{textoSegundos(n * s.seg)}</b> de trabajo{s.estimado ? ' · estimado' : ''}
      </div>
    </div>
  )
}
