'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'

export default function ModalEditarCitas({ citas, pacienteNombre, horas=[], salas=['A','B'], tiposClase=[], guardando, onGuardar, onEstado, onEliminar, onCerrar }: any) {
  const [rows, setRows] = useState<any[]>(
    (citas||[]).slice().sort((a:any,b:any)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).map((c:any)=>({
      id:c.id, paciente_id:c.paciente_id, fecha:c.fecha, hora:(c.hora||'').slice(0,5), sala:c.sala, tipo:c.tipo, estado:c.estado,
    }))
  )
  const [busy, setBusy] = useState(false)
  // Lo que ya se ha aplicado en la base de datos mientras el modal está abierto.
  // Cancelar y eliminar guardan al momento (no esperan al botón Guardar), así que
  // hay que decirlo: si no, se pulsa Guardar esperando que "confirme" y no pasa nada.
  const [hechas, setHechas] = useState({ canceladas: 0, eliminadas: 0 })
  const [flash, setFlash] = useState('')
  const avisar = (t:string) => { setFlash(t); setTimeout(()=>setFlash(''), 2600) }
  const GT = '1.2fr 0.8fr 0.7fr 1fr 82px'
  const cancelarCita = async (r:any) => { if(!onEstado) return; setBusy(true); await onEstado(orig(r.id),'cancelada'); setRows(p=>p.map(x=>x.id===r.id?{...x,estado:'cancelada'}:x)); setHechas(h=>({...h,canceladas:h.canceladas+1})); avisar('Cita cancelada · se ha generado su recuperación'); setBusy(false) }
  const deshacerCita = async (r:any) => { if(!onEstado) return; setBusy(true); await onEstado(orig(r.id),'programada'); setRows(p=>p.map(x=>x.id===r.id?{...x,estado:'programada'}:x)); setHechas(h=>({...h,canceladas:Math.max(0,h.canceladas-1)})); avisar('Cancelación deshecha'); setBusy(false) }
  const eliminarUna = async (r:any) => { if(!onEliminar) return; if(!confirm('¿Eliminar esta cita definitivamente? Se usa para errores: no guarda falta ni recuperación.')) return; setBusy(true); await onEliminar(orig(r.id)); setRows(p=>p.filter(x=>x.id!==r.id)); setHechas(h=>({...h,eliminadas:h.eliminadas+1})); avisar('Cita eliminada'); setBusy(false) }
  const HORAS = horas && horas.length>0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const set = (id:string, k:string, v:string) => setRows(p=>p.map(r=>r.id===id?{...r,[k]:v}:r))

  const orig = (id:string) => (citas||[]).find((c:any)=>c.id===id)
  const cambiada = (r:any) => { const o=orig(r.id); return o && (o.fecha!==r.fecha || (o.hora||'').slice(0,5)!==r.hora || o.sala!==r.sala || o.tipo!==r.tipo) }
  const nCambios = rows.filter(cambiada).length

  const diaSemana = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short'})

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)onCerrar()}}>
      <div className="modal" style={{width:620,maxWidth:'94vw'}}>
        <div className="modal-title">
          <span>Editar sesiones · {pacienteNombre}</span>
          <button className="modal-close" onClick={()=>{if(!guardando)onCerrar()}}>✕</button>
        </div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>Edita día, hora, sala o tipo de varias citas a la vez (la sesión se mantiene). También puedes <b style={{fontWeight:600,color:'#8A6410'}}>Cancelar</b> (avisó, genera recuperación) o <b style={{fontWeight:600,color:'var(--red)'}}>eliminar</b> (borra, solo errores) cada cita.</div>

        <div style={{display:'grid',gridTemplateColumns:GT,gap:6,fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',padding:'0 4px 6px'}}>
          <div>Día</div><div>Hora</div><div>Sala</div><div>Tipo</div><div/>
        </div>
        <div style={{maxHeight:'52vh',overflowY:'auto'}}>
          {rows.length===0 && <div style={{fontSize:11,color:'var(--grl)',padding:'10px 4px'}}>Este paciente no tiene citas este mes.</div>}
          {rows.map(r=>{
            const cancel = r.estado==='cancelada'
            const dis = guardando || busy || cancel
            return (
              <div key={r.id} style={{display:'grid',gridTemplateColumns:GT,gap:6,alignItems:'center',padding:'5px 4px',borderRadius:7,marginBottom:3,background:cancel?'var(--redl)':(cambiada(r)?'var(--gl)':'transparent')}}>
                {cancel ? (
                  <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                    <span style={{fontSize:11,color:'var(--red)',textDecoration:'line-through',whiteSpace:'nowrap'}}>{new Date(r.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                    <span style={{fontSize:8,fontWeight:600,color:'var(--red)',background:'var(--w)',border:'1px solid var(--red)',borderRadius:99,padding:'1px 7px',flexShrink:0}}>CANCELADA</span>
                  </div>
                ) : (
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <input type="date" className="input" value={r.fecha} onChange={e=>set(r.id,'fecha',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px'}}/>
                    <span style={{fontSize:9,color:'var(--grl)',width:24,flexShrink:0,textTransform:'capitalize'}}>{diaSemana(r.fecha)}</span>
                  </div>
                )}
                <select className="input" value={r.hora} onChange={e=>set(r.id,'hora',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px',opacity:cancel?0.6:1}}>
                  {!HORAS.includes(r.hora)&&<option value={r.hora}>{r.hora}</option>}
                  {HORAS.map((h:string)=><option key={h} value={h}>{h}</option>)}
                </select>
                <select className="input" value={r.sala} onChange={e=>set(r.id,'sala',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px',opacity:cancel?0.6:1}}>
                  {!salas.includes(r.sala)&&<option value={r.sala}>{r.sala}</option>}
                  {salas.map((s:string)=><option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0,opacity:cancel?0.6:1}}>
                  <span style={{display:'inline-flex',color:colorTipo(r.tipo),flexShrink:0}}><Ic name={iconTipoClase(r.tipo,(tiposClase.find((t:any)=>t.valor===r.tipo)||{}).icono)} size={14}/></span>
                  <select className="input" value={r.tipo} onChange={e=>set(r.id,'tipo',e.target.value)} disabled={dis} style={{fontSize:11,padding:'5px 7px'}}>
                    {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-end'}}>
                  {cancel ? (
                    <button onClick={()=>deshacerCita(r)} disabled={busy} style={{fontSize:9,color:'var(--g)',background:'none',border:'none',cursor:'pointer',fontWeight:500,padding:0}} title="Deshacer la cancelación">Deshacer</button>
                  ) : (
                    <>
                      <button onClick={()=>cancelarCita(r)} disabled={busy} style={{fontSize:10,color:'#8A6410',background:'none',border:'none',cursor:'pointer',padding:0}} title="Cancelar (avisó; genera recuperación)">Cancelar</button>
                      <button onClick={()=>eliminarUna(r)} disabled={busy} style={{display:'inline-flex',color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:0}} title="Eliminar (borra la cita; solo para errores)"><Ic name="papelera" size={14}/></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {flash && (
          <div style={{marginTop:10,fontSize:10,color:'var(--gd)',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'6px 10px',display:'flex',alignItems:'center',gap:6}}>
            <Ic name="ok" size={12}/> {flash}
          </div>
        )}
        {(hechas.canceladas>0||hechas.eliminadas>0) && (
          <div style={{marginTop:8,fontSize:10,color:'var(--gr)',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,color:'var(--n)'}}>Ya aplicado:</span>
            {hechas.canceladas>0&&<span style={{color:'#8A6410'}}>{hechas.canceladas} cancelada{hechas.canceladas>1?'s':''}</span>}
            {hechas.eliminadas>0&&<span style={{color:'var(--red)'}}>{hechas.eliminadas} eliminada{hechas.eliminadas>1?'s':''}</span>}
            <span style={{color:'var(--grl)'}}>· ya guardado, no hace falta pulsar Guardar</span>
          </div>
        )}

        <div style={{display:'flex',gap:8,marginTop:14,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--grl)'}}>{nCambios>0?`${nCambios} cita${nCambios>1?'s':''} con cambios sin guardar`:'Sin cambios pendientes'}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>{nCambios>0?'Descartar':'Cancelar'}</button>
          {nCambios>0 ? (
            <button className="btn btn-p" onClick={()=>onGuardar(rows.filter(cambiada))} disabled={guardando}>
              {guardando?'Guardando…':`✓ Guardar (${nCambios})`}
            </button>
          ) : (
            <button className="btn btn-p" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>✓ Hecho</button>
          )}
        </div>
      </div>
    </div>
  )
}
