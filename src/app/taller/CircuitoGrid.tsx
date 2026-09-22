'use client'
import { Ic } from '@/lib/icons'
import ChapaEjecucion from './ChapaEjecucion'

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
                <ChapaEjecucion ej={ej} itemMarcado={itemMarcado}
                  onToggle={(ii: number) => toggleItem(pacienteId, ei, ii)}
                  onTodos={(v: boolean) => marcarTodosItems(pacienteId, ei, v)}
                  objetivosLib={objetivosLib} objsPac={objsPac}
                  onObjetivo={(oid: string) => toggleObjetivo(pacienteId, oid, ej.ejercicio_id, ej.nombre)}/>
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
