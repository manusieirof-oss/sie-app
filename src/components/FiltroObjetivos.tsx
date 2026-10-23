'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import MonedaObjetivo from './MonedaObjetivo'

/**
 * FILTRAR POR OBJETIVO, IGUAL EN TODAS LAS PESTAÑAS (Sesiones, Ciclos...).
 * Un boton abre un velo con buscador y los objetivos como bolas con su nombre; fuera
 * solo quedan los marcados. Antes cada pestaña lo hacia a su manera: una fila con los
 * cien estirados, o un desplegable larguisimo.
 */
const nrm = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function FiltroObjetivos({ objetivos, valor, onChange, nResultado, nombre = 'resultados' }: {
  objetivos: any[], valor: string[], onChange: (v: string[]) => void, nResultado?: number, nombre?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  if (!objetivos?.length) return null
  const alternar = (id: string) => onChange(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])
  const lista = objetivos.filter((o: any) => !busca.trim() || nrm(o.nombre).includes(nrm(busca.trim())))
  return (
    <>
      <button className={`chip-sel ${valor.length ? 'on' : ''}`} onClick={() => { setBusca(''); setAbierto(true) }}>
        <Ic name="objetivo" size={11}/> Objetivo{valor.length ? ` · ${valor.length}` : ''}
      </button>
      {valor.map(id => { const o = objetivos.find((x: any) => x.id === id); return (
        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1.5px solid var(--gm)', borderRadius: 99, padding: '2px 4px 2px 10px', fontSize: 12, color: 'var(--gd)', background: 'var(--w)' }}>
          {o?.nombre || 'Objetivo'}
          <button onClick={() => onChange(valor.filter(x => x !== id))} style={{ border: 0, background: 'var(--gl)', color: 'var(--gd)', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer' }}>✕</button>
        </span>) })}
      {valor.length > 0 && <button className="btn btn-t btn-sm" onClick={() => onChange([])}>Limpiar</button>}
      {abierto && (
        <div className="modal-bg" style={{ zIndex: 160 }} onClick={e => { if (e.target === e.currentTarget) setAbierto(false) }}>
          <div className="modal" style={{ width: 'min(760px,96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-title">Filtrar por objetivo<button className="modal-close" onClick={() => setAbierto(false)}>✕</button></div>
            <input className="input" autoFocus placeholder="Buscar objetivo…" value={busca} onChange={e => setBusca(e.target.value)} style={{ marginBottom: 10 }}/>
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))', gap: '14px 8px', alignContent: 'start', padding: '4px 2px' }}>
              {lista.map((o: any) => {
                const sel = valor.includes(o.id)
                return (
                  <button key={o.id} title={o.nombre} onClick={() => alternar(o.id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 4, borderRadius: 14,
                      boxShadow: sel ? 'inset 0 0 0 2px var(--g)' : 'none', opacity: valor.length && !sel ? .55 : 1 }}>
                    <span style={{ position: 'relative', lineHeight: 0 }}>
                      <MonedaObjetivo objetivo={o} titulo=""/>
                      {sel && <span style={{ position: 'absolute', right: -3, top: -3, width: 18, height: 18, borderRadius: '50%', background: 'var(--g)', color: '#fff', fontSize: 11, lineHeight: '18px', textAlign: 'center', boxShadow: '0 0 0 2px #fff' }}>✓</span>}
                    </span>
                    <span className="obj-mon-g" style={{ color: sel ? 'var(--gd)' : 'var(--gr)', fontSize: 11 }}>{o.nombre}</span>
                  </button>)
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              {valor.length > 0 && <button className="btn btn-t btn-sm" onClick={() => onChange([])}>Limpiar</button>}
              <div style={{ flex: 1 }}/>
              <button className="btn btn-p btn-sm" onClick={() => setAbierto(false)}>{nResultado != null ? `Ver ${nResultado} ${nombre}` : 'Listo'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
