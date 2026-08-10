'use client'
import { useEffect, useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { indicePlanes, precioBono as precioDeBono } from '@/lib/bonos'
import {
  HISTORICO_BASE, ANIOS_EXENTOS, MESES_CORTO, indiceEstacional, proyectar,
  facturadoPorMes, nivelDesdeBonos, nivelBase,
} from '@/lib/prevision'

// Previsión de ingresos.
//
// TODO EN BASE IMPONIBLE. El IVA no es tuyo: lo recaudas para Hacienda. Esta
// pantalla existe en parte porque mezclarlo hacía parecer que 2026 crecía un
// 14% cuando en realidad, comparando base contra base, cae un 4%: hasta 2025 la
// clínica estaba exenta y ahora factura al 21% con los mismos precios.
//
// Los bonos dicen el futuro, las facturas el pasado. Ninguno hace de lo otro.

const G='#5A969E', GD='#3E7179', AMB='#D4A24E', RED='#C25B5B', GREY='#9CA3AF'

export default function PrevisionTab({ planes, bonos }: any) {
  const anio = new Date().getFullYear()
  const [base, setBase] = useState<Record<number, number>>({})
  const [iva, setIva] = useState<Record<number, number>>({})
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string|null>(null)
  const [verIndices, setVerIndices] = useState(false)

  useEffect(() => { cargar() }, [anio])

  async function cargar() {
    setCargando(true)
    const r = await facturadoPorMes(anio)
    if (!r.ok) setFallo(`No se han podido leer las facturas: ${r.error}`)
    setBase(r.base); setIva(r.iva)
    setCargando(false)
  }

  const idx = useMemo(() => indiceEstacional(), [])
  const idxPlanes = useMemo(() => indicePlanes(planes), [planes])

  // Si todavía no hay facturas, el suelo lo ponen las cuotas activas.
  const hayFacturas = Object.keys(base).length > 0
  const filas = useMemo(() => {
    if (hayFacturas) return proyectar(base, idx)
    const nivel = nivelDesdeBonos(bonos || [], (b: any) => precioDeBono(b, idxPlanes))
    let acc = 0
    return idx.map(x => {
      const previsto = Math.round(nivel * x.indice * 100) / 100
      acc += previsto
      return { mes: x.mes, real: null, previsto, desvio: null, acumulado: Math.round(acc*100)/100 }
    })
  }, [base, idx, bonos, idxPlanes, hayFacturas])

  const facturado = filas.reduce((a, f) => a + (f.real ?? 0), 0)
  const pendiente = filas.reduce((a, f) => a + (f.real == null ? f.previsto : 0), 0)
  const cierre = facturado + pendiente
  const ivaAño = Object.values(iva).reduce((a, b) => a + b, 0)
  const mesActual = new Date().getMonth() + 1
  const esteMes = filas[mesActual - 1]

  const anterior = HISTORICO_BASE[anio - 1]
  const totalAnterior = anterior ? Object.values(anterior).reduce((a, b) => a + b, 0) : null
  const variacion = totalAnterior ? (cierre / totalAnterior - 1) * 100 : null

  const datos = filas.map(f => ({
    mes: MESES_CORTO[f.mes],
    Facturado: f.real,
    Previsto: f.previsto,
    Anterior: anterior?.[f.mes] ?? null,
  }))

  const eur = (n: number) => `${Math.round(n).toLocaleString('es-ES')} €`

  return (
    <div>
      {fallo && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>{fallo}
        </div>
      )}

      {/* Lo primero que se lee, porque sin esto los números se malinterpretan. */}
      <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:8,padding:'9px 13px',marginBottom:14,fontSize:10,color:'var(--gr)',lineHeight:1.6}}>
        <Ic name="info" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
        Todo en <strong>base imponible</strong>, sin IVA. Es lo que de verdad ingresas.
        {ANIOS_EXENTOS.length > 0 && <> Los años {ANIOS_EXENTOS[0]}–{ANIOS_EXENTOS[ANIOS_EXENTOS.length-1]} la actividad estaba <strong>exenta de IVA</strong>, así que lo cobrado y la base coincidían.</>}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Ingresado</div>
          <div style={{fontSize:24,fontWeight:300,color:G,marginTop:4}}>{eur(facturado)}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>+{eur(ivaAño)} de IVA cobrado</div>
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Falta por ingresar</div>
          <div style={{fontSize:24,fontWeight:300,color:AMB,marginTop:4}}>{eur(pendiente)}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>previsto</div>
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Cierre {anio}</div>
          <div style={{fontSize:24,fontWeight:300,color:GD,marginTop:4}}>{eur(cierre)}</div>
          {variacion != null && (
            <div style={{fontSize:9,color:variacion>=0?'var(--gd)':'var(--red)',fontWeight:600}}>
              {variacion>=0?'+':''}{variacion.toFixed(1)}% sobre {anio-1}
            </div>
          )}
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Este mes</div>
          <div style={{fontSize:24,fontWeight:300,color:'var(--n)',marginTop:4}}>{esteMes ? eur(esteMes.real ?? esteMes.previsto) : '—'}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>
            {esteMes ? `índice ${idx[mesActual-1].indice.toFixed(2)}` : ''}
          </div>
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Ingreso neto por mes</div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={datos} margin={{top:5,right:10,left:-10,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
          <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${Math.round(v).toLocaleString('es-ES')} €`}/>
          <Legend wrapperStyle={{fontSize:10}}/>
          {anterior && <Line type="monotone" dataKey="Anterior" name={`${anio-1} (exento)`} stroke={GREY} strokeWidth={1.5} dot={false}/>}
          <Line type="monotone" dataKey="Previsto" stroke={AMB} strokeWidth={2} strokeDasharray="5 4" dot={{r:2}}/>
          <Line type="monotone" dataKey="Facturado" stroke={G} strokeWidth={3} dot={{r:3}} connectNulls={false}/>
        </LineChart>
      </ResponsiveContainer>

      {/* De dónde sale. Una previsión que no enseña sus tripas no se cree nadie. */}
      <div className="card" style={{margin:'18px 0 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div className="card-title" style={{margin:0,flex:1}}>De dónde sale</div>
          <button className="btn btn-t btn-sm" onClick={()=>setVerIndices(v=>!v)}>
            {verIndices ? 'Ocultar detalle' : 'Ver el detalle por año'}
          </button>
        </div>
        <div style={{fontSize:10,color:'var(--gr)',lineHeight:1.75,marginBottom:10}}>
          <div>Nivel de un mes medio, corregido de estacionalidad: <strong>{eur(hayFacturas ? nivelBase(base, idx) : nivelDesdeBonos(bonos||[], (b:any)=>precioDeBono(b, idxPlanes)))}</strong>
            {hayFacturas ? ' · de los últimos meses facturados' : ' · de las cuotas activas, porque aún no hay facturas'}</div>
          <div>× el índice de cada mes, promediado de {Object.keys(HISTORICO_BASE).join(', ')}</div>
        </div>

        <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:verIndices?12:0}}>
          {idx.map(x => (
            <div key={x.mes} style={{flex:'1 1 60px',textAlign:'center',padding:'6px 4px',borderRadius:6,
                                     background: x.indice<0.7?'var(--redl)' : x.indice<0.95?'var(--ambl)' : x.indice>1.15?'var(--gl)' : 'var(--bl)'}}>
              <div style={{fontSize:9,color:'var(--grl)'}}>{MESES_CORTO[x.mes]}</div>
              <div style={{fontSize:12,fontWeight:600,color:x.indice<0.7?'var(--red)':x.indice>1.15?'var(--gd)':'var(--n)'}}>{x.indice.toFixed(2)}</div>
            </div>
          ))}
        </div>

        {verIndices && (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={idx.map(x => ({ mes: MESES_CORTO[x.mes], ...Object.fromEntries(x.porAnio.map(p => [String(p.anio), p.valor])) }))}
                      margin={{top:5,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
              <XAxis dataKey="mes" tick={{fontSize:9,fill:GREY}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:GREY}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
              <Legend wrapperStyle={{fontSize:10}}/>
              {Object.keys(HISTORICO_BASE).map((a,i) => (
                <Bar key={a} dataKey={a} fill={[GREY,AMB,G][i] || GD} radius={[3,3,0,0]}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        <div style={{marginTop:10,padding:'8px 11px',background:'var(--bl)',borderRadius:6,fontSize:9.5,color:'var(--grl)',lineHeight:1.6}}>
          Es una recta, no un pronóstico. Supone que <strong>nadie se da de baja</strong> y que la temporada se repite como en años anteriores.
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:500,color:'var(--n)',margin:'18px 0 10px'}}>Mes a mes</div>
      <div style={{border:'1px solid var(--bd)',borderRadius:8,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead>
            <tr style={{background:'var(--bl)'}}>
              {['Mes','Previsto','Ingresado','Desvío','Acumulado'].map((h,i)=>(
                <th key={h} style={{textAlign:i?'right':'left',padding:'8px 10px',fontSize:9,letterSpacing:.4,
                                    textTransform:'uppercase',color:'var(--grl)',fontWeight:600}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.mes} style={{borderTop:'1px solid var(--bd)'}}>
                <td style={{padding:'7px 10px'}}>
                  {MESES_CORTO[f.mes]}
                  {f.real == null && <span style={{fontSize:9,color:'var(--grl)'}}> previsto</span>}
                </td>
                <td style={{padding:'7px 10px',textAlign:'right',color:'var(--grl)'}}>{eur(f.previsto)}</td>
                <td style={{padding:'7px 10px',textAlign:'right',fontWeight:f.real!=null?600:400}}>
                  {f.real != null ? eur(f.real) : '—'}
                </td>
                <td style={{padding:'7px 10px',textAlign:'right',color:f.desvio==null?'var(--grl)':f.desvio>=0?'var(--gd)':'var(--red)'}}>
                  {f.desvio == null ? '—' : `${f.desvio>=0?'+':''}${f.desvio.toFixed(0)}%`}
                </td>
                <td style={{padding:'7px 10px',textAlign:'right',color:'var(--grl)'}}>{eur(f.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
