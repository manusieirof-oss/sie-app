'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ClinicaTab from './components/ClinicaTab'
import ValoracionTab from './components/ValoracionTab'
import BonosTab from './components/BonosTab'
import RecuperacionesTab from './components/RecuperacionesTab'
import UsuariosTab from './components/UsuariosTab'
import CuentaTab from './components/CuentaTab'

export default function AjustesPage() {
  const [tab, setTab] = useState<'clinica'|'valoracion'|'bonos'|'recuperaciones'|'usuarios'|'cuenta'>('clinica')
  const [perfilActual, setPerfilActual] = useState<any>(null)
  const [ajustes, setAjustes] = useState<Record<string,string>>({})
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [comoNosConocio, setComoNosConocio] = useState<string[]>(['Recomendación de un conocido','Instagram','Google','Facebook','Pasó por aquí','Otro'])
  const [tiposClase, setTiposClase] = useState([{valor:'entrenamiento',icono:'🏋',nombre:'Entrenamiento',color:'#5A969E',duracion:50},{valor:'pilates',icono:'🧘',nombre:'Pilates',color:'#A8CDD1',duracion:50},{valor:'rehabilitacion',icono:'🏥',nombre:'Rehabilitación',color:'#C9A84C',duracion:50},{valor:'individual',icono:'👤',nombre:'Individual',color:'#3E7179',duracion:50},{valor:'embarazadas',icono:'🤰',nombre:'Embarazadas',color:'#B05A5A',duracion:50}])
  const [tiposJornada, setTiposJornada] = useState<string[]>([])
  const [tiposPlantilla, setTiposPlantilla] = useState<string[]>([])
  const [deportesLista, setDeportesLista] = useState<string[]>([])
  const [bonos, setBonos] = useState([{id:'reducido',nombre:'Reducido',dias:2,descripcion:'2 días/semana'},{id:'esencial',nombre:'Esencial',dias:3,descripcion:'3 días/semana'},{id:'progreso',nombre:'Progreso',dias:4,descripcion:'4 días/semana'},{id:'avanzado',nombre:'Avanzado',dias:5,descripcion:'5 días/semana'},{id:'individual',nombre:'Individual',dias:1,descripcion:'Sesiones sueltas'},{id:'bono4',nombre:'Bono 4 sesiones',dias:1,descripcion:'4 sesiones'}])
  const [nuevoComoNos, setNuevoComoNos] = useState('')
  const [nuevoJornada, setNuevoJornada] = useState('')
  const [nuevoPlantilla, setNuevoPlantilla] = useState('')
  const [nuevoDeporte, setNuevoDeporte] = useState('')

  useEffect(() => { cargar(); cargarPerfilActual() }, [])

  async function cargarPerfilActual() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
      setPerfilActual(data)
    }
  }

  async function cargar() {
    const { data } = await supabase.from('ajustes').select('clave,valor')
    if (data) {
      const map: Record<string,string> = {}
      data.forEach(a => { map[a.clave] = a.valor || '' })
      setAjustes(map)
      if (map.como_nos_conocio) setComoNosConocio(JSON.parse(map.como_nos_conocio))
      if (map.tipos_clase) setTiposClase(JSON.parse(map.tipos_clase))
      if (map.tipos_jornada) setTiposJornada(JSON.parse(map.tipos_jornada))
      else setTiposJornada(['Sentado','Sedentario','De pie','Mixto','Esfuerzo físico','Conductor','Pantallas','Trabajo manual'])
      if (map.tipos_plantilla) setTiposPlantilla(JSON.parse(map.tipos_plantilla))
      else setTiposPlantilla(['Rígida','Semirrígida','Blanda','Descarga metatarsal','Propioceptiva','Personalizada'])
      if (map.deportes_lista) setDeportesLista(JSON.parse(map.deportes_lista))
      else setDeportesLista(['Fútbol','Pádel','Tenis','Natación','Ciclismo','Running','CrossFit','Yoga','Pilates','Gimnasio','Golf','Baloncesto','Senderismo','Otro'])
      if (map.bonos_lista) setBonos(JSON.parse(map.bonos_lista))
    }
  }

  function set(clave: string, valor: string) {
    setAjustes(p => ({ ...p, [clave]: valor }))
  }

  async function guardar() {
    setGuardando(true)
    const datos = {
      ...ajustes,
      como_nos_conocio: JSON.stringify(comoNosConocio),
      tipos_clase: JSON.stringify(tiposClase),
      tipos_jornada: JSON.stringify(tiposJornada),
      tipos_plantilla: JSON.stringify(tiposPlantilla),
      deportes_lista: JSON.stringify(deportesLista),
      bonos_lista: JSON.stringify(bonos),
    }
    for (const [clave, valor] of Object.entries(datos)) {
      await supabase.from('ajustes').upsert({ clave, valor: String(valor) }, { onConflict: 'clave' })
    }
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:3}}>
          {([['clinica','🏥 Clínica'],['valoracion','📋 Valoración'],['bonos','🎫 Bonos'],['recuperaciones','🔄 Recuperaciones'],['cuenta','🔐 Mi cuenta'],...(perfilActual?.rol==='admin'?[['usuarios','👥 Usuarios']]:[])] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{fontSize:10,padding:'7px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:tab===k?'var(--w)':'transparent',color:tab===k?'var(--n)':'var(--grl)',fontWeight:tab===k?500:300,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
              {l}
            </button>
          ))}
        </div>
        <button className="btn btn-p" onClick={guardar} disabled={guardando}>
          {guardando?'⏳ Guardando...':guardado?'✓ Guardado':'💾 Guardar cambios'}
        </button>
      </div>

      {tab==='clinica'&&<ClinicaTab ajustes={ajustes} set={set}/>}
      {tab==='valoracion'&&<ValoracionTab ajustes={ajustes} set={set} comoNosConocio={comoNosConocio} setComoNosConocio={setComoNosConocio} tiposClase={tiposClase} setTiposClase={setTiposClase} tiposJornada={tiposJornada} setTiposJornada={setTiposJornada} tiposPlantilla={tiposPlantilla} setTiposPlantilla={setTiposPlantilla} deportesLista={deportesLista} setDeportesLista={setDeportesLista} nuevoComoNos={nuevoComoNos} setNuevoComoNos={setNuevoComoNos} nuevoJornada={nuevoJornada} setNuevoJornada={setNuevoJornada} nuevoPlantilla={nuevoPlantilla} setNuevoPlantilla={setNuevoPlantilla} nuevoDeporte={nuevoDeporte} setNuevoDeporte={setNuevoDeporte}/>}
      {tab==='bonos'&&<BonosTab bonos={bonos} setBonos={setBonos}/>}
      {tab==='recuperaciones'&&<RecuperacionesTab ajustes={ajustes} set={set}/>}
      {tab==='usuarios'&&<UsuariosTab perfilActual={perfilActual}/>}
      {tab==='cuenta'&&<CuentaTab perfilActual={perfilActual}/>}
    </div>
  )
}
