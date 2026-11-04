'use client'
import { DIAS_LARGOS, type ModoReparto, type HastaReparto } from '@/lib/repartir'

// ---------------------------------------------------------------------------
// EL PANEL DE REPARTIR del calendario de citas.
//
// Las sesiones se eligen tocando sus fichas (en el orden en que se tocan: 1º, 2º…)
// y aquí arriba solo se marca LA CONDICIÓN: alternarlas, una por día de la semana
// o por bloques de semanas. Así se hacía antes y era lo más rápido; lo que se
// añade son las dos condiciones nuevas. La cuenta está en lib/repartir.
// ---------------------------------------------------------------------------

export type EstadoReparto = {
  modo: ModoReparto
  cada: number
  semanas: number
  hasta: HastaReparto
  pisar: boolean
}

export const repartoVacio = (): EstadoReparto => ({ modo: 'alternar', cada: 1, semanas: 4, hasta: { tipo: 'todas' }, pisar: false })

export default function RepartirPanel({ r, setR, nombres, diasConCitas, hoy, onPintar, nCambian }: {
  r: EstadoReparto
  setR: (f: (p: EstadoReparto) => EstadoReparto) => void
  /** Las sesiones tocadas, en orden. */
  nombres: string[]
  diasConCitas: number[]
  hoy: string
  onPintar: () => void
  nCambian: number
}) {
  return (
    <div className="tc-rep">
      <span>Repartir</span>
      <select value={r.modo === 'alternar' ? `a${r.cada}` : r.modo} onChange={e => {
        const v = e.target.value
        setR(p => v.startsWith('a') ? { ...p, modo: 'alternar', cada: Number(v.slice(1)) } : { ...p, modo: v as ModoReparto })
      }}>
        <option value="a1">alternando, en cada cita</option>
        {[2, 3, 4].map(n => <option key={n} value={`a${n}`}>alternando, cada {n} citas</option>)}
        <option value="dias">una por día de la semana</option>
        <option value="bloques">por bloques de semanas</option>
      </select>
      {r.modo === 'bloques' && (
        <div className="tc-fila"><span>cada una</span>
          <input type="number" min={1} value={r.semanas} onChange={e => setR(p => ({ ...p, semanas: Math.max(1, Number(e.target.value) || 1) }))}/>
          <span>semanas</span></div>
      )}
      {/* Lo que va a hacer, dicho en palabras, con las sesiones tocadas. */}
      {nombres.length === 0 ? <em>Toca abajo las sesiones a repartir.</em> : (
        <div className="tc-resumen">
          {r.modo === 'dias'
            ? diasConCitas.map((d, i) => <div key={d}><b>{DIAS_LARGOS[d]}</b> → {nombres[i % nombres.length]}</div>)
            : r.modo === 'bloques'
              ? nombres.map((n, i) => <div key={i}>{i === 0 ? '' : 'luego '}{n} · {r.semanas} sem.</div>)
              : <div>{nombres.join(' → ')}{nombres.length > 1 ? ' → …' : ''}</div>}
        </div>
      )}
      <select value={r.hasta.tipo} onChange={e => setR(p => ({ ...p, hasta: { ...p.hasta, tipo: e.target.value as any } }))}>
        <option value="todas">en todas sus citas</option>
        <option value="fecha">hasta una fecha</option>
        <option value="semanas">durante unas semanas</option>
      </select>
      {r.hasta.tipo === 'fecha' && <input type="date" min={hoy} value={r.hasta.fecha || ''} onChange={e => setR(p => ({ ...p, hasta: { ...p.hasta, fecha: e.target.value } }))}/>}
      {r.hasta.tipo === 'semanas' && (
        <div className="tc-fila"><input type="number" min={1} value={r.hasta.semanas || 4}
          onChange={e => setR(p => ({ ...p, hasta: { ...p.hasta, semanas: Math.max(1, Number(e.target.value) || 1) } }))}/><span>semanas</span></div>
      )}
      <label><input type="checkbox" checked={r.pisar} onChange={e => setR(p => ({ ...p, pisar: e.target.checked }))}/> pisar las que ya tienen otra (nunca las de candado)</label>
      <button className="btn btn-p btn-sm" disabled={nombres.length === 0} onClick={onPintar}>Pintar</button>
      {nCambian > 0 && <em className="tc-cambian">{nCambian} cita{nCambian === 1 ? '' : 's'} cambia{nCambian === 1 ? '' : 'n'} · se guarda al Confirmar</em>}
    </div>
  )
}
