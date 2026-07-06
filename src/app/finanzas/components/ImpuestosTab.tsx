'use client'
import { useState } from 'react'

const G='#5A969E', GD='#3E7179', RED='#C25B5B', AMB='#D4A24E'

// Devuelve el trimestre (1-4) de un mes (1-12)
const trimestreDe = (mes:number) => Math.ceil(mes/3)
const MESES_TRIM: Record<number,string> = { 1:'Ene–Mar', 2:'Abr–Jun', 3:'Jul–Sep', 4:'Oct–Dic' }

export default function ImpuestosTab({ planes, gastos, bonosHist=[] }: any) {
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [irpfPctBeneficio, setIrpfPctBeneficio] = useState(20) // % del modelo 130

  // Precio final e IVA por tipo de bono
  const ivaIngresoPorTipo: Record<string, number> = {}
  planes.forEach((p:any)=>{
    const final = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base*(1+p.iva/100)*100)/100
    const base = p.iva>0 ? final/(1+p.iva/100) : final
    ivaIngresoPorTipo[p.bono_tipo] = final - base // IVA repercutido por bono
  })
  const baseIngresoPorTipo: Record<string, number> = {}
  planes.forEach((p:any)=>{
    const final = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base*(1+p.iva/100)*100)/100
    baseIngresoPorTipo[p.bono_tipo] = p.iva>0 ? final/(1+p.iva/100) : final
  })

  // Calcular por trimestre
  function calcularTrimestre(t: number) {
    // Ingresos: bonos de ese trimestre y año
    const bonosT = bonosHist.filter((b:any)=> b.anio===anio && trimestreDe(b.mes)===t)
    const ivaRepercutido = bonosT.reduce((a:number,b:any)=> a + (ivaIngresoPorTipo[b.tipo]||0), 0)
    const baseIngresos = bonosT.reduce((a:number,b:any)=> a + (baseIngresoPorTipo[b.tipo]||0), 0)

    // Gastos de ese trimestre y año
    const gastosT = gastos.filter((g:any)=>{
      if (!g.fecha) return false
      const [gy, gm] = g.fecha.split('-').map(Number)
      return gy===anio && trimestreDe(gm)===t
    })
    const ivaSoportado = gastosT.reduce((a:number,g:any)=> a + (Number(g.importe) - Number(g.base_imponible||g.importe)), 0)
    const baseGastos = gastosT.reduce((a:number,g:any)=> a + Number(g.base_imponible||g.importe), 0)

    // Modelo 303: IVA a pagar = repercutido - soportado
    const modelo303 = ivaRepercutido - ivaSoportado

    // Modelo 130: % sobre beneficio (base ingresos - base gastos)
    const beneficio = baseIngresos - baseGastos
    const modelo130 = Math.max(0, beneficio * (irpfPctBeneficio/100))

    // Modelo 111: IRPF retenido en gastos marcados como 111
    const modelo111 = gastosT.filter((g:any)=>g.irpf_modelo==='111' && g.irpf_pct>0)
      .reduce((a:number,g:any)=> a + Number(g.base_imponible||0)*(g.irpf_pct/100), 0)

    // Modelo 115: IRPF retenido en alquiler (marcados como 115)
    const modelo115 = gastosT.filter((g:any)=>g.irpf_modelo==='115' && g.irpf_pct>0)
      .reduce((a:number,g:any)=> a + Number(g.base_imponible||0)*(g.irpf_pct/100), 0)

    return { ivaRepercutido, ivaSoportado, modelo303, beneficio, modelo130, modelo111, modelo115, nBonos: bonosT.length, nGastos: gastosT.length }
  }

  const trimestreActual = trimestreDe(new Date().getMonth()+1)
  const eur = (n:number) => `${n>=0?'':'−'}${Math.abs(n).toFixed(2)}€`

  return (
    <div>
      {/* AVISO */}
      <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
        ⚠️ <strong>Estimación orientativa.</strong> Estas cifras te ayudan a anticipar los pagos trimestrales, pero no sustituyen la contabilidad oficial de tu gestoría. Los importes reales pueden variar.
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
          <span style={{fontSize:10,color:'var(--grl)'}}>% IRPF (modelo 130)</span>
          <input className="input" type="number" style={{width:70,padding:'4px 8px'}} value={irpfPctBeneficio} onChange={e=>setIrpfPctBeneficio(Number(e.target.value)||0)}/>
        </div>
      </div>

      {/* TRIMESTRES */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[1,2,3,4].map(t=>{
          const d = calcularTrimestre(t)
          const esActual = t===trimestreActual && anio===anioActual
          const vacio = d.nBonos===0 && d.nGastos===0
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
