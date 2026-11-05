'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { nombreMedida } from '@/lib/ejercicios'
import { agrupaPorRaiz } from '@/lib/etiquetas'
import { animacionDe } from '@/lib/anim3d/asignar'
import { videosDe } from '@/lib/videos'
import { figuraDe } from '@/lib/cuerpo'
import { MediosEjercicio } from '@/components/MediosEjercicio'
import FiguraMusculos from '@/components/FiguraMusculos'

// ---------------------------------------------------------------------------
// LA FICHA DE UN EJERCICIO (Biblioteca).
//
// Un panel que entra por la derecha y ocupa casi toda la pantalla: a la izquierda el
// escenario con la animación 3D grande (lo primero que se quiere ver es CÓMO se mueve),
// a la derecha la información para leer. Es solo para consultar: editar se hace en el
// torno, y desde aquí solo hay un atajo para quien tiene permiso.
// ---------------------------------------------------------------------------

const lista = (x: any): string[] => (Array.isArray(x) ? x : String(x || '').split('\n'))
  .map((t: any) => String(typeof t === 'object' ? (t?.texto || t?.nombre || '') : t).trim()).filter(Boolean)

/* El uso sale de la vista ejercicio_resumen. Se guarda en memoria del módulo: al ir
   pasando de un ejercicio a otro no se vuelve a pedir a la base. */
let resumenCache: Record<string, any> | null = null

const fecha = (f?: string) => f ? new Date(String(f).length === 10 ? f + 'T12:00:00' : f)
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export default function FichaEjercicio({ ejercicio, ejercicios, etiquetas, amasar = false, onCambiar, onCerrar }: {
  ejercicio: any, ejercicios: any[], etiquetas: any[], amasar?: boolean,
  /** Para saltar a otro de la familia sin cerrar el panel. */
  onCambiar: (e: any) => void, onCerrar: () => void
}) {
  const router = useRouter()
  const [varSel, setVarSel] = useState(-1)
  const [uso, setUso] = useState<any>(resumenCache?.[ejercicio.id] ?? null)

  useEffect(() => { setVarSel(-1) }, [ejercicio.id])
  // Esc cierra, como cualquier panel.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onCerrar])
  useEffect(() => {
    if (resumenCache) { setUso(resumenCache[ejercicio.id] ?? null); return }
    supabase.from('ejercicio_resumen').select('*').then(({ data }) => {
      const r: Record<string, any> = Object.fromEntries((data || []).map((f: any) => [f.ejercicio_id, f]))
      resumenCache = r
      setUso(r[ejercicio.id] ?? null)
    })
  }, [ejercicio.id])

  const principalId = ejercicio.portada_id || ejercicio.id
  const principal = ejercicios.find(e => e.id === principalId)
  const familia = ejercicios.filter(e => e.id === principalId || e.portada_id === principalId)
  const variantes: any[] = ejercicio.variantes || []
  const v = varSel >= 0 ? variantes[varSel] : null

  // Lo que se ve en el escenario: lo mismo que en el editor (animación, foto, vídeos).
  const foto = v ? (v.imagen_url || ejercicio.imagen_url) : ejercicio.imagen_url
  const anim = v ? animacionDe({ nombre: `${ejercicio.nombre} · ${v.nombre || ''}` }) : animacionDe(ejercicio)
  const vids = videosDe(ejercicio)
  const videos = v?.video_url ? [{ titulo: v.nombre || 'Vídeo', url: v.video_url }, ...vids] : vids
  const vacio = (
    <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
      {figuraDe(ejercicio.etiquetas || [], etiquetas) ? <FiguraMusculos etiquetasEj={ejercicio.etiquetas} etiquetas={etiquetas}/> : <Ic name="fuerza" size={64}/>}
    </div>
  )

  const pasos = lista(ejercicio.items_ejecucion)
  const frases = lista(ejercicio.feedbacks)
  const trabaja = agrupaPorRaiz(etiquetas, ejercicio.etiquetas || [])
  const objetivos: any[] = uso?.objetivos || []

  return (
    <div className="fe-velo" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{CSS}</style>
      <div className="fe-panel">
        {/* ESCENARIO */}
        <div className="fe-escena">
          <div className="fe-escena-in">
            <MediosEjercicio key={ejercicio.id + ':' + varSel} anim={anim} foto={foto} videos={videos} vacio={vacio} alto={460}/>
          </div>
        </div>

        {/* INFORMACIÓN */}
        <div className="fe-info">
          <div className="fe-cab">
            <div style={{ flex: 1, minWidth: 0 }}>
              {principal && principal.id !== ejercicio.id && (
                <button type="button" className="fe-miga" onClick={() => onCambiar(principal)}>{principal.nombre} ›</button>
              )}
              <h2 className="fe-titulo">{ejercicio.nombre}</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span className="fe-pill"><Ic name="regla" size={11}/> {nombreMedida(ejercicio.tipo_medida)}</span>
                {uso?.veces > 0 && <span className="fe-pill">{uso.veces} {uso.veces === 1 ? 'vez' : 'veces'} apuntado</span>}
              </div>
            </div>
            <button className="fe-x" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={16}/></button>
          </div>

          {/* Variantes de ejecución y resto de la familia, juntas: es lo que se elige en la sala. */}
          {(variantes.length > 0 || familia.length > 1) && (
            <div className="fe-bloque">
              {variantes.length > 0 && <>
                <div className="fe-et">Variantes</div>
                <div className="fe-chips">
                  <button type="button" className={`fe-chip ${varSel === -1 ? 'on' : ''}`} onClick={() => setVarSel(-1)}>Normal</button>
                  {variantes.map((x, i) => (
                    <button key={i} type="button" className={`fe-chip ${varSel === i ? 'on' : ''}`} title={x?.descripcion || undefined}
                      onClick={() => setVarSel(i)}>{x?.nombre || 'Variante'}</button>
                  ))}
                </div>
              </>}
              {familia.length > 1 && <>
                <div className="fe-et" style={{ marginTop: variantes.length ? 12 : 0 }}>Su familia</div>
                <div className="fe-chips">
                  {familia.map(f => (
                    <button key={f.id} type="button" className={`fe-chip ${f.id === ejercicio.id ? 'on' : ''}`}
                      onClick={() => f.id !== ejercicio.id && onCambiar(f)}>{f.nombre}</button>
                  ))}
                </div>
              </>}
            </div>
          )}

          {ejercicio.descripcion && <p className="fe-desc">{ejercicio.descripcion}</p>}

          {pasos.length > 0 && (
            <div className="fe-bloque">
              <div className="fe-et">Cómo se hace bien</div>
              <ol className="fe-pasos">{pasos.map((t, i) => <li key={i}><span>{i + 1}</span>{t}</li>)}</ol>
            </div>
          )}

          {frases.length > 0 && (
            <div className="fe-bloque">
              <div className="fe-et">Qué decirle</div>
              <div className="fe-frases">{frases.map((t, i) => <div key={i} className="fe-frase">«{t}»</div>)}</div>
            </div>
          )}

          {trabaja.length > 0 && (
            <div className="fe-bloque">
              <div className="fe-et">Qué trabaja</div>
              <div className="fe-chips">
                {trabaja.map((g: any) => (
                  <span key={g.raiz.id} className="fe-tag" title={g.hijas.map((h: any) => h.nombre).join(' · ') || undefined}>
                    {g.raiz.nombre}{g.hijas.length > 0 && <small> · {g.hijas.map((h: any) => h.nombre).join(', ')}</small>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {uso && (uso.veces > 0 || uso.sesiones > 0) && (
            <div className="fe-bloque">
              <div className="fe-et">En la clínica</div>
              <div className="fe-cifras">
                <div><b>{uso.pacientes}</b><span>pacientes</span></div>
                <div><b>{uso.sesiones}</b><span>sesiones</span></div>
                <div><b>{uso.ultima ? fecha(uso.ultima) : '—'}</b><span>última vez</span></div>
              </div>
              {objetivos.length > 0 && (
                <div className="fe-chips" style={{ marginTop: 10 }}>
                  {objetivos.slice(0, 6).map((o: any) => <span key={o.nombre} className="fe-tag">{o.nombre} <small>· {o.n}</small></span>)}
                </div>
              )}
            </div>
          )}

          {amasar && (
            <div className="fe-pie">
              <button className="btn btn-p" onClick={() => router.push(`/torno/amasar/${ejercicio.id}`)}>
                <Ic name="editar" size={13}/> Amasar en el torno</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Estilos aquí mismo: es el único sitio que los usa y así el panel se lee de una vez.
const CSS = `
.fe-velo{position:fixed;inset:0;z-index:150;background:rgba(38,40,37,.38);backdrop-filter:blur(3px);display:flex;justify-content:flex-end;animation:feVelo .2s ease}
.fe-panel{width:min(1080px,100vw);height:100%;background:var(--w);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);box-shadow:-12px 0 40px rgba(38,40,37,.18);animation:feEntra .28s cubic-bezier(.2,.8,.2,1)}
.fe-escena{background:radial-gradient(120% 90% at 50% 30%,#ffffff 0%,var(--gl) 55%,#dcebed 100%);display:flex;align-items:center;justify-content:center;padding:28px;overflow:hidden}
.fe-escena-in{width:100%;max-width:520px}
.fe-info{overflow-y:auto;padding:26px 28px 30px;display:flex;flex-direction:column;gap:18px}
.fe-cab{display:flex;gap:12px;align-items:flex-start}
.fe-miga{border:none;background:none;padding:0;font:inherit;font-size:12px;color:var(--g);cursor:pointer}
.fe-titulo{margin:2px 0 0;font-size:24px;font-weight:500;color:var(--n);line-height:1.2}
.fe-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--gd);background:var(--gl);border-radius:99px;padding:3px 10px}
.fe-x{border:none;background:var(--bl);width:34px;height:34px;border-radius:50%;cursor:pointer;color:var(--n);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fe-x:hover{background:var(--bm)}
.fe-desc{margin:0;font-size:14px;line-height:1.6;color:var(--n)}
.fe-bloque{border-top:1px solid var(--bd2);padding-top:14px}
.fe-et{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);margin-bottom:8px}
.fe-chips{display:flex;gap:6px;flex-wrap:wrap}
.fe-chip{font:inherit;font-size:12.5px;padding:5px 12px;border-radius:99px;border:1.5px solid var(--bd);background:var(--w);color:var(--n);cursor:pointer;transition:all .15s}
.fe-chip:hover{border-color:var(--g)}
.fe-chip.on{background:var(--g);border-color:var(--g);color:#fff}
.fe-tag{font-size:12.5px;padding:4px 11px;border-radius:99px;background:var(--bl);color:var(--n)}
.fe-tag small{color:var(--gr);font-size:11.5px}
.fe-pasos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.fe-pasos li{display:flex;gap:10px;font-size:13.5px;line-height:1.5;color:var(--n)}
.fe-pasos li span{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--g);color:#fff;font-size:11.5px;display:flex;align-items:center;justify-content:center;margin-top:1px}
.fe-frases{display:flex;flex-direction:column;gap:6px}
.fe-frase{align-self:flex-start;max-width:92%;background:var(--ambl);color:var(--n);font-size:13.5px;padding:7px 13px;border-radius:14px 14px 14px 4px}
.fe-cifras{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.fe-cifras div{background:var(--bl);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column}
.fe-cifras b{font-size:17px;font-weight:500;color:var(--n)}
.fe-cifras span{font-size:11.5px;color:var(--gr)}
.fe-pie{margin-top:auto;padding-top:10px;display:flex;justify-content:flex-end}
@keyframes feEntra{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes feVelo{from{opacity:0}to{opacity:1}}
@media (max-width:820px){.fe-panel{grid-template-columns:1fr;grid-template-rows:auto 1fr;overflow-y:auto}.fe-escena{padding:16px}.fe-info{overflow:visible}}
`
