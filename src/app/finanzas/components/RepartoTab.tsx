'use client'
import React, { useMemo, useState } from 'react'
import { mesISO } from '@/lib/fechas'
import { indicePlanes, precioBono } from '@/lib/bonos'
import { agruparGastos, agruparIngresos, moverCategoria, moverConcepto, totalReparto,
         type CatReparto, type ModoReparto } from '@/lib/simulador'

/**
 * DÓNDE VA EL DINERO.
 *
 * Tres preguntas distintas que no se mezclan en el mismo rosco: lo que entra,
 * lo que sale todos los meses y lo que sale a veces. Bajar el alquiler y bajar
 * el material no son la misma decisión.
 *
 * Y dos formas de preguntarlo:
 *   Repartir         → el total está quieto. Lo que le das a una sale de las
 *                      demás. "Dónde pongo el dinero que ya gasto."
 *   Cambiar el total → cada categoría va sola y el total se mueve con ella.
 *                      "Y si gasto más en esto."
 *
 * Dentro de cada porción están sus conceptos, que es donde se decide de verdad:
 * "Suministros 400 €" no dice nada, "luz 280, agua 60, internet 60" sí.
 *
 * No guarda nada. Las cuentas están en lib/simulador.
 */

const RED = '#C25B5B', GD = '#3E7179'
const TONOS = ['#5A969E','#3E7179','#8FB8BE','#D4A24E','#C25B5B','#9CA3AF','#6E8F94','#B8CFD3','#E0C088','#D99A9A']

type Bloque = 'ingresos' | 'fijo' | 'variable'
const BLOQUES: [Bloque, string][] = [['ingresos','Ingresos'],['fijo','Gastos fijos'],['variable','Gastos variables']]

const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES')}€`

const pastilla = (activo: boolean): React.CSSProperties => ({
  fontSize: 10, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', background: activo ? 'var(--w)' : 'transparent',
  color: activo ? 'var(--n)' : 'var(--grl)', fontWeight: activo ? 500 : 300,
  boxShadow: activo ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
})

const grupo: React.CSSProperties = {
  display: 'flex', gap: 4, background: 'var(--bl)', border: '1px solid var(--bd)',
  borderRadius: 'var(--rl)', padding: 3,
}

/**
 * EL ROSCO. Grande, porque es lo que se mira: los controles son para tocarlo,
 * no al revés.
 */
function Rosco({ cats, pie }: { cats: CatReparto[], pie: string }) {
  const total = totalReparto(cats) || 1
  let ang = -Math.PI / 2
  return (
    <svg viewBox="0 0 220 220" style={{ width: 320, height: 320, flexShrink: 0 }}>
      {cats.map((c, i) => {
        const frac = c.valor / total
        if (frac <= 0) return null
        const tono = TONOS[i % TONOS.length]
        const titulo = `${c.nombre}: ${eur(c.valor)} (${Math.round(frac * 100)}%)`
        if (frac >= 0.999) {
          return <circle key={c.nombre} cx="110" cy="110" r="100" fill={tono}><title>{titulo}</title></circle>
        }
        const a0 = ang, a1 = ang + frac * Math.PI * 2
        ang = a1
        const grande = frac > 0.5 ? 1 : 0
        const x0 = 110 + 100 * Math.cos(a0), y0 = 110 + 100 * Math.sin(a0)
        const x1 = 110 + 100 * Math.cos(a1), y1 = 110 + 100 * Math.sin(a1)
        return (
          <path key={c.nombre} d={`M 110 110 L ${x0} ${y0} A 100 100 0 ${grande} 1 ${x1} ${y1} Z`}
            fill={tono} stroke="var(--w)" strokeWidth="1.5">
            <title>{titulo}</title>
          </path>
        )
      })}
      <circle cx="110" cy="110" r="62" fill="var(--w)" />
      <text x="110" y="108" textAnchor="middle" fontSize="22" fontWeight="200" fill="var(--n)">
        {eur(totalReparto(cats))}
      </text>
      <text x="110" y="126" textAnchor="middle" fontSize="9" fill="var(--grl)">{pie}</text>
    </svg>
  )
}

/**
 * FUERA DEL COMPONENTE. Definida dentro, React la trataría como un componente
 * nuevo en cada render: desmontaría el control y arrastrarlo sería imposible.
 */
function Barra({ tope, valor, tono, ancho, onMove }: any) {
  return (
    <input type="range" min={0} max={tope} step={Math.max(1, Math.round(tope / 200))}
      value={Math.min(Math.round(valor), tope)}
      onChange={e => onMove(Number(e.target.value))}
      style={{ width: ancho, accentColor: tono, flexShrink: 0 }} />
  )
}

export default function RepartoTab({ planes = [], gastos = [], bonosHist = [], ingresos = [], mesRef }: any) {
  const mesActual = mesRef || mesISO()
  const [bloque, setBloque] = useState<Bloque>('fijo')
  const [modo, setModo] = useState<ModoReparto>('repartir')
  const [abierta, setAbierta] = useState<Record<string, boolean>>({})
  const [edit, setEdit] = useState<Record<Bloque, CatReparto[] | null>>({ ingresos: null, fijo: null, variable: null })

  const orig = useMemo(() => {
    const idx = indicePlanes(planes)
    return {
      ingresos: agruparIngresos({
        bonosHist, ingresos, mesActual,
        precioBono: (b: any) => precioBono(b, idx),
        nombrePlan: (b: any) => idx[b?.tipo]?.nombre || b?.tipo || 'Sin plan',
      }),
      fijo: agruparGastos(gastos, mesActual, 'fijo'),
      variable: agruparGastos(gastos, mesActual, 'variable'),
    }
  }, [planes, gastos, bonosHist, ingresos, mesActual])

  const base = orig[bloque]
  const cats = edit[bloque] || base
  const total = totalReparto(cats)
  const totalOrig = totalReparto(base)
  const esIngreso = bloque === 'ingresos'
  const tocado = !!edit[bloque]
  const aplicar = (nuevas: CatReparto[]) => setEdit(e => ({ ...e, [bloque]: nuevas }))
  const tinte = (d: number) => Math.abs(d) < 1 ? 'transparent' : ((d > 0) === esIngreso ? GD : RED)

  // Repartiendo, el tope es todo lo que hay. Con el total suelto no hay tope
  // natural: se da margen sobre lo que valía, y fijo —si dependiera del valor
  // actual, el final del recorrido huiría mientras arrastras.
  const topeDe = (vOrig: number) =>
    modo === 'repartir' ? Math.max(10, Math.round(Math.max(totalOrig, total)))
                        : Math.max(50, Math.round(vOrig * 3))

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={grupo}>
          {BLOQUES.map(([k, l]) => <button key={k} onClick={() => setBloque(k)} style={pastilla(bloque === k)}>{l}</button>)}
        </div>
        <div style={grupo}>
          {([['repartir', 'Repartir'], ['total', 'Cambiar el total']] as [ModoReparto, string][])
            .map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={pastilla(modo === k)}>{l}</button>)}
        </div>
        {tocado && (
          <button className="btn btn-d btn-sm" onClick={() => setEdit(e => ({ ...e, [bloque]: null }))}>
            Volver a como está
          </button>
        )}
      </div>

      {cats.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--grl)', padding: 20 }}>
          Sin datos de meses cerrados en este bloque no hay nada que repartir.
        </div>
      ) : (<>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 30, flexWrap: 'wrap' }}>
          <Rosco cats={cats} pie={esIngreso ? 'de ingresos al mes' : 'al mes'} />

          <div style={{ flex: 1, minWidth: 340 }}>
            {cats.map((c, i) => {
              const o = base.find(x => x.nombre === c.nombre)
              const dif = c.valor - (o?.valor || 0)
              const tono = TONOS[i % TONOS.length]
              const abierto = !!abierta[c.nombre]
              return (
                <div key={c.nombre} style={{ borderBottom: '1px solid var(--bd)', padding: '7px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: tono, flexShrink: 0 }} />
                    <button onClick={() => setAbierta(a => ({ ...a, [c.nombre]: !abierto }))}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                               fontSize: 10, color: 'var(--n)', flex: 1, textAlign: 'left',
                               display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 7, color: 'var(--grl)', width: 7 }}>{abierto ? '▼' : '▶'}</span>
                      {c.nombre}
                      <span style={{ fontSize: 8, color: 'var(--grl)' }}>{c.conceptos.length}</span>
                    </button>
                    <span style={{ fontSize: 9, color: 'var(--grl)' }}>{Math.round(c.valor / (total || 1) * 100)}%</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--n)', minWidth: 58, textAlign: 'right' }}>{eur(c.valor)}</span>
                    <span style={{ fontSize: 9, minWidth: 50, textAlign: 'right', color: tinte(dif) }}>
                      {dif > 0 ? '+' : ''}{eur(dif)}
                    </span>
                    <Barra tope={topeDe(o?.valor || 0)} valor={c.valor} tono={tono} ancho={110}
                      onMove={(n: number) => aplicar(moverCategoria(cats, c.nombre, n, modo))} />
                  </div>

                  {abierto && (
                    <div style={{ marginTop: 6, marginLeft: 17, paddingLeft: 11, borderLeft: `2px solid ${tono}` }}>
                      {c.conceptos.map(k => {
                        const ko = o?.conceptos.find(x => x.nombre === k.nombre)
                        const kdif = k.valor - (ko?.valor || 0)
                        return (
                          <div key={k.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 9, color: 'var(--gr)', flex: 1 }}>{k.nombre}</span>
                            <span style={{ fontSize: 10, color: 'var(--n)', minWidth: 52, textAlign: 'right' }}>{eur(k.valor)}</span>
                            <span style={{ fontSize: 9, minWidth: 46, textAlign: 'right', color: tinte(kdif) }}>
                              {kdif > 0 ? '+' : ''}{eur(kdif)}
                            </span>
                            <Barra tope={topeDe(ko?.valor || 0)} valor={k.valor} tono={tono} ancho={90}
                              onMove={(n: number) => aplicar(moverConcepto(cats, c.nombre, k.nombre, n, modo))} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: 'var(--bl)', borderRadius: 8, padding: '12px 14px', fontSize: 10,
                      color: 'var(--gr)', lineHeight: 1.7, marginTop: 18 }}>
          {modo === 'repartir' ? (<>
            El total no se mueve: <strong style={{ color: 'var(--n)' }}>{eur(totalOrig)}</strong> al mes de media.
            Lo que le das a una categoría sale de las demás, según lo que pesa cada una.
          </>) : (<>
            Cada categoría va por su cuenta. El total pasa de <strong style={{ color: 'var(--n)' }}>{eur(totalOrig)}</strong>
            {' '}a <strong style={{ color: tinte(total - totalOrig) === 'transparent' ? 'var(--n)' : tinte(total - totalOrig) }}>{eur(total)}</strong> al mes.
          </>)}
          <div style={{ color: 'var(--grl)', marginTop: 5 }}>
            Media de los meses ya cerrados. Abre una categoría para ver sus conceptos: siempre vale lo que suman los suyos.
          </div>
        </div>
      </>)}
    </div>
  )
}
