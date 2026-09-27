'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import EvaluacionFase from './EvaluacionFase'
import { finPrevisto, faseEn, PROGRESIONES, Sistema, Asignacion } from '@/lib/sistemas'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// UN SISTEMA DEL PACIENTE, EN UNA TARJETA
//
// Fuera solo va lo que se mira de un vistazo: color, nombre, en que fase va y
// los puntitos del camino. Todo lo demas -fechas, sesiones que propone, quien
// pinta las citas, la evaluacion y los botones que cambian algo- vive dentro,
// al pulsarla. Antes eran dos filas por sistema y seis iconos sin etiqueta
// colgando a la derecha; con dos sistemas ya no se leia.
// ---------------------------------------------------------------------------

const corto = (iso: string) => new Date(iso + 'T12:00:00')
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const largo = (iso: string) => new Date(iso + 'T12:00:00')
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const dia = (iso: string) => new Date(iso + 'T12:00:00')
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function TarjetaSistema({ pacienteId, a, logrados, escalones, varios,
  evaluaciones, trayendo, onTraer, onMarco, onFechas, onEditarSistema, onQuitar, onRecargar }: {
  pacienteId: string
  a: Asignacion
  logrados: Record<string, string | null>
  escalones?: Record<string, string | null>
  /** Lleva mas de un sistema: solo entonces tiene sentido decir cual pinta las citas. */
  varios: boolean
  evaluaciones: Record<string, { id: string, fecha: string | null }>
  trayendo: string
  onTraer: (faseId: string, ids: string[]) => void
  onMarco: () => void
  onFechas: () => void
  onEditarSistema: () => void
  onQuitar: () => void
  onRecargar?: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const s: Sistema | undefined = (a as any).sistema
  if (!s) return null

  const hoy = hoyISO()
  const fases = s.fases || []
  const t = faseEn(s, a, hoy, logrados, escalones)
  const i = t ? fases.findIndex(f => f.id === t.fase.id) : -1

  /**
   * TODAVIA NO HA EMPEZADO. `faseEn` no devuelve nada antes de la fecha de
   * inicio y con razon, pero entonces la tarjeta no decia ni que arrancaba el
   * dia 30 ni dejaba programar la evaluacion de la primera fase.
   */
  const porEmpezar = t == null && a.fecha_inicio != null && hoy < a.fecha_inicio
  const primeraFase = porEmpezar
    ? fases[Math.max(0, Math.min(Number((a as any).fase_inicial) || 0, fases.length - 1))]
    : null
  const faseViva = t ? t.fase : primeraFase
  const iViva = faseViva ? fases.findIndex(f => f.id === faseViva.id) : -1

  const ev = faseViva ? evaluaciones[a.id + '|' + faseViva.id] : undefined
  const fin = finPrevisto(s, a)
  const cerrado = s.progresion === 'fecha_fin'
  const prog = PROGRESIONES.find(p => p.valor === s.progresion)
  const proponen = t ? (t.fase.sesiones || []) : []

  const pie = t
    ? `${t.fase.nombre}${iViva >= 0 && fases.length > 1 ? ` · ${iViva + 1} de ${fases.length}` : ''}`
    : porEmpezar ? `Empieza el ${dia(a.fecha_inicio as string)}` : 'Fuera de fase'

  return (
    <>
      <div onClick={() => setAbierto(true)} title={s.nombre}
        style={{ aspectRatio: '1 / 1', border: '1px solid var(--bd)', borderRadius: 10,
          background: 'var(--w)', overflow: 'hidden', cursor: 'pointer', position: 'relative',
          display: 'flex', flexDirection: 'column', opacity: porEmpezar ? .72 : 1 }}>
        <div style={{ height: 4, background: s.color, flexShrink: 0 }}/>

        {varios && (a as any).principal === true && (
          <span style={{ position: 'absolute', top: 9, right: 9, fontSize: 9.5, letterSpacing: '.4px',
            textTransform: 'uppercase', color: 'var(--gd)', background: 'var(--gl)',
            border: '1px solid var(--gm)', borderRadius: 99, padding: '2px 8px' }}>marco</span>
        )}
        {ev && !(varios && (a as any).principal === true) && (
          <span style={{ position: 'absolute', top: 9, right: 9, fontSize: 10, whiteSpace: 'nowrap',
            color: 'var(--ambt)', background: 'var(--ambl)', border: '1px solid var(--amb)',
            borderRadius: 99, padding: '2px 8px' }}>
            {ev.fecha ? `eval. ${dia(ev.fecha)}` : 'evaluación'}
          </span>
        )}

        <div style={{ flex: 1, padding: '12px 13px 11px', display: 'flex', flexDirection: 'column',
          minHeight: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: s.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            marginBottom: 9 }}>
            {s.icono ? <Ic name={s.icono} size={14}/> : null}
          </span>
          <div style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--n)', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.nombre}</div>
          <div style={{ flex: 1, minHeight: 6 }}/>
          <div style={{ fontSize: 11, color: 'var(--gr)', lineHeight: 1.35, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pie}</div>
          {fin && (
            <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 2 }}>
              {cerrado ? 'termina el' : 'posible fin'} {dia(fin)}
            </div>
          )}
          {fases.length > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 9 }}>
              {fases.map((f, k) => (
                <i key={f.id} style={{ height: 3, flex: 1, borderRadius: 99,
                  background: iViva >= 0 && k <= iViva ? s.color : 'var(--bm)' }}/>
              ))}
            </div>
          )}
        </div>
      </div>

      {abierto && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setAbierto(false) }}>
          <div style={{ background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 12,
            width: '94vw', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: 'var(--sh-md)' }}>

            <div style={{ padding: '14px 17px', borderBottom: '1px solid var(--bd)', display: 'flex',
              alignItems: 'center', gap: 11 }}>
              <span style={{ width: 34, height: 34, borderRadius: 8, background: s.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icono ? <Ic name={s.icono} size={15}/> : null}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}>{s.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--gr)' }}>
                  {prog?.nombre || s.progresion} · {fases.length} fase{fases.length === 1 ? '' : 's'} · suyo, no toca la biblioteca
                </div>
              </div>
              <button className="modal-close" onClick={() => setAbierto(false)}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '15px 17px' }}>
              {fases.length > 0 && (
                <>
                  <div className="ct-l" style={{ marginBottom: 8 }}>Por dónde va</div>
                  <div style={{ display: 'flex' }}>
                    {fases.map((f, k) => {
                      const hecha = iViva >= 0 && k < iViva
                      const ahora = k === iViva
                      const linea = hecha || ahora ? s.color : 'var(--bm)'
                      return (
                        <div key={f.id} style={{ flex: 1, textAlign: 'center', position: 'relative',
                          paddingTop: 19 }}>
                          <span style={{ position: 'absolute', top: 6, left: k === 0 ? '50%' : 0,
                            right: k === fases.length - 1 ? '50%' : 0, height: 2, background: linea }}/>
                          <span style={{ position: 'absolute', top: 0, left: '50%', marginLeft: -7,
                            width: 14, height: 14, borderRadius: '50%', border: `2px solid ${hecha || ahora ? s.color : 'var(--bm)'}`,
                            background: hecha ? s.color : 'var(--w)',
                            boxShadow: ahora ? `0 0 0 3px ${s.color}30` : undefined }}/>
                          <span style={{ display: 'block', fontSize: 11, lineHeight: 1.35, padding: '0 4px',
                            color: ahora ? 'var(--n)' : 'var(--grl)' }}>{f.nombre}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="ct-l" style={{ margin: '17px 0 8px' }}>La ficha</div>
              <Fila k="Empezó" v={a.fecha_inicio ? largo(a.fecha_inicio) : 'sin fecha'}/>
              <Fila k={cerrado ? 'Termina' : 'Posible fin'}
                v={fin ? largo(fin) : (s.progresion === 'objetivos' ? 'sin fecha — avanza por objetivos' : 'le faltan fechas')}/>
              {proponen.length > 0 && (
                <Fila k="Esta fase propone" v={
                  <>
                    {proponen.length} sesion{proponen.length === 1 ? '' : 'es'}
                    <button className="btn btn-s btn-sm" style={{ marginLeft: 6 }}
                      disabled={trayendo === (t as any)?.fase?.id}
                      title="Copia a su ficha las sesiones que propone esta fase"
                      onClick={() => onTraer((t as any).fase.id, proponen)}>
                      {trayendo === (t as any)?.fase?.id ? '…' : `traer ${proponen.length}`}
                    </button>
                  </>
                }/>
              )}
              {varios && (
                <Fila k="Pinta las citas" v={(a as any).principal === true
                  ? 'sí, es el marco'
                  : <>no <button className="btn btn-s btn-sm" style={{ marginLeft: 6 }}
                      onClick={onMarco}>hacer marco</button></>}/>
              )}

              {faseViva && (
                <>
                  <div className="ct-l" style={{ margin: '17px 0 8px' }}>
                    Para salir de {faseViva.nombre}
                  </div>
                  {porEmpezar && (
                    <div style={{ fontSize: 11, color: 'var(--gr)', marginBottom: 7 }}>
                      Todavía no está en ninguna fase: empieza el {largo(a.fecha_inicio as string)}.
                    </div>
                  )}
                  <EvaluacionFase pacienteId={pacienteId} asignacion={a} fase={faseViva}
                    color={s.color} onCambio={onRecargar}/>
                </>
              )}
            </div>

            <div style={{ padding: '12px 17px', borderTop: '1px solid var(--bd)', display: 'flex',
              gap: 7, alignItems: 'center', flexWrap: 'wrap', background: 'var(--bl)' }}>
              {/* Cerrar antes de abrir: los dos modales que vienen de aqui los pinta
                  la rejilla, que va despues en el DOM, asi que saldrian por detras. */}
              <button className="btn btn-s btn-sm" onClick={() => { setAbierto(false); onFechas() }}>
                <Ic name="calendario" size={12}/> Fechas y fase
              </button>
              <button className="btn btn-s btn-sm" onClick={() => { setAbierto(false); onEditarSistema() }}>
                <Ic name="editar" size={12}/> Editar el sistema
              </button>
              <div style={{ flex: 1 }}/>
              <button className="btn btn-s btn-sm" style={{ borderColor: 'var(--bd)', color: 'var(--gr)' }}
                onClick={() => { setAbierto(false); onQuitar() }}>Quitárselo</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Fila({ k, v }: { k: string, v: any }) {
  return (
    <div style={{ display: 'flex', gap: 7, fontSize: 12, padding: '5px 0',
      borderBottom: '1px solid var(--bd2, var(--bl))' }}>
      <span style={{ width: 128, flexShrink: 0, color: 'var(--gr)', fontSize: 11.5 }}>{k}</span>
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>{v}</span>
    </div>
  )
}
