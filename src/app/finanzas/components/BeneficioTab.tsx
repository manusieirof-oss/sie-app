'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { calcularImpuestos, rangoTrimestre } from '@/lib/impuestos'
import type { Factura } from '@/lib/facturado'
import { cargarHuchas, guardarHucha, borrarHucha, apuntarSalida, borrarSalida, repartir,
         type Hucha, type Salida } from '@/lib/huchas'

/**
 * BENEFICIO: CUÁNTO DINERO DEJA LA CLÍNICA Y QUÉ HACER CON ÉL.
 *
 * Se lee de arriba abajo como una cuenta:
 *   ingresos − gastos = beneficio − IRPF (130) = dinero libre
 * y el dinero libre se reparte en huchas por porcentaje.
 *
 * Todo sin IVA: el IVA que cobras no es tuyo, lo pagas en el 303. Por eso no
 * entra en la cuenta, pero se avisa aparte de cuánto hay que tener guardado.
 */

const G = '#5A969E', GD = '#3E7179', RED = '#C25B5B', AMB = '#D4A24E'
const TONOS = ['#5A969E', '#3E7179', '#D4A24E', '#8FB8BE', '#C25B5B', '#9CA3AF', '#E0C088', '#6E8F94']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const eur = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('es-ES')} €`

/** Los periodos que se pueden elegir dentro del año que tiene cargado Finanzas. */
function periodos(anio: number) {
  const ult = (m: number) => new Date(anio, m, 0).getDate()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const lista = [{ id: 'anio', nombre: `Todo ${anio}`, desde: `${anio}-01-01`, hasta: `${anio}-12-31` }]
  for (let t = 1; t <= 4; t++) {
    const r = rangoTrimestre(`${anio}-${p2((t - 1) * 3 + 1)}`)
    lista.push({ id: `t${t}`, nombre: `${t}º trimestre`, desde: r.desde, hasta: r.hasta })
  }
  for (let m = 1; m <= 12; m++)
    lista.push({ id: `m${m}`, nombre: MESES[m - 1], desde: `${anio}-${p2(m)}-01`, hasta: `${anio}-${p2(m)}-${ult(m)}` })
  return lista
}

function Linea({ texto, valor, color, fuerte, ayuda }: { texto: string, valor: number, color?: string, fuerte?: boolean, ayuda?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0',
                  borderTop: fuerte ? '1px solid var(--bd)' : 'none' }}>
      <div>
        <div style={{ fontSize: fuerte ? 12 : 11, fontWeight: fuerte ? 600 : 400, color: 'var(--n)' }}>{texto}</div>
        {ayuda && <div style={{ fontSize: 9, color: 'var(--grl)' }}>{ayuda}</div>}
      </div>
      <div style={{ fontSize: fuerte ? 18 : 13, fontWeight: fuerte ? 700 : 500, color: color || 'var(--n)' }}>{eur(valor)}</div>
    </div>
  )
}

export default function BeneficioTab({ gastos, ingresos, facturas, mesRef }:
  { gastos: any[], ingresos: any[], facturas: Factura[], mesRef: string }) {
  const anio = Number(mesRef.slice(0, 4))
  const lista = useMemo(() => periodos(anio), [anio])
  const [perId, setPerId] = useState('anio')
  const per = lista.find(p => p.id === perId) || lista[0]

  const [huchas, setHuchas] = useState<Hucha[]>([])
  const [salidas, setSalidas] = useState<Salida[]>([])
  const [error, setError] = useState<string | null>(null)
  // Los % que se están tecleando, para no guardar a cada pulsación.
  const [pcts, setPcts] = useState<Record<string, string>>({})
  const [nueva, setNueva] = useState('')
  // Formulario de "apuntar lo sacado": abierto en una hucha concreta.
  const [salidaDe, setSalidaDe] = useState<string | null>(null)
  const [fSal, setFSal] = useState({ fecha: hoyISO(), importe: '', nota: '' })

  async function recargar() {
    const r = await cargarHuchas()
    setError(r.error)
    setHuchas(r.huchas)
    setSalidas(r.salidas)
    setPcts(Object.fromEntries(r.huchas.map(h => [h.id, String(h.pct)])))
  }
  useEffect(() => { recargar() }, [])

  // LA CUENTA. Misma función que Impuestos y Resumen, para que las tres
  // pantallas digan el mismo beneficio del mismo periodo.
  const imp = calcularImpuestos({ facturas, ingresos, gastos, desde: per.desde, hasta: per.hasta })
  const libre = imp.beneficio - imp.modelo130

  // El IVA no es tuyo, pero está en tu cuenta hasta que pagas el 303. Se mira
  // el trimestre en curso porque es el que todavía no has pagado.
  const triHoy = rangoTrimestre(hoyISO().slice(0, 7))
  const ivaPendiente = Math.max(0, calcularImpuestos({ facturas, ingresos, gastos, ...triHoy }).modelo303)

  const reparto = repartir(libre, huchas, salidas, per.desde, per.hasta)
  const sumaPct = huchas.reduce((a, h) => a + h.pct, 0)

  async function guardarPct(h: Hucha) {
    const v = Number(String(pcts[h.id] ?? '').replace(',', '.'))
    if (isNaN(v) || v < 0 || v > 100) { setPcts(p => ({ ...p, [h.id]: String(h.pct) })); return }
    if (v === h.pct) return
    const r = await guardarHucha({ ...h, pct: v })
    if (!r.ok) setError(`No se ha guardado el %: ${r.error}`)
    recargar()
  }

  async function crear() {
    if (!nueva.trim()) return
    const r = await guardarHucha({ nombre: nueva, pct: 0, orden: huchas.length + 1 })
    if (!r.ok) { setError(`No se ha creado la hucha: ${r.error}`); return }
    setNueva('')
    recargar()
  }

  async function quitar(h: Hucha) {
    if (!confirm(`¿Eliminar la hucha «${h.nombre}»? También se borra lo apuntado como sacado de ella.`)) return
    const r = await borrarHucha(h.id)
    if (!r.ok) setError(`No se ha borrado: ${r.error}`)
    recargar()
  }

  async function guardarSalida() {
    const imp = Number(fSal.importe.replace(',', '.'))
    if (!salidaDe || !(imp > 0) || !fSal.fecha) return
    const r = await apuntarSalida({ hucha_id: salidaDe, fecha: fSal.fecha, importe: imp, nota: fSal.nota })
    if (!r.ok) { setError(`No se ha apuntado: ${r.error}`); return }
    setSalidaDe(null)
    setFSal({ fecha: hoyISO(), importe: '', nota: '' })
    recargar()
  }

  async function quitarSalida(s: Salida) {
    if (!confirm('¿Eliminar este apunte?')) return
    const r = await borrarSalida(s.id)
    if (!r.ok) setError(`No se ha borrado: ${r.error}`)
    recargar()
  }

  const salidasPer = salidas.filter(s => s.fecha >= per.desde && s.fecha <= per.hasta)
  const nombreDe = (id: string) => huchas.find(h => h.id === id)?.nombre || '—'

  return (
    <div>
      {error && (
        <div style={{ background: 'var(--redl)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px',
                      marginBottom: 12, fontSize: 10, color: 'var(--red)' }}>
          <Ic name="alerta" size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />{error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Periodo</span>
        <select className="input" style={{ width: 'auto', padding: '6px 10px' }} value={perId} onChange={e => setPerId(e.target.value)}>
          {lista.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.6fr)', gap: 14, alignItems: 'start' }}>
        {/* LA CUENTA */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n)', marginBottom: 6 }}>Lo que deja la clínica</div>
          <Linea texto="Ingresos" valor={imp.baseIngresos} color={GD} ayuda="Sin IVA" />
          <Linea texto="− Gastos" valor={-imp.baseGastos} color={RED} ayuda="Sin IVA, con la Seguridad Social de las nóminas. Sin previsiones." />
          <Linea texto="Beneficio" valor={imp.beneficio} fuerte />
          <Linea texto="− IRPF (modelo 130)" valor={-imp.modelo130} color={RED} ayuda="El 20 % del beneficio, para Hacienda" />
          <Linea texto="Dinero libre" valor={libre} color={libre >= 0 ? G : RED} fuerte />
          {libre < 0 && (
            <div style={{ fontSize: 10, color: RED, marginTop: 6 }}>En este periodo hay pérdidas: no hay nada que repartir.</div>
          )}
          {ivaPendiente > 0 && (
            <div style={{ background: 'var(--ambl)', border: '1px solid var(--amb)', borderRadius: 8, padding: '8px 10px',
                          marginTop: 10, fontSize: 10, color: '#7A5800', lineHeight: 1.5 }}>
              <Ic name="alerta" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              Aparte, deja en la cuenta <strong>{eur(ivaPendiente)}</strong> de IVA del {triHoy.t}º trimestre.
              No es tuyo: se paga en el 303 y no entra en esta cuenta.
            </div>
          )}
        </div>

        {/* LAS HUCHAS */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n)' }}>En qué lo repartes</div>
            <div style={{ fontSize: 10, color: Math.round(sumaPct) === 100 ? 'var(--grl)' : AMB }}>
              {Math.round(sumaPct) === 100 ? 'Repartido el 100 %'
                : sumaPct < 100 ? `Sin repartir: ${Math.round((100 - sumaPct) * 100) / 100} %`
                : `Te pasas: ${Math.round((sumaPct - 100) * 100) / 100} % de más`}
            </div>
          </div>

          {/* La barra: el reparto de un vistazo. */}
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', background: 'var(--bl)', marginBottom: 12 }}>
            {huchas.map((h, i) => h.pct > 0 && (
              <div key={h.id} title={`${h.nombre}: ${h.pct} %`}
                   style={{ width: `${(h.pct / Math.max(100, sumaPct)) * 100}%`, background: TONOS[i % TONOS.length] }} />
            ))}
          </div>

          {reparto.map((h, i) => (
            <div key={h.id} style={{ borderTop: '1px solid var(--bd)', padding: '8px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 80px 80px auto', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--n)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: TONOS[i % TONOS.length], flexShrink: 0 }} />
                  {h.nombre}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <input className="input" style={{ width: 48, padding: '4px 6px', textAlign: 'right' }} inputMode="decimal"
                    value={pcts[h.id] ?? ''} onChange={e => setPcts(p => ({ ...p, [h.id]: e.target.value }))}
                    onBlur={() => guardarPct(h)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  <span style={{ fontSize: 10, color: 'var(--grl)' }}>%</span>
                </div>
                <Cifra titulo="Le toca" valor={h.toca} />
                <Cifra titulo="Sacado" valor={h.sacado} color={h.sacado > 0 ? RED : 'var(--grl)'} />
                <Cifra titulo="Queda" valor={h.queda} color={h.queda >= 0 ? G : RED} fuerte />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn" style={{ fontSize: 10, padding: '4px 8px' }} title="Apuntar dinero sacado de esta hucha"
                    onClick={() => { setSalidaDe(salidaDe === h.id ? null : h.id); setFSal({ fecha: hoyISO(), importe: '', nota: '' }) }}>
                    <Ic name="dinero" size={11} /> Sacar
                  </button>
                  <button className="btn" style={{ fontSize: 10, padding: '4px 6px' }} title="Eliminar hucha" onClick={() => quitar(h)}>
                    <Ic name="papelera" size={11} />
                  </button>
                </div>
              </div>
              {salidaDe === h.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input className="input" type="date" style={{ width: 'auto', padding: '4px 6px' }} value={fSal.fecha}
                    onChange={e => setFSal(p => ({ ...p, fecha: e.target.value }))} />
                  <input className="input" inputMode="decimal" placeholder="Importe €" style={{ width: 90, padding: '4px 6px' }}
                    value={fSal.importe} onChange={e => setFSal(p => ({ ...p, importe: e.target.value }))} />
                  <input className="input" placeholder="Nota (opcional)" style={{ flex: 1, minWidth: 120, padding: '4px 6px' }}
                    value={fSal.nota} onChange={e => setFSal(p => ({ ...p, nota: e.target.value }))} />
                  <button className="btn btn-p" style={{ fontSize: 10, padding: '5px 10px' }} onClick={guardarSalida}>Apuntar</button>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
            <input className="input" placeholder="Nueva hucha (ej. Vacaciones)" style={{ flex: 1, padding: '5px 8px' }}
              value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') crear() }} />
            <button className="btn" style={{ fontSize: 10 }} onClick={crear}><Ic name="mas" size={11} /> Añadir</button>
          </div>
        </div>
      </div>

      {/* LO SACADO EN EL PERIODO */}
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--n)', marginBottom: 8 }}>Lo sacado en este periodo</div>
        {salidasPer.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--grl)' }}>Nada apuntado todavía. Usa «Sacar» en una hucha.</div>
        ) : salidasPer.map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1.5fr 90px auto', gap: 8, alignItems: 'center',
                                   fontSize: 11, padding: '5px 0', borderTop: '1px solid var(--bd)' }}>
            <span style={{ color: 'var(--grl)' }}>{s.fecha.split('-').reverse().join('/')}</span>
            <span>{nombreDe(s.hucha_id)}</span>
            <span style={{ color: 'var(--grl)' }}>{s.nota || ''}</span>
            <span style={{ textAlign: 'right', fontWeight: 500 }}>{eur(s.importe)}</span>
            <button className="btn" style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => quitarSalida(s)}><Ic name="papelera" size={10} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Cifra({ titulo, valor, color, fuerte }: { titulo: string, valor: number, color?: string, fuerte?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 8, color: 'var(--grl)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{titulo}</div>
      <div style={{ fontSize: fuerte ? 13 : 11, fontWeight: fuerte ? 600 : 400, color: color || 'var(--n)' }}>{eur(valor)}</div>
    </div>
  )
}
