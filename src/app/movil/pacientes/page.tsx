'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { iniciales, nombreDe } from '@/lib/movil'

/**
 * PACIENTES en el móvil: un buscador y la lista. Nada de filtros: en el móvil se
 * busca a alguien concreto; las listas filtradas se miran en el ordenador.
 * Por defecto, los activos; con un toque, todos.
 */
export default function MovilPacientes() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [buscar, setBuscar] = useState('')
  const [todos, setTodos] = useState(false)

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,apellidos,nombre_clinica,telefono,estado').order('nombre')
      .then(({ data }) => setPacientes(data || []))
  }, [])

  const lista = useMemo(() => pacientes
    .filter(p => todos || p.estado === 'activo')
    .filter(p => !buscar || contiene(nombreDe(p), buscar) || contiene(p.nombre_clinica, buscar) || (p.telefono || '').includes(buscar)),
  [pacientes, buscar, todos])

  return (
    <div className="m-pag">
      <div className="m-cab"><div><h1>Pacientes</h1><small>{lista.length} {todos ? 'en total' : 'activos'}</small></div>
        <button className={`m-pildora ${todos ? 'on' : ''}`} onClick={() => setTodos(v => !v)}>{todos ? 'Solo activos' : 'Ver todos'}</button>
      </div>
      <div className="m-buscar">
        <Ic name="buscar" size={16}/>
        <input placeholder="Nombre, apodo o teléfono" value={buscar} onChange={e => setBuscar(e.target.value)}/>
        {buscar && <button onClick={() => setBuscar('')}><Ic name="cerrar" size={14}/></button>}
      </div>
      <div className="m-lista">
        {lista.slice(0, 200).map(p => (
          <Link key={p.id} href={`/movil/pacientes/${p.id}`} className="m-lista-it">
            <span className="m-av">{iniciales(p)}</span>
            <span className="m-lista-m"><b>{nombreDe(p)}</b><small>{p.nombre_clinica ? `"${p.nombre_clinica}" · ` : ''}{p.telefono || ''}</small></span>
            <Ic name="der" size={15} style={{ color: 'var(--bm)' }}/>
          </Link>
        ))}
        {lista.length === 0 && <div className="m-vacio">Nadie con ese nombre.</div>}
      </div>
    </div>
  )
}
