'use client'
import { useState } from 'react'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { Ic } from '@/lib/icons'
import { nombreMedida } from '@/lib/ejercicios'
import { agrupaPorRaiz } from '@/lib/etiquetas'

// ---------------------------------------------------------------------------
// LA BIBLIOTECA, SOLO PARA MIRAR (nivel 2).
//
// El entrenador tiene que poder consultar los ejercicios —cómo se hacen, en qué fijarse,
// qué variantes hay— sin poder tocarlos: cambiar uno lo cambia para todas las sesiones
// que lo usan. Es la misma rejilla de siempre; al tocar un ejercicio se abre su ficha
// para leer, sin campos que editar.
// ---------------------------------------------------------------------------

const lista = (x: any): string[] => (Array.isArray(x) ? x : String(x || '').split('\n'))
  .map((t: any) => String(typeof t === 'object' ? (t?.texto || t?.nombre || '') : t).trim()).filter(Boolean)

export default function BibliotecaVer({ ejercicios, etiquetas }: { ejercicios: any[], etiquetas: any[] }) {
  const [viendo, setViendo] = useState<any>(null)
  const familia = viendo ? ejercicios.filter(e => e.portada_id === (viendo.portada_id || viendo.id) || e.id === (viendo.portada_id || viendo.id)) : []
  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', background: 'var(--bl)', borderRadius: 10, padding: '8px 12px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic name="ojo" size={14}/> Para consultar: toca un ejercicio para ver cómo se hace. Cambiarlo es cosa del encargado/a.
      </div>
      <ExploradorEjercicios ejercicios={ejercicios} etiquetas={etiquetas} botonCrear={false} onAbrir={setViendo}/>

      {viendo && (
        <div className="modal-bg" style={{ zIndex: 150 }} onClick={e => { if (e.target === e.currentTarget) setViendo(null) }}>
          <div className="modal" style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-title">
              {viendo.nombre}
              <button className="modal-close" onClick={() => setViendo(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 260px) 1fr', gap: 18 }}>
              <div style={{ borderRadius: 14, overflow: 'hidden' }}>
                <ImagenEjercicio src={viendo.imagen_url} ejercicioId={viendo.id} etiquetasEj={viendo.etiquetas || []} radio={14} icono={40} alt={viendo.nombre}/>
                {viendo.video_url && <a href={viendo.video_url} target="_blank" rel="noreferrer" className="btn btn-s btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                  <Ic name="play" size={12}/> Ver vídeo</a>}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--n)', lineHeight: 1.55 }}>
                <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 8 }}>{nombreMedida(viendo.tipo_medida)}</div>
                {viendo.descripcion && <p style={{ margin: '0 0 12px' }}>{viendo.descripcion}</p>}
                {lista(viendo.items_ejecucion).length > 0 && <>
                  <div className="et-mini" style={{ marginBottom: 4 }}>Cómo se hace bien</div>
                  <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>{lista(viendo.items_ejecucion).map((t, i) => <li key={i}>{t}</li>)}</ul>
                </>}
                {lista(viendo.feedbacks).length > 0 && <>
                  <div className="et-mini" style={{ marginBottom: 4 }}>Qué decirle</div>
                  <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>{lista(viendo.feedbacks).map((t, i) => <li key={i}>{t}</li>)}</ul>
                </>}
                {(viendo.variantes || []).length > 0 && <>
                  <div className="et-mini" style={{ marginBottom: 4 }}>Variantes</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                    {(viendo.variantes || []).map((v: any, i: number) => <span key={i} className="badge badge-g" title={v?.descripcion || undefined}>{v?.nombre}</span>)}
                  </div>
                </>}
                {familia.length > 1 && <>
                  <div className="et-mini" style={{ marginBottom: 4 }}>Su familia</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                    {familia.filter(f => f.id !== viendo.id).map(f => (
                      <button key={f.id} type="button" className="chip-sel" onClick={() => setViendo(f)}>{f.nombre}</button>
                    ))}
                  </div>
                </>}
                {agrupaPorRaiz(etiquetas, viendo.etiquetas || []).length > 0 && <>
                  <div className="et-mini" style={{ marginBottom: 4 }}>Qué trabaja</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {agrupaPorRaiz(etiquetas, viendo.etiquetas || []).map((g: any) => (
                      <span key={g.raiz.id} className="badge badge-g" title={g.hijas.map((h: any) => h.nombre).join(' · ') || undefined}>{g.raiz.nombre}</span>
                    ))}
                  </div>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
