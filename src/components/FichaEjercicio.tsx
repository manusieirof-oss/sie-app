'use client'
import { useEffect, useRef, useState } from 'react'
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
// EL CROMO DE UN EJERCICIO (Biblioteca).
//
// Se presenta como un cromo porque se entiende sin explicar: por delante lo que se
// mira (la animación 3D, el nombre y sus cifras), por detrás lo que se lee (cómo se
// hace, qué decirle, qué trabaja). Se le da la vuelta con un toque y se inclina con el
// ratón para que se sienta "en la mano". Es solo para consultar: editar se hace en el
// torno, y desde el reverso hay un atajo para quien tiene permiso.
// ---------------------------------------------------------------------------

const lista = (x: any): string[] => (Array.isArray(x) ? x : String(x || '').split('\n'))
  .map((t: any) => String(typeof t === 'object' ? (t?.texto || t?.nombre || '') : t).trim()).filter(Boolean)

/* El uso sale de la vista ejercicio_resumen. Se guarda en memoria del módulo: al pasar
   de un cromo a otro no se vuelve a pedir a la base. */
let resumenCache: Record<string, any> | null = null

const fecha = (f?: string) => f ? new Date(String(f).length === 10 ? f + 'T12:00:00' : f)
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

/* LA "RAREZA" DEL CROMO: el color del marco según lo que se usa en la clínica. Así de un
   vistazo se ve si es un básico de la casa o uno que casi nadie ha probado. */
function rareza(veces: number) {
  if (veces >= 100) return { k: 'oro', t: 'Imprescindible' }
  if (veces >= 30) return { k: 'plata', t: 'Habitual' }
  if (veces >= 1) return { k: 'bronce', t: 'De vez en cuando' }
  return { k: 'nuevo', t: 'Sin estrenar' }
}

export default function FichaEjercicio({ ejercicio, ejercicios, etiquetas, amasar = false, onCambiar, onCerrar }: {
  ejercicio: any, ejercicios: any[], etiquetas: any[], amasar?: boolean,
  /** Para saltar a otro de la familia sin cerrar el cromo. */
  onCambiar: (e: any) => void, onCerrar: () => void
}) {
  const router = useRouter()
  const [varSel, setVarSel] = useState(-1)
  const [vuelta, setVuelta] = useState(false)
  const [uso, setUso] = useState<any>(resumenCache?.[ejercicio.id] ?? null)
  const carta = useRef<HTMLDivElement>(null)
  /* EL ESCENARIO, TAN GRANDE COMO QUEPA. El cromo tiene alto fijo (para poder darle la
     vuelta) y lo demás del anverso ocupa unos 330 px; el resto es para la figura. */
  const [alto, setAlto] = useState(380)
  useEffect(() => {
    const medir = () => setAlto(Math.max(220, Math.min(430, Math.min(760, window.innerHeight * .92) - 330)))
    medir(); window.addEventListener('resize', medir); return () => window.removeEventListener('resize', medir)
  }, [])

  const principalId = ejercicio.portada_id || ejercicio.id
  const principal = ejercicios.find(e => e.id === principalId)
  const familia = ejercicios.filter(e => e.id === principalId || e.portada_id === principalId)
  const pos = familia.findIndex(f => f.id === ejercicio.id)
  const irA = (d: number) => { if (familia.length > 1) onCambiar(familia[(pos + d + familia.length) % familia.length]) }

  useEffect(() => { setVarSel(-1); setVuelta(false) }, [ejercicio.id])
  // Teclado: Esc cierra, espacio da la vuelta, flechas pasan por la familia.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === ' ') { e.preventDefault(); setVuelta(v => !v) }
      else if (e.key === 'ArrowRight') irA(1)
      else if (e.key === 'ArrowLeft') irA(-1)
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }) // sin dependencias a propósito: irA cambia con cada ejercicio
  useEffect(() => {
    if (resumenCache) { setUso(resumenCache[ejercicio.id] ?? null); return }
    supabase.from('ejercicio_resumen').select('*').then(({ data }) => {
      const r: Record<string, any> = Object.fromEntries((data || []).map((f: any) => [f.ejercicio_id, f]))
      resumenCache = r
      setUso(r[ejercicio.id] ?? null)
    })
  }, [ejercicio.id])

  /* LA INCLINACIÓN. Se escribe en variables CSS (no en estado de React) para que mover el
     ratón no vuelva a pintar la animación 3D en cada píxel. Sobre el escenario no se
     inclina: ahí el ratón sirve para girar la figura. */
  function mover(e: React.PointerEvent) {
    const el = carta.current; if (!el || e.pointerType !== 'mouse') return
    if ((e.target as HTMLElement).closest('.cr-escena')) { quieto(); return }
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(x - .5) * 12}deg`)
    el.style.setProperty('--rx', `${(.5 - y) * 10}deg`)
    el.style.setProperty('--bx', `${x * 100}%`)
    el.style.setProperty('--by', `${y * 100}%`)
  }
  function quieto() { const el = carta.current; if (!el) return; el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg') }

  const variantes: any[] = ejercicio.variantes || []
  const v = varSel >= 0 ? variantes[varSel] : null
  const foto = v ? (v.imagen_url || ejercicio.imagen_url) : ejercicio.imagen_url
  const anim = v ? animacionDe({ nombre: `${ejercicio.nombre} · ${v.nombre || ''}` }) : animacionDe(ejercicio)
  const vids = videosDe(ejercicio)
  const videos = v?.video_url ? [{ titulo: v.nombre || 'Vídeo', url: v.video_url }, ...vids] : vids
  const vacio = (
    <div style={{ width: '100%', height: alto, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--grl)' }}>
      {figuraDe(ejercicio.etiquetas || [], etiquetas) ? <div style={{ height: '100%', aspectRatio: '360/640' }}><FiguraMusculos etiquetasEj={ejercicio.etiquetas} etiquetas={etiquetas}/></div> : <Ic name="fuerza" size={64}/>}
    </div>
  )

  const pasos = lista(ejercicio.items_ejecucion)
  const frases = lista(ejercicio.feedbacks)
  const trabaja = agrupaPorRaiz(etiquetas, ejercicio.etiquetas || [])
  const objetivos: any[] = uso?.objetivos || []
  const rz = rareza(uso?.veces || 0)
  // El número del cromo: su sitio en la colección, por orden alfabético.
  const numero = [...ejercicios].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')).findIndex(e => e.id === ejercicio.id) + 1

  return (
    <div className="cr-velo" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{CSS}</style>
      {familia.length > 1 && <button className="cr-flecha izq" onClick={() => irA(-1)} aria-label="Anterior de la familia">‹</button>}

      <div className={`cr-carta cr-${rz.k} ${vuelta ? 'girada' : ''}`} ref={carta} onPointerMove={mover} onPointerLeave={quieto}>
        <div className="cr-giro">
          {/* ANVERSO */}
          <div className="cr-cara cr-anverso">
            <div className="cr-brillo"/>
            <div className="cr-arriba">
              <span className="cr-num">#{numero}</span>
              {principal && principal.id !== ejercicio.id
                ? <button type="button" className="cr-fam" onClick={() => onCambiar(principal)}>{principal.nombre}</button>
                : <span className="cr-fam">{familia.length > 1 ? `Familia · ${familia.length}` : 'Ejercicio'}</span>}
              <span className="cr-rz">{rz.t}</span>
            </div>
            <div className="cr-escena">
              <MediosEjercicio key={ejercicio.id + ':' + varSel} anim={anim} foto={foto} videos={videos} vacio={vacio} alto={alto} limpio/>
            </div>
            <div className="cr-nombre">
              <h2>{ejercicio.nombre}{v && <small> · {v.nombre}</small>}</h2>
              <span><Ic name="regla" size={11}/> {nombreMedida(ejercicio.tipo_medida)}</span>
            </div>
            {variantes.length > 0 && (
              <div className="cr-vars">
                <button type="button" className={varSel === -1 ? 'on' : ''} onClick={() => setVarSel(-1)}>Normal</button>
                {variantes.map((x, i) => <button key={i} type="button" className={varSel === i ? 'on' : ''} onClick={() => setVarSel(i)}>{x?.nombre || 'Variante'}</button>)}
              </div>
            )}
            <div className="cr-stats">
              <div><b>{uso?.veces ?? '·'}</b><span>Veces</span></div>
              <div><b>{uso?.pacientes ?? '·'}</b><span>Pacientes</span></div>
              <div><b>{uso?.sesiones ?? '·'}</b><span>Sesiones</span></div>
              <div><b>{pasos.length}</b><span>Claves</span></div>
            </div>
            <button type="button" className="cr-voltear" onClick={() => setVuelta(true)}>Dale la vuelta <span>↻</span></button>
          </div>

          {/* REVERSO */}
          <div className="cr-cara cr-reverso">
            <div className="cr-rev-cab">
              <div>
                <span className="cr-num">#{numero}</span>
                <h3>{ejercicio.nombre}</h3>
              </div>
              <button type="button" className="cr-redondo" onClick={() => setVuelta(false)} title="Volver a la animación">↺</button>
            </div>
            <div className="cr-rev-cuerpo">
              {ejercicio.descripcion && <p className="cr-desc">{ejercicio.descripcion}</p>}
              {pasos.length > 0 && <section>
                <div className="cr-et">Cómo se hace bien</div>
                <ol className="cr-pasos">{pasos.map((t, i) => <li key={i}><i>{i + 1}</i>{t}</li>)}</ol>
              </section>}
              {frases.length > 0 && <section>
                <div className="cr-et">Qué decirle</div>
                <div className="cr-frases">{frases.map((t, i) => <span key={i}>«{t}»</span>)}</div>
              </section>}
              {trabaja.length > 0 && <section>
                <div className="cr-et">Qué trabaja</div>
                <div className="cr-tags">{trabaja.map((g: any) => (
                  <span key={g.raiz.id}>{g.raiz.nombre}{g.hijas.length > 0 && <small> · {g.hijas.map((h: any) => h.nombre).join(', ')}</small>}</span>
                ))}</div>
              </section>}
              {objetivos.length > 0 && <section>
                <div className="cr-et">Para qué se usa aquí</div>
                <div className="cr-barras">{objetivos.slice(0, 5).map((o: any) => (
                  <div key={o.nombre}><span>{o.nombre}</span><i style={{ width: `${Math.max(8, o.n / objetivos[0].n * 100)}%` }}/><b>{o.n}</b></div>
                ))}</div>
              </section>}
              {uso?.ultima && <div className="cr-ultima">Última vez apuntado: {fecha(uso.ultima)}</div>}
            </div>
            {amasar && <button className="btn btn-p cr-amasar" onClick={() => router.push(`/torno/amasar/${ejercicio.id}`)}>
              <Ic name="editar" size={13}/> Amasar en el torno</button>}
          </div>
        </div>
      </div>

      {familia.length > 1 && <button className="cr-flecha der" onClick={() => irA(1)} aria-label="Siguiente de la familia">›</button>}
      <button className="cr-cerrar" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={18}/></button>
      {familia.length > 1 && <div className="cr-puntos">{familia.map((f, i) => <i key={f.id} className={i === pos ? 'on' : ''} onClick={() => onCambiar(f)} title={f.nombre}/>)}</div>}
    </div>
  )
}

// Estilos aquí mismo: es el único sitio que los usa y así el cromo se lee de una vez.
// Cada rareza solo cambia dos colores (--m marco, --m2 fondo claro); el resto es común.
const CSS = `
.cr-velo{position:fixed;inset:0;z-index:150;background:rgba(30,34,33,.62);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;gap:18px;animation:crVelo .2s ease;perspective:1400px}
.cr-carta{--rx:0deg;--ry:0deg;--bx:50%;--by:30%;--m:var(--g);--m2:#cfe6e9;width:min(430px,92vw);height:min(760px,92vh);transform:rotateX(var(--rx)) rotateY(var(--ry));transition:transform .18s ease-out;transform-style:preserve-3d;animation:crEntra .45s cubic-bezier(.2,.9,.25,1.15)}
.cr-oro{--m:#C9A84C;--m2:#f6e7b4}.cr-plata{--m:#9aa3a6;--m2:#e9eef0}.cr-bronce{--m:#b08560;--m2:#f0dccb}.cr-nuevo{--m:var(--g);--m2:#d6ecee}
.cr-giro{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.3,.8,.3,1)}
.cr-carta.girada .cr-giro{transform:rotateY(180deg)}
.cr-cara{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:22px;overflow:hidden;background:var(--w);border:7px solid var(--m);box-shadow:0 30px 60px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.6);display:flex;flex-direction:column}
.cr-reverso{transform:rotateY(180deg);background:linear-gradient(180deg,var(--m2) 0,var(--w) 120px)}
.cr-brillo{position:absolute;inset:0;pointer-events:none;z-index:3;border-radius:15px;background:radial-gradient(circle at var(--bx) var(--by),rgba(255,255,255,.38),transparent 45%);mix-blend-mode:soft-light}
.cr-oro .cr-brillo{background:radial-gradient(circle at var(--bx) var(--by),rgba(255,255,255,.5),transparent 40%),linear-gradient(115deg,transparent 20%,rgba(255,215,120,.25) 40%,rgba(160,220,255,.2) 55%,transparent 75%);background-size:100% 100%,200% 200%;background-position:center,var(--bx) var(--by)}
.cr-arriba{display:flex;align-items:center;gap:8px;padding:10px 14px;background:linear-gradient(180deg,var(--m2),transparent);font-size:11.5px}
.cr-num{font-weight:600;color:var(--m);font-size:12px;letter-spacing:.03em;filter:brightness(.8)}
.cr-fam{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:none;background:none;padding:0;font:inherit;color:var(--gr);text-align:left;cursor:default}
button.cr-fam{cursor:pointer;color:var(--gd)}button.cr-fam:before{content:'‹ '}
.cr-rz{background:var(--m);color:#fff;border-radius:99px;padding:2px 9px;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase}
.cr-escena{margin:0 12px;border-radius:14px;overflow:hidden;background:radial-gradient(110% 80% at 50% 35%,#fff 0%,var(--m2) 100%);flex-shrink:0;padding:6px}
.cr-nombre{padding:12px 16px 4px}
.cr-nombre h2{margin:0;font-size:22px;font-weight:600;line-height:1.15;color:var(--n)}
.cr-nombre h2 small{font-weight:400;color:var(--gr);font-size:16px}
.cr-nombre span{display:inline-flex;gap:5px;align-items:center;font-size:11.5px;color:var(--gr);margin-top:4px}
.cr-vars{display:flex;gap:5px;overflow-x:auto;padding:6px 16px 2px;scrollbar-width:none}
.cr-vars button{flex-shrink:0;font:inherit;font-size:12px;padding:4px 11px;border-radius:99px;border:1.5px solid var(--bd);background:var(--w);color:var(--n);cursor:pointer}
.cr-vars button.on{background:var(--n);border-color:var(--n);color:#fff}
.cr-stats{display:grid;grid-template-columns:repeat(4,1fr);margin:auto 12px 0;border-top:1.5px dashed var(--bd);padding:10px 0 4px}
.cr-stats div{display:flex;flex-direction:column;align-items:center}
.cr-stats b{font-size:20px;font-weight:600;color:var(--n);line-height:1.1}
.cr-stats span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--grl)}
.cr-voltear{margin:6px 12px 12px;border:none;border-radius:12px;padding:9px;background:var(--m2);color:var(--n);font:inherit;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.cr-voltear span{display:inline-block;transition:transform .4s}.cr-voltear:hover span{transform:rotate(180deg)}
.cr-rev-cab{display:flex;align-items:flex-start;gap:10px;padding:14px 16px 8px}
.cr-rev-cab>div{flex:1;min-width:0}.cr-rev-cab h3{margin:2px 0 0;font-size:18px;font-weight:600;color:var(--n);line-height:1.2}
.cr-redondo{width:36px;height:36px;border-radius:50%;border:none;background:var(--w);box-shadow:0 2px 8px rgba(0,0,0,.12);font-size:18px;cursor:pointer;color:var(--n)}
.cr-rev-cuerpo{flex:1;overflow-y:auto;padding:4px 16px 14px;display:flex;flex-direction:column;gap:14px}
.cr-desc{margin:0;font-size:13.5px;line-height:1.55;color:var(--n)}
.cr-et{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--m);filter:brightness(.75);margin-bottom:7px;font-weight:600}
.cr-pasos{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.cr-pasos li{display:flex;gap:9px;font-size:13px;line-height:1.45;color:var(--n)}
.cr-pasos i{font-style:normal;flex-shrink:0;width:21px;height:21px;border-radius:50%;background:var(--m);color:#fff;font-size:11px;display:grid;place-items:center}
.cr-frases{display:flex;flex-direction:column;gap:5px;align-items:flex-start}
.cr-frases span{background:var(--ambl);font-size:13px;padding:6px 12px;border-radius:13px 13px 13px 4px;color:var(--n)}
.cr-tags{display:flex;flex-wrap:wrap;gap:5px}
.cr-tags span{font-size:12px;padding:4px 10px;border-radius:99px;background:var(--bl);color:var(--n)}
.cr-tags small{color:var(--gr)}
.cr-barras{display:flex;flex-direction:column;gap:5px}
.cr-barras div{display:grid;grid-template-columns:1fr 90px 24px;gap:8px;align-items:center;font-size:12.5px;color:var(--n)}
.cr-barras span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-barras i{height:7px;border-radius:99px;background:var(--m);justify-self:start}
.cr-barras b{font-weight:500;color:var(--gr);text-align:right}
.cr-ultima{font-size:11.5px;color:var(--grl)}
.cr-amasar{margin:0 16px 14px;justify-content:center}
.cr-flecha{width:46px;height:46px;border-radius:50%;border:none;background:rgba(255,255,255,.92);font-size:26px;line-height:1;cursor:pointer;color:var(--n);box-shadow:0 6px 20px rgba(0,0,0,.25);flex-shrink:0}
.cr-flecha:hover{transform:scale(1.08)}
.cr-cerrar{position:fixed;top:18px;right:20px;width:42px;height:42px;border-radius:50%;border:none;background:rgba(255,255,255,.92);cursor:pointer;display:grid;place-items:center;color:var(--n)}
.cr-puntos{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:7px}
.cr-puntos i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45);cursor:pointer}.cr-puntos i.on{background:#fff;width:22px;border-radius:99px}
@keyframes crEntra{from{transform:translateY(40px) rotateX(18deg) scale(.9);opacity:0}to{transform:none;opacity:1}}
@keyframes crVelo{from{opacity:0}to{opacity:1}}
@media (max-width:620px){.cr-flecha{position:fixed;bottom:12px;z-index:2}.cr-flecha.izq{left:14px}.cr-flecha.der{right:14px}.cr-velo{gap:0}}
`
