'use client'
import { Ic } from '@/lib/icons'

// Vista de una sesión. Antes había dos modales distintos para lo mismo:
// desde Sesiones se veía con imágenes, series, pesos y notas; desde Historial,
// solo una lista de nombres. Ahora es el mismo, y lo único que cambia son las
// acciones: en Historial estás consultando el pasado, no editándolo.
export default function DetalleSesion({ sesion, objetivos = [], onCerrar, onEditar, onDuplicar, onEliminar }: {
  sesion: any
  objetivos?: any[]
  onCerrar: () => void
  onEditar?: () => void
  onDuplicar?: () => void
  onEliminar?: () => void
}) {
  const hayAcciones = !!(onEditar || onDuplicar || onEliminar)

  const dato = (v: any, txt: string, fondo = 'var(--bm)', color = 'var(--gr)') =>
    v ? <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: fondo, color }}>{txt}</span> : null

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: 'var(--n)' }}>{sesion.nombre}</div>
            {sesion.descripcion && <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 2 }}>{sesion.descripcion}</div>}
            {objetivos.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                {objetivos.map((o: any) => (
                  <span key={o.id} style={{ fontSize: 12, padding: '2px 9px', borderRadius: 99, background: o.color || 'var(--g)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Ic name="objetivo" size={11} /> {o.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        {hayAcciones && (
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6 }}>
            {onEditar && <button className="btn btn-s btn-sm" onClick={onEditar}><Ic name="editar" size={12} /> Editar</button>}
            {onDuplicar && <button className="btn btn-t btn-sm" onClick={onDuplicar}><Ic name="copiar" size={12} /> Duplicar</button>}
            <div style={{ flex: 1 }} />
            {onEliminar && <button className="btn btn-d btn-sm" onClick={onEliminar}><Ic name="papelera" size={12} /> Eliminar</button>}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {(sesion.partes || []).length === 0 && <div className="muted">Esta sesión no tiene ejercicios.</div>}
          {(sesion.partes || []).map((parte: any, pi: number) => (
            <div key={pi} style={{ marginBottom: 12, background: 'var(--bl)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--bd)' }}>
              <div style={{ padding: '8px 13px', borderBottom: '1px solid var(--bm)', fontSize: 13, fontWeight: 500, color: 'var(--n)' }}>
                {parte.nombre || `Parte ${pi + 1}`}
              </div>
              {(parte.ejercicios || []).length === 0
                ? <div style={{ padding: '8px 13px', fontSize: 12, color: 'var(--gr)' }}>Sin ejercicios</div>
                : (parte.ejercicios || []).map((ej: any, ei: number) => {
                    const nombre = typeof ej === 'string' ? ej : (ej.nombre || ej.ejercicio || '')
                    return (
                      <div key={ei} style={{ padding: '10px 13px', borderBottom: '1px solid var(--bl)', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                        {ej.imagen_url && <img src={ej.imagen_url} alt={nombre} style={{ width: 44, height: 44, objectFit: 'contain', background: 'var(--bm)', borderRadius: 5, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: 'var(--n)', marginBottom: 4 }}>{nombre}</div>
                          {typeof ej !== 'string' && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {dato(ej.variante, ej.variante, 'var(--gl)', 'var(--gd)')}
                              {dato(ej.capacidad, ej.capacidad, 'var(--ambl)', '#7A5800')}
                              {dato(ej.series, `${ej.series} series`)}
                              {dato(ej.reps, `${ej.reps} reps`)}
                              {dato(ej.peso, `${ej.peso} kg`)}
                              {dato(ej.tiempo, `${ej.tiempo} seg`)}
                            </div>
                          )}
                          {ej.nota && (
                            <div style={{ fontSize: 12, color: '#7A5800', marginTop: 4, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Ic name="nota" size={12} /> {ej.nota}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
