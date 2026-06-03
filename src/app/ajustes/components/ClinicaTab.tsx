'use client'

export default function ClinicaTab({ ajustes, set }: any) {
  return (
    <div className="card">
      <div className="card-title">🏥 Datos de la clínica</div>
      <div className="g2">
        <div className="field" style={{gridColumn:'1/-1'}}>
          <label>Nombre de la clínica</label>
          <input className="input" value={ajustes.clinica_nombre||''} onChange={e=>set('clinica_nombre',e.target.value)} placeholder="SIE Clínica"/>
        </div>
        <div className="field"><label>Hora de apertura</label><input className="input" type="time" value={ajustes.clinica_horario_inicio||'08:30'} onChange={e=>set('clinica_horario_inicio',e.target.value)}/></div>
        <div className="field"><label>Hora de cierre</label><input className="input" type="time" value={ajustes.clinica_horario_fin||'21:30'} onChange={e=>set('clinica_horario_fin',e.target.value)}/></div>
        <div className="field"><label>Duración de la clase (minutos)</label><input className="input" type="number" value={ajustes.clinica_duracion_clase||'50'} onChange={e=>set('clinica_duracion_clase',e.target.value)}/></div>
        <div className="field"><label>Tiempo de cambio entre grupos (minutos)</label><input className="input" type="number" value={ajustes.clinica_tiempo_cambio||'10'} onChange={e=>set('clinica_tiempo_cambio',e.target.value)}/></div>
        <div className="field"><label>Máximo personas por sala</label><input className="input" type="number" value={ajustes.clinica_max_personas_sala||'6'} onChange={e=>set('clinica_max_personas_sala',e.target.value)}/></div>
        <div className="field"><label>Pausa mediodía — inicio</label><input className="input" type="time" value={ajustes.clinica_pausa_inicio||'12:30'} onChange={e=>set('clinica_pausa_inicio',e.target.value)}/></div>
        <div className="field"><label>Pausa mediodía — fin</label><input className="input" type="time" value={ajustes.clinica_pausa_fin||'15:30'} onChange={e=>set('clinica_pausa_fin',e.target.value)}/></div>
      </div>
    </div>
  )
}
