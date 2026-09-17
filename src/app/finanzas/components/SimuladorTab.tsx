'use client'
import { useState } from 'react'
import { mesISO } from '@/lib/fechas'
import { precioConDescuento, precioFinalPlan, indicePlanes } from '@/lib/bonos'
import { costeTrabajador, costeCompra, simularSubida, SS_EMPRESA_PCT, type ModoCompra } from '@/lib/simulador'

const G='#5A969E', GD='#3E7179', RED='#C25B5B', AMB='#D4A24E'

/**
 * PROBAR ANTES DE DECIDIR.
 *
 * Todo lo demás en Finanzas cuenta lo que ya ha pasado. Esta pantalla es la
 * única que responde a "¿y si...?": contratar, comprar, subir precios.
 *
 * No guarda nada. Parte de tus cifras reales —el suelo de gastos fijos y lo que
 * deja un cliente— y dice qué haría falta para que la decisión salga bien.
 */
/**
 * FUERA DEL COMPONENTE, NO DENTRO.
 *
 * Definidos dentro, React los trataba como un componente distinto en cada
 * pulsación: desmontaba el input y montaba otro, así que el foco se perdía y
 * solo se podía escribir un dígito.
 */
const Campo = ({ label, value, onChange, ancho=90, sufijo }: any) => (
  <div className="field" style={{marginBottom:0,width:ancho}}>
    <label>{label}</label>
    <div style={{display:'flex',alignItems:'baseline',gap:4}}>
      <input className="input" type="number" value={value} onChange={e=>onChange(e.target.value)}/>
      {sufijo && <span style={{fontSize:10,color:'var(--grl)'}}>{sufijo}</span>}
    </div>
  </div>
)

const Dato = ({ v, l, ayuda, color }: any) => (
  <div>
    <div style={{fontSize:20,fontWeight:200,color:color||'var(--n)',lineHeight:1.1}}>{v}</div>
    <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
    {ayuda && <div style={{fontSize:9,color:'var(--grl)',marginTop:2,lineHeight:1.5}}>{ayuda}</div>}
  </div>
)


export default function SimuladorTab({ planes=[], gastos=[], bonos=[], mesRef }: any) {
  const [caso, setCaso] = useState<'contratar'|'comprar'|'precios'>('contratar')
  const eur = (n:number) => `${Math.round(n).toLocaleString('es-ES')}€`

  const mesActual = mesRef || mesISO()
  const fijosPorMes: Record<string, number> = {}
  gastos.filter((g:any)=>g.tipo==='fijo'&&g.fecha).forEach((g:any)=>{
    const m = g.fecha.slice(0,7); fijosPorMes[m] = (fijosPorMes[m]||0) + Number(g.importe)
  })
  const cerrados = Object.keys(fijosPorMes).filter(m=>m<mesActual)
  const claves = cerrados.length ? cerrados : Object.keys(fijosPorMes)
  const sueloActual = claves.length ? claves.reduce((a,m)=>a+fijosPorMes[m],0)/claves.length : 0

  const idx = indicePlanes(planes)
  const activos = bonos.filter((b:any)=>b.activo!==false)
  const ingresoMes = activos.reduce((a:number,b:any)=>a+precioConDescuento(precioFinalPlan(idx[b.tipo]), b),0)
  const porCliente = activos.length ? ingresoMes/activos.length : 0
  const faltan = (extra:number) => porCliente>0 ? Math.ceil(extra/porCliente) : 0

  const [bruto, setBruto] = useState('1200')
  const [ssPct, setSsPct] = useState(String(SS_EMPRESA_PCT))
  const [pagas, setPagas] = useState('12')
  const tr = costeTrabajador(parseFloat(bruto)||0, parseFloat(ssPct)||0, parseFloat(pagas)||12)

  const [precio, setPrecio] = useState('5000')
  const [modo, setModo] = useState<ModoCompra>('contado')
  const [meses, setMeses] = useState('48')
  const [interes, setInteres] = useState('7')
  const [anos, setAnos] = useState('5')
  const [residual, setResidual] = useState('0')
  const cp = costeCompra({
    precioSinIva: parseFloat(precio)||0, modo, meses: parseFloat(meses)||48,
    interesPct: parseFloat(interes)||0, anosAmortizacion: parseFloat(anos)||5,
    valorResidual: parseFloat(residual)||0,
  })

  const [subida, setSubida] = useState('5')
  const [bajas, setBajas] = useState('3')
  const sub = simularSubida({
    ingresoActual: ingresoMes, nClientes: activos.length,
    subidaPct: parseFloat(subida)||0, bajasEsperadas: parseFloat(bajas)||0,
  })

  return (
    <div>
      <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,marginBottom:14,width:'fit-content'}}>
        {([['contratar','Contratar'],['comprar','Comprar algo'],['precios','Subir precios']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setCaso(k)}
            style={{fontSize:10,padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'inherit',
                    background:caso===k?'var(--w)':'transparent',color:caso===k?'var(--n)':'var(--grl)',
                    fontWeight:caso===k?500:300,boxShadow:caso===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
        ))}
      </div>

      <div style={{fontSize:10,color:'var(--grl)',marginBottom:16,lineHeight:1.6}}>
        Nada de lo que hagas aquí se guarda. Se parte de tus cifras reales:
        <strong style={{color:'var(--n)'}}>{eur(sueloActual)}/mes</strong> de gastos fijos
        {activos.length>0 && <>, {activos.length} cuotas activas que dejan <strong style={{color:'var(--n)'}}>{eur(porCliente)}</strong> de media cada una</>}.
      </div>

      {caso==='contratar' && (
        <div>
          <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:18}}>
            <Campo label="Salario bruto" value={bruto} onChange={setBruto} ancho={110} sufijo="€/mes"/>
            <Campo label="Pagas al año" value={pagas} onChange={setPagas} ancho={80}/>
            <Campo label="SS empresa" value={ssPct} onChange={setSsPct} ancho={80} sufijo="%"/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:18,marginBottom:16}}>
            <Dato v={eur(tr.brutoMes)} l="Bruto prorrateado" color={G}
                  ayuda={parseFloat(pagas)!==12 ? `${pagas} pagas repartidas en 12 meses` : undefined}/>
            <Dato v={eur(tr.ss)} l="Seguridad Social empresa" color={AMB} ayuda="lo pagas tú, encima del bruto"/>
            <Dato v={eur(tr.coste)} l="Coste real al mes" color={RED} ayuda="lo que sale de tu cuenta"/>
            <Dato v={eur(tr.costeAnual)} l="Al año"/>
          </div>

          <div style={{background:'var(--bl)',borderRadius:8,padding:'12px 14px',fontSize:10,color:'var(--gr)',lineHeight:1.7}}>
            {/* "Suelo" en una pantalla que habla de sueldos se lee como una
                errata. Se dice lo que es: el mínimo que hay que ingresar. */}
            Lo mínimo que necesitas ingresar al mes pasaría de <strong style={{color:'var(--n)'}}>{eur(sueloActual)}</strong> a <strong style={{color:'var(--n)'}}>{eur(sueloActual+tr.coste)}</strong>.
            {porCliente>0 && <> Para cubrirlo te harían falta <strong style={{color:'var(--n)'}}>{faltan(tr.coste)} cuotas más</strong> de las que tienes ahora.</>}
            <div style={{color:'var(--grl)',marginTop:5}}>
              El % de Seguridad Social es orientativo: depende del contrato, del grupo de cotización y de las bonificaciones. Confírmalo con tu gestoría antes de firmar.
            </div>
          </div>
        </div>
      )}

      {caso==='comprar' && (
        <div>
          <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:14}}>
            <Campo label="Precio sin IVA" value={precio} onChange={setPrecio} ancho={110} sufijo="€"/>
            <div className="field" style={{marginBottom:0,width:150}}>
              <label>Cómo lo pagas</label>
              <select className="input" value={modo} onChange={e=>setModo(e.target.value as ModoCompra)}>
                <option value="contado">Al contado</option>
                <option value="financiado">Financiado</option>
                <option value="renting">Renting</option>
                <option value="leasing">Leasing</option>
              </select>
            </div>
            {modo==='contado' && <Campo label="Amortizar en" value={anos} onChange={setAnos} ancho={80} sufijo="años"/>}
            {modo!=='contado' && <Campo label="Plazo" value={meses} onChange={setMeses} ancho={80} sufijo="meses"/>}
            {modo==='financiado' && <><Campo label="Interés" value={interes} onChange={setInteres} ancho={70} sufijo="%"/>
              <Campo label="Amortizar en" value={anos} onChange={setAnos} ancho={80} sufijo="años"/></>}
            {modo==='leasing' && <Campo label="Valor residual" value={residual} onChange={setResidual} ancho={100} sufijo="€"/>}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:18,marginBottom:16}}>
            <Dato v={eur(cp.desembolsoInicial)} l="Sale ahora de la cuenta" color={cp.desembolsoInicial>0?RED:'var(--grl)'}/>
            <Dato v={cp.cuotaMes>0?eur(cp.cuotaMes):'—'} l="Cuota al mes" color={cp.cuotaMes>0?RED:'var(--grl)'}/>
            <Dato v={eur(cp.ivaRecuperable)} l="IVA que recuperas" color={G} ayuda="lo restas en el 303"/>
            <Dato v={eur(cp.gastoDeducibleMes)} l="Gasto deducible al mes" color={GD}/>
          </div>

          <div style={{background:'var(--bl)',borderRadius:8,padding:'12px 14px',fontSize:10,color:'var(--gr)',lineHeight:1.7}}>
            {cp.nota}
            {cp.cuotaMes>0 && porCliente>0 && (
              <div style={{marginTop:5}}>
                La cuota sube tu mínimo mensual a <strong style={{color:'var(--n)'}}>{eur(sueloActual+cp.cuotaMes)}</strong>:
                {' '}<strong style={{color:'var(--n)'}}>{faltan(cp.cuotaMes)} cuotas más</strong> para cubrirla.
              </div>
            )}
            {cp.desembolsoInicial>0 && porCliente>0 && (
              <div style={{marginTop:5}}>
                Pagando al contado no sube tu mínimo mensual, pero salen {eur(cp.desembolsoInicial)} de golpe.
                {' '}Equivale a <strong style={{color:'var(--n)'}}>{Math.ceil(cp.desembolsoInicial/porCliente)} cuotas</strong> enteras.
              </div>
            )}
            <div style={{color:'var(--grl)',marginTop:5}}>
              Los años de amortización dependen del tipo de bien y los fija Hacienda. Pregúntalo antes de contar con ese gasto.
            </div>
          </div>
        </div>
      )}

      {caso==='precios' && (
        <div>
          {activos.length===0 ? (
            <div style={{fontSize:11,color:'var(--grl)',padding:20}}>
              Sin cuotas activas este mes no hay nada que simular.
            </div>
          ) : (<>
            <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap',marginBottom:18}}>
              <Campo label="Subida" value={subida} onChange={setSubida} ancho={80} sufijo="%"/>
              <Campo label="Bajas que esperas" value={bajas} onChange={setBajas} ancho={110} sufijo="personas"/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:18,marginBottom:16}}>
              <Dato v={eur(ingresoMes)} l="Ahora" ayuda={`${activos.length} cuotas a ${eur(sub.porCliente||0)}`}/>
              <Dato v={eur(sub.nuevo)} l="Después" color={G} ayuda={`${sub.quedan} cuotas a ${eur(sub.nuevoPrecio||0)}`}/>
              <Dato v={`${sub.diferencia>=0?'+':''}${eur(sub.diferencia)}`} l="Diferencia al mes"
                    color={sub.diferencia>=0?GD:RED}/>
              <Dato v={String(sub.bajasLimite)} l="Bajas que aguantas" color={AMB}
                    ayuda="a partir de ahí, peor que ahora"/>
            </div>

            <div style={{background:'var(--bl)',borderRadius:8,padding:'12px 14px',fontSize:10,color:'var(--gr)',lineHeight:1.7}}>
              Subiendo un {subida}% puedes perder hasta <strong style={{color:'var(--n)'}}>{sub.bajasLimite} personas</strong> y seguir ingresando lo mismo que ahora.
              {sub.diferencia<0 && <> Con {bajas} bajas <strong style={{color:RED}}>pierdes {eur(-sub.diferencia)} al mes</strong>.</>}
              <div style={{color:'var(--grl)',marginTop:5}}>
                Cuántos se van de verdad no lo sabe una pantalla. El número de arriba es el límite, no una predicción.
              </div>
            </div>
          </>)}
        </div>
      )}
    </div>
  )
}
