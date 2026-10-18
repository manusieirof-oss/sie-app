'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

/**
 * YO · quién eres, ir a la versión completa y cerrar sesión.
 *
 * "Versión completa" deja una marca en este móvil para que no vuelva a redirigir a
 * la versión móvil al abrir la agenda (ver ClientLayout). Desde la completa se vuelve
 * con el enlace "Versión móvil" de tu menú.
 */
export default function MovilYo() {
  const [perfil, setPerfil] = useState<any>(null)
  const [email, setEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setEmail(user?.email || '')
      if (user) {
        const { data } = await supabase.from('perfiles').select('nombre,rol').eq('user_id', user.id).maybeSingle()
        setPerfil(data)
      }
    })
  }, [])

  const completa = () => {
    try { localStorage.setItem('sie_version', 'completa') } catch {}
    router.push('/agenda')
  }
  const salir = async () => { await supabase.auth.signOut(); router.push('/login') }

  return (
    <div className="m-pag">
      <div className="m-fcab" style={{ marginTop: 18 }}>
        <span className="m-av xl">{((perfil?.nombre || email || '?').trim()[0] || '?').toUpperCase()}</span>
        <b>{perfil?.nombre || 'Tu cuenta'}</b>
        <small>{email}</small>
      </div>
      <button className="m-opcion" onClick={completa}><Ic name="clinica" size={18}/> Versión completa (ordenador)<Ic name="der" size={15} style={{ marginLeft: 'auto', color: 'var(--grl)' }}/></button>
      <button className="m-opcion rojo" onClick={salir}><Ic name="salir" size={18}/> Cerrar sesión</button>
      <img src="/marca/sie-logo.svg" alt="SIE" style={{ display: 'block', width: 90, margin: '40px auto 0', opacity: .7 }}/>
    </div>
  )
}
