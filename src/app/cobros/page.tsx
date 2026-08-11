'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import ModalCobro from '@/components/ModalCobro'
import { indicePlanes, precioFinalPlan, precioConDescuento, esVentaPuntual } from '@/lib/bonos'
import { listadoGestoria } from '@/lib/cobros'
import { cargarTarifas } from '@/lib/tarifas'
import { abrirFactura } from '@/lib/factura'
import Link from 'next/link'

// Pilar Cobros. Quién ha pagado el mes y quién no, y desde aquí se cobra.
//
// VIVE FUERA DE FINANZAS A PROPÓSITO, con su propio permiso. Cobrar y ver el
// dinero de la clínica son dos cosas distintas: los empleados cobran a los
// pacientes y emiten facturas, pero no tienen por qué ver gastos, impuestos ni
// la cuenta de resultados. `permisos.cobros` abre esta pantalla;
// `permisos.finanzas` sigue abriendo solo Finanzas.
//
// El estado de pago sale de `v_bonos_pago`, o sea, de si existe un cobro que
// cubra ese bono. NO se lee `bonos.estado_pago`: ese campo queda solo para
// distinguir "pendiente" de "impago", que es un juicio, no un hecho.

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function CobrosPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean|null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallos, setFallos] = useState<string[]>([])

  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth()+1)
  const [anio] = useState(hoy.getFullYear())

  const [pacientes, setPacientes] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [pago, setPago] = useState<Record<string, any>>({})
  const [planes, setPlanes] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [servicios, setServicios] = useState<any[]>([])
  const [descuentos, setDescuentos] = useState<any[]>([])
  // Cuántas clases lleva cada paciente este mes, sacadas de la AGENDA.
  // Es el contraste que descubre a quien viene y no paga.
  const [clasesDe, setClasesDe] = useState<Record<string, number>>({})
  const [vinieronSinBono, setVinieronSinBono] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  // Tres vistas en vez de un interruptor. "Ver todos" sacaba también a quien no
  // tiene cuota ni ha venido, y eso es ruido: la lista va de cobrar el mes.
  const [vista, setVista] = useState<'pendientes'|'vinieron'|'todos'>('pendientes')
  const [cobrando, setCobrando] = useState<any>(null)
  const [aviso, setAviso] = useState<string|null>(null)
  // Última factura emitida, para poder imprimirla sin buscarla.
  const [ultima, setUltima] = useState<string|null>(null)

  useEffect(() => { verificar() }, [])
  useEffect(() => { if (autorizado) cargar() }, [autorizado, mes])

  async function verificar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
    // Quien puede ver Finanzas puede cobrar; al revés no.
    setAutorizado(data?.rol === 'admin' || data?.permisos?.cobros === true || data?.permisos?.finanzas === true)
  }

  async function cargar() {
    setCargando(true); setFallos([])
    const [rp, rb, rpl, rf] = await Promise.all([
      supabase.from('pacientes').select('id,nombre,apellidos,dni,estado').in('estado',['activo','pausa']).order('nombre'),
      // Solo los bonos vigentes: un paciente al que se le corrigió el bono a
      // mitad de mes tiene la fila vieja desactivada, y contarla sería cobrar dos veces.
      supabase.from('bonos').select('*').eq('mes', mes).eq('anio', anio).eq('activo', true),
      supabase.from('planes').select('*').eq('activo', true),
      supabase.from('facturas').select('id,serie,numero,fecha_expedicion,tipo,total,cobro_id').order('fecha_expedicion',{ascending:false}).limit(30),
    ])
    const errs = ([['pacientes',rp],['bonos',rb],['planes',rpl],['facturas',rf]] as const)
      .filter(([,r]) => r.error).map(([n,r]) => `${n}: ${r.error!.message}`)

    const tar = await cargarTarifas()
    if (tar.error) errs.push(`tarifas: ${tar.error}`)
    setServicios(tar.servicios); setDescuentos(tar.descuentos)

    // ---- CRUCE CON LA AGENDA ----------------------------------------------
    // Quién ha pisado la clínica este mes, tenga cuota o no. Sin esto, alguien
    // sin bono asignado no aparece en ningún sitio: ni en la lista de cobros,
    // ni en pendientes, ni en el total. Viene, entrena y no lo ve nadie.
    const desdeM = `${anio}-${String(mes).padStart(2,'0')}-01`
    const hastaM = new Date(anio, mes, 0).toISOString().split('T')[0]
    const rcit = await supabase.from('citas')
      .select('paciente_id, pacientes(nombre,apellidos)')
      .gte('fecha', desdeM).lte('fecha', hastaM)
      .in('estado', ['realizada','programada'])
    if (rcit.error) errs.push(`citas del mes: ${rcit.error.message}`)

    const cuenta: Record<string, number> = {}
    const nombreDe: Record<string, string> = {}
    ;(rcit.data || []).forEach((c: any) => {
      if (!c.paciente_id) return
      cuenta[c.paciente_id] = (cuenta[c.paciente_id] || 0) + 1
      if (c.pacientes) nombreDe[c.paciente_id] = `${c.pacientes.nombre} ${c.pacientes.apellidos}`
    })
    setClasesDe(cuenta)

    const conBono = new Set((rb.data || []).map((b:any) => b.paciente_id))
    setVinieronSinBono(
      Object.entries(cuenta)
        .filter(([pid]) => !conBono.has(pid))
        .map(([pid, n]) => ({ id: pid, nombre: nombreDe[pid] || 'Paciente', clases: n }))
        .sort((a, b) => b.clases - a.clases)
    )

    const ids = (rb.data || []).map((b:any) => b.id)
    let mapaPago: Record<string, any> = {}
    if (ids.length) {
      const rv = await supabase.from('v_bonos_pago').select('*').in('bono_id', ids)
      if (rv.error) errs.push(`estado de pago: ${rv.error.message}`)
      mapaPago = Object.fromEntries((rv.data || []).map((r:any) => [r.bono_id, r]))
    }

    setFallos(errs)
    setPacientes(rp.data || []); setBonos(rb.data || []); setPlanes(rpl.data || [])
    setFacturas(rf.data || []); setPago(mapaPago)
    setCargando(false)
  }

  const idx = useMemo(() => indicePlanes(planes), [planes])
  const pacienteDe = useMemo(() => Object.fromEntries(pacientes.map(p => [p.id, p])), [pacientes])

  /**
   * UNA FILA POR BONO, no por paciente.
   *
   * Antes esto era un `Object.fromEntries(bonos.map(b => [b.paciente_id, b]))`,
   * que se queda con un solo bono por persona. Con un tipo de bono al mes no se
   * notaba; ahora alguien puede pagar su cuota de septiembre Y comprar ocho
   * sesiones en septiembre, y el segundo bono desaparecía del mapa sin más: no
   * salía en la lista, no se cobraba y no se facturaba. Dinero perdido en
   * silencio, que es la peor forma de perderlo.
   */
  const filas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return bonos
      .map(bono => {
        const p = pacienteDe[bono.paciente_id]
        const pagado = !!pago[bono.id]?.pagado
        const importe = precioConDescuento(precioFinalPlan(idx[bono.tipo]), bono)
        // Impago es un JUICIO sobre algo que sigue sin cobrarse: "vino y no paga".
        // Nunca lo contrario: "pagado" no se escribe a mano, sale del cobro.
        const impago = !pagado && bono?.estado_pago === 'impago'
        // Las clases van en la fila de la cuota. Repetirlas en la del bono de
        // sesiones haría leer las mismas doce clases dos veces.
        const clases = esVentaPuntual(bono) ? 0 : (clasesDe[bono.paciente_id] || 0)
        return { p, bono, pagado, impago, importe, clases }
      })
      // Un bono cuyo paciente no está en la lista (de baja a mitad de mes) se
      // cae aquí, pero no en silencio: se dice abajo.
      .filter(f => !!f.p)
      .filter(f => !t || `${f.p.nombre} ${f.p.apellidos}`.toLowerCase().includes(t))
      .filter(f => vista === 'todos' ? true
                 : vista === 'vinieron' ? f.clases > 0
                 : !f.pagado)
      // Los cobrados al final: mientras cobras te interesa lo que falta. Dentro
      // de los pendientes, primero el que más clases lleva sin pagar. Y las dos
      // filas de una misma persona, juntas: separadas parecen un error.
      .sort((a, b) => Number(a.pagado) - Number(b.pagado)
        || b.clases - a.clases
        || `${a.p.nombre} ${a.p.apellidos}`.localeCompare(`${b.p.nombre} ${b.p.apellidos}`))
  }, [bonos, pacienteDe, pago, idx, busca, vista, clasesDe])

  /**
   * Abre el cobro mirando antes si al paciente se le ha cobrado alguna vez.
   * Solo en el primer cobro se le ofrece pagar la fracción de mes que le queda;
   * a partir del mes siguiente la cuota va entera.
   */
  async function abrirCobro(p: any, bono: any) {
    const { count, error } = await supabase.from('cobros')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', p.id).eq('anulado', false)
    if (error) setAviso(`No se ha podido comprobar si tiene cobros previos: ${error.message}`)
    setCobrando({ p, bono, tieneCobrosPrevios: (count ?? 1) > 0 })
  }

  async function marcarImpago(bono: any, esImpago: boolean) {
    const { error } = await supabase.from('bonos')
      .update({ estado_pago: esImpago ? 'impago' : 'pendiente' }).eq('id', bono.id)
    if (error) { setAviso(`No se ha podido marcar: ${error.message}`); return }
    cargar()
  }

  const totalPendiente = filas.filter(f=>!f.pagado).reduce((a,f)=>a+f.importe, 0)
  const nPagados = Object.values(pago).filter((r:any)=>r.pagado).length

  async function exportarGestoria() {
    const desde = `${anio}-${String(mes).padStart(2,'0')}-01`
    const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]
    const r = await listadoGestoria(desde, hasta)
    if (!r.ok) { setAviso(`No se ha podido generar el listado: ${r.error}`); return }
    if (!r.filas.length) { setAviso('No hay facturas emitidas en ese mes.'); return }
    const cols = ['serie','numero','fecha','cliente','nif','servicios','base','iva','retencion','total','forma_pago']
    const csv = [cols.join(';'), ...r.filas.map((f:any) => cols.map(c => String(f[c] ?? '').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `facturas-${anio}-${String(mes).padStart(2,'0')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (autorizado === null) return <div style={{fontSize:12,color:'var(--grl)',padding:20}}>Verificando acceso...</div>
  if (!autorizado) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:10}}>
      <div style={{color:'var(--grl)'}}><Ic name="candado" size={40} strokeWidth={1.5}/></div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <select className="input" style={{width:'auto',padding:'6px 10px'}} value={mes} onChange={e=>setMes(Number(e.target.value))}>
          {MESES.map((m,i)=><option key={m} value={i+1}>{m} {anio}</option>)}
        </select>
        <input className="input" style={{width:200}} placeholder="Buscar paciente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3}}>
          {([['pendientes','Pendientes'],['vinieron','Han venido'],['todos','Todos']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)}
              style={{fontSize:10,padding:'6px 11px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',
                background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',
                fontWeight:vista===k?500:400,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <Link href="/cobros/facturas" className="btn btn-s btn-sm" style={{textDecoration:'none'}}>
          <Ic name="informe" size={12}/> Facturas emitidas
        </Link>
        <button className="btn btn-s btn-sm" onClick={exportarGestoria}>
          <Ic name="descargar" size={12}/> Listado para la gestoría
        </button>
      </div>

      {fallos.length > 0 && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>Faltan datos por leer.</strong> Lo de abajo está incompleto:
          <ul style={{margin:'4px 0 0 16px',padding:0}}>{fallos.map(f=><li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {aviso && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',display:'flex',gap:8,alignItems:'center'}}>
          <Ic name="alerta" size={12}/><span style={{flex:1}}>{aviso}</span>
          {ultima && (
            <button className="btn btn-p btn-sm" onClick={async()=>{
              const r = await abrirFactura(ultima)
              if (!r.ok) setAviso(r.error || 'No se ha podido abrir la factura.')
            }}><Ic name="informe" size={11}/> Ver factura</button>
          )}
          <button className="btn btn-t btn-sm" onClick={()=>{setAviso(null);setUltima(null)}}>Cerrar</button>
        </div>
      )}

      {/* VIENE Y NO TIENE CUOTA
          El agujero que no tapaba nada: esta pantalla lista a quien TIENE bono,
          así que alguien sin bono asignado entrenaba sin aparecer en ningún
          sitio. Se cruza con la agenda y se enseña arriba, en rojo, porque es
          dinero que se está yendo sin que nadie lo vea. */}
      {vinieronSinBono.length > 0 && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'11px 14px',marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,color:'var(--red)',display:'flex',alignItems:'center',gap:5,marginBottom:7}}>
            <Ic name="alerta" size={13}/>
            {vinieronSinBono.length} {vinieronSinBono.length===1?'persona ha venido':'personas han venido'} este mes sin cuota asignada
          </div>
          <div style={{fontSize:10,color:'#8A3A3A',marginBottom:9,lineHeight:1.6}}>
            Tienen citas en la agenda pero ningún bono de {MESES[mes-1].toLowerCase()}, así que no salen en la lista de abajo ni cuentan en el pendiente. Asígnales bono desde su ficha.
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {vinieronSinBono.map(v=>(
              <Link key={v.id} href={`/pacientes/${v.id}`}
                style={{fontSize:10,padding:'4px 10px',borderRadius:99,background:'var(--w)',border:'1px solid #E8C4C4',
                        color:'var(--n)',textDecoration:'none',whiteSpace:'nowrap'}}>
                {v.nombre} <span style={{color:'var(--red)',fontWeight:600}}>{v.clases}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:16}}>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Cobrado</div>
          <div style={{fontSize:24,fontWeight:300,color:'#3E7179',marginTop:4}}>{nPagados}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>cuotas de {bonos.length}</div>
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Pendiente</div>
          <div style={{fontSize:24,fontWeight:300,color:'#D4A24E',marginTop:4}}>{totalPendiente.toFixed(0)} €</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>{filas.filter(f=>!f.pagado).length} pacientes</div>
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Han venido</div>
          <div style={{fontSize:24,fontWeight:300,color:'var(--n)',marginTop:4}}>{Object.keys(clasesDe).length}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>personas distintas</div>
        </div>
        <div className="card" style={{textAlign:'center',margin:0}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Última factura</div>
          <div style={{fontSize:24,fontWeight:300,color:'#5A969E',marginTop:4}}>
            {facturas[0] ? `${facturas[0].serie}/${String(facturas[0].numero).padStart(4,'0')}` : '—'}
          </div>
          <div style={{fontSize:9,color:'var(--grl)'}}>{facturas.length ? `${facturas.length} recientes` : 'ninguna aún'}</div>
        </div>
      </div>

      {cargando ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando...</div>
      ) : filas.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
          {vista==='pendientes' ? 'No queda nadie por cobrar este mes.'
           : vista==='vinieron' ? 'Nadie con cuota ha venido todavía este mes.'
           : 'Nadie tiene cuota asignada este mes.'}
        </div>
      ) : filas.map(({ p, bono, pagado, impago, importe, clases }) => (
        <div key={bono.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:8,
                                border:`1px solid ${impago?'var(--red)':'var(--bd)'}`,marginBottom:6,
                                background:pagado?'var(--gl)':impago?'var(--redl)':'var(--w)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>
              {p.nombre} {p.apellidos}
              {p.estado==='pausa' && <span style={{fontSize:9,color:'#7A5800',marginLeft:6}}>en pausa</span>}
              {impago && <span style={{fontSize:9,color:'var(--red)',marginLeft:6,fontWeight:600}}>impago</span>}
            </div>
            <div style={{fontSize:9,color:'var(--grl)'}}>
              {idx[bono.tipo]?.nombre || bono.tipo}
              {/* Sin esto, las dos filas de quien tiene cuota Y sesiones se leen
                  como una duplicada. */}
              {esVentaPuntual(bono) && <span style={{color:'var(--gd)'}}>{' · '}{bono.sesiones_totales} sesiones</span>}
              {!p.dni && ' · sin DNI'}
              {/* Lo que ya ha entrenado sin haber pagado. Cuanto más alto, más urge. */}
              {!pagado && clases > 0 && (
                <span style={{color:clases>=4?'var(--red)':'#7A5800',fontWeight:600}}>
                  {' · '}{clases} {clases===1?'clase':'clases'} ya
                </span>
              )}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:pagado?'#3E7179':'var(--n)'}}>{importe.toFixed(2)} €</div>
          {pagado ? (
            <span style={{fontSize:10,color:'#3E7179',display:'inline-flex',alignItems:'center',gap:4,minWidth:130,justifyContent:'flex-end'}}>
              <Ic name="check" size={13}/> Cobrado
            </span>
          ) : (
            <div style={{display:'flex',gap:5,minWidth:130,justifyContent:'flex-end'}}>
              {bono && (
                <button className="btn btn-s btn-sm" title={impago?'Volver a pendiente':'Marcar como impago: vino y no ha pagado'}
                  onClick={()=>marcarImpago(bono, !impago)}
                  style={impago?{color:'var(--red)',borderColor:'var(--red)'}:undefined}>
                  {impago ? 'Pendiente' : 'Impago'}
                </button>
              )}
              <button className="btn btn-p btn-sm" disabled={!bono} onClick={()=>abrirCobro(p, bono)}>Cobrar</button>
            </div>
          )}
        </div>
      ))}

      {cobrando && (
        <ModalCobro
          paciente={cobrando.p}
          bono={cobrando.bono}
          planes={planes}
          servicios={servicios}
          descuentos={descuentos}
          /* Prorrateo solo en el primer cobro del paciente: si nunca se le ha
             cobrado nada, se le ofrece pagar la fracción de mes que le queda. */
          primerCobro={!cobrando.tieneCobrosPrevios}
          onCerrar={()=>setCobrando(null)}
          onEmitida={r=>{
            setAviso(`Factura ${r.serie}/${String(r.numero).padStart(4,'0')} emitida.`)
            setUltima(r.facturaId)
            cargar()
          }}
        />
      )}
    </div>
  )
}
