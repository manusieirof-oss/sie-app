'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { contiene, normalizar } from '@/lib/texto'
import { categoriaDe, CATEGORIAS_ETIQUETA } from '@/lib/etiquetas'
import { TIPOS_MEDIDA, moverAFamilia } from '@/lib/ejercicios'

// ---------------------------------------------------------------------------
// PONER EN COMÚN: varios ejercicios elegidos en el torno y, de una vez, lo que
// comparten: familia, etiquetas, cómo se mide, ejecución y feedbacks.
//
// SOLO AÑADE, NUNCA QUITA. Las etiquetas y las frases se suman a las que ya tenga
// cada uno (sin repetir); así aplicarlo a uno ya hecho no le borra nada. Lo único que
// se sustituye es "cómo se mide", porque solo puede tener uno.
// ---------------------------------------------------------------------------

export default function EnComun({ elegidos, todos, onHecho, onCerrar }: {
  elegidos: any[], todos: any[], onHecho: () => void, onCerrar: () => void,
}) {
  const [ets, setEts] = useState<any[]>([])
  const [familia, setFamilia] = useState('')
  const [etAdd, setEtAdd] = useState<string[]>([])
  const [buscaEt, setBuscaEt] = useState('')
  const [medida, setMedida] = useState('')
  const [ejec, setEjec] = useState('')
  const [fbs, setFbs] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    traerTodo((d, h) => supabase.from('etiquetas').select('id,nombre,padre_id,categoria').order('id').range(d, h)).then(r => setEts(r.filas))
  }, [])

  const ids = elegidos.map(e => e.id)
  // Las etiquetas que ya tienen TODOS: se ven, para no volver a ponerlas.
  const yaComunes = useMemo(() => {
    if (!elegidos.length) return [] as string[]
    return (elegidos[0].etiquetas || []).filter((id: string) => elegidos.every(e => (e.etiquetas || []).includes(id)))
  }, [elegidos])
  const encontradas = buscaEt.trim() ? ets.filter(e => contiene(e.nombre, buscaEt) && !etAdd.includes(e.id)).slice(0, 18) : []
  const nombreEt = (id: string) => ets.find(e => e.id === id)?.nombre || '…'
  const otrasPortadas = todos.filter(e => !e.portada_id && !ids.includes(e.id))
  const lineas = (t: string) => t.split('\n').map(x => x.trim()).filter(Boolean)
  const hayAlgo = !!familia || etAdd.length > 0 || !!medida || lineas(ejec).length > 0 || lineas(fbs).length > 0

  /** Suma frases nuevas a una lista sin repetir las que ya estén (sin mirar mayúsculas ni tildes). */
  const sumar = (lista: any[] | null, nuevas: string[]) => {
    const l = (lista || []).filter((i: any) => i?.texto?.trim())
    const tiene = new Set(l.map((i: any) => normalizar(i.texto).trim()))
    return [...l, ...nuevas.filter(t => !tiene.has(normalizar(t).trim())).map(texto => ({ texto }))]
  }

  async function aplicar() {
    setAplicando(true); setError('')
    const nEj = lineas(ejec), nFb = lineas(fbs)
    for (const e of elegidos) {
      const cambio: any = {}
      if (etAdd.length) cambio.etiquetas = Array.from(new Set([...(e.etiquetas || []), ...etAdd]))
      if (medida) cambio.tipo_medida = medida
      if (nEj.length) cambio.items_ejecucion = sumar(e.items_ejecucion, nEj)
      if (nFb.length) cambio.feedbacks = sumar(e.feedbacks, nFb)
      if (Object.keys(cambio).length) {
        const { error: er } = await supabase.from('ejercicios').update(cambio).eq('id', e.id)
        if (er) { setError(`${e.nombre}: ${er.message}`); setAplicando(false); return }
      }
    }
    // La familia al final: si la portada elegida es uno de ellos, los demás cuelgan de él.
    if (familia) {
      const destino = todos.find(x => x.id === familia)
      for (const e of elegidos) {
        if (e.id === familia || e.portada_id === (destino?.portada_id || familia)) continue
        const r = await moverAFamilia(e.id, destino)
        if (r.ok === false) { setError(`${e.nombre}: ${r.error}`); setAplicando(false); return }
      }
    }
    setAplicando(false)
    onHecho()
  }

  const bloque = (titulo: string, ayuda: string, hijos: any) => (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--bd)' }}>
      <div className="et-mini">{titulo}</div>
      <div style={{ fontSize: 11.5, color: 'var(--grl)', margin: '2px 0 8px' }}>{ayuda}</div>
      {hijos}
    </div>
  )

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(38,40,37,.18)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="t-fade"
        style={{ width: 'min(620px, 100%)', maxHeight: 'calc(100vh - 40px)', overflow: 'auto', background: '#fff',
          borderRadius: 22, padding: '18px 22px', boxShadow: '0 24px 60px rgba(38,40,37,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 17 }}>En común a {elegidos.length} ejercicios</div>
          <button className="btn btn-t btn-sm" onClick={onCerrar}><Ic name="cerrar" size={12}/></button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '8px 0 6px' }}>
          {elegidos.map(e => <span key={e.id} className="chip-sel" style={{ fontSize: 11.5, cursor: 'default' }}>{e.nombre}</span>)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--grl)', marginBottom: 6 }}>Solo se añade: no se quita nada de lo que ya tengan.</div>

        {bloque('Familia', 'El principal; el resto pasan a ser sus variantes.', (
          <select className="input" value={familia} onChange={e => setFamilia(e.target.value)}>
            <option value="">No cambiar</option>
            <optgroup label="Uno de los elegidos">
              {elegidos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </optgroup>
            <optgroup label="Otro principal de la biblioteca">
              {otrasPortadas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </optgroup>
          </select>
        ))}

        {bloque('Etiquetas', 'Se suman a las suyas.', (<>
          {yaComunes.length > 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--gr)', marginBottom: 6 }}>Ya las tienen todos: {yaComunes.map(nombreEt).join(', ')}</div>
          )}
          {etAdd.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {etAdd.map(id => <span key={id} className="chip-sel on" style={{ fontSize: 12 }} onClick={() => setEtAdd(l => l.filter(x => x !== id))}>{nombreEt(id)} ✕</span>)}
            </div>
          )}
          <input className="input" value={buscaEt} onChange={e => setBuscaEt(e.target.value)} placeholder="Busca una etiqueta…"/>
          {encontradas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {encontradas.map(e => (
                <span key={e.id} className="chip-sel" style={{ fontSize: 12 }} title={CATEGORIAS_ETIQUETA.find(c => c.key === categoriaDe(ets, e))?.label}
                  onClick={() => { setEtAdd(l => [...l, e.id]); setBuscaEt('') }}>{e.nombre}</span>
              ))}
            </div>
          )}
        </>))}

        {bloque('Cómo se mide', 'Este sí se cambia: cada ejercicio solo tiene uno.', (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[{ id: '', nombre: 'No cambiar' }, ...TIPOS_MEDIDA].map(m => (
              <span key={m.id} className={`chip-sel ${medida === m.id ? 'on' : ''}`} style={{ fontSize: 12.5 }} onClick={() => setMedida(m.id)}>{m.nombre}</span>
            ))}
          </div>
        ))}

        {bloque('Ejecución', 'Una por línea. Se suman a las suyas.', (
          <textarea className="input" rows={3} value={ejec} onChange={e => setEjec(e.target.value)} placeholder="Ej. Espalda neutra"/>
        ))}

        {bloque('Feedbacks', 'Una por línea. Se suman a los suyos.', (
          <textarea className="input" rows={3} value={fbs} onChange={e => setFbs(e.target.value)} placeholder="Ej. Saca el aire al subir"/>
        ))}

        {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn btn-t" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={!hayAlgo || aplicando} onClick={aplicar}>
            {aplicando ? 'Aplicando…' : `Aplicar a ${elegidos.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}
