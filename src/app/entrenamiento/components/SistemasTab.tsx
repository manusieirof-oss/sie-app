'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { esPlantilla } from '@/lib/sesiones'
import { cargarSistemas, borrarSistema, PROGRESIONES, Sistema } from '@/lib/sistemas'
import ModalSistema from './ModalSistema'

// ---------------------------------------------------------------------------
// SISTEMAS Y MÉTODOS · el nivel de arriba de la biblioteca
//
// Ejercicios → sesiones → sistemas. Aquí solo se define el molde: qué fases tiene,
// cómo se pasa de una a otra y qué sesiones propone cada una. A quién se le pone
// y desde cuándo es cosa de la ficha del paciente, no de la biblioteca.
// ---------------------------------------------------------------------------

export default function SistemasTab({ objetivos = [], sesiones = [] }: { objetivos: any[], sesiones: any[] }) {
  const [lista, setLista] = useState<Sistema[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<any>(undefined)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    setLista(await cargarSistemas(false))
    setCargando(false)
  }

  // Solo plantillas: una sesión que ya es de un paciente no es material de molde.
  const plantillas = (sesiones || []).filter(esPlantilla)

  async function eliminar(s: Sistema) {
    if (!confirm(`¿Borrar «${s.nombre}»? Lo que ya se copió a cada paciente se queda como está.`)) return
    const r = await borrarSistema(s.id)
    if (!r.ok) { alert(r.error); return }
    cargar()
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--gr)' }}>
          {cargando ? 'Cargando…' : `${lista.length} sistema${lista.length === 1 ? '' : 's'}`}
        </div>
        <button className="btn btn-p btn-sm" onClick={() => setEditando(null)}>+ Nuevo sistema</button>
      </div>

      {!cargando && lista.length === 0 && (
        <div className="muted">
          Todavía no hay ninguno. Un sistema agrupa sesiones en fases para llegar a algo:
          un embarazo por trimestres, una vuelta de lesión por objetivos, unas oposiciones
          con fecha de examen.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))', gap: 11 }}>
        {lista.map(s => {
          const nSes = (s.fases || []).reduce((a, f) => a + (f.sesiones?.length || 0), 0)
          const prog = PROGRESIONES.find(p => p.valor === s.progresion)
          return (
            <div key={s.id} className="test-clic" onClick={() => setEditando(s)}
              style={{ border: '1px solid var(--bd)', borderRadius: 7, overflow: 'hidden',
                background: 'var(--w)', opacity: s.activo ? 1 : .55 }}>
              <div style={{ height: 4, background: s.color }}/>
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: s.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.icono ? <Ic name={s.icono} size={11}/> : null}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--n)' }}>{s.nombre}</div>
                  <button className="btn btn-s btn-sm" title="Borrar"
                    onClick={e => { e.stopPropagation(); eliminar(s) }}>✕</button>
                </div>
                {s.descripcion && (
                  <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 4, lineHeight: 1.4 }}>
                    {s.descripcion.slice(0, 70)}{s.descripcion.length > 70 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 6 }}>
                  {(s.fases || []).length} fase{(s.fases || []).length === 1 ? '' : 's'} · {nSes} sesion{nSes === 1 ? '' : 'es'}
                </div>
                <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span className="pill pill-o on">{prog?.nombre || s.progresion}</span>
                  {!s.activo && <span className="pill pill-soft">Inactivo</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editando !== undefined && (
        <ModalSistema sistema={editando} objetivos={objetivos} sesiones={plantillas}
          onCerrar={() => setEditando(undefined)} onGuardado={cargar}/>
      )}
    </>
  )
}
