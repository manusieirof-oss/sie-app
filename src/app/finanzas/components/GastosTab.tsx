'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO, mesISO } from '@/lib/fechas'

export default function GastosTab({ gastos, recargar, mesRef }: any) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [form, setForm] = useState({ concepto:'', importe:'', metodo:'total', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' })

  /**
   * EL DESGLOSE, A PARTIR DEL NÚMERO QUE TENGAS A MANO.
   *
   * Antes solo se podía meter el total y la base salía de dividir entre 1+IVA.
   * Eso vale cuando el total es base + IVA, y deja de valer en cuanto hay
   * RETENCIÓN: en una factura de alquiler el total ya lleva el IRPF restado.
   *
   *   Alquiler:  655,00 base + 137,55 IVA − 124,45 IRPF = 668,10 total
   *   La app:    668,10 / 1,21 = 552,15 de base  ← 102,85 € de menos
   *
   * Y no era un número feo en pantalla: con esa base te deducías 21,60 € menos
   * de IVA soportado cada mes y declarabas 19,54 € menos de retención en el 115.
   *
   * La solución no es adivinar cuál de los dos casos es. Es preguntar qué número
   * estás copiando de la factura, que es algo que quien la tiene delante sabe
   * sin dudar. Con retención, lo natural es teclear la BASE.
   */
  const ivaPct = parseFloat(form.iva_pct) || 0
  const irpfPct = parseFloat(form.irpf_pct) || 0
  const importe = parseFloat(form.importe) || 0

  const base = form.metodo === 'base' ? importe
    : ivaPct > 0 ? importe / (1 + ivaPct/100)
    : importe
  const ivaImporte = base * (ivaPct/100)
  const irpfImporte = base * (irpfPct/100)
  /** Lo que sale de la cuenta: base + IVA − retención. Es lo que pagas de verdad. */
  const total = base + ivaImporte - irpfImporte

  async function crear() {
    if (!form.concepto || !form.importe) { setError('Concepto e importe son obligatorios'); return }
    setGuardando(true)
    setError(null)
    const { error: errIns } = await supabase.from('gastos').insert({
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
    setGuardando(false)
    // Cerrar el modal sin mirar el error daba un gasto "guardado" que no existía.
    if (errIns) { setError(`No se ha podido guardar el gasto: ${errIns.message}`); return }
    setForm({ concepto:'', importe:'', metodo:form.metodo, iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' })
    setModal(false)
    recargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: errDel } = await supabase.from('gastos').delete().eq('id', id)
    if (errDel) { setError(`No se ha podido eliminar el gasto: ${errDel.message}`); return }
    recargar()
  }

  const mesActual = mesRef || mesISO()
  const totalMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual).reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  const totalFijos = gastos.filter((g:any)=>g.tipo==='fijo').reduce((acc:number,g:any)=>acc+Number(g.importe),0)

  // Fijos POR MES. El mismo dato se enseñaba abajo como "Fijos esperados/mes"
  // siendo el acumulado de todo el histórico, así que con medio año cargado
  // decía seis veces lo que toca pagar cada mes.
  const fijosPorMes: Record<string, number> = {}
  gastos.filter((g:any)=>g.tipo==='fijo'&&g.fecha).forEach((g:any)=>{
    const m = g.fecha.slice(0,7); fijosPorMes[m] = (fijosPorMes[m]||0) + Number(g.importe)
  })
  const nMesesFijos = Object.keys(fijosPorMes).length
  const fijosMedios = nMesesFijos ? Object.values(fijosPorMes).reduce((a,b)=>a+b,0)/nMesesFijos : 0

  // Media mensual de los últimos 3 meses (excluyendo el mes actual incompleto)
  const hoy = mesRef ? new Date(`${mesRef}-01T12:00:00`) : new Date()
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
        <div className="card-title" style={{margin:0}}><span className="ct-l"><Ic name="recibo"/> Gastos</span></div>
        <button className="btn btn-p btn-sm" onClick={()=>setModal(true)}>+ Nuevo gasto</button>
      </div>

      {error && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
        </div>
      )}

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
            <div style={{fontSize:18,fontWeight:300,color:'#7A5800'}}>{fijosMedios.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)'}}>Fijos esperados/mes{nMesesFijos>1?` (media de ${nMesesFijos})`:''}</div>
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
                {g.tiene_factura && ' · con factura'}
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
            <button onClick={()=>eliminar(g.id)} style={{color:'var(--red)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="papelera" size={13}/></button>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo gasto<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Concepto *</label><input className="input" value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))} placeholder="ej. Alquiler local" autoFocus/></div>
            <div className="g2">
              <div className="field">
                <label>{form.metodo === 'base' ? 'Base imponible (€) *' : 'Total pagado (€) *'}</label>
                <input className="input" type="number" value={form.importe} onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/>
              </div>
              <div className="field"><label>Tipo</label>
                <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                  <option value="variable">Variable</option>
                  <option value="fijo">Fijo (mensual)</option>
                </select>
              </div>
            </div>
            {/* QUÉ NÚMERO ESTÁS COPIANDO. Con retención el total no es base+IVA
                —lleva el IRPF restado— así que no se puede deducir la base a
                partir de él. Se pregunta en vez de adivinar. */}
            <div className="field">
              <label>¿Qué importe vas a escribir?</label>
              <div style={{display:'flex',gap:6}}>
                {[['total','El total pagado'],['base','La base imponible']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(p=>({...p,metodo:v}))}
                    style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            border:`1.5px solid ${form.metodo===v?'var(--g)':'var(--bd)'}`,
                            background:form.metodo===v?'var(--g)':'var(--w)',
                            color:form.metodo===v?'#fff':'var(--gr)'}}>{l}</button>
                ))}
              </div>
              {irpfPct > 0 && form.metodo === 'total' && (
                <div style={{fontSize:9,color:'var(--amb)',marginTop:5,lineHeight:1.5,display:'flex',gap:4}}>
                  <Ic name="alerta" size={11}/>
                  <span>Con retención, el total ya lleva el IRPF restado y la base no se puede
                  calcular desde él. Pon <strong>la base imponible</strong>, que en tu factura
                  es el importe de la renta.</span>
                </div>
              )}
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

            {/* El desglose completo, con el mismo orden y los mismos signos que
                la factura, para poder compararlo línea a línea antes de guardar.
                El TOTAL estaba antes en la etiqueta del campo, así que al meter
                la base no había forma de comprobar que salía lo que pone abajo
                del papel. */}
            {base > 0 && (
              <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:'var(--grl)'}}>Base imponible</span>
                  <span style={{fontWeight:500}}>{base.toFixed(2)} €</span>
                </div>
                {ivaPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {ivaPct}%</span>
                    <span style={{fontWeight:500}}>{ivaImporte.toFixed(2)} €</span>
                  </div>
                )}
                {irpfPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>− IRPF {irpfPct}%</span>
                    <span style={{fontWeight:500,color:'var(--red)'}}>−{irpfImporte.toFixed(2)} €</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                  <span style={{fontWeight:600,color:'var(--n)'}}>Total pagado</span>
                  <span style={{fontWeight:600,color:'var(--n)'}}>{total.toFixed(2)} €</span>
                </div>
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
              <span style={{fontSize:10,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={12}/> Tiene factura</span>
            </div>
            <div className="field"><label>Notas</label><textarea className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} style={{minHeight:50}}/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
