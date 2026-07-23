'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

export default function CuentaTab({ perfilActual }: any) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [verNueva, setVerNueva] = useState(false)
  const [verRepetir, setVerRepetir] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{tipo:'ok'|'error', texto:string}|null>(null)

  // Requisitos de seguridad
  const requisitos = [
    { label: 'Al menos 12 caracteres', cumple: nueva.length >= 12 },
    { label: 'Una letra mayúscula', cumple: /[A-Z]/.test(nueva) },
    { label: 'Una letra minúscula', cumple: /[a-z]/.test(nueva) },
    { label: 'Un número', cumple: /[0-9]/.test(nueva) },
    { label: 'Un símbolo (!@#$...)', cumple: /[^A-Za-z0-9]/.test(nueva) },
  ]
  const todosCumplidos = requisitos.every(r => r.cumple)
  const coinciden = nueva.length > 0 && nueva === repetir

  async function cambiarPassword() {
    setMensaje(null)
    if (!todosCumplidos) {
      setMensaje({tipo:'error', texto:'La contraseña no cumple todos los requisitos'})
      return
    }
    if (!coinciden) {
      setMensaje({tipo:'error', texto:'Las contraseñas no coinciden'})
      return
    }
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: nueva })
    setGuardando(false)
    if (error) {
      setMensaje({tipo:'error', texto:'Error al cambiar la contraseña: '+error.message})
    } else {
      setMensaje({tipo:'ok', texto:'✓ Contraseña actualizada correctamente'})
      setNueva('')
      setRepetir('')
    }
  }

  return (
    <div className="card" style={{maxWidth:480}}>
      <div className="card-title"><span className="ct-l"><Ic name="candado"/> Mi cuenta</span></div>
      <div style={{fontSize:11,color:'var(--n)',marginBottom:4}}>{perfilActual?.nombre || 'Usuario'}</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:16}}>{perfilActual?.rol==='admin'?'Administrador':'Usuario'}</div>

      <div style={{fontSize:11,fontWeight:600,color:'var(--n)',marginBottom:10}}>Cambiar contraseña</div>

      <div className="field"><label>Nueva contraseña</label>
        <div style={{position:'relative'}}>
          <input className="input" type={verNueva?'text':'password'} value={nueva} onChange={e=>setNueva(e.target.value)} placeholder="••••••••" autoComplete="new-password" style={{paddingRight:38}}/>
          <button type="button" onClick={()=>setVerNueva(v=>!v)} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:0,display:'inline-flex',color:'var(--grl)'}}><Ic name="ojo" size={15}/></button>
        </div>
      </div>

      {/* INDICADOR DE REQUISITOS */}
      {nueva.length > 0 && (
        <div style={{background:'var(--bl)',borderRadius:6,padding:'10px 12px',marginBottom:12}}>
          {requisitos.map((r,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:10,marginBottom:i<requisitos.length-1?5:0,color:r.cumple?'var(--gd)':'var(--grl)'}}>
              <span style={{fontSize:11}}>{r.cumple?'✓':'○'}</span>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="field"><label>Repetir contraseña</label>
        <div style={{position:'relative'}}>
          <input className="input" type={verRepetir?'text':'password'} value={repetir} onChange={e=>setRepetir(e.target.value)} placeholder="••••••••" autoComplete="new-password" style={{paddingRight:38}}/>
          <button type="button" onClick={()=>setVerRepetir(v=>!v)} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:0,display:'inline-flex',color:'var(--grl)'}}><Ic name="ojo" size={15}/></button>
        </div>
      </div>

      {repetir.length > 0 && !coinciden && (
        <div style={{fontSize:10,color:'var(--red)',marginBottom:12,marginTop:-6}}>Las contraseñas no coinciden</div>
      )}

      {mensaje && (
        <div style={{padding:'8px 12px',borderRadius:6,fontSize:11,marginBottom:12,background:mensaje.tipo==='ok'?'var(--gl)':'var(--redl)',border:`1px solid ${mensaje.tipo==='ok'?'var(--gm)':'#F5C8C8'}`,color:mensaje.tipo==='ok'?'var(--gd)':'var(--red)'}}>
          {mensaje.texto}
        </div>
      )}

      <button className="btn btn-p" onClick={cambiarPassword} disabled={guardando||!todosCumplidos||!coinciden}>
        {guardando?'Guardando…':<><Ic name="guardar" size={13}/> Cambiar contraseña</>}
      </button>
    </div>
  )
}
