'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarSistema } from '@/lib/sistemas'
import { medidasDeObjetivo, escalonDe, direccionDe, ponerMeta, type Medida } from '@/lib/metasVia'

/**
 * HASTA DÓNDE TIENE QUE LLEGAR EN CADA FASE.
 *
 * Es el único momento en que tienes en la misma pantalla las fases del ciclo y el
 * punto de partida del paciente, y por eso se pregunta aquí y no en la valoración:
 * allí tienes la partida pero te faltan el horizonte y la dosis, y veinte
 * repeticiones no significan nada si no sabes si es para diciembre o para marzo.
 *
 * Poner «20» es otra cosa cuando tienes delante que hoy hace 8. De ahí la columna
 * de la partida.
 *
 * SE PUEDE SALTAR. El ciclo se asigna igual y los escalones se ponen después desde
 * cada objetivo: es el mismo sitio, solo que de uno en uno.
 */

const cab: any = {
  fontSize: 9.5, fontWeight: 600, color: 'var(--grl)', letterSpacing: '.4px',
  textTransform: 'uppercase', padding: '0 8px 7px', verticalAlign: 'bottom',
  borderBottom: '1px solid var(--bd)',
}

type Fila = {
  objetivo: any
  medidas: Medida[]
}

export default function EscalonesAsignar({ pacienteId, sistemaId, onHecho }: {
  pacienteId: string
  /** La COPIA del paciente, no el molde: sus fases son las que se van a cerrar. */
  sistemaId: string
  onHecho: () => void
}) {
  const [fases, setFases] = useState<any[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [valores, setValores] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { montar() }, [sistemaId])

  async function montar() {
    setCargando(true)
    const sis = await cargarSistema(sistemaId)
    const fs = sis?.fases || []
    setFases(fs)

    const ids = Array.from(new Set(fs.flatMap((f: any) => f.objetivos || []))) as string[]
    if (ids.length === 0) { setFilas([]); setCargando(false); return }

    const [{ data: suyos }, { data: tests }, { data: objs }] = await Promise.all([
      supabase.from('pacientes_objetivos').select('objetivo_id,nombre,vias')
        .eq('paciente_id', pacienteId).in('objetivo_id', ids),
      supabase.from('tests').select('*'),
      supabase.from('objetivos').select('id,nombre,imagen_url').in('id', ids),
    ])

    const out: Fila[] = []
    const ya: Record<string, string> = {}
    for (const po of (suyos || [])) {
      const dela = (objs || []).find((o: any) => o.id === po.objetivo_id)
      const o = { ...po, id: po.objetivo_id, nombre: po.nombre || dela?.nombre || 'Objetivo',
        imagen_url: dela?.imagen_url || null }
      const medidas = await medidasDeObjetivo(pacienteId, o, tests || [])
      // Lo que ya estuviera puesto se muestra, no se pisa: reabrir esta pantalla no
      // puede borrar los escalones de una asignación anterior.
      medidas.forEach(m => fs.forEach((f: any) => {
        const e = escalonDe(o, m.ref, m.lado, f.id)
        if (e) ya[o.id + '·' + m.clave + '·' + f.id] = String(e.hasta)
      }))
      out.push({ objetivo: o, medidas })
    }
    setValores(v => ({ ...ya, ...v }))
    setFilas(out)
    setCargando(false)
  }

  async function guardar() {
    setGuardando(true)
    for (const fila of filas) {
      for (const m of fila.medidas) {
        for (const f of fases) {
          const k = fila.objetivo.id + '·' + m.clave + '·' + f.id
          const txt = (valores[k] || '').trim()
          if (txt === '') continue
          const n = Number(txt.replace(',', '.'))
          if (Number.isFinite(n) === false) continue
          const r: any = await ponerMeta(pacienteId, fila.objetivo.id, {
            ref: m.ref,
            etiqueta: 'Meta: ' + (m.test.nombre || 'test') + ' · ' + (m.item?.nombre || ''),
            item: m.item?.nombre || '',
            unidad: m.unidad || null,
            lado: m.lado,
            partida: m.hoy,
            partida_fecha: m.fechaHoy,
            hasta: n,
            dir: direccionDe(m.item),
            fase_id: f.id,
            fecha_resuelto: null,
          } as any)
          if (r.ok === false) { setGuardando(false); alert('No se ha podido guardar: ' + r.error); return }
        }
      }
    }
    setGuardando(false)
    onHecho()
  }

  const conEscalon = filas.filter(f =>
    f.medidas.some(m => fases.some((x: any) => (valores[f.objetivo.id + '·' + m.clave + '·' + x.id] || '').trim() !== ''))).length
  const medibles = filas.filter(f => f.medidas.length > 0).length

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onHecho() }}>
      <div className="modal" style={{ width: 'min(880px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">
          Hasta dónde tiene que llegar en cada fase
          <button className="modal-close" onClick={onHecho}><Ic name="cerrar" size={15}/></button>
        </div>

        {cargando ? <div className="muted" style={{ padding: 20 }}>Cargando…</div>
          : filas.length === 0 ? (
            <div className="muted" style={{ padding: '14px 0' }}>
              Este ciclo no persigue ningún objetivo que el paciente lleve, así que no hay
              nada a lo que ponerle número.
            </div>
          ) : (
          <>
            {/* Las cabeceras NO llevan `et-mini`: esa clase es `display:inline-flex` y en un
                `th` revienta la tabla —las columnas dejaban de cuadrar con las casillas—. */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...cab, textAlign: 'left' }}>Objetivo y con qué se mide</th>
                  <th style={{ ...cab, textAlign: 'left', width: 96 }}>Hoy está en</th>
                  {fases.map((f: any, i: number) => (
                    <th key={f.id} style={{ ...cab, textAlign: 'center', width: 112 }}>
                      <span style={{ display: 'block' }}>Fase {i + 1}</span>
                      {/* Sin repetir el número: casi todas las fases ya se llaman «Fase 2 ·
                          algo», y arriba ya lo pone. Se queda solo lo que añade. */}
                      {(() => {
                        const n = String(f.nombre || '')
                          .replace(/^\s*fase\s*\d*\s*[-·:.]?\s*/i, '').trim()
                        if (n === '') return null
                        return (
                          <span style={{ display: 'block', fontWeight: 400, textTransform: 'none',
                            letterSpacing: 0, fontSize: 10.5, color: 'var(--grl)' }}>{n}</span>
                        )
                      })()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map(fila => fila.medidas.length === 0 ? (
                  /* SIN NÚMERO no hay meta posible, pero sale igual: el ciclo también lo
                     persigue, y esconderlo haría pensar que no cuenta. */
                  <tr key={fila.objetivo.id}>
                    <td style={{ padding: '9px 8px', borderTop: '1px solid var(--bd2)' }}>
                      <span style={{ fontSize: 12.5 }}>{fila.objetivo.nombre}</span>
                    </td>
                    <td colSpan={fases.length + 1} style={{ padding: '9px 8px', borderTop: '1px solid var(--bd2)',
                      fontSize: 11.5, color: 'var(--grl)', fontStyle: 'italic' }}>
                      No se mide con un número: se cierra cuando su test salga limpio.
                    </td>
                  </tr>
                ) : fila.medidas.map((m, mi) => (
                  <tr key={fila.objetivo.id + m.clave}>
                    <td style={{ padding: '9px 8px', borderTop: '1px solid var(--bd2)' }}>
                      {mi === 0 && <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{fila.objetivo.nombre}</div>}
                      <div style={{ fontSize: 11, color: 'var(--gd)', lineHeight: 1.3 }}>
                        {m.test.nombre} · {m.item?.nombre}
                        {m.lado && m.lado !== 'bilateral' ? ' · ' + m.lado : ''}
                      </div>
                    </td>
                    <td style={{ padding: '9px 8px', borderTop: '1px solid var(--bd2)' }}>
                      {m.hoy != null ? (
                        <>
                          <div style={{ fontSize: 15, lineHeight: 1.2 }}>
                            {m.hoy} <span style={{ fontSize: 10.5, color: 'var(--grl)' }}>{m.unidad}</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--grl)' }}>
                            {m.fechaHoy ? new Date(m.fechaHoy + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                          </div>
                        </>
                      ) : <span style={{ fontSize: 11, color: '#8A6410' }}>sin medir</span>}
                    </td>
                    {fases.map((f: any) => {
                      const k = fila.objetivo.id + '·' + m.clave + '·' + f.id
                      const ultima = f.id === fases[fases.length - 1]?.id
                      return (
                        <td key={f.id} style={{ padding: '9px 8px', borderTop: '1px solid var(--bd2)' }}>
                          {/* La unidad pegada a la casilla: sin ella no se sabe si son
                              centímetros, grados o repeticiones, y cambia por fila. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <input className="input" type="text" inputMode="decimal" placeholder="—"
                              title={`${fila.objetivo.nombre} · ${m.item?.nombre} · ${f.nombre}`}
                              style={{ width: 54, padding: '4px 5px', fontSize: 13, textAlign: 'center',
                                borderColor: ultima ? 'var(--gm)' : undefined,
                                background: ultima ? 'var(--gl)' : undefined }}
                              value={valores[k] || ''}
                              onChange={e => setValores(v => ({ ...v, [k]: e.target.value }))}/>
                            <span style={{ fontSize: 10.5, color: 'var(--grl)' }}>{m.unidad}</span>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )))}
              </tbody>
            </table>

            <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 8, lineHeight: 1.6 }}>
              La última columna es la meta final —por eso va marcada—; las de en medio son el
              camino. {fases.length > 0 && `Al llegar al número de una fase se sale de ella, aunque la meta final siga lejos.`}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--ambl)',
              border: '1px solid var(--amb)', borderRadius: 7, padding: '8px 11px', fontSize: 11.5,
              color: '#7A5800', lineHeight: 1.55, marginTop: 13 }}>
              <Ic name="alerta" size={12}/>
              <span>Puedes dejarlo en blanco y ponerlo más tarde desde el objetivo. Una fase sin
                escalón se cierra como hasta ahora, cuando su test dé limpio.</span>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--gr)' }}>
            {medibles > 0 && `${conEscalon} de ${medibles} objetivos con escalones.`}
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn btn-s" onClick={onHecho} disabled={guardando}>Saltar</button>
          <button className="btn btn-p" onClick={guardar} disabled={guardando || cargando}>
            {guardando ? 'Guardando…' : 'Guardar los escalones'}
          </button>
        </div>
      </div>
    </div>
  )
}
