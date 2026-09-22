'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// UN CIRCUITO, COMO SE HACE: CRUZANDO
//
// En circuito no se acaba un ejercicio y se pasa al siguiente: se da una vuelta
// entera y se vuelve a empezar. Por eso aqui los ejercicios son COLUMNAS y las
// vueltas FILAS — se anota en el orden en que se trabaja, no en el orden en que
// esta escrita la sesion.
//
// Y lo de la vez anterior va DENTRO del hueco, en gris clarito: se lee lo que
// hizo sin gastar una linea, y al escribir encima desaparece solo.
// ---------------------------------------------------------------------------

const FANT = '#C7C3BA'

export default function CircuitoGrid({ pacienteId, ejercicios, mutarSerie, setComent,
  toggleItem, marcarTodosItems, itemMarcado, objetivosLib = [], objsPac = [], toggleObjetivo }: any) {

  const [abierto, setAbierto] = useState<number | null>(null)
  const vueltas = Math.max(1, ...ejercicios.map((o: any) => (o.ej.series || []).length))
  const textoDe = (it: any) => typeof it === 'string' ? it : it?.texto

  const cols = `30px repeat(${ejercicios.length}, minmax(132px, 1fr))`
  const celda = { width: 44, height: 27, fontFamily: 'inherit', fontSize: 12.5, padding: '0 3px',
    textAlign: 'center' as const, border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--n)' }

  const fondo = (hecha: boolean) => hecha
    ? { background: 'var(--gl)', borderColor: 'var(--gm)' }
    : { background: 'var(--w)' }

  return (
    <div style={{ overflowX: 'auto', marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '5px 8px',
        minWidth: 90 + ejercicios.length * 140 }}>

        <div/>
        {ejercicios.map(({ ej, ei }: any) => {
          const items = ej.items || []
          const total = items.length
          const marcados = items.filter((it: any) => itemMarcado(ej.items_evaluados, textoDe(it), 0)).length
          const col = total === 0 ? { background: 'var(--bm)', color: 'var(--gr)' }
            : marcados === 0 ? { background: 'var(--bm)', color: 'var(--gr)' }
            : marcados === total ? { background: 'var(--g)', color: '#fff' }
            : { background: 'var(--amb)', color: '#fff' }
          const tm = ej.tipo_medida || 'peso_reps'
          const unidad = tm === 'tiempo' ? 'segundos' : tm === 'peso_tiempo' ? 'kg · seg' : 'kg × reps'
          return (
            <div key={ei} style={{ textAlign: 'center', paddingBottom: 4 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {ej.imagen_url
                  ? <img src={ej.imagen_url} alt={ej.nombre} style={{ width: 104, height: 104, objectFit: 'contain',
                      background: 'var(--w)', borderRadius: 10, border: '1px solid var(--bd)' }}/>
                  : <div style={{ width: 104, height: 104, background: 'var(--bm)', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
                      <Ic name="fuerza" size={30}/>
                    </div>}
                <button onClick={() => { if (total > 0) setAbierto(abierto === ei ? null : ei) }}
                  title={total === 0 ? 'Sin items de ejecucion' : 'Ejecucion'}
                  style={{ position: 'absolute', right: -5, bottom: -5, minWidth: 36, height: 23, borderRadius: 99,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, fontSize: 10.5,
                    fontWeight: 600, fontFamily: 'inherit', padding: '0 7px', border: '2px solid var(--w)',
                    cursor: total > 0 ? 'pointer' : 'default', boxShadow: '0 1px 5px rgba(38,40,37,.20)', ...col }}>
                  {total === 0 ? '—' : `${marcados}/${total}`}
                </button>

                {abierto === ei && total > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 9px)', left: '50%', transform: 'translateX(-50%)',
                    width: 246, background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 9,
                    boxShadow: '0 10px 28px rgba(38,40,37,.18)', padding: '11px 12px', zIndex: 20, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5, textTransform: 'uppercase' }}>Ejecución</span>
                      <button onClick={() => marcarTodosItems(pacienteId, ei, marcados < total)}
                        style={{ marginLeft: 'auto', fontSize: 8, padding: '2px 8px', borderRadius: 99, cursor: 'pointer',
                          fontFamily: 'inherit', border: '1px solid ' + (marcados === total ? 'var(--g)' : 'var(--bd)'),
                          background: marcados === total ? 'var(--gl)' : 'var(--w)',
                          color: marcados === total ? 'var(--gd)' : 'var(--gr)' }}>
                        {marcados === total ? '✓ Todo correcto' : 'Marcar todo'}
                      </button>
                      <button onClick={() => setAbierto(null)} style={{ fontSize: 12, color: 'var(--gr)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
                    </div>
                    {items.map((it: any, ii: number) => {
                      const cumple = itemMarcado(ej.items_evaluados, textoDe(it), ii)
                      const objs = (it.objetivos || []).map((oid: string) => objetivosLib.find((o: any) => o.id === oid)).filter(Boolean)
                      return (
                        <div key={ii}>
                          <div onClick={() => toggleItem(pacienteId, ei, ii)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                            <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, color: '#fff', fontSize: 11,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1.5px solid ${cumple ? 'var(--g)' : 'var(--bd)'}`,
                              background: cumple ? 'var(--g)' : 'transparent' }}>{cumple ? '✓' : ''}</span>
                            <span style={{ fontSize: 11 }}>{textoDe(it)}</span>
                          </div>
                          {cumple ? null : objs.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '3px 0 4px 25px' }}>
                              {objs.map((o: any) => {
                                const ya = objsPac.some((po: any) => po.objetivo_id === o.id)
                                return (
                                  <span key={o.id} onClick={() => toggleObjetivo(pacienteId, o.id, ej.ejercicio_id, ej.nombre)}
                                    style={{ fontSize: 8, padding: '2px 7px', borderRadius: 99, cursor: 'pointer',
                                      border: '1px solid var(--g)', background: ya ? 'var(--g)' : 'var(--w)',
                                      color: ya ? '#fff' : 'var(--gd)' }}>
                                    {ya ? '✓ ' : '+ '}{o.nombre}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.3 }}>{ej.nombre}</div>
              {ej.variante && <div style={{ fontSize: 8, marginTop: 2 }}><span style={{ padding: '1px 5px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{ej.variante}</span></div>}
              {(() => {
                const pl = ej.plan || {}
                const t: string[] = []
                if (pl.reps) t.push(`${pl.reps} reps`)
                if (pl.tiempo) t.push(`${pl.tiempo}s`)
                if (pl.peso) t.push(`${pl.peso} kg`)
                return t.length > 0 ? <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gd)', marginTop: 2 }}>{t.join(' · ')}</div> : null
              })()}
              <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 3, letterSpacing: .3 }}>{unidad}</div>
            </div>
          )
        })}

        {Array.from({ length: vueltas }).map((_, si) => (
          <div key={'v' + si} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--grl)' }}>
              {si + 1}.ª
            </div>
            {ejercicios.map(({ ej, ei }: any) => {
              const ser = (ej.series || [])[si]
              if (ser == null) return <div key={ei}/>
              const tm = ej.tipo_medida || 'peso_reps'
              const ant = (ej.ultimo || [])[si] || {}
              const hecha = (ser.peso || ser.reps || ser.segundos) ? true : false
              return (
                <div key={ei} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {tm !== 'tiempo' && (
                    <input inputMode="decimal" value={ser.peso || ''} placeholder={ant.peso || '—'}
                      onChange={e => mutarSerie(pacienteId, ei, si, 'peso', e.target.value)}
                      style={{ ...celda, ...fondo(hecha) }}/>
                  )}
                  {tm === 'peso_reps' && <span style={{ fontSize: 10, color: 'var(--bm)' }}>×</span>}
                  {tm === 'peso_reps' && (
                    <input inputMode="numeric" value={ser.reps || ''} placeholder={ant.reps || '—'}
                      onChange={e => mutarSerie(pacienteId, ei, si, 'reps', e.target.value)}
                      style={{ ...celda, ...fondo(hecha) }}/>
                  )}
                  {(tm === 'tiempo' || tm === 'peso_tiempo') && (
                    <input inputMode="numeric" value={ser.segundos || ''} placeholder={ant.segundos || '—'}
                      onChange={e => mutarSerie(pacienteId, ei, si, 'segundos', e.target.value)}
                      style={{ ...celda, ...fondo(hecha) }}/>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        <div/>
        {ejercicios.map(({ ej, ei }: any) => (
          <div key={ei} style={{ marginTop: 9 }}>
            <textarea value={ej.comentario} rows={2} placeholder="Comentario…"
              onChange={e => setComent(pacienteId, ei, e.target.value)}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px' }}
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45, padding: '6px 8px',
                border: '1px solid var(--bd)', borderRadius: 5, minHeight: 42, maxHeight: 120,
                resize: 'vertical', color: 'var(--n)', background: 'var(--w)' }}/>
            {ej.plan?.nota && (
              <div style={{ fontSize: 10, color: '#7A5800', background: 'var(--ambl)', border: '1px solid var(--amb)',
                borderRadius: 6, padding: '5px 8px', marginTop: 5, lineHeight: 1.45, fontStyle: 'italic' }}>
                {ej.plan.nota}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
