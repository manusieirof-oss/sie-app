'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
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
    const [{ data: p }, { data: g }, { data: b }, { data: bh }] = await Promise.all([
      supabase.from('planes').select('*').eq('activo', true).order('precio_base'),
      supabase.from('gastos').select('*').order('fecha', { ascending: false }),
      supabase.from('bonos').select('*').eq('activo', true),
      supabase.from('bonos').select('tipo,estado_pago,mes,anio,created_at,activo').order('created_at'),
    ])
    setPlanes(p || [])
    setGastos(g || [])
    setBonos(b || [])
    setBonosHist(bh || [])
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
      <div style={{fontSize:40}}>🔒</div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
      <div style={{fontSize:11,color:'var(--grl)'}}>No tienes permiso para ver el módulo de finanzas</div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3,marginBottom:12,width:'fit-content'}}>
        {([['resumen','📊 Resumen'],['planes','💶 Planes'],['gastos','🧾 Gastos'],['impuestos','🏛 Impuestos'],['rentabilidad','📈 Rentabilidad']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{fontSize:10,padding:'7px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:tab===k?'var(--w)':'transparent',color:tab===k?'var(--n)':'var(--grl)',fontWeight:tab===k?500:300,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

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
