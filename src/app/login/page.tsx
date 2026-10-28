'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { esCompartido, recientes, olvidar, apuntarActividad, MINUTOS_INACTIVO, type Reciente } from '@/lib/compartido'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // EQUIPO COMPARTIDO: quienes ya lo han usado, para entrar tocando su nombre.
  const [gente, setGente] = useState<Reciente[]>([])
  const [elegido, setElegido] = useState<Reciente | null>(null)
  const [aviso, setAviso] = useState('')
  const [compartido, setCompartido] = useState(false)
  const pass = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (esCompartido()) { setCompartido(true); setGente(recientes()) }
    if (new URLSearchParams(window.location.search).get('motivo') === 'inactivo')
      setAviso(`Sesión cerrada tras ${MINUTOS_INACTIVO} minutos sin usar el equipo.`)
  }, [])

  const elegir = (r: Reciente | null) => {
    setElegido(r); setEmail(r?.email || ''); setPassword(''); setError('')
    if (r) setTimeout(() => pass.current?.focus(), 0)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    // La marca de actividad a cero: si no, en un equipo compartido la vieja (de anoche)
    // cerraría la sesión nada más entrar.
    apuntarActividad()
    router.push('/hoy')
  }

  const iniciales = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()

  return (
    <div className="login-wrap">
      <div className="login-box">
        <img src="/marca/sie-logo.svg" alt="SIE" className="login-logo-img"/>
        <div className="login-sub">Gestión clínica · Acceso profesional</div>
        {aviso && <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'var(--gd)',marginBottom:12}}>{aviso}</div>}

        {gente.length > 0 && !elegido && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'var(--grl)',marginBottom:8}}>¿Quién eres?</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))',gap:8}}>
              {gente.map(r => (
                <div key={r.email} style={{position:'relative'}}>
                  <button type="button" onClick={() => elegir(r)}
                    style={{width:'100%',padding:'10px 6px',borderRadius:12,border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                    <span style={{width:40,height:40,borderRadius:'50%',background:'var(--g)',color:'#fff',display:'grid',placeItems:'center',fontWeight:600,fontSize:14}}>{iniciales(r.nombre)}</span>
                    <span style={{fontSize:11.5,color:'var(--n)',fontWeight:500,textAlign:'center',lineHeight:1.2}}>{r.nombre.split(' ')[0]}</span>
                  </button>
                  <button type="button" title="Quitar de este equipo" onClick={() => { olvidar(r.email); setGente(recientes()) }}
                    style={{position:'absolute',top:3,right:5,border:'none',background:'none',color:'var(--grl)',cursor:'pointer',fontSize:12,padding:2}}>×</button>
                </div>
              ))}
            </div>
            <div style={{textAlign:'center',marginTop:10}}>
              <button type="button" onClick={() => setGente([])} style={{border:'none',background:'none',color:'var(--gd)',fontSize:11,cursor:'pointer'}}>Entrar con otro correo</button>
            </div>
          </div>
        )}

        {(gente.length === 0 || elegido) && (
          <form onSubmit={handleLogin}>
            {elegido ? (
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <span style={{width:36,height:36,borderRadius:'50%',background:'var(--g)',color:'#fff',display:'grid',placeItems:'center',fontWeight:600,fontSize:13}}>{iniciales(elegido.nombre)}</span>
                <div style={{flex:1,fontSize:13,fontWeight:500,color:'var(--n)'}}>{elegido.nombre}</div>
                <button type="button" onClick={() => elegir(null)} style={{border:'none',background:'none',color:'var(--gd)',fontSize:11,cursor:'pointer'}}>No soy yo</button>
              </div>
            ) : (
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required autoFocus/>
              </div>
            )}
            <div className="field">
              <label>Contraseña</label>
              {/* En un equipo compartido el navegador no debe ofrecer guardarla. */}
              <input ref={pass} className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required
                autoComplete={compartido ? 'off' : 'current-password'}/>
            </div>
            {error && <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'var(--red)',marginBottom:12}}>{error}</div>}
            <button className="btn btn-p" type="submit" style={{width:'100%',justifyContent:'center',padding:'10px',fontSize:13}} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
