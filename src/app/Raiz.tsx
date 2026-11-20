'use client'
import { usePathname } from 'next/navigation'
import ClientLayout from './ClientLayout'

// LA APP DE CLIENTES (/app) VA APARTE: sin el menú, la firma de confidencialidad ni nada
// del equipo. Todo lo demás, dentro del marco de SIE de siempre.
export default function Raiz({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  if (pathname === '/app' || pathname.startsWith('/app/')) return <>{children}</>
  return <ClientLayout>{children}</ClientLayout>
}
