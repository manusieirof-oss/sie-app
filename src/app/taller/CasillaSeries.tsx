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
  /* HOY OSCURO, LO DE ANTES CLARO. Las casillas salen rellenas con lo de la ultima
     vez (o lo planificado) y se veian igual que lo apuntado hoy: no se sabia si ya
     se habia anotado o era el punto de partida. */
  const hoy: Record<string, boolean> = ej.hoy || {}
  const esHoy = (si: number, c: string) => !!hoy[`${si}.${c}`]
  const todasHoy = (c: string) => series.length > 0 && series.every((_, si) => esHoy(si, c))
  const algoHoy = Object.keys(hoy).length > 0
  const tinta = (deHoy: boolean) => deHoy
    ? { color: 'var(--n)', fontWeight: 600, borderColor: 'var(--gr)' }
    : { color: 'var(--grl)', fontWeight: 400 }
  const mezclado = campos.some(c => iguales(c) === false)
  const hayAlgo = series.some(s => campos.some(c => num(s?.[c]) != null))

  /** Escribir arriba rellena TODAS: es lo que pasa el 90% de las veces. */
  const ponerEnTodas = (campo: string, valor: string) => {
    series.forEach((_, si) => mutarSerie(pacienteId, ei, si, campo, valor))
  }

  const ant = (ej.ultimo || [])[0] || {}
  /* LO PRESCRITO, AQUI. Estaba suelto bajo el nombre -"45s"- sin decir si era
     lo que tocaba, lo de la ultima vez o lo de hoy. Es lo que hay que hacer,
     asi que va donde se escribe: de hueco en la casilla y en la chapa mientras
     no haya nada apuntado. */
  const plan: any = ej.plan || {}
  const prescrito = (c: string) => {
    const v = c === 'peso' ? plan.peso : c === 'reps' ? plan.reps : plan.tiempo
    return v == null || v === '' ? '' : String(v)
  }
  const hueco = (c: string) => prescrito(c) || ant[c] || '—'
  const textoPlan = campos.map(c => prescrito(c)).filter(Boolean)
    .map((v, i) => campos.length > 1 && i > 0 ? v : v).join(tm === 'peso_reps' ? '×' : '·')
  const celda = {
    width: 52, height: 30, fontFamily: 'inherit', fontSize: 14, padding: '0 3px',
    textAlign: 'center' as const, borderRadius: 6, color: 'var(--n)',
    border: '1px solid var(--bd)', background: 'var(--w)',
  }
  const etiqueta = (c: string) => c === 'peso' ? 'kg' : c === 'reps' ? 'reps' : 'seg'
  /** La misma rejilla arriba y abajo: indice · casillas · hueco de la ✕. */
  const fila: any = { display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }
  const sep: any = { width: 8, textAlign: 'center', fontSize: 11, color: 'var(--bm)' }

  /** Lo que dice la chapa: "3×20×10", o solo las series si aun no hay nada. */
  const resumen = hayAlgo
    ? String(series.length) + '×' + campos.map(c => muestra(c) || '—').join('×')
    : String(series.length) + (textoPlan ? '× ' + textoPlan + (tm === 'tiempo' || tm === 'peso_tiempo' ? 's' : '') : '×')

  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={mezclado ? 'Las series no son iguales · pulsa para verlas' : 'Peso y repeticiones'}
        style={{ position: 'absolute', left: 5, bottom: 5, height: 23, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, fontFamily: 'inherit', padding: '0 9px',
          border: '2px solid var(--w)', cursor: 'pointer',
          boxShadow: '0 1px 5px rgba(38,40,37,.20)',
          background: hayAlgo ? (algoHoy ? 'var(--gd)' : 'var(--gl)') : 'var(--w)',
          color: hayAlgo ? (algoHoy ? '#fff' : 'var(--gd)') : 'var(--grl)' }}>
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
                siempre. El detalle de abajo es para cuando no coinciden — y va en
                la MISMA rejilla, que si no las columnas bailaban. */}
            <div style={fila}>
              <span style={{ width: 14 }}/>
              {campos.map((c, k) => (
                <span key={c} style={{ display: 'contents' }}>
                  {k > 0 && <span style={sep}>{tm === 'peso_reps' ? '×' : '·'}</span>}
                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                    <input inputMode={c === 'peso' ? 'decimal' : 'numeric'} value={muestra(c)}
                      placeholder={hueco(c)} autoFocus={k === 0}
                      onChange={e => ponerEnTodas(c, e.target.value)} style={{ ...celda, ...tinta(todasHoy(c)) }}/>
                    <span style={{ fontSize: 8.5, color: 'var(--grl)', marginTop: 2 }}>{etiqueta(c)}</span>
                  </span>
                </span>
              ))}
              <span style={{ width: 18 }}/>
            </div>
            {mezclado && (
              <div style={{ fontSize: 9.5, color: '#7A5800', textAlign: 'center', marginTop: 4 }}>
                es la media · escribir aquí iguala todas
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--grl)', textAlign: 'center', marginTop: 5,
              lineHeight: 1.5 }}>
              {textoPlan && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, flexWrap: 'wrap' }}>
                  <span>punto de partida <b style={{ color: 'var(--gd)', fontWeight: 600 }}>{series.length} × {textoPlan}{tm === 'tiempo' || tm === 'peso_tiempo' ? ' s' : ''}</b></span>
                  {/* La misma chapa que fuera, para reconocerla de un vistazo. */}
                  {plan.capacidad && (
                    <span style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 99,
                      border: '1px solid var(--amb)', color: '#7A5800', background: 'var(--w)' }}>
                      {plan.capacidad}
                    </span>
                  )}
                  {plan.regimen && (
                    <span style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 99,
                      border: '1px solid var(--gm)', color: 'var(--gd)', background: 'var(--w)' }}>
                      {plan.regimen}
                    </span>
                  )}
                </div>
              )}
              {campos.some(c => ant[c]) && (
                <div>última vez {campos.map(c => ant[c] || '—').join(tm === 'peso_reps' ? '×' : '·')}</div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--bl)', margin: '10px 0 7px' }}/>

            {series.map((ser: any, si: number) => (
              <div key={si} style={{ ...fila, marginBottom: 5 }}>
                <span style={{ width: 14, fontSize: 10, color: 'var(--grl)', textAlign: 'center' }}>{si + 1}</span>
                {campos.map((c, k) => (
                  <span key={c} style={{ display: 'contents' }}>
                    {k > 0 && <span style={sep}>{tm === 'peso_reps' ? '×' : '·'}</span>}
                    <input inputMode={c === 'peso' ? 'decimal' : 'numeric'} value={ser?.[c] || ''}
                      placeholder={prescrito(c) || ((ej.ultimo || [])[si] || {})[c] || '—'}
                      onChange={e => mutarSerie(pacienteId, ei, si, c, e.target.value)}
                      style={{ ...celda, height: 27, ...tinta(esHoy(si, c)) }}/>
                  </span>
                ))}
                {quitarSerie && (
                  <button onClick={() => series.length > 1 && quitarSerie(pacienteId, ei, si)}
                    title="Quitar esta serie" disabled={series.length <= 1}
                    style={{ width: 18, fontSize: 11, color: series.length > 1 ? 'var(--red)' : 'transparent',
                      background: 'none', border: 'none', cursor: series.length > 1 ? 'pointer' : 'default',
                      padding: 0 }}>✕</button>
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
