'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LA PIEZA: lo que se ve al darle a "Programar".
//
// Mientras se guarda, el barro gira en el torno: una vasija con franjas de los
// colores de sus sesiones que da vueltas y sube desde una pella aplastada. Cuando
// está guardado, la vasija se hace pequeña arriba y de ella salen sus citas en
// vertical, una a una, con su sesión y su evaluación.
//
// La animación va a la par que el guardado de verdad: si algo falla, el torno se
// para y sale el error. Nunca se ve la pieza terminada sin estar guardada.
// ---------------------------------------------------------------------------

export type FilaPieza = {
  id: string, fecha: string, hora: string | null,
  ses: { nombre: string, color: string, fase?: string, partes?: any[] } | null,
  evs: { momento: 'inicial' | 'final', faseNombre: string, color: string, tests: { id: string, nombre: string, imagen: string, items: string[] }[] }[],
  /** Se ha tocado ahora (no lo tenía ya). */
  nueva: boolean,
}

// La silueta de la vasija (viewBox 120 x 150).
const VASIJA = 'M40 10 Q60 6 80 10 Q76 22 74 30 Q104 52 102 92 Q100 132 60 140 Q20 132 18 92 Q16 52 46 30 Q44 22 40 10 Z'

export default function PiezaTorno({ estado, error, filas, nombre, onFicha, onVolver, onCerrar }: {
  estado: 'girando' | 'lista' | 'error', error?: string, filas: FilaPieza[], nombre: string,
  onFicha: () => void, onVolver: () => void, onCerrar: () => void,
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  // Las franjas: los colores de sus sesiones, cada uno en fuerte y en claro para que
  // se note el giro. Sin sesiones, color barro.
  const colores = Array.from(new Set(filas.map(f => f.ses?.color || f.evs[0]?.color).filter(Boolean))) as string[]
  const tonos = colores.length ? colores : ['#B98B67']
  // Las justas para cubrir la vasija mientras se desplazan un ciclo entero.
  const periodo = tonos.length * 20
  const franjas = Array.from({ length: Math.ceil((120 + periodo) / 10) + 1 }, (_, i) => ({ x: i * 10, c: tonos[Math.floor(i / 2) % tonos.length], o: i % 2 ? .55 : .95 }))
  const conSes = filas.filter(f => f.ses).length
  const conEv = filas.reduce((n, f) => n + f.evs.length, 0)

  return (
    <div className={`pz pz-${estado}`}>
      <style>{`
        .pz { position:fixed; inset:0; z-index:40; background:#fff; overflow-y:auto; animation: pz-aparece .45s ease .25s backwards }
        @keyframes pz-aparece { from { opacity:0 } to { opacity:1 } }
        .pz-col { max-width:620px; margin:0 auto; padding:0 18px 120px; display:flex; flex-direction:column; align-items:center }
        .pz-torno { width:130px; margin-top:28vh; transition: width .7s ease, margin-top .7s ease; transform-origin:50% 100% }
        .pz-lista .pz-torno { width:54px; margin-top:26px }
        .pz-barro { transform-origin:50% 100%; animation: pz-sube 1.5s cubic-bezier(.3,.7,.3,1) backwards }
        /* Una pella aplastada que se centra, sube y se abre. */
        @keyframes pz-sube {
          0%   { transform: scale(1.55, .22) }
          35%  { transform: scale(1.2, .5) }
          65%  { transform: scale(.88, 1.12) }
          100% { transform: scale(1, 1) }
        }
        .pz-franjas { animation: pz-gira .7s linear infinite }
        .pz-lista .pz-franjas { animation-duration: 5s }
        .pz-error .pz-franjas, .pz-error .pz-barro { animation-play-state: paused }
        @keyframes pz-gira { from { transform: translateX(0) } to { transform: translateX(-${periodo}px) } }
        .pz-plato { animation: pz-plato .7s linear infinite }
        .pz-lista .pz-plato { opacity:0; transition: opacity .5s ease }
        @keyframes pz-plato { from { stroke-dashoffset:0 } to { stroke-dashoffset:-40 } }
        .pz-txt { font-size:12px; color:var(--grl); margin-top:14px; letter-spacing:.3px }

        .pz-cab { text-align:center; margin:10px 0 22px; animation: pz-entra .5s ease .2s backwards }
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
        .pz-pie { position:fixed; left:0; right:0; bottom:22px; display:flex; justify-content:center; gap:10px; pointer-events:none;
                  animation: pz-entra .5s ease 1s backwards }
        .pz-pie > * { pointer-events:auto; box-shadow:0 10px 26px rgba(38,40,37,.16) }
        @media (prefers-reduced-motion: reduce) { .pz *, .pz { animation-duration:.01ms !important; animation-delay:0ms !important; transition:none !important } }
      `}</style>

      <div className="pz-col">
        {/* EL TORNO */}
        <div className="pz-torno">
          <svg viewBox="0 0 120 165" style={{ width: '100%', display: 'block', overflow: 'visible' }}>
            <defs>
              <clipPath id="pz-vasija"><path d={VASIJA}/></clipPath>
              {/* Sombra a los lados y luz en el centro: así se ve redonda. */}
              <linearGradient id="pz-luz" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#262825" stopOpacity=".38"/>
                <stop offset=".42" stopColor="#fff" stopOpacity=".28"/>
                <stop offset=".58" stopColor="#fff" stopOpacity=".1"/>
                <stop offset="1" stopColor="#262825" stopOpacity=".42"/>
              </linearGradient>
            </defs>
            {/* El plato que gira. */}
            <ellipse cx="60" cy="146" rx="56" ry="10" fill="var(--bl)"/>
            <ellipse className="pz-plato" cx="60" cy="146" rx="46" ry="7" fill="none" stroke="var(--bd)" strokeWidth="1.5" strokeDasharray="14 6"/>
            <g className="pz-barro">
              <g clipPath="url(#pz-vasija)">
                <g className="pz-franjas">
                  {franjas.map((f, i) => <rect key={i} x={f.x} y="0" width="10.5" height="150" fill={f.c} opacity={f.o}/>)}
                </g>
                <rect x="0" y="0" width="120" height="150" fill="url(#pz-luz)"/>
              </g>
            </g>
          </svg>
        </div>

        {estado === 'girando' && <div className="pz-txt">Torneando…</div>}
        {estado === 'error' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 13.5, color: 'var(--rojo, #B4553F)' }}>No se ha guardado todo</div>
            <div style={{ fontSize: 12, color: 'var(--gr)', margin: '4px 0 12px' }}>{error}</div>
            <button className="btn btn-t btn-sm" onClick={onCerrar}>Volver al calendario</button>
          </div>
        )}

        {estado === 'lista' && (
          <>
            <div className="pz-cab">
              <div style={{ fontSize: 17 }}>{nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>
                {[conSes > 0 && `${conSes} cita${conSes === 1 ? '' : 's'} con sesión`, conEv > 0 && `${conEv} evaluaci${conEv === 1 ? 'ón' : 'ones'}`].filter(Boolean).join(' · ')}
              </div>
            </div>

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
                          {(f.ses?.partes || []).map((p: any, pi: number) => (
                            <div key={pi} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gd)' }}>{p.nombre || `Parte ${pi + 1}`}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--gr)', lineHeight: 1.45 }}>{(p.ejercicios || []).map((e: any) => e.nombre).join(' · ')}</div>
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

            <div className="pz-pie">
              <button className="btn btn-t" style={{ background: '#fff' }} onClick={onVolver}>Volver al torno</button>
              <button className="btn btn-p" onClick={onFicha}><Ic name="ok" size={13}/> Ver su ficha</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
