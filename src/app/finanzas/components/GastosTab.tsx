'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO, mesISO } from '@/lib/fechas'
import { CADENCIAS, fechasDeSerie, mediaDeConcepto, crearSerie, confirmarGasto,
         borrarEstimadosDeSerie, estimadosVencidos } from '@/lib/gastos'

export default function GastosTab({ gastos, recargar, mesRef }: any) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)
  /**
   * La media de este concepto en gastos REALES anteriores. Es lo que se usa para
   * los meses que aún no han llegado: la luz cambia cada mes y repetir doce
   * veces la de septiembre no se parecería a nada.
   *
   * null mientras no se sepa o cuando no hay histórico; entonces se repite el
   * importe que se esté tecleando, que es lo único honesto que se puede hacer.
   */
  const [media, setMedia] = useState<{ base: number, n: number }|null>(null)
  const [form, setForm] = useState({ concepto:'', importe:'', metodo:'total', repetir:false, cadencia:'mensual', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' })

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

  /** Las fechas que se van a crear, para poder decirlo ANTES de crearlas. */
  const fechasSerie = form.repetir ? fechasDeSerie(form.fecha, form.cadencia) : [form.fecha]

  /**
   * La base que llevarán los meses que aún no han llegado.
   *
   * Manda la media de los reales anteriores. Si no hay histórico se repite lo
   * que estás tecleando: no hay nada mejor, y fingir una media a partir de un
   * solo dato sería inventar precisión.
   */
  const baseEstimada = media?.base ?? base

  /** Se busca la media al salir del campo, no en cada tecla. */
  async function buscarMedia() {
    if (!form.concepto.trim()) { setMedia(null); return }
    const r = await mediaDeConcepto(form.concepto)
    setMedia(r.media != null ? { base: r.media, n: r.n } : null)
  }

  async function crear() {
    if (!form.concepto || !form.importe) { setError('Concepto e importe son obligatorios'); return }
    setGuardando(true)
    setError(null)

    const plantilla = {
      concepto: form.concepto,
      base: Math.round(base*100)/100,
      iva_pct: ivaPct,
      irpf_pct: irpfPct,
      irpf_modelo: form.irpf_modelo,
      tipo: form.tipo,
      categoria: form.categoria || null,
      notas: form.notas || null,
    }

    if (form.repetir) {
      // La serie entera. El primero es real —la factura que tienes delante— y
      // el resto quedan como estimados hasta que llegue cada papel.
      const r = await crearSerie({ plantilla, desde: form.fecha, cadencia: form.cadencia, baseEstimada })
      setGuardando(false)
      if (!r.ok) { setError(`No se ha podido crear la serie: ${r.error}`); return }
    } else {
      const { error: errIns } = await supabase.from('gastos').insert({
        ...plantilla,
        importe: total,
        base_imponible: plantilla.base,
        irpf_modelo: irpfPct > 0 ? form.irpf_modelo : null,
        fecha: form.fecha,
        estimado: false,
        tiene_factura: form.tiene_factura,
      })
      setGuardando(false)
      // Cerrar el modal sin mirar el error daba un gasto "guardado" que no existía.
      if (errIns) { setError(`No se ha podido guardar el gasto: ${errIns.message}`); return }
    }

    setForm(p => ({ ...p, concepto:'', importe:'', repetir:false, categoria:'', tiene_factura:false, notas:'' }))
    setMedia(null)
    setModal(false)
    recargar()
  }

  /** Llegó la factura: se pone el importe real y deja de ser una estimación. */
  async function confirmar(g: any) {
    const txt = prompt(
      `${g.concepto} · ${new Date(g.fecha+'T12:00:00').toLocaleDateString('es-ES')}\n\n` +
      `Base imponible de la factura (estimada: ${Number(g.base_imponible||0).toFixed(2)} €):`,
      String(g.base_imponible || ''))
    if (txt == null) return
    const nueva = parseFloat(txt.replace(',', '.'))
    if (isNaN(nueva) || nueva < 0) { setError('Ese importe no es válido'); return }
    const r = await confirmarGasto(g.id, nueva, Number(g.iva_pct||0), Number(g.irpf_pct||0))
    if (!r.ok) { setError(`No se ha podido confirmar: ${r.error}`); return }
    recargar()
  }

  /** Quitar lo que queda por venir de una serie, sin tocar lo ya confirmado. */
  async function borrarSerie(serieId: string, concepto: string) {
    if (!confirm(`¿Quitar las previsiones pendientes de "${concepto}"?\n\nLos gastos ya confirmados no se tocan.`)) return
    const r = await borrarEstimadosDeSerie(serieId)
    if (!r.ok) { setError(`No se han podido borrar: ${r.error}`); return }
    recargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: errDel } = await supabase.from('gastos').delete().eq('id', id)
    if (errDel) { setError(`No se ha podido eliminar el gasto: ${errDel.message}`); return }
    recargar()
  }

  const mesActual = mesRef || mesISO()
  const delMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual)
  const totalMes = delMes.reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  /**
   * Cuánto del total del mes es todavía una previsión.
   *
   * El total las incluye, para ver lo que va a costar el mes. Pero decir 1.200 €
   * sin más, cuando 340 son un cálculo, es dar por cerrado algo que no lo está.
   */
  const estimadoMes = delMes.filter((g:any)=>g.estimado).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const sinConfirmar = estimadosVencidos(gastos, hoyISO())
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

      {/* Ya pasó la fecha y siguen sin factura. O llegó y nadie la metió, o
          hay que quitar la previsión: en cualquier caso, no puede quedarse
          contando como gasto para siempre sin que nadie lo mire. */}
      {sinConfirmar.length > 0 && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,
                     padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>{sinConfirmar.length}</strong> {sinConfirmar.length===1?'gasto estimado ya pasó su fecha':'gastos estimados ya pasaron su fecha'}
          {' '}y {sinConfirmar.length===1?'sigue':'siguen'} sin confirmar. Hasta que pongas el importe de la
          factura no cuentan para el IVA ni para las retenciones.
        </div>
      )}

      <div className="g2" style={{marginBottom:14}}>
        <div style={{background:'var(--redl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'var(--red)'}}>{totalMes.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>
            Gastos este mes
            {estimadoMes > 0 && <><br/>incluye {estimadoMes.toFixed(0)}€ estimados</>}
          </div>
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
          <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,opacity:g.estimado?.72:1,border:g.estimado?'1px dashed var(--bd)':'1px solid var(--bd)',marginBottom:5,background:'var(--bl)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:g.tipo==='fijo'?'var(--amb)':'var(--grl)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',display:'flex',alignItems:'center',gap:6}}>
                {g.concepto}
                {/* Una estimación tiene que verse a simple vista. Si parece una
                    factura más, se acaba dando por buena y se declara. */}
                {g.estimado && (
                  <span style={{fontSize:8,fontWeight:600,padding:'1px 6px',borderRadius:99,
                                background:'var(--bl)',border:'1px dashed var(--bd)',color:'var(--grl)'}}>
                    estimado
                  </span>
                )}
              </div>
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
            <div style={{fontSize:13,fontWeight:600,color:g.estimado?'var(--grl)':'var(--red)',
                         fontStyle:g.estimado?'italic':'normal'}}>
              {Number(g.importe).toFixed(2)}€
            </div>
            {g.estimado && (
              <button className="btn btn-s btn-sm" onClick={()=>confirmar(g)}
                title="Ha llegado la factura: poner el importe real">
                Confirmar
              </button>
            )}
            {g.estimado && g.serie_id && (
              <button onClick={()=>borrarSerie(g.serie_id, g.concepto)}
                title="Quitar las previsiones pendientes de esta serie"
                style={{color:'var(--grl)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}>
                <Ic name="papelera" size={12}/>
              </button>
            )}
            <button onClick={()=>eliminar(g.id)} style={{color:'var(--red)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="papelera" size={13}/></button>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">Nuevo gasto<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Concepto *</label><input className="input" value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))} placeholder="ej. Alquiler local" autoFocus onBlur={buscarMedia}/></div>
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
            {/* REPETIR DURANTE EL AÑO
                El primero es real; los siguientes quedan como ESTIMADOS y no
                cuentan para el 303 ni el 115 hasta que confirmes cada factura.
                Ver lib/gastos: deducir IVA de un papel que no existe no es un
                número feo, es una declaración mal hecha. */}
            <div className="field">
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={form.repetir}
                  onChange={e=>setForm(p=>({...p,repetir:e.target.checked}))}/>
                Se repite durante el año
              </label>
              {form.repetir && (
                <>
                  <select className="input" style={{marginTop:6}} value={form.cadencia}
                    onChange={e=>setForm(p=>({...p,cadencia:e.target.value}))}>
                    {CADENCIAS.map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.ayuda}</option>)}
                  </select>
                  <div style={{fontSize:9,color:'var(--gd)',marginTop:6,lineHeight:1.6,
                               background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 10px'}}>
                    Se crearán <strong>{fechasSerie.length}</strong> gastos hasta diciembre, el día{' '}
                    <strong>{form.fecha.split('-')[2]}</strong> de cada periodo.
                    {' '}El primero queda como <strong>real</strong> y los otros {fechasSerie.length-1} como
                    {' '}<strong>estimados</strong>, que no cuentan para los impuestos hasta que confirmes su factura.
                    {media
                      ? <> Los estimados llevarán <strong>{media.base.toFixed(2)} €</strong> de base,
                          la media de los {media.n} anteriores de este concepto.</>
                      : <> No hay histórico de este concepto, así que los estimados repetirán
                          los <strong>{base.toFixed(2)} €</strong> que has puesto.</>}
                  </div>
                </>
              )}
            </div>

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
