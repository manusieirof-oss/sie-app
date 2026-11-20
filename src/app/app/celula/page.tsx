'use client'
import Avatar from '../Avatar'
import Navegacion from '../Navegacion'

// SU CÉLULA EN GRANDE: para tocarla, girarla y verla con calma.
export default function Celula() {
  return (
    <>
      <main className="capp-col capp-con-nav">
        <header className="capp-hola"><small><a href="/app" style={{ color: 'inherit' }}>← Inicio</a></small><h1>Tu célula</h1></header>
        <Avatar grande/>
      </main>
      <Navegacion/>
    </>
  )
}
