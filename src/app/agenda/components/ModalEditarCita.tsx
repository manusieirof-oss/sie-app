'use client'

export default function ModalEditarCita({ editandoCita, setEditandoCita, guardando, guardarEdicionCita, onCerrar, horas, tiposCita=[] }: any) {
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  if (!editandoCita) return null
  const nombrePac = editandoCita.pacientes ? `${editandoCita.pacientes.nombre} ${editandoCita.pacientes.apellidos||''}` : 'Paciente'

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)onCerrar()}}>
      <div className="modal" style={{width:440}}>
        <div className="modal-title">
          Editar cita
          <button className="modal-close" onClick={()=>{if(!guardando)onCerrar()}}>✕</button>
        </div>
        <div style={{fontSize:11,color:'var(--n)',fontWeight:500,marginBottom:12,padding:'7px 10px',background:'var(--gl)',borderRadius:6}}>{nombrePac}</div>

        <div className="field"><label>Día de la cita</label>
          <input type="date" className="input" value={editandoCita.fecha||''} onChange={e=>setEditandoCita((p:any)=>({...p,fecha:e.target.value}))} disabled={guardando}/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div className="field"><label>Hora</label>
            <select className="input" value={editandoCita.hora?.slice(0,5)||''} onChange={e=>setEditandoCita((p:any)=>({...p,hora:e.target.value+':00'}))} disabled={guardando}>
              <option value="">Elegir hora...</option>
              {HORAS.map((h:string)=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="field"><label>Sala</label>
            <select className="input" value={editandoCita.sala||''} onChange={e=>setEditandoCita((p:any)=>({...p,sala:e.target.value}))} disabled={guardando}>
              <option value="A">Sala A</option>
              <option value="B">Sala B</option>
            </select>
          </div>
        </div>

        <div className="field"><label>Tipo</label>
          <select className="input" value={editandoCita.tipo||''} onChange={e=>setEditandoCita((p:any)=>({...p,tipo:e.target.value}))} disabled={guardando}>
            {tiposCita.map((t:any)=><option key={t.id} value={t.id}>{t.nombre} ({t.duracion} min)</option>)}
          </select>
        </div>

        <div className="field"><label>Notas</label>
          <input className="input" value={editandoCita.notas||''} onChange={e=>setEditandoCita((p:any)=>({...p,notas:e.target.value}))} placeholder="Notas sobre esta cita..." disabled={guardando}/>
        </div>

        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={guardarEdicionCita} disabled={guardando}>{guardando?'Guardando...':'💾 Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}
