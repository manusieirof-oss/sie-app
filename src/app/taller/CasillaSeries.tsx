'use client'
import { useEffect, useRef, useState } from 'react'
import Flotante from './Flotante'
import { camposSerie, partesMedida, ajustesMedida, ESFUERZOS, UNIDAD, COLOR_BANDA, type AjustesMedida } from '@/lib/medida'

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
  // Bandas y escalas de esfuerzo, de Ajustes (una sola consulta por página).
  const [aj, setAj] = useState<AjustesMedida | null>(null)
  useEffect(() => { ajustesMedida().then(setAj) }, [])
  const ancla = useRef<HTMLButtonElement>(null)
  const series: any[] = ej.series || []
  /* ISOMETRICO SE MIDE EN TIEMPO. La medida salia solo del ejercicio del catalogo
     (casi todos peso y reps), asi que al marcarlo isometrico seguia pidiendo kg y
     repeticiones. Con regimen isometrico: segundos, y kg ademas si lleva carga. */
  const regimen = String(ej.regimen || ej.plan?.regimen || '').toLowerCase()
  const isometrico = regimen.startsWith('isom')
  const base = ej.tipo_medida || 'peso_reps'
  const conCarga = (ej.plan?.peso != null && String(ej.plan.peso) !== '') || base === 'peso_tiempo'
    || (ej.series || []).some((x: any) => x?.peso != null && String(x.peso) !== '')
  /* CARGA × VOLUMEN (lib/medida): con peso pide kg, peso corporal nada, banda cuál;
     y luego reps, segundos o metros. Isométrico sin carga apuntada: solo segundos. */
  let campos: string[] = camposSerie(base, { isometrico })
  if (isometrico && partesMedida(base).carga === 'kg' && !conCarga) campos = campos.filter(c => c !== 'peso')
  // El esfuerzo no va en la chapa: se apunta en el detalle si está encendido en Ajustes.
  const esfuerzos = ESFUERZOS.filter(x => (aj?.esfuerzo || []).includes(x.id))
  const bandas = aj?.bandas || []
  const porTiempo = campos.includes('segundos')
  const tm = campos.includes('reps') && campos.length > 1 ? 'peso_reps' : 'otro'

  // La banda es un nombre, no un número: se compara como texto y no hay media.
  const valoresDe = (c: string): any[] => c === 'banda'
    ? series.map(s => (s?.banda ? String(s.banda) : null)) : series.map(s => num(s?.[c]))
  const iguales = (c: string) => {
    const v = valoresDe(c).filter(x => x != null)
    return v.length === 0 || v.every(x => x === v[0])
  }
  /** Lo que se enseña en la casilla: el valor si todas coinciden, la media si no. */
  const muestra = (c: string) => {
    if (c === 'banda') return valoresDe(c).find(x => x != null) || ''
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
  // Mas contraste: la primera version (gris contra negro) apenas se distinguia en la tablet.
  const tinta = (deHoy: boolean) => deHoy
    ? { color: 'var(--n)', fontWeight: 700, borderColor: 'var(--gd)', background: 'var(--w)' }
    : { color: '#B3B1AC', fontWeight: 400, background: 'var(--bl)', borderStyle: 'dashed' }
  const mezclado = campos.some(c => iguales(c) === false)
  const hayAlgo = series.some(s => campos.some(c => c === 'banda' ? !!s?.banda : num(s?.[c]) != null))

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
    const v = c === 'peso' ? plan.peso : c === 'reps' ? plan.reps : c === 'segundos' ? plan.tiempo : plan[c]
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
  const etiqueta = (c: string) => UNIDAD[c] || ESFUERZOS.find(x => x.id === c)?.nombre || c
  /** La casilla de cada campo: la banda se elige de la lista de Ajustes; el resto se teclea. */
  const casilla = (c: string, valor: string, hueco: string, onChange: (v: string) => void, estilo: any, autoFocus?: boolean) => c === 'banda'
    ? (
      <select value={valor} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
        style={{ ...estilo, width: 78, fontSize: 12, padding: '0 2px', borderLeft: `5px solid ${COLOR_BANDA[valor || hueco] || 'var(--bd)'}` }}>
        <option value="">{hueco && hueco !== '—' ? hueco : 'banda'}</option>
        {bandas.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    )
    : (
      <input inputMode={c === 'peso' ? 'decimal' : 'numeric'} value={valor} placeholder={hueco} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} style={estilo}/>
    )
  /** La misma rejilla arriba y abajo: indice · casillas · hueco de la ✕. */
  const fila: any = { display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }
  const sep: any = { width: 8, textAlign: 'center', fontSize: 11, color: 'var(--bm)' }

  /** Lo que dice la chapa: "3×20×10", o solo las series si aun no hay nada. */
  const resumen = hayAlgo
    ? String(series.length) + '×' + campos.map(c => muestra(c) || '—').join('×')
    : String(series.length) + (textoPlan ? '× ' + textoPlan + (porTiempo ? 's' : campos.includes('metros') ? 'm' : '') : '×')

  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={mezclado ? 'Las series no son iguales · pulsa para verlas' : 'Apuntar las series'}
        style={{ position: 'absolute', left: 5, bottom: 5, height: 23, borderRadius: 99,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontFamily: 'inherit', padding: '0 9px',
          border: '2px solid var(--w)', cursor: 'pointer',
          boxShadow: '0 1px 5px rgba(38,40,37,.20)',
          background: algoHoy ? 'var(--gd)' : 'var(--w)',
          color: algoHoy ? '#fff' : (hayAlgo ? '#A9A7A2' : 'var(--grl)'),
          fontWeight: algoHoy ? 700 : 500 }}>
        {resumen}{mezclado ? ' ~' : ''}
      </button>

      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)}
        ancho={224 + (campos.includes('banda') ? 30 : 0) + esfuerzos.length * 46}>
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
                    {/* LO DE ANTES VA DE HUECO, NO DE VALOR. Estaba escrito dentro de la
                        casilla, asi que al teclear se sumaba: tenia 8, apuntabas 9 y
                        quedaba 89. Como hueco se ve igual de claro y se escribe encima. */}
                    {casilla(c, todasHoy(c) ? muestra(c) : '', muestra(c) || hueco(c), v => ponerEnTodas(c, v),
                      { ...celda, ...tinta(todasHoy(c)) }, k === 0)}
                    <span style={{ fontSize: 8.5, color: 'var(--grl)', marginTop: 2 }}>{etiqueta(c)}</span>
                  </span>
                </span>
              ))}
              {/* ESFUERZO: opcional, en otra tinta, para que no parezca obligatorio. */}
              {esfuerzos.map(x => (
                <span key={x.id} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginLeft: 4 }}>
                  <input inputMode="numeric" value={todasHoy(x.id) ? muestra(x.id) : ''} placeholder={muestra(x.id) || '·'} title={x.ayuda}
                    onChange={e => ponerEnTodas(x.id, e.target.value)}
                    style={{ ...celda, width: 38, borderColor: 'var(--amb)', ...(todasHoy(x.id) ? { color: '#7A5800', fontWeight: 700 } : { background: 'var(--w)' }) }}/>
                  <span style={{ fontSize: 8.5, color: '#A87E2C', marginTop: 2 }}>{x.nombre}</span>
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
                  <span>punto de partida <b style={{ color: 'var(--gd)', fontWeight: 600 }}>{series.length} × {textoPlan}{porTiempo ? ' s' : campos.includes('metros') ? ' m' : ''}</b></span>
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
                    {casilla(c, esHoy(si, c) ? (ser?.[c] || '') : '',
                      (ser?.[c] != null && String(ser[c]) !== '' ? String(ser[c]) : '') || prescrito(c) || ((ej.ultimo || [])[si] || {})[c] || '—',
                      v => mutarSerie(pacienteId, ei, si, c, v), { ...celda, height: 27, ...tinta(esHoy(si, c)) })}
                  </span>
                ))}
                {esfuerzos.map(x => (
                  <input key={x.id} inputMode="numeric" value={ser?.[x.id] ?? ''} placeholder="·" title={`${x.nombre}: ${x.ayuda}`}
                    onChange={e => mutarSerie(pacienteId, ei, si, x.id, e.target.value)}
                    style={{ ...celda, height: 27, width: 38, marginLeft: 4, borderColor: 'var(--amb)', color: '#7A5800' }}/>
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
