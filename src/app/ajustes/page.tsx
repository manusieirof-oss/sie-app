'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AjustesPage() {
  const [ajustes, setAjustes] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ajustes').select('clave,valor')
    if (data) {
      const map: Record<string,string> = {}
      data.forEach(a => { map[a.clave] = a.valor||'' })
      setAjustes(map)
    }
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true)
    for (const [clave, valor] of Object.entries(ajustes)) {
      await supabase.from('ajustes').upsert({ clave, valor }, { onConflict: 'clave' })
    }
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  function set(clave: string, valor: string) {
    setAjustes(p => ({ ...p, [clave]: valor }))
  }

  if (loading) return <div className="loading">Cargando ajustes...</div>

  return (
    <div style={{maxWidth:800,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:300,color:'var(--n)'}}>⚙️ Ajustes</div>
          <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>Configuración de la clínica</div>
        </div>
        <button className="btn btn-p" onClick={guardar} disabled={guardando}>
          {guardando?'⏳ Guardando...':guardado?'✓ Guardado':'💾 Guardar cambios'}
        </button>
      </div>

      {/* CLÍNICA */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🏥 Datos de la clínica</div>
        <div className="g2">
          <div className="field" style={{gridColumn:'1/-1'}}>
            <label>Nombre de la clínica</label>
            <input className="input" value={ajustes.clinica_nombre||''} onChange={e=>set('clinica_nombre',e.target.value)} placeholder="SIE Clínica"/>
          </div>
          <div className="field">
            <label>Hora de apertura</label>
            <input className="input" type="time" value={ajustes.clinica_horario_inicio||'08:30'} onChange={e=>set('clinica_horario_inicio',e.target.value)}/>
          </div>
          <div className="field">
            <label>Hora de cierre</label>
            <input className="input" type="time" value={ajustes.clinica_horario_fin||'21:30'} onChange={e=>set('clinica_horario_fin',e.target.value)}/>
          </div>
          <div className="field">
            <label>Duración de la clase (minutos)</label>
            <input className="input" type="number" value={ajustes.clinica_duracion_clase||'50'} onChange={e=>set('clinica_duracion_clase',e.target.value)}/>
          </div>
          <div className="field">
            <label>Tiempo de cambio entre grupos (minutos)</label>
            <input className="input" type="number" value={ajustes.clinica_tiempo_cambio||'10'} onChange={e=>set('clinica_tiempo_cambio',e.target.value)}/>
          </div>
          <div className="field">
            <label>Máximo personas por sala</label>
            <input className="input" type="number" value={ajustes.clinica_max_personas_sala||'6'} onChange={e=>set('clinica_max_personas_sala',e.target.value)}/>
          </div>
        </div>
      </div>

      {/* RECUPERACIONES */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title">🔄 Política de recuperaciones</div>
        <div style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--bl)',borderRadius:'var(--rl)',border:'1px solid var(--bd)'}}>
            <div>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Permitir recuperaciones</div>
              <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Los pacientes pueden recuperar clases perdidas</div>
            </div>
            <button onClick={()=>set('recuperaciones_activas',ajustes.recuperaciones_activas==='true'?'false':'true')}
              style={{width:40,height:22,borderRadius:99,background:ajustes.recuperaciones_activas==='true'?'var(--g)':'var(--bm)',border:'none',cursor:'pointer',transition:'background .2s',position:'relative'}}>
              <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'left .2s',left:ajustes.recuperaciones_activas==='true'?'21px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
            </button>
          </div>
        </div>
        {ajustes.recuperaciones_activas==='true' && (
          <div className="g2">
            <div className="field">
              <label>Plazo máximo para recuperar (días)</label>
              <input className="input" type="number" value={ajustes.recuperaciones_plazo_dias||'30'} onChange={e=>set('recuperaciones_plazo_dias',e.target.value)}/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>Si el paciente se da de baja, pierde las recuperaciones pendientes</div>
            </div>
            <div className="field">
              <label>Máximo recuperaciones por mes</label>
              <input className="input" type="number" value={ajustes.recuperaciones_max_mes||'0'} onChange={e=>set('recuperaciones_max_mes',e.target.value)}/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = sin límite</div>
            </div>
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Aviso mínimo para que la falta sea recuperable (horas)</label>
              <input className="input" type="number" value={ajustes.recuperaciones_aviso_horas||'0'} onChange={e=>set('recuperaciones_aviso_horas',e.target.value)}/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = siempre recuperable independientemente del aviso</div>
            </div>
          </div>
        )}
      </div>

      {/* BONOS */}
      <div className="card">
        <div className="card-title">💳 Tipos de bono</div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10,fontWeight:300}}>Los bonos actuales del sistema. Próximamente podrás añadir y editar desde aquí.</div>
        {[
          ['Esencial','2 días/semana'],
          ['Progreso','3 días/semana'],
          ['Avanzado','4 días/semana'],
          ['Avanzado+1','5 días/semana'],
        ].map(([nombre,dias])=>(
          <div key={nombre} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--bl)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{nombre}</div>
              <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{dias}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
