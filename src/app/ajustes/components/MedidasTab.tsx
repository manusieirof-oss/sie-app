'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { ESCALAS_BANDA, ESFUERZOS, COLOR_BANDA, leerAjustesMedida } from '@/lib/medida'

// ---------------------------------------------------------------------------
// LA SALA: cómo se apunta en el taller lo que no son kilos (ver lib/medida).
//   - Bandas: la escala del centro, de la más suave a la más dura. El orden importa:
//     es lo que dice si alguien ha progresado de banda.
//   - Esfuerzo: RPE, RIR y dolor. Apagado no sale nada en la sala; encendido sale una
//     casilla más por serie, siempre opcional.
// Se guardan con el botón general de Ajustes, como el resto.
// ---------------------------------------------------------------------------

export default function MedidasTab({ ajustes, set }: { ajustes: Record<string, string>, set: (k: string, v: string) => void }) {
  const { bandas, esfuerzo } = leerAjustesMedida(ajustes)
  const [nueva, setNueva] = useState('')
  const ponerBandas = (l: string[]) => set('medida_bandas', JSON.stringify(l))
  const mover = (i: number, d: number) => {
    const l = [...bandas]; const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]; ponerBandas(l)
  }
  const escalaActual = Object.keys(ESCALAS_BANDA).find(k => JSON.stringify(ESCALAS_BANDA[k]) === JSON.stringify(bandas))
  const togEsf = (id: string) => set('medida_esfuerzo', JSON.stringify(esfuerzo.includes(id) ? esfuerzo.filter(x => x !== id) : [...esfuerzo, id]))

  const interruptor = (on: boolean, fn: () => void) => (
    <button onClick={fn} style={{ width: 40, height: 22, borderRadius: 99, background: on ? 'var(--g)' : 'var(--bm)', border: 'none',
      cursor: 'pointer', transition: 'background .2s', position: 'relative', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'left .2s',
        left: on ? '21px' : '3px', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}/>
    </button>
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="fuerza"/> Bandas</span></div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Las que tenéis, de la más suave a la más dura. Salen en los ejercicios que se miden con banda.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['theraband', 'Thera-Band'], ['resistencia', 'Por resistencia'], ['kg', 'Por kg']] as const).map(([k, t]) => (
            <span key={k} className={`chip-sel ${escalaActual === k ? 'on' : ''}`} style={{ fontSize: 12 }}
              onClick={() => ponerBandas(ESCALAS_BANDA[k])}>{t}</span>
          ))}
          {!escalaActual && <span className="chip-sel on" style={{ fontSize: 12, cursor: 'default' }}>Propia</span>}
        </div>
        <div style={{ display: 'grid', gap: 5, maxWidth: 380 }}>
          {bandas.map((b, i) => (
            <div key={b + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10,
              background: '#fff', boxShadow: '0 1px 5px rgba(38,40,37,.08)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, background: COLOR_BANDA[b] || 'var(--bm)', flexShrink: 0 }}/>
              <span style={{ fontSize: 11, color: 'var(--grl)', width: 14 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{b}</span>
              <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} disabled={i === 0} onClick={() => mover(i, -1)} title="Más suave">↑</button>
              <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} disabled={i === bandas.length - 1} onClick={() => mover(i, 1)} title="Más dura">↓</button>
              <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} disabled={bandas.length <= 1}
                onClick={() => ponerBandas(bandas.filter((_, j) => j !== i))} title="Quitar"><Ic name="cerrar" size={11}/></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input className="input" value={nueva} placeholder="Añadir una banda…" onChange={e => setNueva(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nueva.trim()) { ponerBandas([...bandas, nueva.trim()]); setNueva('') } }}/>
            <button className="btn btn-s btn-sm" disabled={!nueva.trim()} onClick={() => { ponerBandas([...bandas, nueva.trim()]); setNueva('') }}>Añadir</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="regla"/> Esfuerzo en la sala</span></div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 10 }}>
          Lo que enciendas sale como una casilla más en cada serie del taller. Nunca es obligatorio.
        </div>
        <div style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
          {ESFUERZOS.map(x => (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px',
              background: 'var(--bl)', borderRadius: 'var(--rl)', border: '1px solid var(--bd)' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--n)' }}>{x.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--grl)' }}>{x.ayuda}</div>
              </div>
              {interruptor(esfuerzo.includes(x.id), () => togEsf(x.id))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
