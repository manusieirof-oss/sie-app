'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { resumenVolumen, type ResumenVolumen as Datos } from '@/lib/volumen'

/**
 * Qué ha entrenado el paciente y qué no, en un periodo.
 *
 * Va como componente y no como pantalla porque tiene dos casas: la ficha del paciente,
 * para mirarlo al revalorar, y el futuro programa de entrenamiento, que es donde se
 * decidirá sobre él. La cuenta vive en `lib/volumen.ts`, así que las dos enseñan lo
 * mismo por construcción.
 *
 * El patrón va ANTES que el músculo a propósito: lo que suele estar desequilibrado no
 * es un músculo suelto sino el gesto —el doble de empuje que de tracción—, y eso por
 * músculo no se ve porque pectoral y dorsal salen parecidos.
 */

const PERIODOS = [
  { semanas: 4, label: '4 semanas' },
  { semanas: 8, label: '8 semanas' },
  { semanas: 12, label: '3 meses' },
  { semanas: 26, label: '6 meses' },
]

export default function ResumenVolumen({ pacienteId, semanasIniciales = 8 }: {
  pacienteId: string
  semanasIniciales?: number
}) {
  const [semanas, setSemanas] = useState(semanasIniciales)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    resumenVolumen(pacienteId, semanas).then(d => { if (vivo) { setDatos(d); setCargando(false) } })
    return () => { vivo = false }
  }, [pacienteId, semanas])

  if (cargando) return <div style={{ fontSize: 13, color: 'var(--gr)', padding: '12px 0' }}>Contando series…</div>
  if (!datos) return null

  const maxPatron = Math.max(1, ...datos.patrones.map(p => p.series))
  const maxMusculo = Math.max(1, ...datos.musculos.map(m => m.series))
  // Los músculos que nunca se han tocado en el periodo se listan aparte y al final:
  // dentro de la lista principal serían treinta ceros tapando los diez que importan.
  const conTrabajo = datos.musculos.filter(m => m.series > 0)
  const sinTrabajo = datos.musculos.filter(m => m.series === 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* El denominador va delante: sin él, alguien que falta la mitad parecería que
            entrena poco por culpa del programa. */}
        <span style={{ fontSize: 13, color: 'var(--gr)' }}>
          <b style={{ color: 'var(--n)', fontWeight: 500 }}>{datos.asistidas}</b> sesiones realizadas
          {datos.perdidas > 0 && <> de {datos.asistidas + datos.perdidas}</>}
          {' · '}{datos.seriesTotales} series
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {PERIODOS.map(p => (
            <button key={p.semanas} type="button" className={`chip-sel ${semanas === p.semanas ? 'on' : ''}`}
              onClick={() => setSemanas(p.semanas)}>{p.label}</button>
          ))}
        </div>
      </div>

      {datos.avisos.length > 0 && (
        <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 14 }}>
          {datos.avisos.map((a, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--n)', lineHeight: 1.6 }}>{a}</div>
          ))}
        </div>
      )}

      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l">Por patrón</span></span>
          <span className="sh-r">qué gesto se ha entrenado</span>
        </div>
        <div style={{ display: 'grid', gap: 7 }}>
          {datos.patrones.map(p => {
            const vacio = p.series === 0
            const flojo = !vacio && p.series * 3 < maxPatron
            const color = vacio || flojo ? 'var(--red)' : 'var(--g)'
            return (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '132px 1fr 52px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: vacio ? 'var(--grl)' : flojo ? 'var(--red)' : 'var(--n)' }}>{p.nombre}</span>
                <span style={{ height: 13, background: 'var(--bm)', borderRadius: 3, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(p.series / maxPatron) * 100}%`, background: color }} />
                </span>
                <span style={{ fontSize: 12, color: vacio ? 'var(--grl)' : 'var(--gr)', textAlign: 'right' }}
                  title={p.sesiones > 0 ? `En ${p.sesiones} sesiones` : 'Sin entrenar'}>{p.series}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sec">
        <div className="sec-h">
          <span className="sh-l"><span className="ct-l">Por músculo</span></span>
          <span className="sh-r">en cuántas series aparece cada zona</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {conTrabajo.map(m => {
            const p = m.series / maxMusculo
            const fondo = p > 0.66 ? 'var(--g)' : p > 0.33 ? 'var(--gm)' : 'var(--gl)'
            const texto = p > 0.66 ? '#fff' : 'var(--gd)'
            return (
              <span key={m.id} title={`${m.series} series en ${m.sesiones} sesiones`}
                style={{ fontSize: 13, padding: '3px 10px', borderRadius: 'var(--r)', background: fondo, color: texto }}>
                {m.nombre} <b style={{ fontWeight: 500 }}>{m.series}</b>
              </span>
            )
          })}
        </div>

        {sinTrabajo.length > 0 && (
          <>
            <div className="et-mini" style={{ margin: '12px 0 6px' }}>Sin tocar en el periodo</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sinTrabajo.map(m => (
                <span key={m.id} style={{ fontSize: 12, padding: '2px 9px', borderRadius: 'var(--r)', border: '1px dashed var(--bd)', color: 'var(--grl)' }}>
                  {m.nombre}
                </span>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: 'var(--grl)', margin: '12px 0 0', lineHeight: 1.6 }}>
          Un ejercicio cuenta entero en cada zona que trabaja, así que estos números no
          suman el total de series. Se cuenta lo realizado, no lo prescrito.
        </p>
      </div>
    </div>
  )
}
