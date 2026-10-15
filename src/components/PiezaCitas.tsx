'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// SUS CITAS EN VERTICAL: la presentación final del torno.
//
// Una fila por cita, unidas por un hilo: fecha y hora, el mosaico de la sesión y su
// fase, y la evaluación con la foto de sus tests. Tocar una la abre con sus partes
// en fichas. Sale al programar en el torno y en la ficha (Planificación → Vista
// interactiva), así se ve igual en los dos sitios.
// ---------------------------------------------------------------------------

export type FilaPieza = {
  id: string, fecha: string, hora: string | null,
  ses: { nombre: string, color: string, fase?: string, partes?: any[] } | null,
  evs: { momento: 'inicial' | 'final', faseNombre: string, color: string, tests: { id: string, nombre: string, imagen: string, items: string[] }[] }[],
  /** Se ha tocado ahora (no lo tenía ya). */
  nueva: boolean,
}

export default function PiezaCitas({ filas }: { filas: FilaPieza[] }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  return (
    <>
      <style>{`
        @keyframes pz-entra { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform:none } }
        .pz-filas { position:relative; width:100%; display:flex; flex-direction:column; gap:10px }
        /* El hilo: une las citas como en el banco. */
        .pz-hilo { position:absolute; left:63px; top:8px; bottom:8px; width:2px; border-radius:2px; background:var(--bd2);
                   transform-origin:top; animation: pz-hilo 1s ease .1s backwards }
        @keyframes pz-hilo { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        /* Cada cita sale de la vasija: estrecha y arriba, y se abre a su sitio. */
        .pz-fila { position:relative; display:grid; grid-template-columns:50px 28px minmax(0,1fr); align-items:start; gap:0;
                   border:none; background:transparent; padding:0; font-family:inherit; text-align:left; cursor:pointer; width:100%;
                   animation: pz-sale .55s cubic-bezier(.2,.8,.3,1.15) backwards }
        @keyframes pz-sale { from { opacity:0; transform: translateY(-26px) scaleX(.25) } to { opacity:1; transform:none } }
        .pz-dia { text-align:right; padding-top:6px; padding-right:4px }
        .pz-punto { width:12px; height:12px; border-radius:99px; margin:13px auto 0; box-shadow:0 0 0 3px #fff; position:relative; z-index:1 }
        .pz-tarj { background:#fff; border-radius:14px; padding:9px 11px; box-shadow:0 3px 14px rgba(38,40,37,.10);
                   transition: transform .18s ease, box-shadow .18s ease }
        .pz-fila:hover .pz-tarj { transform: translateX(3px); box-shadow:0 8px 22px rgba(38,40,37,.15) }
        .pz-mos { width:46px; height:46px; border-radius:11px; overflow:hidden; display:grid; flex-shrink:0; background:var(--bl) }
        .pz-mos img { width:100%; height:100%; object-fit:cover; display:block; min-width:0; min-height:0 }
        .pz-abre { animation: pz-entra .25s ease backwards; margin-top:9px; padding-top:9px; border-top:1px solid var(--bd2) }
        .pz-parte { font-size:10px; letter-spacing:.7px; text-transform:uppercase; color:var(--grl); margin-bottom:6px }
        .pz-ejs { display:flex; gap:10px; overflow-x:auto; padding:2px 2px 4px }
        .pz-ej { flex:0 0 74px; display:flex; flex-direction:column; align-items:center; text-align:center; animation: pz-entra .3s ease backwards }
        .pz-ej-f { width:64px; height:64px; border-radius:14px; overflow:hidden; background:var(--bl); color:var(--gm);
                   display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(38,40,37,.08) }
        .pz-ej-f img { width:100%; height:100%; object-fit:cover; display:block }
        .pz-ej-n { font-size:10.5px; line-height:1.2; color:var(--n); margin-top:5px; overflow:hidden; display:-webkit-box;
                   -webkit-line-clamp:2; -webkit-box-orient:vertical; max-width:74px }
        .pz-ej-d { font-size:10px; color:var(--grl); margin-top:1px }
        @media (prefers-reduced-motion: reduce) { .pz-filas * { animation-duration:.01ms !important; animation-delay:0ms !important } }
      `}</style>
    <div className="pz-filas">
      <div className="pz-hilo"/>
      {filas.map((f, i) => {
        const d = new Date(f.fecha + 'T12:00:00')
        const ab = abierta === f.id
        const ejs = (f.ses?.partes || []).flatMap((p: any) => p.ejercicios || [])
        const fotos = ejs.slice(0, 4).map((e: any) => e.imagen_url || '')
        const color = f.ses?.color || f.evs[0]?.color || 'var(--gm)'
        return (
          <button key={f.id} type="button" className="pz-fila" onClick={() => setAbierta(ab ? null : f.id)}
            // Salen de una en una; con muchas citas, sin pasar de ~1,5 s en total.
            style={{ animationDelay: `${Math.min(i * 70, 1400)}ms` }}>
            <div className="pz-dia">
              <div style={{ fontSize: 19, lineHeight: 1, color: 'var(--n)' }}>{d.getDate()}</div>
              <div style={{ fontSize: 10, color: 'var(--grl)', textTransform: 'capitalize' }}>
                {d.toLocaleDateString('es-ES', { weekday: 'short' })} · {d.toLocaleDateString('es-ES', { month: 'short' })}
              </div>
              {f.hora && <div style={{ fontSize: 10.5, color: 'var(--gd)' }}>{String(f.hora).slice(0, 5)}</div>}
            </div>
            <div><div className="pz-punto" style={{ background: color }}/></div>
            <div className="pz-tarj">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {f.ses && (
                  <span className="pz-mos" style={{ boxShadow: `0 0 0 2px ${f.ses.color}`,
                    gridTemplateColumns: fotos.length > 1 ? '1fr 1fr' : '1fr', gridTemplateRows: fotos.length > 2 ? '1fr 1fr' : '1fr' }}>
                    {fotos.length === 0 && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gm)' }}><Ic name="fuerza" size={16}/></span>}
                    {fotos.map((src: string, k: number) => src
                      ? <img key={k} src={src} alt=""/>
                      : <span key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gm)', background: '#fff' }}><Ic name="fuerza" size={13}/></span>)}
                  </span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, color: f.ses ? 'var(--n)' : 'var(--grl)' }}>{f.ses ? f.ses.nombre : 'Solo evaluación'}</span>
                  {f.ses?.fase && <span style={{ display: 'block', fontSize: 11, color: 'var(--grl)' }}>{f.ses.fase}</span>}
                </span>
                {f.nueva && <span title="Puesta ahora" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--gd)', flexShrink: 0 }}/>}
              </div>
              {/* La evaluación de esa cita, con la foto de sus tests. */}
              {f.evs.map((e, k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                  {e.tests.some(t => t.imagen)
                    ? e.tests.filter(t => t.imagen).slice(0, 3).map(t => <img key={t.id} src={t.imagen} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 6 }}/>)
                    : <span style={{ color: e.color, lineHeight: 0 }}><Ic name="test" size={16}/></span>}
                  <span style={{ fontSize: 11.5, color: e.color }}>{e.momento === 'inicial' ? 'Al empezar' : 'Al salir'}</span>
                  <span style={{ fontSize: 11, color: 'var(--grl)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.faseNombre}</span>
                </div>
              ))}
              {ab && (
                <div className="pz-abre">
                  {/* POR DENTRO, EN IMÁGENES: cada parte es una fila de fichas de sus
                      ejercicios (foto, nombre corto y series × reps). Antes era un
                      párrafo de nombres seguidos que no se leía. */}
                  {(f.ses?.partes || []).map((p: any, pi: number) => (
                    <div key={pi} style={{ marginBottom: 10 }}>
                      <div className="pz-parte">{p.nombre || `Parte ${pi + 1}`}</div>
                      <div className="pz-ejs">
                        {(p.ejercicios || []).map((e: any, ei: number) => (
                          <span key={ei} className="pz-ej" title={e.nombre} style={{ animationDelay: `${ei * 35}ms` }}>
                            <span className="pz-ej-f">
                              {e.imagen_url ? <img src={e.imagen_url} alt=""/> : <Ic name="fuerza" size={18}/>}
                            </span>
                            <span className="pz-ej-n">{e.nombre}</span>
                            {(e.series || e.reps) && <span className="pz-ej-d">{[e.series, e.reps].filter(Boolean).join(' × ')}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {f.evs.flatMap(e => e.tests).map(t => (
                    <div key={t.id} style={{ fontSize: 11.5, color: 'var(--gr)', marginTop: 4 }}>
                      <span style={{ color: 'var(--n)' }}>{t.nombre}</span>{(t.items || []).length > 0 ? ` · ${(t.items || []).join(', ')}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
    </>
  )
}
