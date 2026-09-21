'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { sinAjustes, resumenAjustes } from '@/lib/ajustesCita'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// LO QUE SE LE FUE CAMBIANDO A ESTA SESIÓN, DÍA A DÍA
//
// La sesión es el plan y no se mueve. Pero a lo largo de dieciséis citas se le
// van tocando cosas —un ejercicio a unilateral, otro con más peso— y hasta ahora
// eso no se veía en ningún sitio: había que abrir cita a cita, o acordarse.
//
// SOLO SE MIRA. Se edita en la cita, desde la ficha del paciente. Dos pantallas
// escribiendo lo mismo acaban discrepando, y aquí lo que hace falta es la foto
// completa: lo que ya pasó y lo que está preparado.
// ---------------------------------------------------------------------------

export default function HistorialAjustes({ sesion, onCerrar }: { sesion: any, onCerrar: () => void }) {
  const [citas, setCitas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const hoy = hoyISO()

  useEffect(() => { cargar() }, [sesion?.id])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('citas')
      .select('id,fecha,hora,estado,ajustes,paciente_id, pacientes(nombre,apellidos,nombre_clinica)')
      .eq('sesion_id', sesion.id).order('fecha')
    setCitas(data || [])
    setCargando(false)
  }

  const nombreDe = (c: any) => {
    const p = Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes
    if (!p) return 'Paciente'
    return (p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`).trim()
  }
  const fechaDe = (f: string) =>
    new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

  // Un solo paciente: su nombre no aporta en cada fila y roba ancho a lo que importa.
  const pacientes = Array.from(new Set(citas.map(c => c.paciente_id)))
  const variosPacientes = pacientes.length > 1
  const conCambios = citas.filter(c => !sinAjustes(c.ajustes)).length

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 780,
                    maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    boxShadow: 'var(--sh-md)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--n)' }}>Cambios día a día · {sesion.nombre}</div>
            <div style={{ fontSize: 10, color: 'var(--gr)', marginTop: 2 }}>
              {cargando ? 'Cargando…'
                : citas.length === 0 ? 'Esta sesión no está en ninguna cita'
                : `${citas.length} citas · ${conCambios} con cambios`}
            </div>
          </div>
          <button onClick={onCerrar} style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--bd)',
            background: 'var(--w)', cursor: 'pointer', fontSize: 13, color: 'var(--gr)' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!cargando && citas.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gr)', padding: 16, textAlign: 'center' }}>
              Cuando la asignes a citas, aquí verás qué se cambió cada día.
            </div>
          )}

          {citas.map(c => {
            const pasada = c.fecha < hoy
            const esHoy = c.fecha === hoy
            const cambios = resumenAjustes(sesion, c.ajustes)
            return (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 10px',
                borderRadius: 7, marginBottom: 4,
                background: esHoy ? 'var(--gl)' : pasada ? 'var(--bl)' : 'transparent',
                border: `1px solid ${esHoy ? 'var(--gm)' : 'transparent'}`,
                opacity: pasada ? .75 : 1 }}>
                <div style={{ width: 96, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--n)', fontWeight: 500 }}>{fechaDe(c.fecha)}</div>
                  <div style={{ fontSize: 10, color: 'var(--grl)' }}>{(c.hora || '').slice(0, 5)}</div>
                </div>
                <div style={{ width: 74, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                    background: esHoy ? 'var(--g)' : c.estado === 'realizada' ? 'var(--gl)' : 'var(--bm)',
                    color: esHoy ? '#fff' : c.estado === 'realizada' ? 'var(--gd)' : 'var(--gr)' }}>
                    {esHoy ? 'hoy' : c.estado === 'realizada' ? '✓ hecha' : c.estado === 'falta' ? 'falta' : pasada ? 'pasada' : 'prevista'}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {variosPacientes && (
                    <div style={{ fontSize: 10, color: 'var(--gr)', marginBottom: 2 }}>{nombreDe(c)}</div>
                  )}
                  {cambios.length === 0
                    ? <span style={{ fontSize: 11, color: 'var(--grl)' }}>Sin cambios</span>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cambios.map((r: any) => (
                          <div key={r.clave} style={{ fontSize: 11, color: 'var(--n)' }}>
                            {r.nombre}
                            {r.cambios.map((x: any, i: number) => (
                              <span key={i} style={{ marginLeft: 7 }}>
                                <span style={{ fontSize: 9, color: 'var(--grl)' }}>{x.campo}</span>{' '}
                                {x.de && <span style={{ color: 'var(--grl)', textDecoration: 'line-through' }}>{x.de}</span>}
                                {' '}<span style={{ color: 'var(--gd)', fontWeight: 500 }}>{x.a || '—'}</span>
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--bd)', fontSize: 10, color: 'var(--grl)', lineHeight: 1.6 }}>
          <Ic name="info" size={11} style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Aquí solo se mira. Los cambios de un día se ponen en la cita, desde la ficha del paciente.
        </div>
      </div>
    </div>
  )
}
