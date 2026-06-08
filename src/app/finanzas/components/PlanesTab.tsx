'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function PlanesTab({ planes, recargar }: any) {
  const [editando, setEditando] = useState<string|null>(null)
  const [modo, setModo] = useState<'final'|'base'>('final')
  const [valor, setValor] = useState('')
  const [ivaEdit, setIvaEdit] = useState('21')
  const [guardando, setGuardando] = useState(false)

  function iniciarEdicion(p: any) {
    setEditando(p.id)
    setModo('final')
    setIvaEdit(String(p.iva))
    const final = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
    setValor(String(final))
  }

  async function guardar(p: any) {
    setGuardando(true)
    const v = parseFloat(valor) || 0
    const iva = parseFloat(ivaEdit) || 0
    let base, finalP
    if (modo === 'final') {
      finalP = v
      base = Math.round((v / (1 + iva/100)) * 100) / 100
    } else {
      base = v
      finalP = Math.round(v * (1 + iva/100) * 100) / 100
    }
    await supabase.from('planes').update({ precio_base: base, precio_final: finalP, iva }).eq('id', p.id)
    setEditando(null)
    setGuardando(false)
    recargar()
  }

  // Cálculo en vivo para mostrar la previsualización mientras editas
  function calcularPreview() {
    const v = parseFloat(valor) || 0
    const iva = parseFloat(ivaEdit) || 0
    if (modo === 'final') {
      const base = Math.round((v / (1 + iva/100)) * 100) / 100
      return { base, final: v, ivaImporte: Math.round((v - base) * 100) / 100 }
    } else {
      const final = Math.round(v * (1 + iva/100) * 100) / 100
      return { base: v, final, ivaImporte: Math.round((final - v) * 100) / 100 }
    }
  }

  return (
    <div className="card">
      <div className="card-title">💶 Planes y precios</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Edita el precio de cada plan. Puedes introducir el precio con IVA o el precio base, y el IVA es configurable.</div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,padding:'6px 10px',fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,borderBottom:'1px solid var(--bd)',marginBottom:6}}>
        <div>Plan</div>
        <div style={{textAlign:'right'}}>Base</div>
        <div style={{textAlign:'right'}}>IVA</div>
        <div style={{textAlign:'right'}}>Final</div>
        <div></div>
      </div>

      {planes.map((p:any) => {
        const final = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
        const ivaImporte = Math.round((final - p.precio_base) * 100) / 100
        const enEdicion = editando === p.id
        const preview = enEdicion ? calcularPreview() : null

        if (enEdicion) {
          return (
            <div key={p.id} style={{padding:'12px',borderRadius:8,background:'var(--gl)',border:'1px solid var(--gm)',marginBottom:6}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--n)',marginBottom:10}}>{p.nombre}</div>

              {/* SELECTOR DE MODO */}
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                <button onClick={()=>setModo('final')} style={{flex:1,padding:'6px',borderRadius:6,border:`1.5px solid ${modo==='final'?'var(--g)':'var(--bd)'}`,background:modo==='final'?'var(--g)':'var(--w)',color:modo==='final'?'#fff':'var(--gr)',fontSize:10,cursor:'pointer',fontFamily:'system-ui'}}>Introducir precio CON IVA</button>
                <button onClick={()=>setModo('base')} style={{flex:1,padding:'6px',borderRadius:6,border:`1.5px solid ${modo==='base'?'var(--g)':'var(--bd)'}`,background:modo==='base'?'var(--g)':'var(--w)',color:modo==='base'?'#fff':'var(--gr)',fontSize:10,cursor:'pointer',fontFamily:'system-ui'}}>Introducir precio SIN IVA</button>
              </div>

              <div className="g2">
                <div className="field"><label>{modo==='final'?'Precio final (con IVA)':'Precio base (sin IVA)'}</label>
                  <input className="input" type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0.00" autoFocus/>
                </div>
                <div className="field"><label>IVA (%)</label>
                  <input className="input" type="number" value={ivaEdit} onChange={e=>setIvaEdit(e.target.value)} placeholder="21"/>
                </div>
              </div>

              {/* PREVISUALIZACIÓN */}
              {preview && (
                <div style={{display:'flex',gap:14,padding:'8px 12px',background:'var(--w)',borderRadius:6,marginBottom:10,fontSize:10}}>
                  <div><span style={{color:'var(--grl)'}}>Base: </span><span style={{fontWeight:500}}>{preview.base.toFixed(2)}€</span></div>
                  <div><span style={{color:'var(--grl)'}}>IVA: </span><span style={{fontWeight:500}}>{preview.ivaImporte.toFixed(2)}€</span></div>
                  <div><span style={{color:'var(--grl)'}}>Final: </span><span style={{fontWeight:600,color:'var(--g)'}}>{preview.final.toFixed(2)}€</span></div>
                </div>
              )}

              <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                <button className="btn btn-d btn-sm" onClick={()=>setEditando(null)}>Cancelar</button>
                <button className="btn btn-p btn-sm" onClick={()=>guardar(p)} disabled={guardando}>{guardando?'⏳':'💾 Guardar'}</button>
              </div>
            </div>
          )
        }

        return (
          <div key={p.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,padding:'10px',alignItems:'center',borderRadius:6,background:'var(--bl)',marginBottom:5}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>{p.nombre}</div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--grl)'}}>{p.precio_base.toFixed(2)}€</div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--grl)'}}>{p.iva}% · {ivaImporte.toFixed(2)}€</div>
            <div style={{textAlign:'right',fontSize:13,fontWeight:600,color:'var(--g)'}}>{final.toFixed(2)}€</div>
            <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
              <button className="btn btn-s btn-sm" onClick={()=>iniciarEdicion(p)}>✏️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
