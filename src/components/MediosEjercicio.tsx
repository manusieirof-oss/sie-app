'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { AnimEjercicio } from '@/lib/anim3d/tipos'
import { MOVIMIENTOS, paramsPorDefecto } from '@/lib/anim3d/movimientos'
import { animacionSugerida } from '@/lib/anim3d/asignar'
import { comoReproducir, type VideoEj } from '@/lib/videos'

const Animacion3D = dynamic(() => import('./Animacion3D'), { ssr: false })

/**
 * Lo que se ve de un ejercicio: pestañas con la animación 3D (si su movimiento está
 * hecho), la foto y cada vídeo. Si no hay nada, `vacio` (la figura de músculos).
 */
export function MediosEjercicio({ anim, foto, videos, vacio, alto = 420 }: {
  anim: AnimEjercicio | null, foto?: string | null, videos: VideoEj[], vacio?: React.ReactNode, alto?: number
}) {
  const pestanas: { id: string, txt: string }[] = []
  if (anim) pestanas.push({ id: 'anim', txt: '🧍 Animación 3D' })
  if (foto) pestanas.push({ id: 'foto', txt: 'Foto' })
  videos.forEach((v, i) => pestanas.push({ id: 'v' + i, txt: '▶ ' + v.titulo }))
  const [sel, setSel] = useState(pestanas[0]?.id || '')
  // Al cambiar de ejercicio, vuelve a la primera pestaña que tenga.
  const firma = pestanas.map(p => p.id).join()
  useEffect(() => { if (!pestanas.some(p => p.id === sel)) setSel(pestanas[0]?.id || '') }, [firma]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!pestanas.length) return <>{vacio}</>
  const v = sel.startsWith('v') ? videos[+sel.slice(1)] : null
  return (
    <div>
      {pestanas.length > 1 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 7 }}>
          {pestanas.map(p => (
            <button key={p.id} type="button" onClick={() => setSel(p.id)}
              style={{ fontFamily: 'inherit', fontSize: 12, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${sel === p.id ? 'var(--n)' : 'var(--bd)'}`, background: sel === p.id ? 'var(--n)' : 'var(--w)', color: sel === p.id ? '#fff' : 'var(--n)' }}>{p.txt}</button>
          ))}
        </div>
      )}
      {sel === 'anim' && anim && <Animacion3D anim={anim} foto={foto} alto={alto} />}
      {sel === 'foto' && foto && <img src={foto} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', background: 'var(--bm)', borderRadius: 8, border: '1px solid var(--bd)', display: 'block' }} />}
      {v && <Reproductor url={v.url} alto={alto} />}
    </div>
  )
}

function Reproductor({ url, alto }: { url: string, alto: number }) {
  const r = comoReproducir(url)
  const marco: React.CSSProperties = { width: '100%', height: alto, border: 0, borderRadius: 10, background: '#111', display: 'block' }
  if (r.tipo === 'iframe') return <iframe src={r.src} style={marco} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
  if (r.tipo === 'video') return <video src={r.src} style={marco} controls playsInline />
  return (
    <div style={{ ...marco, display: 'grid', placeItems: 'center', background: 'var(--bl)', border: '1px solid var(--bd)' }}>
      <a href={r.src} target="_blank" rel="noopener noreferrer" className="btn btn-s btn-sm">Abrir el vídeo</a>
    </div>
  )
}

/**
 * Editor de la animación de un ejercicio. Por defecto "Automática": se deduce del
 * nombre. Se puede fijar otro movimiento y sus parámetros, o quitarla.
 */
export function EditorAnimacion({ nombre, valor, onChange, disabled }: {
  nombre: string, valor: AnimEjercicio | null, onChange: (v: AnimEjercicio | null) => void, disabled?: boolean
}) {
  const auto = animacionSugerida(nombre)
  const efectivo = valor ? (valor.mov === 'ninguno' ? null : valor) : auto
  const mov = valor ? valor.mov : ''
  const def = efectivo ? MOVIMIENTOS[efectivo.mov] : null
  const sel: React.CSSProperties = { fontSize: 13 }
  return (
    <div>
      <select className="input" style={sel} value={mov} disabled={disabled}
        onChange={e => {
          const m = e.target.value
          if (!m) onChange(null)
          else if (m === 'ninguno') onChange({ mov: 'ninguno' })
          else onChange({ mov: m, p: m === auto?.mov ? { ...auto.p } : paramsPorDefecto(m) })
        }}>
        <option value="">Automática{auto ? ` · ${MOVIMIENTOS[auto.mov].nombre}` : ' · ninguna encaja'}</option>
        {Object.values(MOVIMIENTOS).map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        <option value="ninguno">Sin animación</option>
      </select>
      {def && efectivo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 6, marginTop: 6 }}>
          {def.params.map(pa => (
            <label key={pa.id} style={{ fontSize: 11, color: 'var(--grl)' }}>{pa.nombre}
              <select className="input" style={{ ...sel, marginTop: 2 }} disabled={disabled}
                value={efectivo.p?.[pa.id] ?? pa.opciones[0][0]}
                onChange={e => onChange({ mov: efectivo.mov, p: { ...(efectivo.p || {}), [pa.id]: e.target.value } })}>
                {pa.opciones.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {!valor && !auto && <div style={{ fontSize: 11.5, color: 'var(--grl)', marginTop: 4 }}>Ningún movimiento hecho encaja con este nombre: se ve la foto.</div>}
    </div>
  )
}

/** Lista editable de vídeos: título y enlace (YouTube, Vimeo o un archivo de vídeo). */
export function EditorVideos({ videos, onChange, disabled }: { videos: VideoEj[], onChange: (v: VideoEj[]) => void, disabled?: boolean }) {
  const upd = (i: number, k: keyof VideoEj, v: string) => onChange(videos.map((x, j) => j === i ? { ...x, [k]: v } : x))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {videos.map((v, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 5 }}>
          <input className="input" style={{ fontSize: 13 }} value={v.titulo} placeholder="Título" disabled={disabled} onChange={e => upd(i, 'titulo', e.target.value)} />
          <input className="input" style={{ fontSize: 13 }} value={v.url} placeholder="Enlace de YouTube, Vimeo o .mp4" disabled={disabled} onChange={e => upd(i, 'url', e.target.value)} />
          <button type="button" className="btn btn-d btn-sm" disabled={disabled} onClick={() => onChange(videos.filter((_, j) => j !== i))} title="Quitar">✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-s btn-sm" style={{ alignSelf: 'flex-start' }} disabled={disabled}
        onClick={() => onChange([...videos, { titulo: videos.length ? 'Vídeo ' + (videos.length + 1) : 'Técnica', url: '' }])}>+ Añadir vídeo</button>
    </div>
  )
}
