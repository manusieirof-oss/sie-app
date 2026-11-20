'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Carta from './Carta'
import { Cromo, Sello, nivelDe } from './cromos'

// ABRIR EL SOBRE DE LA SEMANA. Tres momentos: el sobre cerrado (se toca y se rasga),
// las cartas saliendo una a una con lo que ha pasado («¡Nuevo!», «¡Sube a Plata!»,
// «¡Ahora brilla!»), y el resumen para pegarlas en el álbum. Ver app_abrir_sobre().

interface Carta_ { cromo: Cromo, veces_antes: number, vistas_antes: number, brillaba: boolean }

/** Lo que le ha pasado a este cromo con el sobre. */
function queHaPasado(c: Carta_) {
  const antes = c.veces_antes > 0 ? nivelDe(c.vistas_antes) : null, ahora = nivelDe(c.cromo.vistas)
  if (!antes) return { titulo: '¡Nuevo cromo!', fuerte: true }
  if (ahora && ahora.clase !== antes.clase) return { titulo: `¡Sube a ${ahora.nombre}!`, fuerte: true }
  if (c.cromo.brilla && !c.brillaba) return { titulo: '¡Ahora brilla!', fuerte: true }
  const mas = c.cromo.vistas - c.vistas_antes
  return { titulo: mas > 0 ? `+${mas} ${mas === 1 ? 'vez' : 'veces'}` : 'Repetido', fuerte: false }
}

export default function SobreAnimado({ onFin, sello }: { onFin: () => void, sello?: Sello }) {
  const [fase, setFase] = useState<'cerrado' | 'rasgando' | 'cartas' | 'resumen'>('cerrado')
  const [cartas, setCartas] = useState<Carta_[]>([])
  const [vistos, setVistos] = useState(0)   // ejercicios nuevos que aún no ha hecho bien
  const [i, setI] = useState(0)
  const [error, setError] = useState('')

  async function abrir() {
    if (fase !== 'cerrado') return
    setFase('rasgando')
    const [{ data, error }] = await Promise.all([
      supabase.rpc('app_abrir_sobre'),
      new Promise(r => setTimeout(r, 900)),   // lo que dura el rasgado
    ])
    if (error) { setError('No se ha podido abrir. Inténtalo otra vez.'); setFase('cerrado'); return }
    const lista = ((data?.cartas || []) as Carta_[])
      // Primero lo nuevo y lo que sube de color; lo que solo suma veces, al final.
      .sort((a, b) => Number(queHaPasado(b).fuerte) - Number(queHaPasado(a).fuerte))
    setCartas(lista); setI(0); setVistos(Number(data?.vistos) || 0)
    setFase(lista.length ? 'cartas' : 'resumen')
  }

  const siguiente = () => { if (i + 1 < cartas.length) setI(i + 1); else setFase('resumen') }
  const nuevos = cartas.filter(c => c.veces_antes === 0).length
  const suben = cartas.filter(c => { const a = c.veces_antes > 0 ? nivelDe(c.vistas_antes) : null, b = nivelDe(c.cromo.vistas); return a && b && a.clase !== b.clase }).length
  const brillan = cartas.filter(c => c.cromo.brilla && !c.brillaba).length

  return (
    <div className="capp-sobre-velo" role="dialog" aria-label="Tu sobre de la semana">
      {(fase === 'cerrado' || fase === 'rasgando') && (
        <div className="capp-sobre-escena">
          <p className="capp-sobre-txt">{fase === 'cerrado' ? 'Tu sobre de esta semana' : '¡Allá va!'}</p>
          <button type="button" className={`capp-sobre${fase === 'rasgando' ? ' rasga' : ''}`} onClick={abrir} aria-label="Abrir el sobre">
            <span className="tapa" aria-hidden/>
            <span className="cuerpo" aria-hidden><b>SIE</b><small>Cromos</small></span>
          </button>
          {fase === 'cerrado' && <p className="capp-sobre-pista">Toca para abrirlo</p>}
          {error && <p className="capp-sobre-pista">{error}</p>}
        </div>
      )}

      {fase === 'cartas' && cartas[i] && (() => {
        const c = cartas[i], q = queHaPasado(c)
        return (
          <div className="capp-sobre-escena" key={i}>
            <p className={`capp-sobre-txt${q.fuerte ? ' fuerte' : ''}`}>{q.titulo}</p>
            <div className="capp-sobre-carta" onClick={siguiente}><Carta c={c.cromo} grande sello={sello} onAbrir={siguiente}/></div>
            <div className="capp-sobre-botones">
              <button type="button" className="capp-boton" onClick={siguiente}>{i + 1 < cartas.length ? `Siguiente (${i + 1} de ${cartas.length})` : 'Ver el resumen'}</button>
              {cartas.length > 3 && i + 1 < cartas.length && <button type="button" className="capp-sobre-saltar" onClick={() => setFase('resumen')}>Verlos todos</button>}
            </div>
          </div>
        )
      })()}

      {fase === 'resumen' && (
        <div className="capp-sobre-resumen">
          <h2>{cartas.length ? '¡Enhorabuena!' : 'Sobre vacío'}</h2>
          <p>{cartas.length
            ? [nuevos && `${nuevos} ${nuevos === 1 ? 'cromo nuevo' : 'cromos nuevos'}`, suben && `${suben} ${suben === 1 ? 'sube' : 'suben'} de color`, brillan && `${brillan} ${brillan === 1 ? 'brilla porque has mejorado' : 'brillan porque has mejorado'}`]
                .filter(Boolean).join(', ') || 'Has sumado veces a tus cromos.'
            : 'Esta semana no te ha tocado ningún cromo. ¡A por la próxima!'}</p>
          {vistos > 0 && <p>{vistos === 1 ? 'Además, hay 1 ejercicio nuevo en tu álbum que aún sale oscuro' : `Además, hay ${vistos} ejercicios nuevos en tu álbum que aún salen oscuros`}: hazlos bien en clase para conseguirlos.</p>}
          {cartas.length > 0 && <div className="capp-rejilla">{cartas.map((c, k) => <Carta key={k} c={c.cromo} sello={sello}/>)}</div>}
          <button type="button" className="capp-boton" onClick={onFin}>Pegarlos en mi álbum</button>
        </div>
      )}
    </div>
  )
}
