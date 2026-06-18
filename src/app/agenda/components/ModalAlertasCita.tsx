'use client'
import { useState } from 'react'

const TIPOS_ALERTA = [
  ['dolor','🤕 Dolor / molestia',true],
  ['lesion','🩹 Lesión',true],
  ['cita_medica','🏥 Cita médica',false],
  ['personal','💬 Situación personal',false],
  ['duda','❓ Duda / consulta',false],
  ['otro','📌 Otro',false],
] as const

export default function ModalAlertasCita({ verAlertasCita, alertasPaciente, crearAlerta, cerrarAlerta, onCerrar }: any) {
  const [tipo, setTipo] = useState('dolor')
  const [afectaSesion, setAfectaSesion] = useState(true)
  const [descripcion, setDescripcion] = useState('')
  const [creando, setCreando] = useState(false)

  if (!verAlertasCita) return null
  const pacienteId = verAlertasCita.paciente_id
  const alertas = (alertasPaciente||[]).filter((a:any)=>a.paciente_id===pacienteId)
  const nombrePac = verAlertasCita.pacientes ? `${verAlertasCita.pacientes.nombre} ${verAlertasCita.pacientes.apellidos||''}` : 'Paciente'

  async function guardar() {
    if (!descripcion.trim()) return
    setCreando(true)
    await crearAlerta(pacienteId, tipo, afectaSesion, descripcion)
    setDescripcion(''); setTipo('dolor'); setAfectaSesion(true); setCreando(false)
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:420,maxHeight:'85vh',overflowY:'auto'}}>
        <div className="modal-title">
          Alertas · {nombrePac}
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        {/* ALERTAS ACTIVAS */}
        {alertas.length>0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Alertas activas</div>
            {alertas.map((a:any)=>{
              const t = TIPOS_ALERTA.find(x=>x[0]===a.tipo)
              return (
                <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 10px',borderRadius:6,border:`1px solid ${a.afecta_sesion?'#F5C8C8':'var(--bd)'}`,background:a.afecta_sesion?'var(--redl)':'var(--bl)',marginBottom:5}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:500,color:'var(--n)'}}>{t?t[1]:a.tipo}{a.afecta_sesion&&<span style={{fontSize:8,color:'var(--red)',marginLeft:5}}>afecta sesión</span>}</div>
                    <div style={{fontSize:10,color:'var(--gr)',marginTop:2}}>{a.descripcion}</div>
                    <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>desde {a.fecha_inicio}</div>
                  </div>
                  <button onClick={()=>cerrarAlerta(a.id)} style={{fontSize:9,color:'var(--g)',background:'none',border:'1px solid var(--g)',borderRadius:5,padding:'3px 8px',cursor:'pointer',flexShrink:0}}>Cerrar</button>
                </div>
              )
            })}
          </div>
        )}

        {/* NUEVA ALERTA */}
        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Nueva alerta</div>
        <div className="field"><label>Tipo</label>
          <select className="input" value={tipo} onChange={e=>{const v=e.target.value;setTipo(v);const t=TIPOS_ALERTA.find(x=>x[0]===v);if(t)setAfectaSesion(t[2])}}>
            {TIPOS_ALERTA.map(t=><option key={t[0]} value={t[0]}>{t[1]}</option>)}
          </select>
        </div>
        <div onClick={()=>setAfectaSesion(!afectaSesion)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${afectaSesion?'var(--red)':'var(--bd)'}`,background:afectaSesion?'var(--redl)':'var(--w)',cursor:'pointer',marginBottom:10}}>
          <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${afectaSesion?'var(--red)':'var(--bd)'}`,background:afectaSesion?'var(--red)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{afectaSesion&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div>
          <span style={{fontSize:10,color:'var(--n)'}}>Afecta a la sesión (adaptar entreno)</span>
        </div>
        <div className="field"><label>Descripción</label>
          <textarea className="input" style={{minHeight:60}} value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="ej. Molestia cervical, viene con carga / Tiene cita médica el martes"/>
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cerrar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={guardar} disabled={creando||!descripcion.trim()}>{creando?'Guardando...':'⚠️ Activar alerta'}</button>
        </div>
      </div>
    </div>
  )
}
