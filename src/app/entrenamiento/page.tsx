'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BibliotecaTab from './components/BibliotecaTab'
import SesionesTab from './components/SesionesTab'
import TestsTab from './components/TestsTab'
import EtiquetasTab from './components/EtiquetasTab'
import ListasTab from './components/ListasTab'
import PatologiasTab from './components/PatologiasTab'
import MolestiasBibTab from './components/MolestiasBibTab'
import ObjetivosTab from './components/ObjetivosTab'

const CATEGORIAS = [
  { key: 'musculo', label: '💪 Músculo' },
  { key: 'articulacion', label: '🦴 Articulación' },
  { key: 'movimiento', label: '🔄 Movimiento' },
  { key: 'posicion', label: '📍 Posición' },
  { key: 'material', label: '🏋 Material' },
  { key: 'apoyo', label: '🦶 Apoyo' },
  { key: 'agarre', label: '✋ Agarre' },
  { key: 'patologia', label: '🏥 Patología' },
]

function EntrenamientoContent() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState('biblioteca')
  const [ejercicios, setEjercicios] = useState<any[]>([])
  const [pacientes, setPacientes] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [alergiasBiblio, setAlergiasBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [opsBiblioLib, setOpsBiblioLib] = useState<any[]>([])
  const [patologiasBiblio, setPatologiasBiblio] = useState<any[]>([])
  const [molestiasBiblio, setMolestiasBiblio] = useState<any[]>([])
  const [objetivos, setObjetivos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pacienteIdParam, setPacienteIdParam] = useState('')
  const [subsubAbiertas, setSubsubAbiertas] = useState<string[]>([])

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const nuevaSesion = searchParams.get('nueva_sesion')
    const pacienteId = searchParams.get('paciente_id')
    if (nuevaSesion && pacienteId) { setTab('sesiones'); setPacienteIdParam(pacienteId) }
  }, [searchParams])

  async function cargar() {
    setLoading(true)
    const [{ data: e },{ data: p },{ data: s },{ data: et },{ data: tl }] = await Promise.all([
      supabase.from('ejercicios').select('*').order('nombre'),
      supabase.from('pacientes').select('id,nombre,apellidos').eq('estado','activo').order('nombre'),
      supabase.from('sesiones').select('*, pacientes(nombre,apellidos), sesiones_objetivos(objetivo_id)').order('created_at',{ascending:false}).limit(20),
      supabase.from('etiquetas').select('*').order('categoria').order('nombre'),
      supabase.from('tests').select('*').order('nombre'),
    ])
    setEjercicios(e||[]); setPacientes(p||[]); setSesiones(s||[]); setEtiquetas(et||[]); setTestsLib(tl||[])
    const [{ data: meds },{ data: alerg },{ data: intol },{ data: ops },{ data: pats },{ data: mols },{ data: objs }] = await Promise.all([
      supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('categoria').order('nombre'),
      supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('categoria').order('nombre'),
      supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('categoria').order('nombre'),
      supabase.from('operaciones_biblioteca').select('*').eq('activo',true).order('zona').order('nombre'),
      supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('zona').order('nombre'),
      supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('zona').order('nombre'),
      supabase.from('objetivos').select('*').eq('activo',true).order('nombre'),
    ])
    setMedsBiblio(meds||[]); setAlergiasBiblio(alerg||[]); setIntolBiblio(intol||[])
    setOpsBiblioLib(ops||[]); setPatologiasBiblio(pats||[]); setMolestiasBiblio(mols||[])
    setObjetivos(objs||[])
    setLoading(false)
  }

  function getNivel1(cat: string) { return etiquetas.filter(e=>e.categoria===cat && !e.padre_id) }
  function getSubs(padreId: string) { return etiquetas.filter(e=>e.padre_id===padreId) }
  function getNombre(id: string) {
    const et = etiquetas.find(e=>e.id===id)
    if (!et) return ''
    if (et.padre_id) {
      const padre = etiquetas.find(e=>e.id===et.padre_id)
      if (padre?.padre_id) { const abuelo = etiquetas.find(e=>e.id===padre.padre_id); return `${abuelo?.nombre} › ${padre?.nombre} › ${et.nombre}` }
      return `${padre?.nombre} › ${et.nombre}`
    }
    return et.nombre
  }

  function toggle(id: string, lista: string[], setLista: (v:string[])=>void) {
    setLista(lista.includes(id) ? lista.filter(x=>x!==id) : [...lista, id])
  }
  function toggleSubsub(id: string) {
    setSubsubAbiertas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  function SelectorColumnas({ seleccionadas, onChange }: { seleccionadas: string[], onChange: (v:string[])=>void }) {
    return (
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'65vh'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(8,minmax(140px,1fr))',gap:1,background:'var(--bm)',minWidth:1100}}>
          {CATEGORIAS.map(cat=>{
            const nivel1 = getNivel1(cat.key)
            const selCount = etiquetas.filter(e=>e.categoria===cat.key && seleccionadas.includes(e.id)).length
            return (
              <div key={cat.key} style={{background:'var(--w)',display:'flex',flexDirection:'column'}}>
                <div style={{padding:'8px 10px',background:'var(--n)',position:'sticky',top:0}}>
                  <div style={{fontSize:10,fontWeight:500,color:'#fff'}}>{cat.label}</div>
                  {selCount>0&&<div style={{fontSize:8,color:'var(--gm)',marginTop:1}}>{selCount} selec.</div>}
                </div>
                <div style={{padding:'6px 6px',flex:1}}>
                  {nivel1.map(et=>{
                    const subs = getSubs(et.id)
                    const sel = seleccionadas.includes(et.id)
                    return (
                      <div key={et.id} style={{marginBottom:4}}>
                        <div onClick={()=>toggle(et.id,seleccionadas,onChange)}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'4px 6px',borderRadius:4,cursor:'pointer',background:sel?'var(--g)':'transparent',color:sel?'#fff':'var(--n)'}}
                          onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                          onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                          <div style={{width:12,height:12,borderRadius:2,border:`1.5px solid ${sel?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {sel&&<span style={{fontSize:8,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                          </div>
                          <span style={{fontSize:10,fontWeight:sel?500:400}}>{et.nombre}</span>
                        </div>
                        {subs.length>0&&(
                          <div style={{marginLeft:8,borderLeft:'1.5px solid var(--bm)',paddingLeft:6}}>
                            {subs.map(sub=>{
                              const subsubs = getSubs(sub.id)
                              const selSub = seleccionadas.includes(sub.id)
                              const subsubAbierta = subsubAbiertas.includes(sub.id)
                              return (
                                <div key={sub.id} style={{marginBottom:2}}>
                                  <div style={{display:'flex',alignItems:'center',gap:3}}>
                                    <div onClick={()=>toggle(sub.id,seleccionadas,onChange)}
                                      style={{display:'flex',alignItems:'center',gap:4,padding:'3px 5px',borderRadius:3,cursor:'pointer',flex:1,background:selSub?'var(--g)':'transparent',color:selSub?'#fff':'var(--gr)'}}
                                      onMouseOver={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                      onMouseOut={e=>{if(!selSub)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                      <div style={{width:10,height:10,borderRadius:2,border:`1px solid ${selSub?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                        {selSub&&<span style={{fontSize:7,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                                      </div>
                                      <span style={{fontSize:9,fontWeight:300}}>{sub.nombre}</span>
                                    </div>
                                    {subsubs.length>0&&<div onClick={()=>toggleSubsub(sub.id)} style={{fontSize:8,color:'var(--grl)',cursor:'pointer',padding:'2px 3px',transform:subsubAbierta?'rotate(90deg)':'',transition:'transform .15s'}}>›</div>}
                                  </div>
                                  {subsubs.length>0&&subsubAbierta&&(
                                    <div style={{marginLeft:10,borderLeft:'1.5px solid var(--bm)',paddingLeft:5}}>
                                      {subsubs.map(ss=>{
                                        const selSS = seleccionadas.includes(ss.id)
                                        return (
                                          <div key={ss.id} onClick={()=>toggle(ss.id,seleccionadas,onChange)}
                                            style={{display:'flex',alignItems:'center',gap:4,padding:'2px 4px',borderRadius:3,cursor:'pointer',background:selSS?'var(--g)':'transparent',color:selSS?'#fff':'var(--grl)'}}
                                            onMouseOver={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='var(--gl)'}}
                                            onMouseOut={e=>{if(!selSS)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                                            <div style={{width:8,height:8,borderRadius:1,border:`1px solid ${selSS?'rgba(255,255,255,.6)':'var(--bd)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                              {selSS&&<span style={{fontSize:6,color:'var(--g)',fontWeight:700,background:'#fff',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:1}}>✓</span>}
                                            </div>
                                            <span style={{fontSize:8,fontWeight:300}}>{ss.nombre}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="tabs">
        {[['biblioteca','📚 Ejercicios'],['sesiones','📋 Sesiones'],['tests','🔍 Tests'],['etiquetas','🏷 Etiquetas'],['listas','💊 Listas'],['patologias_bib','🏥 Patologías'],['molestias_bib','🤕 Molestias'],['objetivos','🎯 Objetivos']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {loading?<div className="loading">Cargando...</div>:(
        <>
          {tab==='biblioteca'&&<BibliotecaTab ejercicios={ejercicios} etiquetas={etiquetas} cargar={cargar} getNombre={getNombre} SelectorColumnas={SelectorColumnas}/>}
          {tab==='sesiones'&&<SesionesTab sesiones={sesiones} pacientes={pacientes} ejercicios={ejercicios} etiquetas={etiquetas} objetivos={objetivos} cargar={cargar} getNombre={getNombre} pacienteIdInicial={pacienteIdParam}/>}
          {tab==='tests'&&<TestsTab testsLib={testsLib} etiquetas={etiquetas} setTestsLib={setTestsLib} SelectorColumnas={SelectorColumnas}/>}
          {tab==='etiquetas'&&<EtiquetasTab etiquetas={etiquetas} cargar={cargar}/>}
          {tab==='listas'&&<ListasTab medsBiblio={medsBiblio} alergiasBiblio={alergiasBiblio} intolBiblio={intolBiblio} opsBiblioLib={opsBiblioLib} cargar={cargar}/>}
          {tab==='patologias_bib'&&<PatologiasTab patologiasBiblio={patologiasBiblio}/>}
          {tab==='molestias_bib'&&<MolestiasBibTab molestiasBiblio={molestiasBiblio}/>}
          {tab==='objetivos'&&<ObjetivosTab objetivos={objetivos} testsLib={testsLib} cargar={cargar}/>}
        </>
      )}
    </>
  )
}

export default function EntrenamientoPage() {
  return (
    <Suspense fallback={<div className="loading">Cargando...</div>}>
      <EntrenamientoContent />
    </Suspense>
  )
}
