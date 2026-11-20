import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Atkinson_Hyperlegible } from 'next/font/google'
import './app.css'

// LA APP DE CLIENTES. Letra de titulares con carácter (Bricolage) y, para leer, una
// pensada para que se lea bien a cualquier edad y con la vista cansada (Atkinson).
const titulo = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--f-titulo' })
const texto = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--f-texto' })

export const metadata: Metadata = { title: 'Mi entreno' }
export const viewport: Viewport = { themeColor: '#1F4A50', width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className={`capp ${titulo.variable} ${texto.variable}`}>{children}</div>
}
