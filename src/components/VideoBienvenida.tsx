'use client'

// ---------------------------------------------------------------------------
// VÍDEO DE BIENVENIDA de cada nivel: lo primero que ve quien empieza (antes de la guía
// interactiva). Sale solo UNA vez por persona y equipo; luego, desde el menú de su
// inicial («Ver el vídeo»). Los vídeos están en public/videos.
// ---------------------------------------------------------------------------

export const VIDEOS: Partial<Record<1 | 2, string>> = { 1: '/videos/nivel1.mp4', 2: '/videos/nivel2.mp4' }

const CLAVE = (uid: string, n: number) => `sie_video${n}_visto_${uid}`
export const videoVisto = (uid: string, n: number) => { try { return localStorage.getItem(CLAVE(uid, n)) === '1' } catch { return true } }
const marcar = (uid: string, n: number) => { try { localStorage.setItem(CLAVE(uid, n), '1') } catch {} }

export default function VideoBienvenida({ uid, nivel, onFin, conGuia = false }: { uid: string, nivel: 1 | 2, onFin: () => void, conGuia?: boolean }) {
  const src = VIDEOS[nivel]
  const fin = () => { marcar(uid, nivel); onFin() }
  if (!src) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(20,21,19,.92)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>Bienvenido a SIE</div>
      <video src={src} controls autoPlay playsInline onEnded={fin}
        style={{ width: 'min(1100px, 100%)', maxHeight: '75vh', borderRadius: 14, background: '#000', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}/>
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Saltarlo cuenta como visto: quien ya lo ha visto con alguien no tiene que repetirlo. */}
        {conGuia ? <>
          <button className="btn btn-s" onClick={fin}>Saltar</button>
          <button className="btn btn-p" onClick={fin}>Seguir a la guía →</button>
        </> : <button className="btn btn-p" onClick={fin}>Cerrar</button>}
      </div>
    </div>
  )
}
