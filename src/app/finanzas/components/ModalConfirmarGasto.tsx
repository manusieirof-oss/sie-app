'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { confirmarGasto, actualizarEstimadosPendientes, contarPendientes } from '@/lib/gastos'

/**
 * CONFIRMAR UNA PREVISIÓN.
 *
 * Sí hace falta preguntar el importe: una previsión es un cálculo, y lo que
 * decide el IVA que te deduces es el papel, no el cálculo.
 *
 * Una sola pantalla: el importe y lo de propagar el precio a lo que queda se
 * deciden a la vez, viendo los dos números.
 */
export default function ModalConfirmarGasto({ gasto: conf, onCerrar, onHecho, onError }: {
  gasto: any
  onCerrar: () => void
  onHecho: () => void
  onError: (m: string) => void
}) {
  const [confBase, setConfBase] = useState('')
  const [confExento, setConfExento] = useState('')
  const [confMetodo, setConfMetodo] = useState('base')
  const [confSS, setConfSS] = useState('')
  const [confIrpfRet, setConfIrpfRet] = useState('')
  const [confCapital, setConfCapital] = useState('')
  const [confPropagar, setConfPropagar] = useState(false)
  const [confPend, setConfPend] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    // `base_imponible` lleva la parte exenta sumada dentro: al campo va solo
    // la parte gravada, o confirmarGasto la sumaría otra vez.
    const exG = Number(conf.importe_exento || 0)
    setConfBase(String(Math.round((Number(conf.base_imponible || 0) - exG)*100)/100))
    setConfExento(exG ? String(exG) : '')
    setConfMetodo('base')
    setConfSS(conf.ss_empresa ? String(conf.ss_empresa) : '')
    setConfIrpfRet(conf.irpf_retenido ? String(conf.irpf_retenido) : '')
    setConfCapital(conf.capital_amortizado ? String(conf.capital_amortizado) : '')
    setConfPropagar(false)
    setConfPend(0)
    if (conf.serie_id) {
      contarPendientes(conf.serie_id, conf.fecha).then(p => { if (p.ok) setConfPend(p.n) })
    }
  }, [conf])

  async function guardarConfirmacion() {
    const g = conf
    const tecleado = parseFloat(confBase.replace(',', '.'))
    if (isNaN(tecleado) || tecleado < 0) { setError('Ese importe no es válido'); return }
    const exN = Math.max(parseFloat(confExento.replace(',', '.')) || 0, 0)
    const ivaN = Number(g.iva_pct||0), irpfN = Number(g.irpf_pct||0)
    const esPrest = g.clase === 'prestamo'
    // En un préstamo lo tecleado son los intereses: ni IVA ni retención que deshacer.
    const nueva = (esPrest || confMetodo === 'base') ? tecleado
      : (tecleado - exN) / (1 + ivaN/100 - irpfN/100)
    if (nueva < 0) { setError('Con esa parte sin IVA, la base sale negativa. Revisa los importes.'); return }
    setGuardando(true)
    const esNom = g.clase === 'nomina'
    const r = await confirmarGasto(g.id, Math.round(nueva*100)/100, ivaN, irpfN, exN,
      esNom ? {
        ssEmpresa: Math.max(parseFloat(confSS.replace(',', '.')) || 0, 0),
        irpfRetenido: Math.max(parseFloat(confIrpfRet.replace(',', '.')) || 0, 0),
      } : undefined,
      esPrest ? { capital: Math.max(parseFloat(confCapital.replace(',', '.')) || 0, 0) } : undefined)
    if (!r.ok) { setGuardando(false); setError(`No se ha podido confirmar: ${r.error}`); return }

    // La subida de abril: marcado por ti, porque una factura más alta puede ser
    // el precio nuevo o algo puntual de ese mes.
    if (confPropagar && g.serie_id) {
      const u = await actualizarEstimadosPendientes(
        g.serie_id, g.fecha, Math.round(nueva*100)/100, ivaN, irpfN, exN)
      if (!u.ok) onError(`El gasto se confirmó, pero no se han podido actualizar las previsiones: ${u.error}`)
    }
    setGuardando(false)
    onCerrar()
    onHecho()
  }

  const iva = Number(conf.iva_pct || 0), irpf = Number(conf.irpf_pct || 0)
  const esNomConf = conf.clase === 'nomina'
  const esPrestConf = conf.clase === 'prestamo'
  const capConf = Math.max(parseFloat(confCapital.replace(',', '.')) || 0, 0)
  const ssConf = Math.max(parseFloat(confSS.replace(',', '.')) || 0, 0)
  const retConf = Math.max(parseFloat(confIrpfRet.replace(',', '.')) || 0, 0)
  const exPrev = Number(conf.importe_exento || 0)
  const est = Number(conf.base_imponible || 0) - exPrev
  const ex = Math.max(parseFloat(confExento.replace(',', '.')) || 0, 0)
  const tec = parseFloat(confBase.replace(',', '.'))
  const val = isNaN(tec) ? null
    : (esPrestConf || confMetodo === 'base') ? tec
    : (tec - ex) / (1 + iva/100 - irpf/100)
  const cambia = val != null && Math.abs(val - est) > 0.005

  return (
          <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
            <div className="modal" style={{maxWidth:420}}>
              <div className="modal-title">Ha llegado la factura<button className="modal-close" onClick={()=>onCerrar()}>✕</button></div>

              {error && (
                <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,
                             padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)',lineHeight:1.55}}>
                  <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
                </div>
              )}
              <div style={{fontSize:11,color:'var(--n)',fontWeight:500}}>{conf.concepto}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:10}}>
                {new Date(conf.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
                {' · previsión de '}{est.toFixed(2)} €
              </div>

              {/* Las mismas opciones que al crear. Una factura real puede traer
                  otro consumo Y otro canon, y antes solo se podía tocar un número. */}
              <div className="field" style={{display: (esNomConf||esPrestConf) ? 'none' : undefined}}>
                <label>¿Qué importe vas a escribir?</label>
                <div style={{display:'flex',gap:6}}>
                  {[['base','La base imponible'],['total','El total pagado']].map(([v,l])=>(
                    <button key={v} type="button" onClick={()=>setConfMetodo(v)}
                      style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                              border:`1.5px solid ${confMetodo===v?'var(--g)':'var(--bd)'}`,
                              background:confMetodo===v?'var(--g)':'var(--w)',
                              color:confMetodo===v?'#fff':'var(--gr)'}}>{l}</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>{esNomConf ? 'Salario bruto (€)' : esPrestConf ? 'Intereses del recibo (€)' : confMetodo==='base'?'Base imponible de la factura (€)':'Total pagado de la factura (€)'}</label>
                <input className="input" type="number" value={confBase} autoFocus
                  onChange={e=>setConfBase(e.target.value)}/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                  Se pregunta porque lo que se deduce sale del papel, no del cálculo.
                  Si coincide con la previsión, dale a confirmar sin tocar nada.
                </div>
              </div>

              {esPrestConf ? (
                <div className="field">
                  <label>Capital amortizado en este recibo (€)</label>
                  <input className="input" type="number" value={confCapital}
                    onChange={e=>setConfCapital(e.target.value)} placeholder="0.00"/>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                    Cambia en cada recibo. No es gasto, pero cuadra la cuota con el banco.
                  </div>
                </div>
              ) : esNomConf ? (
                <div className="g2">
                  <div className="field">
                    <label>Seguridad Social empresa (€)</label>
                    <input className="input" type="number" value={confSS}
                      onChange={e=>setConfSS(e.target.value)} placeholder="0.00"/>
                  </div>
                  <div className="field">
                    <label>IRPF retenido (€)</label>
                    <input className="input" type="number" value={confIrpfRet}
                      onChange={e=>setConfIrpfRet(e.target.value)} placeholder="0.00"/>
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label>Parte sin IVA (€) <span style={{color:'var(--grl)',fontWeight:400}}>· opcional</span></label>
                  <input className="input" type="number" value={confExento}
                    onChange={e=>setConfExento(e.target.value)} placeholder="0.00"/>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                    Canon y tasas del recibo. Puede cambiar de una factura a otra.
                  </div>
                </div>
              )}

              {val != null && (
                <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>Base</span><span style={{fontWeight:500}}>{val.toFixed(2)} €</span>
                  </div>
                  {!esPrestConf && ex > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ Parte sin IVA</span><span style={{fontWeight:500}}>{ex.toFixed(2)} €</span>
                  </div>}
                  {!esPrestConf && iva > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {iva}%</span><span style={{fontWeight:500}}>{(val*iva/100).toFixed(2)} €</span>
                  </div>}
                  {!esPrestConf && irpf > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>− IRPF {irpf}%</span><span style={{fontWeight:500,color:'var(--red)'}}>−{(val*irpf/100).toFixed(2)} €</span>
                  </div>}
                  {esNomConf && ssConf > 0 && (
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                      <span style={{color:'var(--grl)'}}>+ Seguridad Social empresa</span>
                      <span style={{fontWeight:500}}>{ssConf.toFixed(2)} €</span>
                    </div>
                  )}
                  <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                    <span style={{fontWeight:600,color:'var(--n)'}}>{esNomConf ? 'Coste total empresa' : esPrestConf ? 'Gasto deducible' : 'Total pagado'}</span>
                    <span style={{fontWeight:600,color:'var(--n)'}}>{(esNomConf ? val + ssConf : esPrestConf ? val : val + ex + val*iva/100 - val*irpf/100).toFixed(2)} €</span>
                  </div>
                  {esPrestConf && capConf > 0 && (
                    <>
                      <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px dashed var(--bd)'}}>
                        <span style={{color:'var(--grl)'}}>+ Capital amortizado <span style={{fontSize:9}}>(no es gasto)</span></span>
                        <span style={{fontWeight:500,color:'var(--grl)'}}>{capConf.toFixed(2)} €</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:2}}>
                        <span style={{color:'var(--grl)'}}>Cuota pagada al banco</span>
                        <span style={{fontWeight:500,color:'var(--grl)'}}>{(val + capConf).toFixed(2)} €</span>
                      </div>
                    </>
                  )}
                  {esNomConf && retConf > 0 && (
                    <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px dashed var(--bd)'}}>
                      <span style={{color:'var(--grl)'}}>IRPF retenido <span style={{fontSize:9}}>(al 111, no es gasto)</span></span>
                      <span style={{fontWeight:500,color:'var(--grl)'}}>{retConf.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
              )}

              {/* La subida de abril. Marcado por ti: una factura más alta puede
                  ser una subida permanente o algo puntual de este mes. */}
              {cambia && confPend > 0 && (
                <div onClick={()=>setConfPropagar(v=>!v)}
                  style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 11px',borderRadius:6,cursor:'pointer',marginBottom:10,
                          border:`1px solid ${confPropagar?'var(--g)':'var(--bd)'}`,background:confPropagar?'var(--gl)':'var(--w)'}}>
                  <div style={{width:16,height:16,borderRadius:3,marginTop:1,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                               border:`2px solid ${confPropagar?'var(--g)':'var(--bd)'}`,background:confPropagar?'var(--g)':'transparent'}}>
                    {confPropagar && <span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:10,color:'var(--n)',lineHeight:1.55}}>
                    El importe {val! > est ? 'sube' : 'baja'} de {est.toFixed(2)} € a {val!.toFixed(2)} €.
                    {' '}<strong>Aplicarlo también a las {confPend} previsiones que quedan.</strong>
                    <div style={{color:'var(--grl)',marginTop:2}}>
                      Márcalo si es el precio nuevo de aquí en adelante. Déjalo sin marcar si
                      fue algo puntual de este mes.
                    </div>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-d btn-sm" onClick={()=>onCerrar()}>Cancelar</button>
                <div style={{flex:1}}/>
                <button className="btn btn-p" onClick={guardarConfirmacion} disabled={guardando || val==null}>
                  {guardando?'…':<><Ic name="guardar" size={13}/> Confirmar</>}
                </button>
              </div>
            </div>
          </div>
  )
}
