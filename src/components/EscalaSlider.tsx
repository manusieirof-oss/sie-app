'use client'

/**
 * Una escala de 0 a 10 que admite NO HABER CONTESTADO.
 *
 * El problema no era que faltara una casilla: era que un paciente que no contesta
 * quedaba registrado con el valor por defecto del slider, un 5, indistinguible de un 5
 * dicho de verdad. Ese 5 inventado entra luego en la gráfica, en la media y en el
 * informe, y ya no hay forma de saber cuál es cuál.
 *
 * Es la misma distinción que en los tests entre 'negativo' y 'sin_realizar': "salió
 * limpio" es un hallazgo, "no se lo hice" es un hueco. Aquí, `null` es el hueco.
 *
 * El slider sigue arrancando en 5 a propósito: se decidió que preguntar es lo normal y
 * no contestar la excepción, así que la excepción es la que se marca.
 */
export default function EscalaSlider({
  label, valor, onCambio, color = 'var(--g)', izquierda, derecha, ayuda,
}: {
  label: string
  /** 0-10, o null si no ha contestado. */
  valor: number | null
  onCambio: (v: number | null) => void
  color?: string
  /** Qué significa el 0 y qué el 10. */
  izquierda?: string
  derecha?: string
  ayuda?: string
}) {
  const sinRespuesta = valor === null || valor === undefined
  // Al marcar "no contesta" el slider no desaparece: se apaga. Quitarlo de la vista
  // haría dudar de si el dato se ha perdido, y volver a activarlo tiene que ser un clic.
  const mostrado = sinRespuesta ? 5 : valor

  return (
    <div className="field">
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{label}{!sinRespuesta && ` (${valor}/10)`}</span>
        <span onClick={() => onCambio(sinRespuesta ? 5 : null)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 300, color: sinRespuesta ? 'var(--n)' : 'var(--grl)' }}>
          <span style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            border: `1.5px solid ${sinRespuesta ? 'var(--g)' : 'var(--bd)'}`,
            background: sinRespuesta ? 'var(--g)' : 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {sinRespuesta && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </span>
          No contesta
        </span>
      </label>
      <input type="range" min={0} max={10} value={mostrado} disabled={sinRespuesta}
        onChange={e => onCambio(parseInt(e.target.value))}
        style={{ width: '100%', accentColor: sinRespuesta ? 'var(--bm)' : color, opacity: sinRespuesta ? .45 : 1, cursor: sinRespuesta ? 'default' : 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--grl)' }}>
        <span>{izquierda || '0'}</span>
        <span style={{ fontWeight: 500, color: sinRespuesta ? 'var(--grl)' : color }}>{sinRespuesta ? 'Sin respuesta' : valor}</span>
        <span>{derecha || '10'}</span>
      </div>
      {ayuda && <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 2 }}>{ayuda}</div>}
    </div>
  )
}

/** Lo que se pinta en fichas, informes y resúmenes. Un hueco se dice, no se disimula. */
export function textoEscala(v: number | null | undefined, sufijo = '/10'): string {
  return (v === null || v === undefined) ? 'Sin respuesta' : `${v}${sufijo}`
}
