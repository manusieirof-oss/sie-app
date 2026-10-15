'use client'
import { Ic } from '@/lib/icons'
import PiezaCitas, { type FilaPieza } from '@/components/PiezaCitas'

// ---------------------------------------------------------------------------
// LA PIEZA: lo que se ve al darle a "Programar".
//
// Mientras se guarda, el barro gira en el torno: una vasija con franjas de los
// colores de sus sesiones que da vueltas y sube desde una pella aplastada. Cuando
// está guardado, la vasija se hace pequeña arriba y de ella salen sus citas en
// vertical, una a una, con su sesión y su evaluación.
//
// La animación va a la par que el guardado de verdad: si algo falla, el torno se
// para y sale el error. Nunca se ve la pieza terminada sin estar guardada.
// ---------------------------------------------------------------------------

export type { FilaPieza }

// La silueta de la vasija (viewBox 120 x 150).
const VASIJA = 'M40 10 Q60 6 80 10 Q76 22 74 30 Q104 52 102 92 Q100 132 60 140 Q20 132 18 92 Q16 52 46 30 Q44 22 40 10 Z'

export default function PiezaTorno({ estado, error, filas, nombre, onFicha, onVolver, onCerrar }: {
  estado: 'girando' | 'lista' | 'error', error?: string, filas: FilaPieza[], nombre: string,
  onFicha: () => void, onVolver: () => void, onCerrar: () => void,
}) {
  // Las franjas: los colores de sus sesiones, cada uno en fuerte y en claro para que
  // se note el giro. Sin sesiones, color barro.
  const colores = Array.from(new Set(filas.map(f => f.ses?.color || f.evs[0]?.color).filter(Boolean))) as string[]
  const tonos = colores.length ? colores : ['#B98B67']
  // Las justas para cubrir la vasija mientras se desplazan un ciclo entero.
  const periodo = tonos.length * 20
  const franjas = Array.from({ length: Math.ceil((120 + periodo) / 10) + 1 }, (_, i) => ({ x: i * 10, c: tonos[Math.floor(i / 2) % tonos.length], o: i % 2 ? .55 : .95 }))
  const conSes = filas.filter(f => f.ses).length
  const conEv = filas.reduce((n, f) => n + f.evs.length, 0)

  return (
    <div className={`pz pz-${estado}`}>
      <style>{`
        .pz { position:fixed; inset:0; z-index:40; background:#fff; overflow-y:auto; animation: pz-aparece .45s ease .25s backwards }
        @keyframes pz-aparece { from { opacity:0 } to { opacity:1 } }
        .pz-col { max-width:620px; margin:0 auto; padding:0 18px 120px; display:flex; flex-direction:column; align-items:center }
        .pz-torno { width:130px; margin-top:28vh; transition: width .7s ease, margin-top .7s ease; transform-origin:50% 100% }
        .pz-lista .pz-torno { width:54px; margin-top:26px }
        .pz-barro { transform-origin:50% 100%; animation: pz-sube 1.5s cubic-bezier(.3,.7,.3,1) backwards }
        /* Una pella aplastada que se centra, sube y se abre. */
        @keyframes pz-sube {
          0%   { transform: scale(1.55, .22) }
          35%  { transform: scale(1.2, .5) }
          65%  { transform: scale(.88, 1.12) }
          100% { transform: scale(1, 1) }
        }
        .pz-franjas { animation: pz-gira .7s linear infinite }
        .pz-lista .pz-franjas { animation-duration: 5s }
        .pz-error .pz-franjas, .pz-error .pz-barro { animation-play-state: paused }
        @keyframes pz-gira { from { transform: translateX(0) } to { transform: translateX(-${periodo}px) } }
        .pz-plato { animation: pz-plato .7s linear infinite }
        .pz-lista .pz-plato { opacity:0; transition: opacity .5s ease }
        @keyframes pz-plato { from { stroke-dashoffset:0 } to { stroke-dashoffset:-40 } }
        .pz-txt { font-size:12px; color:var(--grl); margin-top:14px; letter-spacing:.3px }

        .pz-cab { text-align:center; margin:10px 0 22px; animation: pz-entra .5s ease .2s backwards }
        @keyframes pz-entra { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform:none } }
        .pz-pie { position:fixed; left:0; right:0; bottom:22px; display:flex; justify-content:center; gap:10px; pointer-events:none;
                  animation: pz-entra .5s ease 1s backwards }
        .pz-pie > * { pointer-events:auto; box-shadow:0 10px 26px rgba(38,40,37,.16) }
        @media (prefers-reduced-motion: reduce) { .pz *, .pz { animation-duration:.01ms !important; animation-delay:0ms !important; transition:none !important } }
      `}</style>

      <div className="pz-col">
        {/* EL TORNO */}
        <div className="pz-torno">
          <svg viewBox="0 0 120 165" style={{ width: '100%', display: 'block', overflow: 'visible' }}>
            <defs>
              <clipPath id="pz-vasija"><path d={VASIJA}/></clipPath>
              {/* Sombra a los lados y luz en el centro: así se ve redonda. */}
              <linearGradient id="pz-luz" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#262825" stopOpacity=".38"/>
                <stop offset=".42" stopColor="#fff" stopOpacity=".28"/>
                <stop offset=".58" stopColor="#fff" stopOpacity=".1"/>
                <stop offset="1" stopColor="#262825" stopOpacity=".42"/>
              </linearGradient>
            </defs>
            {/* El plato que gira. */}
            <ellipse cx="60" cy="146" rx="56" ry="10" fill="var(--bl)"/>
            <ellipse className="pz-plato" cx="60" cy="146" rx="46" ry="7" fill="none" stroke="var(--bd)" strokeWidth="1.5" strokeDasharray="14 6"/>
            <g className="pz-barro">
              <g clipPath="url(#pz-vasija)">
                <g className="pz-franjas">
                  {franjas.map((f, i) => <rect key={i} x={f.x} y="0" width="10.5" height="150" fill={f.c} opacity={f.o}/>)}
                </g>
                <rect x="0" y="0" width="120" height="150" fill="url(#pz-luz)"/>
              </g>
            </g>
          </svg>
        </div>

        {estado === 'girando' && <div className="pz-txt">Torneando…</div>}
        {estado === 'error' && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 13.5, color: 'var(--rojo, #B4553F)' }}>No se ha guardado todo</div>
            <div style={{ fontSize: 12, color: 'var(--gr)', margin: '4px 0 12px' }}>{error}</div>
            <button className="btn btn-t btn-sm" onClick={onCerrar}>Volver al calendario</button>
          </div>
        )}

        {estado === 'lista' && (
          <>
            <div className="pz-cab">
              <div style={{ fontSize: 17 }}>{nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>
                {[conSes > 0 && `${conSes} cita${conSes === 1 ? '' : 's'} con sesión`, conEv > 0 && `${conEv} evaluaci${conEv === 1 ? 'ón' : 'ones'}`].filter(Boolean).join(' · ')}
              </div>
            </div>

            <PiezaCitas filas={filas}/>

            <div className="pz-pie">
              <button className="btn btn-t" style={{ background: '#fff' }} onClick={onVolver}>Volver al torno</button>
              <button className="btn btn-p" onClick={onFicha}><Ic name="ok" size={13}/> Ver su ficha</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
