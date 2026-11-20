import type { Metadata } from 'next'
import './globals.css'
import Raiz from './Raiz'

export const metadata: Metadata = {
  title: 'SIE · Gestión Clínica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Raiz>{children}</Raiz>
      </body>
    </html>
  )
}
