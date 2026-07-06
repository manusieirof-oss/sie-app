'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function GastosTab({ gastos, recargar }: any) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ concepto:'', importe:'', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:new Date().toISOString().split('T')[0], tiene_factura:false, notas:'' })

  // Cálculo en vivo del desglose a partir del total (importe con IVA incluido)
  const total = parseFloat(form.importe) || 0
  const ivaPct = parseFloat(form.iva_pct) || 0
  const irpfPct = parseFloat(form.irpf_pct) || 0
  const base = ivaPct > 0 ? total / (1 + ivaPct/100) : total
  const ivaImporte = total - base
  const irpfImporte = base * (irpfPct/100)

  async function crear() {
    if (!form.concepto || !form.importe) { alert('Concepto e importe son obligatorios'); return }
    setGuardando(true)
    await supabase.from('gastos').insert({
      concepto: form.concepto,
      importe: total,
      base_imponible: Math.round(base*100)/100,
      iva_pct: ivaPct,
      irpf_pct: irpfPct,
      irpf_modelo: irpfPct > 0 ? form.irpf_modelo : null,
      tipo: form.tipo,
      categoria: form.categoria || null,
      fecha: form.fecha,
      tiene_factura: form.tiene_factura,
      notas: form.notas || null,
    })
    setForm({ concepto:'', importe:'', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:new Date().toISOString().split('T')[0], tiene_factura:false, notas:'' })
    setModal(false)
    setGuardando(false)
    recargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    recargar()
  }

  const totalMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===new Date().toISOString().slice(0,7)).reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  const totalFijos = gastos.filter((g:any)=>g.tipo==='fijo').reduce((acc:number,g:any)=>acc+Number(g.importe),0)

  // Media mensual de los últimos 3 meses (excluyendo el mes actual incompleto)
  const hoy = new Date()
  const mesesRef: string[] = []
  for (let i=1; i<=3; i++) { const d=new Date(hoy.getFullYear(), hoy.getMonth()-i, 1); mesesRef.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const totalUlt3 = gastos.filter((g:any)=>mesesRef.includes(g.fecha?.slice(0,7))).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const mediaMensual = totalUlt3/3

  // Desglose por categoría (todos los gastos)
  const porCat: Record<string, number> = {}
  gastos.forEach((g:any)=>{ const c=g.categoria||'Sin categoría'; porCat[c]=(porCat[c]||0)+Number(g.importe) })
  const catList = Object.entries(porCat).map(([cat,total]:any)=>({cat,total})).sort((a,b)=>b.total-a.total)
  const maxCat = catList.length ? catList[0].total : 1

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div className="card-title" style={{margin:0}}>🧾 Gastos</div>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nuevo gasto</button>
      </div>

      <div className="g2" style={{marginBottom:14}}>
        <div style={{background:'var(--redl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'var(--red)'}}>{totalMes.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>Gastos este mes</div>
        </div>
        <div style={{background:'var(--ambl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'#7A5800'}}>{totalFijos.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>Total gastos fijos</div>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div style={{background:'var(--bl)',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
        <div style={{display:'flex',gap:16,marginBottom:catList.length?12:0,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:18,fontWeight:300,color:'var(--n)'}}>{mediaMensual.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)'}}>Media mensual (últ. 3 meses)</div>
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:300,color:'#7A5800'}}>{totalFijos.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)'}}>Fijos esperados/mes</div>
          </div>
        </div>
        {catList.length>0 && (
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:8}}>Por categoría</div>
            {catList.map(({cat,total})=>(
              <div key={cat} style={{marginBottom:7}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                  <span style={{color:'var(--n)'}}>{cat}</span>
                  <span style={{fontWeight:600,color:'var(--gd)'}}>{total.toFixed(2)}€</span>
                </div>
                <div style={{height:6,borderRadius:99,background:'var(--bm)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(total/maxCat)*100}%`,background:'#5A969E',borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {gastos.length===0 ? (
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin gastos registrados</div>
      ) : (
        gastos.map((g:any) => (
          <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:5,background:'var(--bl)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:g.tipo==='fijo'?'var(--amb)':'var(--grl)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{g.concepto}</div>
              <div style={{fontSize:9,color:'var(--grl)'}}>
                {new Date(g.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
                {g.categoria && ' · '+g.categoria}
                {' · '+(g.tipo==='fijo'?'Fijo':'Variable')}
                {g.tiene_factura && ' · 📄'}
              </div>
              {(g.iva_pct>0 || g.irpf_pct>0) && (
                <div style={{fontSize:8,color:'var(--grl)',marginTop:1}}>
                  Base {Number(g.base_imponible||0).toFixed(2)}€
                  {g.iva_pct>0 && ` · IVA ${g.iva_pct}% (${(Number(g.importe)-Number(g.base_imponible||0)).toFixed(2)}€)`}
                  {g.irpf_pct>0 && ` · IRPF ${g.irpf_pct}%`}
                </div>
              )}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:'var(--red)'}}>{Number(g.importe).toFixed(2)}€</div>
            <button onClick={()=>eliminar(g.id)} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>🗑</button>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo gasto<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Concepto *</label><input className="input" value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))} placeholder="ej. Alquiler local" autoFocus/></div>
            <div className="g2">
              <div className="field"><label>Total (€, con IVA) *</label><input className="input" type="number" value={form.importe} onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/></div>
              <div className="field"><label>Tipo</label>
                <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                  <option value="variable">Variable</option>
                  <option value="fijo">Fijo (mensual)</option>
                </select>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>IVA (%)</label>
                <select className="input" value={form.iva_pct} onChange={e=>setForm(p=>({...p,iva_pct:e.target.value}))}>
                  <option value="21">21%</option>
                  <option value="10">10%</option>
                  <option value="4">4%</option>
                  <option value="0">Sin IVA (0%)</option>
                </select>
              </div>
              <div className="field"><label>IRPF (%)</label><input className="input" type="number" value={form.irpf_pct} onChange={e=>setForm(p=>({...p,irpf_pct:e.target.value}))} placeholder="0"/></div>
            </div>
            {irpfPct > 0 && (
              <div className="field"><label>¿Qué retención es? (modelo)</label>
                <select className="input" value={form.irpf_modelo} onChange={e=>setForm(p=>({...p,irpf_modelo:e.target.value}))}>
                  <option value="111">111 · Profesional / trabajador</option>
                  <option value="115">115 · Alquiler del local</option>
                </select>
              </div>
            )}

            {total > 0 && (
              <div style={{display:'flex',gap:12,padding:'8px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                <div><span style={{color:'var(--grl)'}}>Base: </span><span style={{fontWeight:500}}>{base.toFixed(2)}€</span></div>
                <div><span style={{color:'var(--grl)'}}>IVA: </span><span style={{fontWeight:500}}>{ivaImporte.toFixed(2)}€</span></div>
                {irpfPct>0 && <div><span style={{color:'var(--grl)'}}>IRPF: </span><span style={{fontWeight:500}}>−{irpfImporte.toFixed(2)}€</span></div>}
              </div>
            )}

            <div className="g2">
              <div className="field"><label>Categoría</label><input className="input" value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))} placeholder="ej. Suministros"/></div>
              <div className="field"><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/></div>
            </div>
            <div onClick={()=>setForm(p=>({...p,tiene_factura:!p.tiene_factura}))} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,border:`1px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}>
              <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {form.tiene_factura && <span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:10,color:'var(--n)'}}>📄 Tiene factura</span>
            </div>
            <div className="field"><label>Notas</label><textarea className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} style={{minHeight:50}}/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando?'⏳':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
