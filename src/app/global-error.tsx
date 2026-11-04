'use client'
import { useEffect } from 'react'
import { esFalloDeVersion, recargarPorVersion } from '@/lib/recargaVersion'

// El último recurso: si falla hasta el marco de la app (menú incluido). Ver error.tsx.
export default function ErrorGlobal({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('Error global:', error)
    if (esFalloDeVersion(error)) recargarPorVersion()
  }, [error])
  return (
    <html lang="es"><body style={{ fontFamily: 'system-ui', background: '#F2F1EC' }}>
      <div style={{ padding: 30, maxWidth: 520, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>SIE ha tenido un fallo</div>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 18 }}>Lo guardado sigue guardado. Recarga para seguir.</div>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#5A969E', color: '#fff' }}>Recargar</button>
      </div>
    </body></html>
  )
}
