'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CuentaTab({ perfilActual }: any) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{tipo:'ok'|'error', texto:string}|null>(null)

  async function cambiarPassword() {
    setMensaje(null)
    if (nueva.length < 8) {
      setMensaje({tipo:'error', texto:'La contraseña debe tener al menos 8 caracteres'})
      return
    }
    if (nueva !== repetir) {
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
      <div className="card-title">🔐 Mi cuenta</div>
      <div style={{fontSize:11,color:'var(--n)',marginBottom:4}}>{perfilActual?.nombre || 'Usuario'}</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:16}}>{perfilActual?.rol==='admin'?'Administrador':'Usuario'}</div>

      <div style={{fontSize:11,fontWeight:600,color:'var(--n)',marginBottom:10}}>Cambiar contraseña</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>Usa una contraseña fuerte y única, de al menos 8 caracteres, que no utilices en otros sitios.</div>

      <div className="field"><label>Nueva contraseña</label>
        <input className="input" type="password" value={nueva} onChange={e=>setNueva(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
      </div>
      <div className="field"><label>Repetir contraseña</label>
        <input className="input" type="password" value={repetir} onChange={e=>setRepetir(e.target.value)} placeholder="••••••••" autoComplete="new-password"/>
      </div>

      {mensaje && (
        <div style={{padding:'8px 12px',borderRadius:6,fontSize:11,marginBottom:12,background:mensaje.tipo==='ok'?'var(--gl)':'var(--redl)',border:`1px solid ${mensaje.tipo==='ok'?'var(--gm)':'#F5C8C8'}`,color:mensaje.tipo==='ok'?'var(--gd)':'var(--red)'}}>
          {mensaje.texto}
        </div>
      )}

      <button className="btn btn-p" onClick={cambiarPassword} disabled={guardando||!nueva||!repetir}>
        {guardando?'⏳ Guardando...':'💾 Cambiar contraseña'}
      </button>
    </div>
  )
}
