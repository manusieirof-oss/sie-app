'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { partesMedida } from '@/lib/medida'
import ImagenEjercicio from '@/components/ImagenEjercicio'

// ---------------------------------------------------------------------------
// LA SESIÓN DE UN PACIENTE, EN TARJETAS (agenda → icono de entreno).
//
// Antes cada ejercicio era una caja con series, reps, kg y un cuadro de nota a la
// vista: diez ejercicios eran una pared de casillas. Ahora se ve lo que se mira de un
// vistazo —la imagen, el nombre y la dosis— y el resto se pide: al tocar la imagen
// salen cuatro iconos (dosis, ejecución, feedbacks, nota) y cada uno abre su hoja
// justo debajo de la tarjeta. Solo una tarjeta abierta a la vez. Las tarjetas son
// pequeñas a propósito: la sesión entera tiene que caber de una vista.
//
// La ejecución y los feedbacks no viven en la sesión sino en la biblioteca, así que se
// piden una vez por sesión (como hace el taller). La nota y el peso se siguen guardando
// igual que antes, al salir de la casilla (guardarAnotacion de la agenda).
// ---------------------------------------------------------------------------

type Hoja = 'dosis' | 'ejec' | 'fb' | 'nota'
const HOJAS: { id: Hoja, icono: string, nombre: string }[] = [
  { id: 'dosis', icono: 'fuerza', nombre: 'Dosis' },
  { id: 'ejec', icono: 'lista', nombre: 'Ejecución' },
  { id: 'fb', icono: 'mensaje', nombre: 'Feedbacks' },
  { id: 'nota', icono: 'nota', nombre: 'Nota' },
]

/** Ancho fijo de cada tarjeta: pequeña, para que la sesión entera quepa de una vista. */
const ANCHO = 104

const textos = (l: any) => (Array.isArray(l) ? l : []).map((i: any) => (typeof i === 'string' ? i : i?.texto || '').trim()).filter(Boolean)

export default function TarjetasSesion({ partes, pesos, setPesos, anotaciones, setAnotaciones, guardarAnotacion, guardandoAnot }: any) {
  const [lib, setLib] = useState<Record<string, any>>({})
  const [abierta, setAbierta] = useState<string | null>(null)
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  // Tocar fuera de la tarjeta abierta (y de su hoja) la cierra, como un menú.
  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-tarjeta]')) { setAbierta(null); setHoja(null) }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta])

  const ids = Array.from(new Set((partes || []).flatMap((p: any) => (p.ejercicios || []).map((e: any) => e.ejercicio_id)).filter(Boolean))) as string[]
  useEffect(() => {
    if (!ids.length) return
    supabase.from('ejercicios').select('id,items_ejecucion,feedbacks,etiquetas,imagen_url,tipo_medida').in('id', ids)
      .then(({ data }) => { const m: Record<string, any> = {}; (data || []).forEach((e: any) => { m[e.id] = e }); setLib(m) })
  }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  /** La dosis en una línea: "3 × 10 · 20 kg", "3 × 30 s". Lo que falte no sale. */
  const dosis = (ej: any) => {
    const kg = pesos[ej.ejercicio_id] || ej.peso
    const vol = ej.tiempo ? `${ej.tiempo} s` : ej.reps
    const base = ej.series && vol ? `${ej.series} × ${vol}` : (vol || (ej.series ? `${ej.series} series` : ''))
    return [base, kg ? `${kg} kg` : ''].filter(Boolean).join(' · ')
  }

  const tocar = (clave: string) => {
    if (abierta === clave) { setAbierta(null); setHoja(null) } else { setAbierta(clave); setHoja(null) }
  }

  const hojaDe = (ej: any) => {
    const l = lib[ej.ejercicio_id] || {}
    const conKg = partesMedida(l.tipo_medida).carga === 'kg'
    const caja = { fontSize: 12.5, padding: '3px 10px', background: 'var(--bl)', borderRadius: 8, minWidth: 34, textAlign: 'center' as const }
    if (hoja === 'dosis') return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {[['Series', ej.series], [ej.tiempo ? 'Segundos' : 'Reps', ej.tiempo || ej.reps]].map(([t, v]) => (
          <div key={t as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--grl)' }}>{t}</span><span style={caja}>{v || '—'}</span>
          </div>
        ))}
        {conKg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--grl)' }}>Kg</span>
            <input type="number" value={pesos[ej.ejercicio_id] || ej.peso || ''} placeholder={ej.peso || '0'}
              onChange={e => setPesos((p: any) => ({ ...p, [ej.ejercicio_id]: e.target.value }))}
              onBlur={() => guardarAnotacion(ej.ejercicio_id)}
              style={{ width: 58, fontSize: 12.5, padding: '3px 6px', border: '1px solid var(--g)', borderRadius: 8, background: 'var(--gl)', color: 'var(--gd)', textAlign: 'center', fontFamily: 'system-ui' }}/>
          </div>
        )}
        {(ej.variante || ej.capacidad) && (
          <div style={{ display: 'flex', gap: 4, width: '100%' }}>
            {ej.variante && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{ej.variante}</span>}
            {ej.capacidad && <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: 'var(--ambl)', color: '#7A5800' }}>{ej.capacidad}</span>}
          </div>
        )}
        {ej.video_url && (
          <a href={ej.video_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--g)', textDecoration: 'none' }}>
            <Ic name="play" size={13}/> Ver vídeo
          </a>
        )}
      </div>
    )
    if (hoja === 'ejec' || hoja === 'fb') {
      const l2 = textos(hoja === 'ejec' ? l.items_ejecucion : l.feedbacks)
      if (!l2.length) return <div style={{ fontSize: 12, color: 'var(--grl)' }}>Sin {hoja === 'ejec' ? 'ejecución' : 'feedbacks'} en la biblioteca.</div>
      return hoja === 'ejec' ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {l2.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.4 }}>
              <span style={{ width: 18, height: 18, borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              {t}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {l2.map((t, i) => <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--bl)', color: 'var(--n)' }}>«{t}»</span>)}
        </div>
      )
    }
    if (hoja === 'nota') return (
      <div>
        <textarea autoFocus value={anotaciones[ej.ejercicio_id] || ''} placeholder="Cómo ha ido, qué cambiar la próxima vez…"
          onChange={e => setAnotaciones((p: any) => ({ ...p, [ej.ejercicio_id]: e.target.value }))}
          onBlur={() => guardarAnotacion(ej.ejercicio_id)}
          style={{ width: '100%', fontSize: 12.5, padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 10, background: 'var(--w)', color: 'var(--n)', resize: 'none', height: 70, fontFamily: 'system-ui', lineHeight: 1.45 }}/>
        <div style={{ fontSize: 10.5, color: guardandoAnot === ej.ejercicio_id ? 'var(--g)' : 'var(--grl)', marginTop: 2 }}>
          {guardandoAnot === ej.ejercicio_id ? 'Guardando…' : 'Se guarda al salir de la casilla'}
        </div>
      </div>
    )
    return null
  }

  // El ejercicio de la tarjeta abierta, para pintar su hoja debajo de todo.
  const [pa, ea] = (abierta || '').split('-').map(Number)
  const ejAbierto = abierta ? (partes || [])[pa]?.ejercicios?.[ea] : null

  return (
    <div ref={raiz}>
      <style>{`.ts-entra{animation:ts-entra .18s ease both}@keyframes ts-entra{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>
      {/* Las partes van una al lado de la otra y saltan de línea solo si no caben:
          así una sesión normal se ve entera en una o dos filas, sin huecos a la derecha. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 26, rowGap: 16 }}>
        {(partes || []).map((parte: any, pi: number) => (
          <div key={pi} style={{ minWidth: 0 }}>
            {parte.nombre && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--g)', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 8 }}>{parte.nombre}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(parte.ejercicios || []).map((ej: any, ei: number) => {
                const clave = `${pi}-${ei}`
                const abierto = abierta === clave
                const l = lib[ej.ejercicio_id] || {}
                const conNota = !!(anotaciones[ej.ejercicio_id] || '').trim()
                const d = dosis(ej)
                return (
                  <div key={clave} data-tarjeta style={{ width: ANCHO }}>
                    <div onClick={() => tocar(clave)} style={{ position: 'relative', cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
                      boxShadow: abierto ? '0 0 0 2px var(--g)' : '0 2px 9px rgba(38,40,37,.10)', transition: 'box-shadow .15s' }}>
                      <ImagenEjercicio src={ej.imagen_url || l.imagen_url} ejercicioId={ej.ejercicio_id} etiquetasEj={l.etiquetas}
                        radio={0} fondo="var(--bl)" icono={20} insignias={!abierto}/>
                      {abierto && (
                        <div className="ts-entra" style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(2px)',
                          display: 'grid', gridTemplateColumns: '1fr 1fr', placeItems: 'center', padding: 8 }}>
                          {HOJAS.map(h => {
                            const on = hoja === h.id
                            return (
                              <button key={h.id} title={h.nombre} onClick={e => { e.stopPropagation(); setHoja(on ? null : h.id) }}
                                style={{ width: 36, height: 36, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative',
                                  background: on ? 'var(--g)' : '#fff', color: on ? '#fff' : 'var(--gd)',
                                  boxShadow: '0 2px 8px rgba(38,40,37,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Ic name={h.icono} size={15}/>
                                {h.id === 'nota' && conNota && !on && <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 99, background: 'var(--amb)' }}/>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '6px 1px 0' }}>
                      <div title={ej.nombre} style={{ fontSize: 11.5, color: 'var(--n)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ej.nombre}</div>
                      {(d || conNota) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--grl)', marginTop: 1 }}>
                          {d && <span>{d}</span>}
                          {conNota && <span title="Tiene nota" style={{ display: 'inline-flex', color: 'var(--amb)' }}><Ic name="nota" size={11}/></span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {ejAbierto && hoja && (
        <div data-tarjeta className="ts-entra" style={{ marginTop: 16, background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 4px 16px rgba(38,40,37,.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ic name={HOJAS.find(h => h.id === hoja)!.icono} size={13} style={{ color: 'var(--g)' }}/>
            <span style={{ fontSize: 12, color: 'var(--gd)', flex: 1 }}>{HOJAS.find(h => h.id === hoja)!.nombre} · {ejAbierto.nombre}</span>
            <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} onClick={() => setHoja(null)}><Ic name="cerrar" size={11}/></button>
          </div>
          {hojaDe(ejAbierto)}
        </div>
      )}
    </div>
  )
}
