'use client'
import { useRef, useState } from 'react'
import Flotante from './Flotante'

// ---------------------------------------------------------------------------
// LO QUE SE ESCRIBE EN LA SALA
//
// Casi siempre las tres series son iguales, asi que la casilla de arriba no es
// un resumen: es la ENTRADA. Escribes un peso y unas repes y se rellenan
// todas. Solo cuando no son iguales hace falta abrir el detalle, y entonces la
// casilla pasa a decir la media.
//
// Es al reves de lo que parecia: si el resumen fuera solo lectura habria que
// abrir cada ejercicio para escribir, que es un clic de mas por ejercicio
// justo cuando tienes las manos ocupadas.
// ---------------------------------------------------------------------------

const num = (x: any) => {
  const n = Number(String(x ?? '').replace(',', '.'))
  return Number.isFinite(n) && String(x ?? '') !== '' ? n : null
}

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null)
  if (v.length === 0) return null
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10
}

export default function CasillaSeries({ pacienteId, ej, ei, mutarSerie, addSerie, quitarSerie }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const series: any[] = ej.series || []
  const tm = ej.tipo_medida || 'peso_reps'
  const campos: string[] = tm === 'tiempo' ? ['segundos']
    : tm === 'peso_tiempo' ? ['peso', 'segundos'] : ['peso', 'reps']

  const valoresDe = (c: string) => series.map(s => num(s?.[c]))
  const iguales = (c: string) => {
    const v = valoresDe(c).filter(x => x != null)
    return v.length === 0 || v.every(x => x === v[0])
  }
  /** Lo que se enseña en la casilla: el valor si todas coinciden, la media si no. */
  const muestra = (c: string) => {
    if (iguales(c)) {
      const v = valoresDe(c).find(x => x != null)
      return v == null ? '' : String(v)
    }
    const m = media(valoresDe(c))
    return m == null ? '' : String(m)
  }
  const mezclado = campos.some(c => iguales(c) === false)
  const hayAlgo = series.some(s => campos.some(c => num(s?.[c]) != null))

  /** Escribir arriba rellena TODAS: es lo que pasa el 90% de las veces. */
  const ponerEnTodas = (campo: string, valor: string) => {
    series.forEach((_, si) => mutarSerie(pacienteId, ei, si, campo, valor))
  }

  const ant = (ej.ultimo || [])[0] || {}
  const celda = {
    width: 52, height: 30, fontFamily: 'inherit', fontSize: 14, padding: '0 3px',
    textAlign: 'center' as const, borderRadius: 6, color: 'var(--n)',
    border: '1px solid var(--bd)', background: 'var(--w)',
  }
  const etiqueta = (c: string) => c === 'peso' ? 'kg' : c === 'reps' ? 'reps' : 'seg'

  /** Lo que dice la chapa: "3×20×10", o solo las series si aun no hay nada. */
  const resumen = hayAlgo
    ? String(series.length) + '×' + campos.map(c => muestra(c) || '—').join('×')
    : String(series.length) + '×'

  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={mezclado ? 'Las series no son iguales · pulsa para verlas' : 'Peso y repeticiones'}
        style={{ position: 'absolute', left: 5, bottom: 5, height: 23, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', padding: '0 9px',
          border: '2px solid var(--w)', cursor: 'pointer',
          boxShadow: '0 1px 5px rgba(38,40,37,.20)',
          background: hayAlgo ? 'var(--g)' : 'var(--w)',
          color: hayAlgo ? '#fff' : 'var(--grl)' }}>
        {resumen}{mezclado ? ' ~' : ''}
      </button>

      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={224}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
                textTransform: 'uppercase' }}>Todas las series</span>
              <button onClick={() => setAbierto(false)} style={{ marginLeft: 'auto', fontSize: 12,
                color: 'var(--gr)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
            </div>

            {/* ARRIBA SE ESCRIBE UNA VEZ Y VALEN TODAS, que es lo que pasa casi
                siempre. El detalle de abajo es para cuando no coinciden. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {campos.map((c, k) => (
                <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {k > 0 && <span style={{ fontSize: 11, color: 'var(--bm)' }}>{tm === 'peso_reps' ? '×' : '·'}</span>}
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <input inputMode={c === 'peso' ? 'decimal' : 'numeric'} value={muestra(c)}
                      placeholder={ant[c] || '—'} autoFocus={k === 0}
                      onChange={e => ponerEnTodas(c, e.target.value)} style={celda}/>
                    <span style={{ fontSize: 8.5, color: 'var(--grl)', marginTop: 2 }}>{etiqueta(c)}</span>
                  </span>
                </span>
              ))}
            </div>
            {mezclado && (
              <div style={{ fontSize: 9.5, color: '#7A5800', textAlign: 'center', marginTop: 4 }}>
                es la media · escribir aquí iguala todas
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--bl)', margin: '10px 0 7px' }}/>

            {series.map((ser: any, si: number) => (
              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ width: 13, fontSize: 10, color: 'var(--grl)' }}>{si + 1}</span>
                {campos.map((c, k) => (
                  <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {k > 0 && <span style={{ fontSize: 10, color: 'var(--bm)' }}>{tm === 'peso_reps' ? '×' : '·'}</span>}
                    <input inputMode={c === 'peso' ? 'decimal' : 'numeric'} value={ser?.[c] || ''}
                      placeholder={((ej.ultimo || [])[si] || {})[c] || '—'}
                      onChange={e => mutarSerie(pacienteId, ei, si, c, e.target.value)}
                      style={{ ...celda, width: 46, height: 26, fontSize: 12 }}/>
                  </span>
                ))}
                <div style={{ flex: 1 }}/>
                {series.length > 1 && quitarSerie && (
                  <button onClick={() => quitarSerie(pacienteId, ei, si)} title="Quitar esta serie"
                    style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '2px 3px' }}>✕</button>
                )}
              </div>
            ))}
            {addSerie && (
              <button onClick={() => addSerie(pacienteId, ei)}
                style={{ fontSize: 10, color: 'var(--g)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit' }}>+ serie</button>
            )}
      </Flotante>
    </>
  )
}
