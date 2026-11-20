'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// EL ENLACE DE WHATSAPP. Comprueba el token del enlace y deja la sesión abierta en
// este móvil. Ver /api/app/invitar.
function Entrar() {
  const router = useRouter(), q = useSearchParams()
  const [error, setError] = useState(false)
  useEffect(() => {
    const t = q.get('t')
    if (!t) { setError(true); return }
    supabase.auth.verifyOtp({ token_hash: t, type: 'magiclink' }).then(({ error }) => {
      if (error) setError(true); else router.replace('/app')
    })
  }, [q, router])
  return (
    <div className="capp-centro">
      {error ? <>
        <h1>Este enlace ya no sirve</h1>
        <p>Los enlaces caducan al poco tiempo. Pide uno nuevo en el centro y ábrelo en este móvil.</p>
      </> : <h1>Entrando…</h1>}
    </div>
  )
}
export default function Pagina() { return <Suspense><Entrar/></Suspense> }
