'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { delTrimestre, type Factura } from '@/lib/facturado'
import { calcularImpuestos, rangoTrimestre } from '@/lib/impuestos'

const G='#5A969E', GD='#3E7179', RED='#C25B5B', AMB='#D4A24E'

// Devuelve el trimestre (1-4) de un mes (1-12)
const trimestreDe = (mes:number) => Math.ceil(mes/3)
const MESES_TRIM: Record<number,string> = { 1:'Ene–Mar', 2:'Abr–Jun', 3:'Jul–Sep', 4:'Oct–Dic' }

export default function ImpuestosTab({ planes, gastos, facturas=[], ingresos=[] }: any) {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [irpfPctBeneficio, setIrpfPctBeneficio] = useState(20) // % del modelo 130



  // Calcular por trimestre
  /**
   * UNA SOLA FÓRMULA, EN lib/impuestos.
   *
   * Este cálculo vivía aquí dentro, copiado también en el panel del Resumen.
   * Dos copias de la misma cuenta es una cuenta que mañana se arregla en un
   * sitio y no en el otro: ya pasó con el IVA soportado y con el beneficio, y
   * el resultado fueron dos pantallas diciendo cosas distintas del mismo
   * trimestre.
   *
   * Lo que queda aquí es pintar. La cuenta es de la librería, y la comparten
   * Resumen, la línea de gastos y esta pestaña.
   */
  function calcularTrimestre(t: number) {
    const r = rangoTrimestre(`${anio}-${String((t-1)*3+1).padStart(2,'0')}`)
    const d = calcularImpuestos({
      facturas: facturas as Factura[], ingresos, gastos,
      desde: r.desde, hasta: r.hasta, irpfPct: irpfPctBeneficio,
    })
    const fact = delTrimestre(facturas as Factura[], anio, t)
    const nGastos = gastos.filter((g:any)=>!g.estimado && g.fecha >= r.desde && g.fecha <= r.hasta).length
    return { ...d, nFacturas: fact.n, nGastos }
  }

  const trimestreActual = trimestreDe(new Date().getMonth()+1)
  const eur = (n:number) => `${n>=0?'':'−'}${Math.abs(n).toFixed(2)}€`

  return (
    <div>
      {/* AVISO */}
      <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
<Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/><strong>Estimación orientativa.</strong> Estas cifras te ayudan a anticipar los pagos trimestrales, pero no sustituyen la contabilidad oficial de tu gestoría. Los importes reales pueden variar.
      </div>

      {/* SELECTOR DE AÑO + % IRPF */}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:10,color:'var(--grl)'}}>Año</span>
          <select className="input" style={{width:'auto',padding:'4px 8px'}} value={anio} onChange={e=>setAnio(Number(e.target.value))}>
            {[anioActual+1, anioActual, anioActual-1, anioActual-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {/* El 20% es el tipo general del pago fraccionado. Se deja tocar
              porque hay casos con otro porcentaje, pero sin decir de dónde sale
              el número la casilla parecía pedir un dato que nadie sabe. */}
          <span style={{fontSize:10,color:'var(--grl)'}}>Tu tipo de IRPF</span>
          <input className="input" type="number" style={{width:60,padding:'4px 8px'}} value={irpfPctBeneficio} onChange={e=>setIrpfPctBeneficio(Number(e.target.value)||0)}/>
          <span style={{fontSize:10,color:'var(--grl)'}}>%</span>
          <span style={{fontSize:9,color:'var(--grl)',maxWidth:320,lineHeight:1.5}}>
            El que aplicas en el modelo 130. Lo normal es <strong>20%</strong>; cámbialo solo si tu gestoría te dice otro.
          </span>
        </div>
      </div>

      {/* TRIMESTRES */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[1,2,3,4].map(t=>{
          const d = calcularTrimestre(t)
          const esActual = t===trimestreActual && anio===anioActual
          const vacio = d.nFacturas===0 && d.nGastos===0
          return (
            <div key={t} className="card" style={{margin:0,border:esActual?`1.5px solid ${G}`:'1px solid var(--bd)',opacity:vacio?.5:1}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--n)'}}>{t}º Trimestre <span style={{fontSize:9,fontWeight:400,color:'var(--grl)'}}>({MESES_TRIM[t]})</span></div>
                {esActual && <span style={{fontSize:8,background:G,color:'#fff',padding:'2px 7px',borderRadius:99}}>actual</span>}
              </div>

              {vacio ? (
                <div style={{fontSize:10,color:'var(--grl)',padding:'10px 0'}}>Sin datos en este trimestre</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  <ModeloRow codigo="303" nombre="IVA" valor={d.modelo303} color={GD} eur={eur}
                    detalle={`Repercutido ${d.ivaRepercutido.toFixed(0)}€ − Soportado ${d.ivaSoportado.toFixed(0)}€`}/>
                  <ModeloRow codigo="130" nombre="IRPF pago fraccionado" valor={d.modelo130} color={G} eur={eur}
                    detalle={`${irpfPctBeneficio}% de ${d.beneficio.toFixed(0)}€ de beneficio`}/>
                  <ModeloRow codigo="111" nombre="Retenciones prof./trabaj." valor={d.modelo111} color={AMB} eur={eur}
                    detalle={d.modelo111>0?'Retenciones a ingresar':'Sin retenciones'}/>
                  <ModeloRow codigo="115" nombre="Retenciones alquiler" valor={d.modelo115} color={AMB} eur={eur}
                    detalle={d.modelo115>0?'Retención del alquiler':'Sin retenciones'}/>

                  <div style={{borderTop:'1px solid var(--bd)',marginTop:4,paddingTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:10,fontWeight:600,color:'var(--n)'}}>Total a pagar (aprox.)</span>
                    <span style={{fontSize:15,fontWeight:700,color:RED}}>{(d.modelo303+d.modelo130+d.modelo111+d.modelo115).toFixed(2)}€</span>
                  </div>

                  {d.sinBase>0 && (
                    <div style={{fontSize:9,color:'#7A5800',display:'flex',alignItems:'flex-start',gap:4,marginTop:2}}>
                      <Ic name="alerta" size={10}/>
                      <span>{d.sinBase} {d.sinBase===1?'gasto lleva':'gastos llevan'} % de IVA pero no base imponible: su IVA no está entrando en el 303.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModeloRow({ codigo, nombre, valor, color, detalle, eur }: any) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:8,fontWeight:700,color:'#fff',background:color,borderRadius:4,padding:'2px 5px',flexShrink:0,minWidth:26,textAlign:'center'}}>{codigo}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,fontWeight:500,color:'var(--n)'}}>{nombre}</div>
        <div style={{fontSize:8,color:'var(--grl)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{detalle}</div>
      </div>
      <span style={{fontSize:12,fontWeight:600,color:valor>=0?'var(--n)':G,flexShrink:0}}>{eur(valor)}</span>
    </div>
  )
}
