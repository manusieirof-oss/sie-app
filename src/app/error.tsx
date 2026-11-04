'use client'
import { useEffect } from 'react'
import { esFalloDeVersion, recargarPorVersion } from '@/lib/recargaVersion'

// ---------------------------------------------------------------------------
// SI UNA PANTALLA FALLA, SOLO ESA PANTALLA. Sin esto, cualquier error dejaba la app
// en blanco con un mensaje en inglés y parecía que se había cerrado. Ahora se queda el
// menú, se dice en español y se puede reintentar. Si el fallo es por una versión
// nueva publicada, se recarga sola.
// ---------------------------------------------------------------------------

export default function ErrorPantalla({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error('Pantalla con error:', error)
    if (esFalloDeVersion(error)) recargarPorVersion()
  }, [error])
  return (
    <div style={{ padding: 30, maxWidth: 520, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 16, color: 'var(--n)', marginBottom: 8 }}>Algo ha fallado en esta pantalla</div>
      <div style={{ fontSize: 12, color: 'var(--grl)', marginBottom: 18, lineHeight: 1.5 }}>
        Lo que estaba guardado sigue guardado. Prueba a reintentar; si vuelve a pasar, recarga la página.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-s" onClick={() => reset()}>Reintentar</button>
        <button className="btn btn-p" onClick={() => window.location.reload()}>Recargar</button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 18 }}>{String(error?.message || '').slice(0, 160)}</div>
    </div>
  )
}
