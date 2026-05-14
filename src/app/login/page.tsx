'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false) }
    else router.push('/agenda')
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">SIE</div>
        <div className="login-sub">Gestión clínica · Acceso profesional</div>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required autoFocus/>
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/>
          </div>
          {error && <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',fontSize:11,color:'var(--red)',marginBottom:12}}>{error}</div>}
          <button className="btn btn-p" type="submit" style={{width:'100%',justifyContent:'center',padding:'10px',fontSize:13}} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
