'use client'
import { useMemo, useState } from 'react'
import { ZONAS_CUERPO } from '@/lib/zonasCuerpo'
import { conDescendientes, nivelDe } from '@/lib/etiquetas'
import { capaDeEtiqueta, urlCapa, type Vista } from '@/lib/cuerpo'

// ---------------------------------------------------------------------------
// LOS FILTROS DE ETIQUETA, EN UN VELO.
//
// Abiertos dentro de la pagina empujaban la lista hacia abajo y ocupaban media
// pantalla. Ahora se marcan en un velo y fuera solo quedan las marcadas, como
// pastillas que se quitan con un toque.
//
// Músculos a la izquierda con el cuerpo: se ve delante o detrás, y lo marcado (o lo
// que se señala) se enciende en la figura. A la derecha, por apartados: articulaciones,
// movimientos, patrones, agarres, posición y material. Lo menos usado (apoyo,
// patología, plano y eje) va plegado en «Más filtros».
//
// Cada pastilla dice cuántos ejercicios la tienen (con sus subetiquetas).
// ---------------------------------------------------------------------------

type Grupo = { key: string, label: string, etiquetas: any[] }

/**
 * ZONAS DEL CUERPO PARA FILTRAR RAPIDO. Tocas una zona del muñeco y salen solo los
 * musculos y articulaciones de esa zona. Cada zona es un rectangulo sobre la figura
 * (en % de su ancho y alto) y dos patrones: que musculos y que articulaciones caen
 * ahi, por su nombre (o el de su raiz).
 * Medidos sobre /cuerpo/*_base.svg (360x640): estaban altos, el cuello caia en la cara.
 */
// Las zonas viven en lib/zonasCuerpo (las comparten los tests).
const ZONAS = ZONAS_CUERPO
const nrm = (t: string) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const PRINCIPALES = ['articulacion', 'movimiento', 'patron', 'agarre', 'posicion', 'material']

export function PastillasFiltro({ etiquetas, valor, onChange, onAbrir }: {
  etiquetas: any[], valor: string[], onChange: (v: string[]) => void, onAbrir: () => void
}) {
  if (!valor.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      {valor.map(id => {
        const et = etiquetas.find((x: any) => x.id === id)
        return (
          <span key={id} className="vf-past">
            <button type="button" onClick={onAbrir} title="Abrir los filtros">{et?.nombre || 'Etiqueta'}</button>
            <button type="button" className="x" onClick={() => onChange(valor.filter(x => x !== id))} title="Quitar">✕</button>
          </span>
        )
      })}
      <button type="button" className="vf-limpiar" onClick={() => onChange([])}>Limpiar</button>
    </div>
  )
}

export default function VeloFiltros({ grupos, etiquetas, ejercicios, valor, onChange, nResultado, onCerrar }: {
  grupos: Grupo[], etiquetas: any[], ejercicios: any[], valor: string[], onChange: (v: string[]) => void,
  nResultado: number, onCerrar: () => void,
}) {
  const [vista, setVista] = useState<Vista>('frente')
  const [senalado, setSenalado] = useState<string | null>(null)
  const [abiertas, setAbiertas] = useState<string[]>([])
  const [mas, setMas] = useState(false)
  const [zona, setZona] = useState<string | null>(null)
  const [todosMus, setTodosMus] = useState(false)

  // Cuantos ejercicios lleva cada etiqueta (ella o sus hijas). Se calcula una vez.
  const cuenta = useMemo(() => {
    const m: Record<string, number> = {}
    for (const g of grupos) for (const et of g.etiquetas) {
      const rama = new Set(conDescendientes(etiquetas, et.id))
      m[et.id] = ejercicios.filter(e => (e.etiquetas || []).some((x: string) => rama.has(x))).length
    }
    return m
  }, [grupos, etiquetas, ejercicios])

  const alternar = (id: string) => onChange(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])

  function chips(g: Grupo, lista: any[]) {
    const hijas = g.etiquetas.filter((et: any) => nivelDe(etiquetas, et) > 0)
    const abierta = abiertas.includes(g.key) || hijas.some((h: any) => valor.includes(h.id))
    const ver = abierta ? lista : lista.filter((et: any) => nivelDe(etiquetas, et) === 0)
    return (
      <div className="vf-ops">
        {ver.map((et: any) => (
          <button key={et.id} type="button"
            className={`vf-op ${nivelDe(etiquetas, et) > 0 ? 'hija' : ''} ${valor.includes(et.id) ? 'on' : ''}`}
            onMouseEnter={() => setSenalado(et.id)} onMouseLeave={() => setSenalado(null)}
            onClick={() => alternar(et.id)}>
            {et.nombre}<small>{cuenta[et.id] ?? ''}</small>
          </button>
        ))}
        {hijas.length > 0 && (
          <button type="button" className="vf-mas" onClick={() => setAbiertas(p => p.includes(g.key) ? p.filter(x => x !== g.key) : [...p, g.key])}>
            {abierta ? 'menos ▴' : `+${hijas.length} subetiquetas ▾`}
          </button>
        )}
      </div>
    )
  }

  // Raiz de una etiqueta, para casar por su nombre o el de su madre ("Gluteo > Medio").
  const raizDe = (et: any) => { let r = et, n = 0; while (r?.padre_id && n++ < 8) { const p = etiquetas.find((x: any) => x.id === r.padre_id); if (!p) break; r = p } return r }
  const casa = (et: any, re: RegExp) => re.test(nrm(et.nombre)) || re.test(nrm(raizDe(et)?.nombre || ''))
  const z = ZONAS.find(x => x.id === zona) || null
  const gArt = grupos.find(g => g.key === 'articulacion')
  // MÚSCULOS: los de la vista elegida (con dibujo) y aparte los que no tienen dibujo.
  const gMus = grupos.find(g => g.key === 'musculo')
  // Los de perfil se reparten: los de detras (isquios, gemelo, lumbar...) con la espalda,
  // el resto (cuadriceps, TFL...) con el frente.
  const ladoDe = (c: [Vista, string]): Vista => c[0] !== 'perfil' ? c[0]
    : /isquio|gluteo|gemel|lumbar|deltoides_posterior/.test(c[1]) ? 'espalda' : 'frente'
  const deVista = gMus ? gMus.etiquetas.filter((et: any) => {
    const c = capaDeEtiqueta(etiquetas, et)
    return !!c && ladoDe(c) === vista
  }) : []
  const sinDibujo = gMus ? gMus.etiquetas.filter((et: any) => !capaDeEtiqueta(etiquetas, et)) : []
  // Capas encendidas: las marcadas y la señalada, solo las de esta vista.
  // La figura sigue a lo señalado: si es un musculo que se dibuja de perfil, se pone de perfil.
  const capaSen = senalado ? capaDeEtiqueta(etiquetas, etiquetas.find((x: any) => x.id === senalado)) : null
  const figVista: Vista = capaSen ? capaSen[0] : vista
  const capas = Array.from(new Set([...valor, ...(senalado ? [senalado] : [])]
    .map(id => capaDeEtiqueta(etiquetas, etiquetas.find((x: any) => x.id === id)))
    .filter((c): c is [Vista, string] => !!c && c[0] === figVista).map(c => c[1])))

  const principales = PRINCIPALES.map(k => grupos.find(g => g.key === k)).filter(Boolean) as Grupo[]
  const resto = grupos.filter(g => g.key !== 'musculo' && !PRINCIPALES.includes(g.key))
  const marcadasDe = (g: Grupo) => g.etiquetas.filter((et: any) => valor.includes(et.id)).length

  return (
    <div className="vf-fondo" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{CSS}</style>
      <div className="vf-velo">
        <div className="vf-cab">
          <b>Filtros</b><span>{valor.length ? `${valor.length} marcada${valor.length > 1 ? 's' : ''}` : 'Marca lo que buscas'}</span>
          <button type="button" className="vf-x" onClick={onCerrar}>✕</button>
        </div>
        <div className="vf-cuerpo">
          {gMus && (
            <div className="vf-izq">
              {/* EL MUÑECO PARA FILTRAR RAPIDO: tocas una zona y salen sus musculos y
                  articulaciones. Se gira con Delante / Detrás. */}
              <div className="vf-lbl">Toca una zona{marcadasDe(gMus) ? <em>{marcadasDe(gMus)} músculo{marcadasDe(gMus) > 1 ? 's' : ''}</em> : null}</div>
              <div className="vf-seg">
                {([['frente', 'Delante'], ['espalda', 'Detrás']] as const).map(([v, l]) => (
                  <button key={v} type="button" className={vista === v ? 'on' : ''} onClick={() => setVista(v)}>{l}</button>
                ))}
              </div>
              <div className="vf-fig">
                <img src={urlCapa(figVista, 'base')} alt=""/>
                {capas.map(c => <img key={c} src={urlCapa(figVista, c)} alt=""/>)}
                {figVista === vista && ZONAS.flatMap(zz => ((vista === 'frente' ? zz.frente : zz.espalda) || []).map((r, k) => (
                  <button key={zz.id + k} type="button" title={zz.nombre}
                    className={`vf-zona ${zona === zz.id ? 'on' : ''}`}
                    style={{ left: r[0] + '%', top: r[1] + '%', width: r[2] + '%', height: r[3] + '%' }}
                    onClick={() => { setZona(zona === zz.id ? null : zz.id); setTodosMus(false) }}/>
                )))}
              </div>
              {z ? (
                <>
                  <div className="vf-zt">{z.nombre}<button type="button" className="vf-mas" onClick={() => setZona(null)}>quitar zona ✕</button></div>
                  <div className="vf-lbl">Músculos</div>
                  {(() => { const l = gMus.etiquetas.filter((et: any) => casa(et, z.mus)); return l.length ? chips({ ...gMus, key: 'mz-' + z.id, etiquetas: l }, l) : <div className="vf-nada">Ninguno etiquetado en esta zona</div> })()}
                  {gArt && <>
                    <div className="vf-lbl" style={{ marginTop: 10 }}>Articulaciones</div>
                    {(() => { const l = gArt.etiquetas.filter((et: any) => casa(et, z.art)); return l.length ? chips({ ...gArt, key: 'az-' + z.id, etiquetas: l }, l) : <div className="vf-nada">Ninguna</div> })()}
                  </>}
                </>
              ) : (
                <>
                  <button type="button" className="vf-mas" onClick={() => setTodosMus(v => !v)}>{todosMus ? 'Ocultar todos los músculos ▴' : 'Ver todos los músculos ▾'}</button>
                  {todosMus && chips(gMus, gMus.etiquetas)}
                </>
              )}
            </div>
          )}
          <div className="vf-der">
            {principales.map(g => (
              <div key={g.key} className="vf-sec">
                <div className="vf-lbl">{g.label}{marcadasDe(g) ? <em>{marcadasDe(g)} marcada{marcadasDe(g) > 1 ? 's' : ''}</em> : null}</div>
                {chips(g, g.etiquetas)}
              </div>
            ))}
            {resto.length > 0 && (
              <div className="vf-sec">
                <button type="button" className="vf-mas" style={{ fontSize: 12.5 }} onClick={() => setMas(v => !v)}>
                  {mas ? 'Menos filtros ▴' : `Más filtros (${resto.map(g => g.label.toLowerCase()).join(', ')}) ▾`}
                </button>
                {mas && resto.map(g => (
                  <div key={g.key} style={{ marginTop: 10 }}>
                    <div className="vf-lbl">{g.label}{marcadasDe(g) ? <em>{marcadasDe(g)}</em> : null}</div>
                    {chips(g, g.etiquetas)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="vf-pie">
          {valor.length > 0 && <button type="button" className="vf-limpiar" onClick={() => onChange([])}>Limpiar todo</button>}
          <button type="button" className="vf-ver" onClick={onCerrar}>Ver {nResultado} ejercicio{nResultado === 1 ? '' : 's'}</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.vf-fondo{position:fixed;inset:0;z-index:160;background:rgba(38,40,37,.3);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px}
.vf-velo{width:min(1080px,100%);max-height:92vh;background:#fff;border-radius:22px;box-shadow:0 20px 60px rgba(38,40,37,.2);display:flex;flex-direction:column;overflow:hidden}
.vf-cab{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--bd)}
.vf-cab b{font-size:18px}.vf-cab span{color:var(--grl);font-size:13px}
.vf-x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:1px solid var(--bd);background:#fff;cursor:pointer;font-size:14px}
.vf-cuerpo{display:grid;grid-template-columns:300px 1fr;overflow:auto;flex:1}
@media(max-width:780px){.vf-cuerpo{grid-template-columns:1fr}}
.vf-izq{padding:14px 16px;border-right:1px solid var(--bl);background:#FBFBF9}
.vf-der{padding:10px 18px 14px}
.vf-sec{border-bottom:1px solid var(--bl);padding:10px 0}
.vf-sec:last-child{border-bottom:0}
.vf-lbl{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--grl);font-weight:700;margin-bottom:7px;display:flex;align-items:center;gap:8px}
.vf-lbl em{margin-left:auto;font-style:normal;text-transform:none;letter-spacing:0;color:var(--gd);font-weight:600}
.vf-seg{display:inline-flex;background:#E8E7E1;border-radius:99px;padding:3px;margin-bottom:8px}
.vf-seg button{border:0;background:transparent;border-radius:99px;padding:4px 12px;font-size:12px;color:var(--gr);cursor:pointer;font-family:inherit}
.vf-seg button.on{background:#fff;color:var(--n);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.vf-fig{position:relative;width:190px;aspect-ratio:360/640;margin:0 auto 10px}
.vf-fig img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.vf-zona{position:absolute;border:0;border-radius:12px;background:transparent;cursor:pointer;padding:0;transition:background .12s}
.vf-zona:hover{background:rgba(90,150,158,.22)}
.vf-zona.on{background:rgba(63,120,128,.38);box-shadow:inset 0 0 0 2px #3F7880}
.vf-zt{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;margin:2px 0 8px}
.vf-zt .vf-mas{margin-left:auto;font-weight:600}
.vf-nada{font-size:12px;color:var(--grl)}
.vf-ops{display:flex;flex-wrap:wrap;gap:6px}
.vf-op{border:1.5px solid var(--bd);background:#fff;border-radius:99px;padding:5px 11px;font-size:12.5px;color:var(--n);cursor:pointer;font-family:inherit}
.vf-op.hija{font-size:11.5px;padding:3px 9px;border-style:dashed}
.vf-op small{color:var(--grl);margin-left:4px;font-size:10.5px}
.vf-op.on{background:var(--g);border-color:var(--g);color:#fff;border-style:solid}.vf-op.on small{color:#e3f1f2}
.vf-mas{border:0;background:transparent;color:var(--gd);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;padding:4px 2px}
.vf-pie{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid var(--bd)}
.vf-ver{margin-left:auto;border:0;background:var(--n);color:#fff;border-radius:99px;padding:10px 20px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
.vf-limpiar{border:0;background:transparent;color:var(--gr);text-decoration:underline;font-size:12.5px;cursor:pointer;font-family:inherit}
.vf-past{display:inline-flex;align-items:center;gap:2px;border:1.5px solid var(--gm);background:#fff;border-radius:99px;padding:2px 3px 2px 10px;font-size:12.5px}
.vf-past button{border:0;background:transparent;color:var(--gd);cursor:pointer;font-family:inherit;font-size:12.5px;padding:0}
.vf-past .x{background:var(--gl);border-radius:50%;width:20px;height:20px;font-size:10.5px;margin-left:4px}
`
