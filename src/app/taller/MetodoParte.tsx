'use client'
import { useRef, useState } from 'react'
import { Ic } from '@/lib/icons'
import Flotante from './Flotante'
import { MODOS_PARTE, modoParte } from '@/lib/sesiones'
import { textoDescanso } from '@/lib/capacidades'
import { CAMPOS_METODO, valoresDeParte, letrasGrupos, type ValoresMetodo } from '@/lib/metodos'

// ---------------------------------------------------------------------------
// EL MÉTODO DE UNA PARTE, SOBRE SU FRANJA
//
// Se ve siempre, como una frase: el modo, las series (o vueltas) y los descansos de ESE
// modo. Quien puede cambiar ejercicios (nivel 2 en adelante) tiene un lápiz al lado: abre
// un panel con el modo y sus números, y se elige si vale solo hoy o para su sesión.
//
// Al pasar a otro modo, los números salen de Ajustes → Entrenador (valores de partida
// de cada método); al volver al suyo, los que traía.
// ---------------------------------------------------------------------------

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, padding: '3px 10px', borderRadius: 99,
  border: '1px solid transparent', background: 'transparent', fontFamily: 'inherit', whiteSpace: 'nowrap',
}

function valorTexto(seg: boolean | undefined, v?: string) {
  if (!seg) return v || '—'
  const t = textoDescanso(v || '')
  return t || 'sin pausa'
}

export default function MetodoParte({ parte, puede, defectos, onAplicar }: {
  parte: any
  puede: boolean
  defectos: Record<string, ValoresMetodo>
  onAplicar: (modo: string, v: ValoresMetodo, alcance: 'hoy' | 'siempre') => Promise<void> | void
}) {
  const ancla = useRef<HTMLSpanElement>(null)
  const [abierto, setAbierto] = useState(false)
  const modo0 = modoParte(parte?.modo).id
  const actuales = valoresDeParte(parte)
  const [modo, setModo] = useState<string>(modo0)
  const [v, setV] = useState<ValoresMetodo>(actuales)
  const [guardando, setGuardando] = useState(false)
  /* SUPERSERIES: de cuántos en cuántos van los ejercicios, por orden (2 = parejas A A B B,
     3 = tríos…). Sale de cómo están agrupados ahora; si no lo están, por parejas. */
  const nEj = (parte?.ejercicios || []).length
  const tamActual = () => {
    const g = valoresDeParte(parte).grupos || ''
    const n = g.split('').filter(x => x === (g[0] || 'A')).length
    return modo0 === 'superserie' && new Set(g.split('')).size > 1 ? Math.max(1, n) : 2
  }
  const [tamGrupo, setTamGrupo] = useState(tamActual)

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!puede) return
    setModo(modo0); setV(valoresDeParte(parte)); setTamGrupo(tamActual()); setAbierto(a => !a)
  }
  const cambiarModo = (m: string) => {
    setModo(m)
    // Al suyo, con lo que traía; a otro, con los de partida de Ajustes (lo que haya
    // en blanco en los de partida se queda como estaba).
    if (m === modo0) setV(valoresDeParte(parte))
    else setV({ ...valoresDeParte(parte), ...Object.fromEntries(Object.entries(defectos[m] || {}).filter(([, x]) => x !== '' && x != null)) })
  }
  const mover = (k: keyof ValoresMetodo, paso: number) => {
    const n = Math.max(0, (parseInt(v[k] || '0') || 0) + paso)
    setV(p => ({ ...p, [k]: String(n) }))
  }
  const aplicar = async (alcance: 'hoy' | 'siempre') => {
    setGuardando(true)
    // Solo los campos de ESE modo: lo demás no se toca.
    const campos = CAMPOS_METODO[modo] || []
    const out: ValoresMetodo = {}
    campos.forEach(c => { out[c.k] = v[c.k] ?? '' })
    if (modo === 'tiempo') out.tipo_tiempo = v.tipo_tiempo || 'emom'
    if (modo === 'superserie') out.grupos = letrasGrupos(nEj, tamGrupo)
    await onAplicar(modo, out, alcance)
    setGuardando(false); setAbierto(false)
  }

  // LO QUE SE VE EN LA FRANJA: una frase, no un botón por dato. «Circuito · 2 vueltas ·
  // 15 s entre ejercicios». Las pausas a cero se dicen una vez («sin pausas»).
  const campos0 = CAMPOS_METODO[modo0] || []
  const md0 = modoParte(modo0)
  const numeros = campos0.filter(c => !c.seg && actuales[c.k])
  const pausas = campos0.filter(c => c.seg && (parseInt(actuales[c.k] || '0') || 0) > 0)
  const hayPausas = campos0.some(c => c.seg)

  return (
    <>
      <span style={{ fontSize: 13, color: 'var(--gr)' }}>
        {md0.nombre}
        {numeros.map(c => <span key={c.k}> · <b style={{ color: 'var(--n)', fontWeight: 500 }}>{actuales[c.k]} {c.nombre.toLowerCase()}</b></span>)}
        {pausas.map(c => <span key={c.k}> · <b style={{ color: 'var(--n)', fontWeight: 500 }}>{textoDescanso(actuales[c.k] || '')}</b> {c.nombre.toLowerCase()}</span>)}
        {hayPausas && pausas.length === 0 && <span> · sin pausas</span>}
      </span>
      {puede && (
        <span ref={ancla} role="button" onClick={abrir} title="Cambiar el método, las series o los descansos"
          style={{ width: 30, height: 30, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: 'var(--gr)', flexShrink: 0 }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>
        </span>
      )}

      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={330}>
        <div onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 6 }}>Método</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {MODOS_PARTE.map(m => (
              <button key={m.id} onClick={() => cambiarModo(m.id)} title={m.ayuda}
                style={{ ...chip, cursor: 'pointer', border: `1.5px solid ${modo === m.id ? 'var(--gd)' : 'var(--bd)'}`,
                  background: modo === m.id ? 'var(--gl)' : 'var(--w)', color: modo === m.id ? 'var(--gd)' : 'var(--gr)', fontWeight: modo === m.id ? 600 : 400 }}>
                <Ic name={m.icono} size={12}/> {m.nombre}
              </button>
            ))}
          </div>
          {(CAMPOS_METODO[modo] || []).map(c => (
            <div key={c.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid var(--bl)' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--n)' }}>{c.nombre}</span>
              <button onClick={() => mover(c.k, -c.paso)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--w)', cursor: 'pointer', fontSize: 16 }}>−</button>
              <span style={{ minWidth: 64, textAlign: 'center', fontSize: 13.5, fontWeight: 600 }}>{valorTexto(c.seg, v[c.k])}</span>
              <button onClick={() => mover(c.k, c.paso)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--w)', cursor: 'pointer', fontSize: 16 }}>+</button>
            </div>
          ))}
          {modo === 'superserie' && nEj > 1 && (
            <div style={{ padding: '5px 0', borderTop: '1px solid var(--bl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--n)' }}>Grupos de</span>
                <button onClick={() => setTamGrupo(t => Math.max(2, t - 1))} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--w)', cursor: 'pointer', fontSize: 16 }}>−</button>
                <span style={{ minWidth: 64, textAlign: 'center', fontSize: 13.5, fontWeight: 600 }}>{tamGrupo === 2 ? 'parejas' : tamGrupo === 3 ? 'tríos' : `${tamGrupo}`}</span>
                <button onClick={() => setTamGrupo(t => Math.min(nEj, t + 1))} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--bd)', background: 'var(--w)', cursor: 'pointer', fontSize: 16 }}>+</button>
              </div>
              {/* Cómo quedan, en el orden de la parte. */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {(parte?.ejercicios || []).map((e: any, i: number) => (
                  <span key={i} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'var(--gl)', color: 'var(--gd)' }}>
                    <b>{letrasGrupos(nEj, tamGrupo)[i]}</b> {String(e.nombre || '').split(' ').slice(0, 2).join(' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="btn btn-s btn-sm" onClick={() => setAbierto(false)}>Cancelar</button>
            <span style={{ flex: 1 }}/>
            <button className="btn btn-s btn-sm" disabled={guardando} onClick={() => aplicar('hoy')} title="Solo esta clase: su sesión no cambia">Solo hoy</button>
            <button className="btn btn-p btn-sm" disabled={guardando} onClick={() => aplicar('siempre')} title="Cambia su sesión para las próximas clases">Para siempre</button>
          </div>
        </div>
      </Flotante>
    </>
  )
}
