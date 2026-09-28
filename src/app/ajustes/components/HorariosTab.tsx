'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarTurnos, guardarTurno, borrarTurno, DIAS, type Turno } from '@/lib/turnos'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// EL HORARIO DE QUIEN DA LAS CLASES
//
// Arriba el patron semanal, que es lo que se pone una vez. Abajo los cambios de
// un dia, que son los que de verdad pasan cada semana y que aqui no ensucian el
// horario fijo.
// ---------------------------------------------------------------------------

const vacio = (): any => ({
  perfil_id: '', dias: [1], fecha: '', hora_inicio: '09:00', hora_fin: '13:00',
  sala: '', desde: '', hasta: '',
})

export default function HorariosTab() {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [salas, setSalas] = useState<string[]>(['A', 'B'])
  const [edit, setEdit] = useState<any>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [t, p, a] = await Promise.all([
      cargarTurnos(),
      supabase.from('perfiles').select('id,nombre,rol').order('nombre'),
      supabase.from('ajustes').select('valor').eq('clave', 'clinica_salas').maybeSingle(),
    ])
    setTurnos(t)
    setPerfiles(p.data || [])
    try { const s = JSON.parse(a.data?.valor || '[]'); if (Array.isArray(s) && s.length) setSalas(s) } catch {}
  }

  /**
   * Una fila por dia elegido. "Lunes y miercoles de 9 a 13" es un turno en la
   * cabeza y dos filas en la tabla; hacerlo al reves obligaba a repetir el
   * formulario entero por cada dia.
   */
  async function guardar(seguir = false) {
    if (!edit.perfil_id) { alert('Elige quién lleva el turno.'); return }
    const dias: number[] = edit.fecha ? [0] : (edit.dias || [])
    if (dias.length === 0) { alert('Elige al menos un día.'); return }
    setGuardando(true)
    for (const d of dias) {
      const r = await guardarTurno({ ...edit, dia_semana: edit.fecha ? null : d })
      if (r.ok === false) { setGuardando(false); alert('No se ha podido guardar: ' + r.error); return }
    }
    setGuardando(false)
    await cargar()
    // Seguir deja puesto quién y qué días: lo que cambia entre tramos son las horas.
    if (seguir) setEdit((p: any) => ({ ...p, id: undefined, hora_inicio: p.hora_fin, hora_fin: '' }))
    else setEdit(null)
  }

  async function quitar(t: Turno) {
    if (confirm('¿Quitar este turno?') === false) return
    await borrarTurno(t.id); cargar()
  }

  const nombre = (t: Turno) => t.perfil?.nombre || perfiles.find(p => p.id === t.perfil_id)?.nombre || '—'
  const hh = (h?: string | null) => String(h || '').slice(0, 5)
  const fijos = turnos.filter(t => t.fecha == null)
  const puntuales = turnos.filter(t => t.fecha != null)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))

  const fila = (t: Turno) => (
    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0',
      borderBottom: '1px solid var(--bl)', fontSize: 12.5 }}>
      <span style={{ flex: 1, minWidth: 0 }}>{nombre(t)}</span>
      <span style={{ color: 'var(--gr)' }}>{hh(t.hora_inicio)}–{hh(t.hora_fin)}</span>
      <span style={{ width: 74, fontSize: 11, color: 'var(--grl)' }}>
        {t.sala ? 'sala ' + t.sala : 'todas'}
      </span>
      <button className="btn btn-s btn-sm" onClick={() => setEdit({ ...t, sala: t.sala || '',
        dias: t.dia_semana ? [t.dia_semana] : [], hora_inicio: String(t.hora_inicio).slice(0,5),
        hora_fin: String(t.hora_fin).slice(0,5),
        fecha: t.fecha || '', desde: t.desde || '', hasta: t.hasta || '' })}>
        <Ic name="editar" size={12}/>
      </button>
      <button className="btn btn-s btn-sm" onClick={() => quitar(t)}>✕</button>
    </div>
  )

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="sh-l"><span className="ct-l"><Ic name="calendario" size={13}/> Horarios</span></span>
        <button className="btn btn-s btn-sm" onClick={() => setEdit(vacio())}>+ Añadir turno</button>
      </div>

      <div className="sec-sub" style={{ marginBottom: 10 }}>
        Quien está en cada franja. Su nombre sale en la agenda y en el taller.
      </div>

      {DIAS.map(d => {
        const suyos = fijos.filter(t => t.dia_semana === d.valor)
        if (suyos.length === 0) return null
        return (
          <div key={d.valor} style={{ marginBottom: 12 }}>
            <div className="et-mini">{d.nombre}</div>
            {suyos.map(fila)}
          </div>
        )
      })}
      {fijos.length === 0 && <div className="muted">Sin horarios. Nadie sale en las clases.</div>}

      {puntuales.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="et-mini">Cambios de un día</div>
          {puntuales.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0',
              borderBottom: '1px solid var(--bl)', fontSize: 12.5 }}>
              <span style={{ width: 96, color: 'var(--gd)' }}>
                {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-ES',
                  { day: 'numeric', month: 'short' })}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{nombre(t)}</span>
              <span style={{ color: 'var(--gr)' }}>{hh(t.hora_inicio)}–{hh(t.hora_fin)}</span>
              <span style={{ width: 74, fontSize: 11, color: 'var(--grl)' }}>
                {t.sala ? 'sala ' + t.sala : 'todas'}
              </span>
              <button className="btn btn-s btn-sm" onClick={() => quitar(t)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="modal" style={{ width: 430 }}>
            <div className="modal-title">
              {edit.id ? 'Editar turno' : 'Nuevo turno'}
              <button className="modal-close" onClick={() => setEdit(null)}>✕</button>
            </div>

            <div className="field"><label>Quién</label>
              <select className="input" value={edit.perfil_id || ''}
                onChange={e => setEdit((p: any) => ({ ...p, perfil_id: e.target.value }))}>
                <option value="">Elige…</option>
                {perfiles.map(p => <option key={p.id} value={p.id}>{p.nombre || p.rol}</option>)}
              </select>
            </div>

            <div className="field"><label>Qué días — puedes marcar varios</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIAS.map(d => {
                  const on = !edit.fecha && (edit.dias || []).includes(d.valor)
                  return (
                    <button key={d.valor} type="button"
                      onClick={() => setEdit((p: any) => ({ ...p, fecha: '',
                        dias: (p.dias || []).includes(d.valor)
                          ? (p.dias || []).filter((x: number) => x !== d.valor)
                          : [...(p.dias || []), d.valor] }))}
                      style={{ fontSize: 12, padding: '5px 11px', borderRadius: 99, cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: on ? 'var(--gl)' : 'transparent',
                        color: on ? 'var(--gd)' : 'var(--gr)',
                        border: `1px solid ${on ? 'var(--gm)' : 'var(--bd)'}` }}>
                      {d.corto}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* UN DIA SUELTO, sin tocar el fijo. Cubrir una baja no puede obligarte
                a reescribir el horario de siempre y acordarte de deshacerlo. */}
            <div className="field"><label>O solo un día concreto</label>
              <input className="input" type="date" value={edit.fecha || ''}
                onChange={e => setEdit((p: any) => ({ ...p, fecha: e.target.value }))}/>
              {edit.fecha && (
                <div style={{ fontSize: 11, color: 'var(--gd)', marginTop: 4 }}>
                  Ese día sustituye al turno fijo de esa sala.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>Desde</label>
                <input className="input" type="time" value={edit.hora_inicio}
                  onChange={e => setEdit((p: any) => ({ ...p, hora_inicio: e.target.value }))}/>
              </div>
              <div className="field" style={{ flex: 1 }}><label>Hasta</label>
                <input className="input" type="time" value={edit.hora_fin}
                  onChange={e => setEdit((p: any) => ({ ...p, hora_fin: e.target.value }))}/>
              </div>
            </div>

            <div className="field"><label>Sala</label>
              <select className="input" value={edit.sala || ''}
                onChange={e => setEdit((p: any) => ({ ...p, sala: e.target.value }))}>
                <option value="">Todas</option>
                {salas.map(s => <option key={s} value={s}>Sala {s}</option>)}
              </select>
            </div>

            {!edit.fecha && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}><label>Vale desde (opcional)</label>
                  <input className="input" type="date" value={edit.desde || ''}
                    onChange={e => setEdit((p: any) => ({ ...p, desde: e.target.value }))}/>
                </div>
                <div className="field" style={{ flex: 1 }}><label>Hasta (opcional)</label>
                  <input className="input" type="date" value={edit.hasta || ''}
                    onChange={e => setEdit((p: any) => ({ ...p, hasta: e.target.value }))}/>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-s" onClick={() => setEdit(null)}>Cancelar</button>
              {/* Un mismo dia suele tener dos tramos, mañana y tarde. Cerrar el modal
                  entre uno y otro obligaba a rellenarlo todo dos veces. */}
              {!edit.id && (
                <button className="btn btn-s" onClick={() => guardar(true)} disabled={guardando}>
                  Guardar y otro tramo
                </button>
              )}
              <button className="btn btn-p" onClick={() => guardar(false)} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
