'use client'
import { DIAS_LARGOS, type ModoReparto, type HastaReparto, type Bloque } from '@/lib/repartir'

// ---------------------------------------------------------------------------
// EL PANEL DE REPARTIR del calendario de citas. Solo pinta y recoge lo que se
// elige; la cuenta está en lib/repartir (planReparto), igual en toda la app.
//
// Antes las fichas grandes de las sesiones hacían dos cosas a la vez (pincel y
// orden del reparto, con su "1º, 2º") y no se sabía cuál se estaba haciendo.
// Ahora las fichas son solo el pincel y el reparto se monta aquí.
// ---------------------------------------------------------------------------

export type EstadoReparto = {
  modo: ModoReparto
  porDia: Record<number, string>
  orden: string[]
  bloques: Bloque[]
  hasta: HastaReparto
  pisar: boolean
}

export const repartoVacio = (): EstadoReparto => ({
  modo: 'dias', porDia: {}, orden: [], bloques: [{ ses: '', semanas: 4 }], hasta: { tipo: 'todas' }, pisar: false,
})

type S = { id: string, nombre: string, color: string }

const MODOS: [ModoReparto, string, string][] = [
  ['dias', 'Por día', 'Cada día de la semana, su sesión'],
  ['alternar', 'Alternando', 'Una detrás de otra, siguiendo sus citas'],
  ['bloques', 'Por bloques', 'Una sesión unas semanas, luego otra'],
]

export default function RepartirPanel({ r, setR, sesiones, diasConCitas, hoy, onPintar, nCambian }: {
  r: EstadoReparto
  setR: (f: (p: EstadoReparto) => EstadoReparto) => void
  sesiones: S[]
  /** Los días de la semana (lunes = 0) en que tiene citas por delante. */
  diasConCitas: number[]
  hoy: string
  onPintar: () => void
  /** Cuántas citas cambian respecto a lo guardado (lo pintado y lo tocado a mano). */
  nCambian: number
}) {
  const nombre = (id: string) => sesiones.find(s => s.id === id)?.nombre || '—'
  const elegir = (valor: string, cambiar: (v: string) => void, vacio = '— ninguna —') => (
    <select value={valor} onChange={e => cambiar(e.target.value)}>
      <option value="">{vacio}</option>
      {sesiones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
    </select>
  )
  const listo = r.modo === 'dias' ? Object.values(r.porDia).some(Boolean)
    : r.modo === 'alternar' ? r.orden.length > 0 : r.bloques.some(b => b.ses)

  return (
    <div className="tc-rep">
      <span>Repartir</span>
      <div className="tc-modos">
        {MODOS.map(([k, l, ayuda]) => (
          <button key={k} type="button" title={ayuda} className={r.modo === k ? 'on' : ''}
            onClick={() => setR(p => ({ ...p, modo: k }))}>{l}</button>
        ))}
      </div>

      {r.modo === 'dias' && (
        diasConCitas.length === 0 ? <em>Sin citas por delante.</em> : diasConCitas.map(d => (
          <div key={d} className="tc-fila">
            <b>{DIAS_LARGOS[d]}</b>
            {elegir(r.porDia[d] || '', v => setR(p => ({ ...p, porDia: { ...p.porDia, [d]: v } })), '— no tocar —')}
          </div>
        ))
      )}

      {r.modo === 'alternar' && (<>
        {r.orden.map((id, i) => (
          <div key={i} className="tc-fila tc-orden">
            <b>{i + 1}º</b><span>{nombre(id)}</span>
            <button type="button" title="Subir" disabled={i === 0}
              onClick={() => setR(p => { const o = [...p.orden]; [o[i - 1], o[i]] = [o[i], o[i - 1]]; return { ...p, orden: o } })}>↑</button>
            <button type="button" title="Quitar" onClick={() => setR(p => ({ ...p, orden: p.orden.filter((_, k) => k !== i) }))}>×</button>
          </div>
        ))}
        {elegir('', v => { if (v) setR(p => ({ ...p, orden: [...p.orden, v] })) }, r.orden.length ? '+ añadir otra' : '+ elegir la primera')}
      </>)}

      {r.modo === 'bloques' && (<>
        {r.bloques.map((b, i) => (
          <div key={i} className="tc-bloque">
            {elegir(b.ses, v => setR(p => ({ ...p, bloques: p.bloques.map((x, k) => k === i ? { ...x, ses: v } : x) })))}
            <div className="tc-fila">
              <span>{i === 0 ? 'durante' : 'luego'}</span>
              <input type="number" min={1} value={b.semanas}
                onChange={e => setR(p => ({ ...p, bloques: p.bloques.map((x, k) => k === i ? { ...x, semanas: Math.max(1, Number(e.target.value) || 1) } : x) }))}/>
              <span>sem.</span>
              {r.bloques.length > 1 && <button type="button" title="Quitar" onClick={() => setR(p => ({ ...p, bloques: p.bloques.filter((_, k) => k !== i) }))}>×</button>}
            </div>
          </div>
        ))}
        <button type="button" className="tc-mas" onClick={() => setR(p => ({ ...p, bloques: [...p.bloques, { ses: '', semanas: 4 }] }))}>+ otro bloque</button>
      </>)}

      <div className="tc-sep"/>
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
      <button className="btn btn-p btn-sm" disabled={!listo} onClick={onPintar}>Pintar</button>
      {nCambian > 0 && <em className="tc-cambian">{nCambian} cita{nCambian === 1 ? '' : 's'} cambia{nCambian === 1 ? '' : 'n'} · se guarda al Confirmar</em>}
    </div>
  )
}
