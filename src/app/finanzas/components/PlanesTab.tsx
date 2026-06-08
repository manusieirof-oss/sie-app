'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PlanesTab({ planes, recargar }: any) {
  const [editando, setEditando] = useState<string|null>(null)
  const [precioFinal, setPrecioFinal] = useState('')
  const [guardando, setGuardando] = useState(false)

  function iniciarEdicion(p: any) {
    setEditando(p.id)
    const final = Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
    setPrecioFinal(String(final))
  }

  async function guardar(p: any) {
    setGuardando(true)
    const final = parseFloat(precioFinal) || 0
    const base = Math.round((final / (1 + p.iva/100)) * 100) / 100
    await supabase.from('planes').update({ precio_base: base }).eq('id', p.id)
    setEditando(null)
    setGuardando(false)
    recargar()
  }

  return (
    <div className="card">
      <div className="card-title">💶 Planes y precios</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Precios con IVA del 21% incluido. El precio base se calcula automáticamente.</div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,padding:'6px 10px',fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,borderBottom:'1px solid var(--bd)',marginBottom:6}}>
        <div>Plan</div>
        <div style={{textAlign:'right'}}>Base (sin IVA)</div>
        <div style={{textAlign:'right'}}>IVA 21%</div>
        <div style={{textAlign:'right'}}>Final</div>
        <div></div>
      </div>

      {planes.map((p:any) => {
        const ivaImporte = Math.round(p.precio_base * (p.iva/100) * 100) / 100
        const final = Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
        const enEdicion = editando === p.id
        return (
          <div key={p.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,padding:'10px',alignItems:'center',borderRadius:6,background:'var(--bl)',marginBottom:5}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>{p.nombre}</div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--grl)'}}>{p.precio_base.toFixed(2)}€</div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--grl)'}}>{ivaImporte.toFixed(2)}€</div>
            {enEdicion ? (
              <input className="input" type="number" value={precioFinal} onChange={e=>setPrecioFinal(e.target.value)} style={{fontSize:12,textAlign:'right',padding:'4px 8px'}} autoFocus/>
            ) : (
              <div style={{textAlign:'right',fontSize:13,fontWeight:600,color:'var(--g)'}}>{final.toFixed(2)}€</div>
            )}
            <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
              {enEdicion ? (
                <>
                  <button className="btn btn-p btn-sm" onClick={()=>guardar(p)} disabled={guardando}>{guardando?'⏳':'✓'}</button>
                  <button className="btn btn-d btn-sm" onClick={()=>setEditando(null)}>✕</button>
                </>
              ) : (
                <button className="btn btn-s btn-sm" onClick={()=>iniciarEdicion(p)}>✏️</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
