'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function UsuariosTab({ perfilActual }: any) {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState<string|null>(null)

  const esAdmin = perfilActual?.rol === 'admin'

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*').order('created_at')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function cambiarRol(id: string, nuevoRol: string) {
    setGuardando(id)
    const permisos = nuevoRol === 'admin' ? { finanzas: true } : { finanzas: false }
    await supabase.from('perfiles').update({ rol: nuevoRol, permisos }).eq('id', id)
    await cargar()
    setGuardando(null)
  }

  async function togglePermiso(id: string, permisos: any) {
    setGuardando(id)
    const nuevos = { ...permisos, finanzas: !permisos?.finanzas }
    await supabase.from('perfiles').update({ permisos: nuevos }).eq('id', id)
    await cargar()
    setGuardando(null)
  }

  if (!esAdmin) {
    return (
      <div className="card">
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:12}}>
          🔒 Solo los administradores pueden gestionar usuarios
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title">👥 Usuarios del sistema</div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Gestiona los roles y permisos de acceso de cada usuario</div>

      {loading ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Cargando usuarios...</div>
      ) : usuarios.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Sin usuarios registrados</div>
      ) : (
        usuarios.map(u => (
          <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:8,border:'1px solid var(--bd)',marginBottom:8,background:'var(--bl)'}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:u.rol==='admin'?'var(--g)':'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:u.rol==='admin'?'#fff':'var(--gr)',flexShrink:0,fontWeight:500}}>
              {(u.nombre||'?').charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:500,color:'var(--n)'}}>{u.nombre||'Sin nombre'}</div>
              <div style={{fontSize:9,color:'var(--grl)'}}>{u.rol==='admin'?'Administrador':'Usuario'}</div>
            </div>

            {/* SELECTOR DE ROL */}
            <select className="input" value={u.rol} onChange={e=>cambiarRol(u.id, e.target.value)} disabled={guardando===u.id} style={{width:130,fontSize:11}}>
              <option value="usuario">Usuario</option>
              <option value="admin">Administrador</option>
            </select>

            {/* TOGGLE FINANZAS */}
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:10,color:'var(--grl)'}}>💰 Finanzas</span>
              <button onClick={()=>togglePermiso(u.id, u.permisos)} disabled={guardando===u.id||u.rol==='admin'}
                style={{width:38,height:21,borderRadius:99,background:u.permisos?.finanzas?'var(--g)':'var(--bm)',border:'none',cursor:u.rol==='admin'?'not-allowed':'pointer',transition:'background .2s',position:'relative',opacity:u.rol==='admin'?0.5:1}}>
                <div style={{width:15,height:15,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'left .2s',left:u.permisos?.finanzas?'20px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
              </button>
            </div>
          </div>
        ))
      )}

      <div style={{marginTop:14,padding:'10px 12px',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,fontSize:9,color:'var(--gd)'}}>
        ℹ️ Para añadir un nuevo usuario, créalo primero en Supabase → Authentication → Users, y luego aparecerá aquí para asignarle rol y permisos. Los administradores tienen acceso completo a finanzas automáticamente.
      </div>
    </div>
  )
}
