'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// La prueba de rango pasó a ser la pantalla de tests con cámara (/camara).
export default function PruebaCamara() {
  const r = useRouter()
  useEffect(() => { r.replace('/camara') }, [r])
  return null
}
