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
  /** null = sin elegir: hay que tocar una condición antes de pintar. */
  modo: ModoReparto | null
  cada: number
  semanas: number
  hasta: HastaReparto
  pisar: boolean
}

// SIN NADA ELEGIDO DE ENTRADA: con «Alternando» ya marcado se pintaba sin querer. Hay que
// tocar la condición (y las sesiones) a propósito.
export const repartoVacio = (): EstadoReparto => ({ modo: null, cada: 1, semanas: 4, hasta: { tipo: 'todas' }, pisar: false })

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
      {/* LA CONDICIÓN, EN CUADRADOS: cada una con su nombre y qué hace. En un
          desplegable no se veían las opciones hasta abrirlo. */}
      <div className="tc-cuad">
        {([['alternar', '⇄', 'Alternando', 'una tras otra'], ['dias', '▦', 'Por día', 'cada día la suya'],
           ['bloques', '▤', 'Por bloques', 'unas semanas cada una']] as const).map(([k, ic, t, sub]) => (
          <button key={k} type="button" className={r.modo === k ? 'on' : ''} onClick={() => setR(p => ({ ...p, modo: k }))}>
            <i>{ic}</i><b>{t}</b><small>{sub}</small>
          </button>
        ))}
      </div>
      {r.modo === 'alternar' && (
        <div className="tc-fila"><span>en</span>
          <select value={r.cada} onChange={e => setR(p => ({ ...p, cada: Number(e.target.value) }))}>
            <option value={1}>cada cita</option>
            {[2, 3, 4].map(n => <option key={n} value={n}>una de cada {n} citas</option>)}
          </select></div>
      )}
      {/* Lo que va a hacer, dicho en palabras, con las sesiones tocadas. */}
      {!r.modo ? <em>Elige arriba cómo repartirlas.</em> : nombres.length === 0 ? <em>Toca abajo las sesiones a repartir.</em> : (
        <div className="tc-resumen">
          {r.modo === 'dias'
            ? diasConCitas.map((d, i) => <div key={d}><b>{DIAS_LARGOS[d]}</b> → {nombres[i % nombres.length]}</div>)
            : r.modo === 'bloques'
              ? nombres.map((n, i) => <div key={i}>{i === 0 ? '' : 'luego '}{n} · {r.semanas} sem.</div>)
              : <div>{nombres.join(' → ')}{nombres.length > 1 ? ' → …' : ''}</div>}
        </div>
      )}
      <div className="tc-cuad">
        {([['todas', '∞', 'Todas', 'sus citas'], ['fecha', '📅', 'Hasta', 'una fecha'], ['semanas', '#', 'Durante', 'unas semanas']] as const).map(([k, ic, t, sub]) => (
          <button key={k} type="button" className={r.hasta.tipo === k ? 'on' : ''} onClick={() => setR(p => ({ ...p, hasta: { ...p.hasta, tipo: k } }))}>
            <i>{ic}</i><b>{t}</b><small>{sub}</small>
          </button>
        ))}
      </div>
      {r.hasta.tipo === 'fecha' && <input type="date" min={hoy} value={r.hasta.fecha || ''} onChange={e => setR(p => ({ ...p, hasta: { ...p.hasta, fecha: e.target.value } }))}/>}
      {r.hasta.tipo === 'semanas' && (
        <div className="tc-fila"><input type="number" min={1} value={r.hasta.semanas || 4}
          onChange={e => setR(p => ({ ...p, hasta: { ...p.hasta, semanas: Math.max(1, Number(e.target.value) || 1) } }))}/><span>semanas</span></div>
      )}
      <label><input type="checkbox" checked={r.pisar} onChange={e => setR(p => ({ ...p, pisar: e.target.checked }))}/> pisar las que ya tienen otra (nunca las de candado)</label>
      <button className="btn btn-p btn-sm" disabled={nombres.length === 0 || !r.modo} onClick={onPintar}>Pintar</button>
      {nCambian > 0 && <em className="tc-cambian">{nCambian} cita{nCambian === 1 ? '' : 's'} cambia{nCambian === 1 ? '' : 'n'} · se guarda al Confirmar</em>}
    </div>
  )
}
