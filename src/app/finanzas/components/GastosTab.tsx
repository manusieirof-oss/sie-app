'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function GastosTab({ gastos, recargar }: any) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ concepto:'', importe:'', tipo:'variable', categoria:'', fecha:new Date().toISOString().split('T')[0], tiene_factura:false, notas:'' })

  async function crear() {
    if (!form.concepto || !form.importe) { alert('Concepto e importe son obligatorios'); return }
    setGuardando(true)
    await supabase.from('gastos').insert({
      concepto: form.concepto,
      importe: parseFloat(form.importe),
      tipo: form.tipo,
      categoria: form.categoria || null,
      fecha: form.fecha,
      tiene_factura: form.tiene_factura,
      notas: form.notas || null,
    })
    setForm({ concepto:'', importe:'', tipo:'variable', categoria:'', fecha:new Date().toISOString().split('T')[0], tiene_factura:false, notas:'' })
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
                {g.tiene_factura && ' · 📄 Con factura'}
              </div>
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
              <div className="field"><label>Importe (€) *</label><input className="input" type="number" value={form.importe} onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/></div>
              <div className="field"><label>Tipo</label>
                <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                  <option value="variable">Variable</option>
                  <option value="fijo">Fijo (mensual)</option>
                </select>
              </div>
            </div>
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
