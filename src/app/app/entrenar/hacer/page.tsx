'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { camposDe, ETIQUETA, EjBib } from '../comun'

// HACER UNA SESIÓN POR SU CUENTA. Cada ejercicio con su foto, lo que le puso el centro (si
// es la del centro), sus series para anotar y «Hecho». Al acabar, «Sesión hecha»: antes
// le pide anotar lo de los que marcó hechos. Se guarda con app_guardar_entreno.

interface Item { id: string, nombre: string, imagen: string | null, medida: string, pauta?: string, hecho: boolean, series: Record<string, string>[] }
const ll = (x: any) => x !== '' && x != null

function Hacer() {
  const de = useSearchParams().get('de') || ''
  const [items, setItems] = useState<Item[] | null>(null)
  const [nombre, setNombre] = useState('')
  const [falta, setFalta] = useState<string[]>([])
  const [hecho, setHecho] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    (async () => {
      const { data: bib } = await supabase.rpc('app_biblioteca')
      const porId: Record<string, EjBib> = Object.fromEntries((bib || []).map((e: EjBib) => [e.id, e]))
      if (de === 'centro') {
        const { data } = await supabase.rpc('app_mi_sesion')
        const s = data?.sesion
        setNombre(s?.nombre || 'Sesión del centro')
        const lista: Item[] = []
        for (const p of (s?.partes || [])) for (const e of (p.ejercicios || [])) if (e.id) lista.push({
          id: e.id, nombre: e.nombre, imagen: e.imagen, medida: porId[e.id]?.medida || 'peso_reps', hecho: false,
          pauta: [ll(e.series) && `${e.series} series`, ll(e.reps) && `${e.reps} reps`, ll(e.tiempo) && `${e.tiempo} s`, ll(e.peso) && `${e.peso} kg`].filter(Boolean).join(' · '),
          series: [{}],
        })
        setItems(lista)
      } else {
        const { data } = await supabase.rpc('app_mis_sesiones')
        const s = (data || []).find((x: any) => x.id === de)
        setNombre(s?.nombre || 'Mi sesión')
        setItems((s?.ejercicios || []).filter((id: string) => porId[id]).map((id: string) => ({ id, nombre: porId[id].nombre, imagen: porId[id].imagen, medida: porId[id].medida, hecho: false, series: [{}] })))
      }
    })()
  }, [de])

  const cambiar = (i: number, f: (x: Item) => Item) => setItems(l => (l || []).map((x, k) => k === i ? f(x) : x))
  const anotado = (x: Item) => x.series.some(s => Object.values(s).some(ll))

  async function terminar() {
    const sinAnotar = (items || []).filter(x => x.hecho && !anotado(x)).map(x => x.id)
    if (sinAnotar.length) { setFalta(sinAnotar); document.getElementById('ej-' + sinAnotar[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    if (!(items || []).some(x => x.hecho)) { alert('Marca como hecho al menos un ejercicio.'); return }
    setGuardando(true)
    const { data } = await supabase.rpc('app_guardar_entreno', {
      orig: de === 'centro' ? 'centro' : 'propia', sid: de === 'centro' ? null : de, nom: nombre,
      items: (items || []).map(x => ({ ejercicio_id: x.id, hecho: x.hecho, series: x.hecho ? x.series.filter(s => Object.values(s).some(ll)) : [] })),
    })
    setGuardando(false)
    if (data) setHecho(true); else alert('No se ha podido guardar. Inténtalo otra vez.')
  }

  if (hecho) return (
    <div className="capp-centro" style={{ textAlign: 'center' }}>
      <h1>¡Sesión hecha!</h1>
      <p>Has hecho {(items || []).filter(x => x.hecho).length} de {(items || []).length} ejercicios. Sumarán veces a tus cromos en el sobre del miércoles.</p>
      <a href="/app/entrenar" className="capp-boton" style={{ textDecoration: 'none' }}>Volver</a>
    </div>
  )
  if (!items) return <div className="capp-centro"><h1>Un momento…</h1></div>
  return (
    <main className="capp-col" style={{ paddingBottom: 120 }}>
      <header className="capp-hola"><small><a href="/app/entrenar" style={{ color: 'inherit' }}>← Entrenar</a></small><h1>{nombre}</h1></header>
      {items.length === 0 && <div className="capp-vacio">Esta sesión no tiene ejercicios que puedas hacer por tu cuenta.</div>}
      {items.map((x, i) => {
        const [carga, vol] = camposDe(x.medida)
        const campos = [carga, vol].filter(Boolean) as string[]
        return (
          <section key={x.id} id={'ej-' + x.id} className={`capp-hacer${x.hecho ? ' hecho' : ''}${falta.includes(x.id) ? ' falta' : ''}`}>
            <div className="cab">
              <span className="img">{x.imagen ? <img src={x.imagen} alt=""/> : null}</span>
              <span className="txt"><b>{x.nombre}</b>{x.pauta && <span>{x.pauta}</span>}</span>
              <button type="button" className="marca" aria-pressed={x.hecho} onClick={() => { cambiar(i, y => ({ ...y, hecho: !y.hecho })); setFalta(f => f.filter(z => z !== x.id)) }}>{x.hecho ? '✓ Hecho' : 'Hecho'}</button>
            </div>
            {x.hecho && <>
              {falta.includes(x.id) && <p className="aviso">Anota lo que hiciste antes de terminar.</p>}
              <div className="series">
                {x.series.map((s, k) => (
                  <div key={k} className="serie">
                    <span className="n">{k + 1}</span>
                    {campos.map(c => (
                      <label key={c}><input inputMode={c === 'banda' ? 'text' : 'decimal'} value={s[c] || ''} placeholder={ETIQUETA[c]}
                        onChange={e => cambiar(i, y => ({ ...y, series: y.series.map((z, m) => m === k ? { ...z, [c]: e.target.value } : z) }))}/></label>
                    ))}
                  </div>
                ))}
                <button type="button" className="mas" onClick={() => cambiar(i, y => ({ ...y, series: [...y.series, { ...y.series[y.series.length - 1] }] }))}>+ Serie</button>
              </div>
            </>}
          </section>
        )
      })}
      <div className="capp-pie-fijo">
        <button type="button" className="capp-boton" disabled={guardando} onClick={terminar}>{guardando ? 'Guardando…' : 'Sesión hecha'}</button>
      </div>
    </main>
  )
}
export default function Pagina() { return <Suspense><Hacer/></Suspense> }
