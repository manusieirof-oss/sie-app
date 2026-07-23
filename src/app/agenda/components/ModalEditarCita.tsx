'use client'
import { Ic } from '@/lib/icons'

export default function ModalEditarCita({ editandoCita, setEditandoCita, guardando, guardarEdicionCita, onCerrar, horas, tiposCita=[], tiposClase=[], cambiarEstadoCita, eliminarCita }: any) {
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
            {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre} ({t.duracion} min)</option>)}
          </select>
        </div>

        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={guardarEdicionCita} disabled={guardando}>{guardando?'Guardando…':<><Ic name="guardar" size={13}/> Guardar cambios</>}</button>
        </div>

        <div style={{borderTop:'1px solid var(--bd)',marginTop:14,paddingTop:12}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>Estado de la cita</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>cambiarEstadoCita&&cambiarEstadoCita(editandoCita,'falta')} disabled={guardando}
              style={{flex:1,minWidth:90,padding:'8px 6px',borderRadius:6,border:`1.5px solid ${editandoCita.estado==='falta'?'var(--red)':'var(--bd)'}`,background:editandoCita.estado==='falta'?'var(--redl)':'var(--w)',cursor:'pointer',fontFamily:'system-ui',fontSize:10,color:editandoCita.estado==='falta'?'var(--red)':'var(--gr)',fontWeight:editandoCita.estado==='falta'?500:400,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <span>Falta</span><span style={{fontSize:7,opacity:.8}}>no recupera</span>
            </button>
            <button onClick={()=>cambiarEstadoCita&&cambiarEstadoCita(editandoCita,'cancelada')} disabled={guardando}
              style={{flex:1,minWidth:90,padding:'8px 6px',borderRadius:6,border:`1.5px solid ${editandoCita.estado==='cancelada'?'var(--amb)':'var(--bd)'}`,background:editandoCita.estado==='cancelada'?'var(--ambl)':'var(--w)',cursor:'pointer',fontFamily:'system-ui',fontSize:10,color:editandoCita.estado==='cancelada'?'#7A5800':'var(--gr)',fontWeight:editandoCita.estado==='cancelada'?500:400,display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
              <span>Cancelada</span><span style={{fontSize:7,opacity:.8}}>recupera</span>
            </button>
          </div>
          {(editandoCita.estado==='falta'||editandoCita.estado==='cancelada')&&(
            <button onClick={()=>cambiarEstadoCita&&cambiarEstadoCita(editandoCita,'programada')} disabled={guardando}
              style={{width:'100%',marginTop:8,padding:'7px',borderRadius:6,border:'1px solid var(--g)',background:'var(--gl)',cursor:'pointer',fontFamily:'system-ui',fontSize:10,color:'var(--gd)',fontWeight:500}}>
              ↩ Deshacer · volver a normal
            </button>
          )}
          <button onClick={()=>eliminarCita&&eliminarCita(editandoCita)} disabled={guardando}
            style={{width:'100%',marginTop:8,padding:'7px',borderRadius:6,border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontFamily:'system-ui',fontSize:10,color:'var(--red)'}}>
<Ic name="papelera" size={12}/> Eliminar cita
          </button>
        </div>
      </div>
    </div>
  )
}
