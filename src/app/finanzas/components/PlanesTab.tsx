'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const G='#5A969E', GD='#3E7179'

export default function PlanesTab({ planes, bonos=[], bonosTipos=[], recargar }: any) {
  const [editando, setEditando] = useState<string|null>(null)
  const [modo, setModo] = useState<'final'|'base'>('final')
  const [valor, setValor] = useState('')
  const [ivaEdit, setIvaEdit] = useState('21')
  const [guardando, setGuardando] = useState(false)

  // Bonos activos por tipo: nº de pacientes
  const activosPorTipo: Record<string, number> = {}
  bonos.filter((b:any)=>b.activo).forEach((b:any)=>{ activosPorTipo[b.tipo] = (activosPorTipo[b.tipo]||0)+1 })

  const planPorTipo: Record<string, any> = {}
  planes.forEach((p:any)=>{ planPorTipo[p.bono_tipo] = p })

  const finalDe = (p:any) => p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100

  function iniciarEdicion(p: any) {
    setEditando(p.id)
    setModo('final')
    setIvaEdit(String(p.iva))
    setValor(String(finalDe(p)))
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

  async function crearPlan(tipo: string) {
    setGuardando(true)
    await supabase.from('planes').insert({ bono_tipo: tipo, nombre: nombreTipo(tipo), precio_base: 0, precio_final: 0, iva: 21, activo: true })
    setGuardando(false)
    recargar()
  }

  function nombreTipo(tipo: string) {
    const bt = bonosTipos.find((b:any)=>b.id===tipo)
    return bt ? bt.nombre : tipo
  }

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

  const eur = (n:number) => `${n.toFixed(2)}€`

  return (
    <div className="card">
      <div className="card-title">💶 Planes y precios</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Cada plan corresponde a un tipo de bono. Introduce el precio con IVA o el precio base; el IVA es configurable. Se muestra cuántos pacientes tienen cada bono activo y el ingreso que genera.</div>

      {bonosTipos.length===0 && (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>No hay tipos de bono. Créalos en Ajustes → Bonos.</div>
      )}

      {bonosTipos.map((bt:any) => {
        const p = planPorTipo[bt.id]
        const nPac = activosPorTipo[bt.id] || 0

        // Sin plan: mostrar aviso + botón para crearlo
        if (!p) {
          return (
            <div key={bt.id} style={{display:'flex',alignItems:'center',gap:10,padding:'12px',borderRadius:8,background:'var(--ambl)',border:'1px solid var(--amb)',marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--n)'}}>{bt.nombre}{!bt.activo && ' (inactivo)'}</div>
                <div style={{fontSize:9,color:'#7A5800'}}>Este bono todavía no tiene precio asignado</div>
              </div>
              <button className="btn btn-p btn-sm" onClick={()=>crearPlan(bt.id)} disabled={guardando}>+ Asignar precio</button>
            </div>
          )
        }

        const final = finalDe(p)
        const ingreso = nPac * final
        const enEdicion = editando === p.id
        const preview = enEdicion ? calcularPreview() : null

        if (enEdicion) {
          return (
            <div key={bt.id} style={{padding:'12px',borderRadius:8,background:'var(--gl)',border:'1px solid var(--gm)',marginBottom:6}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--n)',marginBottom:10}}>{bt.nombre}</div>

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
          <div key={bt.id} style={{padding:'12px',borderRadius:8,background:'var(--bl)',marginBottom:6,opacity:bt.activo?1:.55}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--n)'}}>{bt.nombre}{!bt.activo && ' (inactivo)'}</div>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{bt.descripcion || ''}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:16,fontWeight:600,color:G}}>{eur(final)}</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>base {p.precio_base.toFixed(2)}€ · IVA {p.iva}%</div>
              </div>
              <button className="btn btn-s btn-sm" onClick={()=>iniciarEdicion(p)}>✏️</button>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,paddingTop:10,borderTop:'1px solid var(--bd)'}}>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>{nPac}</div>
                <div style={{fontSize:8,color:'var(--grl)'}}>{nPac===1?'paciente activo':'pacientes activos'}</div>
              </div>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:500,color:GD}}>{ingreso.toFixed(0)}€</div>
                <div style={{fontSize:8,color:'var(--grl)'}}>ingreso / mes</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
