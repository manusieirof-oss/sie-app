'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import PlanesTab from './components/PlanesTab'
import GastosTab from './components/GastosTab'
import ResumenTab from './components/ResumenTab'
import ImpuestosTab from './components/ImpuestosTab'
import RentabilidadTab from './components/RentabilidadTab'
import { cargarBonosTipos, BonoTipo } from '@/lib/bonos'

export default function FinanzasPage() {
  const [tab, setTab] = useState<'resumen'|'planes'|'gastos'|'impuestos'|'rentabilidad'>('resumen')
  const [planes, setPlanes] = useState<any[]>([])
  const [gastos, setGastos] = useState<any[]>([])
  const [bonos, setBonos] = useState<any[]>([])
  const [bonosHist, setBonosHist] = useState<any[]>([])
  const [bonosTipos, setBonosTipos] = useState<BonoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [fallos, setFallos] = useState<string[]>([])
  const [autorizado, setAutorizado] = useState<boolean|null>(null)
  const router = useRouter()

  useEffect(() => { verificarAcceso() }, [])

  async function verificarAcceso() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) { router.push('/login'); return }
    const { data: perfil } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
    const tieneAcceso = perfil?.rol === 'admin' || perfil?.permisos?.finanzas === true
    setAutorizado(tieneAcceso)
    if (tieneAcceso) cargar()
  }

  async function cargar() {
    setLoading(true)
    setFallos([])
    const [rp, rg, rb, rbh] = await Promise.all([
      supabase.from('planes').select('*').eq('activo', true).order('precio_base'),
      supabase.from('gastos').select('*').order('fecha', { ascending: false }),
      supabase.from('bonos').select('*').eq('activo', true),
      // El histórico necesita el descuento: sin él, la evolución mensual cobra
      // de más y el mes en curso sale con dos cifras distintas según la gráfica.
      supabase.from('bonos').select('tipo,estado_pago,mes,anio,created_at,activo,descuento_tipo,descuento_valor').order('created_at'),
    ])
    // Una consulta que falla no puede pintarse como "0 €". Se dice.
    const errores = ([['planes', rp], ['gastos', rg], ['bonos', rb], ['histórico de bonos', rbh]] as const)
      .filter(([, r]) => r.error)
      .map(([nombre, r]) => `${nombre}: ${r.error!.message}`)
    setFallos(errores)
    setPlanes(rp.data || [])
    setGastos(rg.data || [])
    setBonos(rb.data || [])
    setBonosHist(rbh.data || [])
    setBonosTipos(await cargarBonosTipos(false))
    setLoading(false)
  }

  if (autorizado === null) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'50vh'}}>
      <span style={{color:'var(--grl)',fontSize:12}}>Verificando acceso...</span>
    </div>
  )

  if (!autorizado) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:10}}>
      <div style={{color:'var(--grl)'}}><Ic name="candado" size={40} strokeWidth={1.5}/></div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
      <div style={{fontSize:11,color:'var(--grl)'}}>No tienes permiso para ver el módulo de finanzas</div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3,marginBottom:12,width:'fit-content'}}>
        {([['resumen','progreso','Resumen'],['planes','euro','Planes'],['gastos','recibo','Gastos'],['impuestos','clinica','Impuestos'],['rentabilidad','sube','Rentabilidad']] as const).map(([k,ic,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{fontSize:11,padding:'7px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:tab===k?'var(--w)':'transparent',color:tab===k?'var(--n)':'var(--grl)',fontWeight:tab===k?500:400,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',gap:5}}>
            <Ic name={ic} size={13}/> {l}
          </button>
        ))}
      </div>

      {fallos.length > 0 && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:10,color:'var(--red)',lineHeight:1.6}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>No se han podido leer todos los datos.</strong> Lo que ves debajo está incompleto:
          <ul style={{margin:'4px 0 0 16px',padding:0}}>{fallos.map(f=><li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {loading ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando finanzas...</div>
      ) : (
        <>
          {tab==='resumen' && <ResumenTab planes={planes} gastos={gastos} bonos={bonos} bonosHist={bonosHist}/>}
          {tab==='planes' && <PlanesTab planes={planes} bonos={bonos} bonosTipos={bonosTipos} recargar={cargar}/>}
          {tab==='gastos' && <GastosTab gastos={gastos} recargar={cargar}/>}
          {tab==='impuestos' && <ImpuestosTab planes={planes} gastos={gastos} bonosHist={bonosHist}/>}
          {tab==='rentabilidad' && <RentabilidadTab planes={planes} gastos={gastos} bonos={bonos} bonosHist={bonosHist}/>}
        </>
      )}
    </div>
  )
}
