'use client'
import { useCallback, useState } from 'react'
import FichaEjercicio from '@/components/FichaEjercicio'
import { useRouter } from 'next/navigation'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LA BIBLIOTECA, SOLO PARA MIRAR (todos los niveles; editar se hace en el torno).
//
// El entrenador tiene que poder consultar los ejercicios —cómo se hacen, en qué fijarse,
// qué variantes hay— sin poder tocarlos: cambiar uno lo cambia para todas las sesiones
// que lo usan. Es la misma rejilla de siempre; al tocar un ejercicio se abre su ficha
// (FichaEjercicio: la animación 3D y todo lo que hay que saber), sin campos que editar.
// ---------------------------------------------------------------------------

export default function BibliotecaVer({ ejercicios, etiquetas, amasar = false }: { ejercicios: any[], etiquetas: any[],
  /** Nivel 3+: atajos al torno para editar o crear. La edición vive allí, no aquí, para que
      la biblioteca sea solo un sitio de consulta y no haya dos editores distintos. */
  amasar?: boolean }) {
  const router = useRouter()
  const [viendo, setViendo] = useState<any>(null)
  // useCallback: el panel escucha Esc con esta función y no debe re-engancharse en cada render.
  const cerrar = useCallback(() => setViendo(null), [])
  return (
    <div>
      {!amasar && <div style={{ fontSize: 12.5, color: 'var(--gr)', background: 'var(--bl)', borderRadius: 10, padding: '8px 12px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic name="ojo" size={14}/> Para consultar: toca un ejercicio para ver cómo se hace. Cambiarlo es cosa del encargado/a.
      </div>}
      <ExploradorEjercicios ejercicios={ejercicios} etiquetas={etiquetas} botonCrear={false} onAbrir={setViendo} paneles
        acciones={amasar ? <button className="btn btn-p btn-sm" onClick={() => router.push('/torno/amasar/nuevo')}>+ Nuevo ejercicio</button> : undefined}/>

      {viendo && <FichaEjercicio ejercicio={viendo} ejercicios={ejercicios} etiquetas={etiquetas} amasar={amasar}
        onCambiar={setViendo} onCerrar={cerrar}/>}
    </div>
  )
}
