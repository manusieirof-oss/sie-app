'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import PlanesTab from '../components/PlanesTab'
import GastosTab from '../components/GastosTab'
import ResumenTab from '../components/ResumenTab'
import ImpuestosTab from '../components/ImpuestosTab'
import RentabilidadTab from '../components/RentabilidadTab'

// Banco de pruebas de Finanzas.
//
// Monta las CINCO PESTAÑAS REALES con los datos reales de 2026. Lo que se ve
// aquí es exactamente lo que pintaría la pantalla de verdad si estos datos
// estuvieran cargados: si algo se ve mal aquí, está mal allí. Por eso no hay ni
// una copia de los componentes.
//
// Los datos NO están en este fichero: se piden a /api/finanzas/prueba, que
// comprueba sesión y permiso antes de soltarlos. Escribirlos aquí los metería
// en el JavaScript público, y son las facturas reales.
//
// El mes "actual" se puede mover con el selector, porque media pestaña de
// Finanzas calcula sobre new Date() y con datos de enero a junio no se vería
// nada estando en agosto.

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio']

export default function PruebaFinanzasPage() {
  const [tab, setTab] = useState<'resumen'|'planes'|'gastos'|'impuestos'|'rentabilidad'>('resumen')
  const [mesFoto, setMesFoto] = useState(6)
  const [datos, setDatos] = useState<any>(null)
  const [estado, setEstado] = useState<'cargando'|'ok'|'sinPermiso'|'error'>('cargando')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { setEstado('sinPermiso'); setMensaje('Necesitas iniciar sesión.'); return }

    let res: Response
    try {
      res = await fetch('/api/finanzas/prueba', { headers: { Authorization: `Bearer ${session.access_token}` } })
    } catch (e: any) {
      setEstado('error'); setMensaje(`No se ha podido contactar con el servidor: ${e?.message || e}`); return
    }

    const cuerpo = await res.json().catch(() => ({}))
    if (res.status === 401 || res.status === 403) {
      setEstado('sinPermiso'); setMensaje(cuerpo?.error || 'Sin permiso.'); return
    }
    if (!res.ok) {
      setEstado('error'); setMensaje(cuerpo?.error || `Error ${res.status}.`); return
    }
    setDatos(cuerpo)
    setEstado('ok')
  }

  // "Activo" = el bono de ese mes. Es lo que la app entiende por cuota vigente.
  const bonos = useMemo(
    () => (datos?.bonos || []).map((b: any) => ({ ...b, activo: b.anio === 2026 && b.mes === mesFoto })),
    [datos, mesFoto]
  )

  if (estado === 'cargando') return (
    <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando datos de prueba...</div>
  )

  if (estado === 'sinPermiso') return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:10}}>
      <div style={{color:'var(--grl)'}}><Ic name="candado" size={40} strokeWidth={1.5}/></div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
      <div style={{fontSize:11,color:'var(--grl)'}}>{mensaje}</div>
    </div>
  )

  if (estado === 'error') return (
    <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'12px 16px',fontSize:11,color:'var(--red)'}}>
      <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
      <strong>No se han podido cargar los datos de prueba.</strong> {mensaje}
    </div>
  )

  const { planes, gastos, bonosTipos } = datos
  const activos = bonos.filter((b: any) => b.activo).length
  const mesRef = `2026-${String(mesFoto).padStart(2,'0')}`
  const gastosDelMes = gastos.filter((g: any) => g.fecha.slice(0,7) === mesRef).length
  const noop = () => {}

  return (
    <div>
      <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
        <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
        <strong>Banco de pruebas.</strong> Las cinco pestañas de abajo son las de verdad, alimentadas con las facturas
        reales de enero a junio de 2026 ({datos.bonos.length} de ingreso, {gastos.length} de gasto).
        No hay conexión con la base de datos: guardar un gasto o editar un precio aquí no hace nada.
        Los pacientes van anonimizados. Las salvedades de cada dato están comentadas en la fuente.
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontSize:10,color:'var(--grl)'}}>Ver como si el mes en curso fuera</span>
        <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3}}>
          {MESES.map((m,i)=>(
            <button key={m} onClick={()=>setMesFoto(i+1)}
              style={{fontSize:10,padding:'5px 10px',borderRadius:5,border:'none',cursor:'pointer',fontFamily:'system-ui',
                background:mesFoto===i+1?'var(--w)':'transparent',color:mesFoto===i+1?'var(--n)':'var(--grl)',
                fontWeight:mesFoto===i+1?500:400,boxShadow:mesFoto===i+1?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{m}</button>
          ))}
        </div>
        <span style={{fontSize:9,color:'var(--grl)'}}>{activos} cuotas · {gastosDelMes} gastos ese mes</span>
      </div>

      <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3,marginBottom:12,width:'fit-content'}}>
        {([['resumen','progreso','Resumen'],['planes','euro','Planes'],['gastos','recibo','Gastos'],['impuestos','clinica','Impuestos'],['rentabilidad','sube','Rentabilidad']] as const).map(([k,ic,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{fontSize:11,padding:'7px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:tab===k?'var(--w)':'transparent',color:tab===k?'var(--n)':'var(--grl)',fontWeight:tab===k?500:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',gap:5}}>
            <Ic name={ic} size={13}/> {l}
          </button>
        ))}
      </div>

      {tab==='resumen' && <ResumenTab planes={planes} gastos={gastos} bonos={bonos} bonosHist={datos.bonos} mesRef={mesRef}/>}
      {tab==='planes' && <PlanesTab planes={planes} bonos={bonos} bonosTipos={bonosTipos} recargar={noop}/>}
      {tab==='gastos' && <GastosTab gastos={gastos} recargar={noop} mesRef={mesRef}/>}
      {tab==='impuestos' && <ImpuestosTab planes={planes} gastos={gastos} bonosHist={datos.bonos}/>}
      {tab==='rentabilidad' && <RentabilidadTab planes={planes} gastos={gastos} bonos={bonos} bonosHist={datos.bonos} mesRef={mesRef}/>}
    </div>
  )
}
