// lib/festejoVisual.ts
//
// CONFIGURACIÓN VISUAL DEL "SÚPER FESTEJO" — compartida entre
// GamificacionHitoModal (medallas de nivel) y cualquier otro festejo
// que necesite exactamente el mismo look & feel (confetti + estrellas
// + fuegos + sonido, escalado en intensidad Bronce < Plata < Oro).
//
// Se extrajo de GamificacionHitoModal.tsx para poder reutilizarlo tal
// cual en los festejos de Objetivos Escalonados y Trofeos, en vez de
// duplicar toda esta configuración.

export type TipoFestejo = 'BRONCE' | 'PLATA' | 'ORO';

export type ConfigFestejo = {
  emoji: string;
  color: string;
  paletaConfetti: string[];
  piezasConfetti: number;
  cantEstrellas: number;
  cantFuegos: number;
  tamañoEmoji: number;
  cardMaxWidth: number;
  overlayFondo: string;
  cardFondo: string;
  cardBorde: string;
  cardSombra: string;
  tituloAnimado: boolean;
  notasSonido: number[];
};

export const CONFIG_FESTEJO: Record<TipoFestejo, ConfigFestejo> = {
  BRONCE: {
    emoji: '🥉',
    color: '#b45309',
    paletaConfetti: ['#f97316', '#fbbf24', '#fde68a', '#ffffff'],
    piezasConfetti: 16,
    cantEstrellas: 4,
    cantFuegos: 0,
    tamañoEmoji: 84,
    cardMaxWidth: 360,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(180,83,9,0.22), rgba(15,23,42,0.6))',
    cardFondo: '#ffffff',
    cardBorde: 'none',
    cardSombra: '0 24px 60px rgba(0,0,0,0.3)',
    tituloAnimado: false,
    notasSonido: [523.25],
  },
  PLATA: {
    emoji: '🥈',
    color: '#6b7280',
    paletaConfetti: ['#cbd5e1', '#94a3b8', '#e2e8f0', '#60a5fa', '#ffffff'],
    piezasConfetti: 20,
    cantEstrellas: 7,
    cantFuegos: 2,
    tamañoEmoji: 100,
    cardMaxWidth: 390,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(100,116,139,0.28), rgba(15,23,42,0.65))',
    cardFondo: 'linear-gradient(180deg, #f8fafc, #ffffff)',
    cardBorde: '2px solid #cbd5e1',
    cardSombra: '0 28px 70px rgba(100,116,139,0.4)',
    tituloAnimado: false,
    notasSonido: [523.25, 659.25],
  },
  ORO: {
    emoji: '🏆',
    color: '#ca8a04',
    paletaConfetti: ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc', '#ffffff'],
    piezasConfetti: 26,
    cantEstrellas: 10,
    cantFuegos: 5,
    tamañoEmoji: 120,
    cardMaxWidth: 420,
    overlayFondo: 'radial-gradient(circle at 50% 40%, rgba(202,138,4,0.35), rgba(15,23,42,0.72))',
    cardFondo: 'linear-gradient(180deg, #fffdf5, #ffffff)',
    cardBorde: '2px solid #fbbf24',
    cardSombra: '0 30px 80px rgba(202,138,4,0.45)',
    tituloAnimado: true,
    notasSonido: [523.25, 659.25, 783.99],
  },
};

// Posiciones (en % del contenedor) de cada estallido de fuegos
// artificiales — repartidas para que no se pisen entre sí.
export const POSICIONES_FUEGOS_FESTEJO = [
  { left: '15%', top: '20%', delay: 0 },
  { left: '82%', top: '15%', delay: 0.35 },
  { left: '50%', top: '10%', delay: 0.7 },
  { left: '25%', top: '55%', delay: 1.05 },
  { left: '75%', top: '50%', delay: 0.5 },
];

// Sonido cortito sintetizado en el navegador (sin archivos externos):
// una nota para Bronce, dos para Plata, tres para Oro (un mini
// arpegio). Si el navegador bloquea el audio automático (el modal se
// abre solo, no por un clic) simplemente no suena — el festejo visual
// sigue andando igual, nunca rompe nada.
export function reproducirSonidoFestejo(notas: number[]) {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const duracion = 0.16;

    notas.forEach((frecuencia, i) => {
      const oscilador = ctx.createOscillator();
      const ganancia = ctx.createGain();
      const inicio = ctx.currentTime + i * duracion;

      oscilador.type = 'sine';
      oscilador.frequency.value = frecuencia;

      ganancia.gain.setValueAtTime(0, inicio);
      ganancia.gain.linearRampToValueAtTime(0.2, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.001, inicio + duracion);

      oscilador.connect(ganancia);
      ganancia.connect(ctx.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + duracion + 0.02);
    });

    setTimeout(() => ctx.close().catch(() => {}), (notas.length * duracion + 0.3) * 1000);
  } catch {
    // Autoplay bloqueado u otro problema — no pasa nada, sigue sin sonido.
  }
}
