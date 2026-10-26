'use client'
import { useEffect, useState } from 'react'
import { fotoEnCache, pedirFoto } from '@/lib/fotos'

/**
 * LA CARA DEL PACIENTE en cualquier circulito: su foto si tiene, sus iniciales si no.
 * Va DENTRO del circulo de cada pantalla (ag-av, m-av...), que pone tamaño y color; la
 * foto lo rellena. Necesita `foto_url` en lo que se carga del paciente.
 */
export default function CaraPaciente({ p }: { p: any }) {
  const ruta: string | null = p?.foto_url || null
  const [u, setU] = useState<string | null>(() => fotoEnCache(ruta))
  useEffect(() => {
    let vivo = true
    setU(fotoEnCache(ruta))
    if (ruta) pedirFoto(ruta).then(x => { if (vivo) setU(x) })
    return () => { vivo = false }
  }, [ruta])
  const ini = (((p?.nombre || '').trim()[0] || '') + ((p?.apellidos || '').trim()[0] || '')).toUpperCase() || '·'
  return u
    ? <img src={u} alt="" onError={() => setU(null)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}/>
    : <>{ini}</>
}
