import React from 'react';

interface VuxioCoreProps {
  isActive: boolean;
  isSpeaking: boolean;
  questionCount?: number;
  size?: number; // diâmetro em px, default 180
}

export const VuxioCore: React.FC<VuxioCoreProps> = ({
  isActive,
  isSpeaking,
  questionCount = 0,
  size = 180,
}) => {
  const MAX_STARS = 50;
  const stars = Array.from({ length: Math.min(questionCount, MAX_STARS) });
  const nucleusSize = Math.round(size * 0.4);
  // Raios das 3 órbitas em percentagem do tamanho total
  const orbitRadii = [0.33, 0.41, 0.49];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Órbitas decorativas */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '7%',
          border: '0.5px dashed rgba(245,158,11,0.1)',
          animation: isActive ? 'VUXIO-rotate-cw 60s linear infinite' : undefined,
          opacity: isActive ? 1 : 0,
          transition: 'opacity 0.5s',
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '17%',
          border: '0.5px solid rgba(245,158,11,0.06)',
          animation: isActive ? 'VUXIO-rotate-ccw 45s linear infinite' : undefined,
          opacity: isActive ? 1 : 0,
          transition: 'opacity 0.5s',
        }}
      />

      {/* Estrelas — uma por pergunta, espalhadas com ângulo dourado */}
      {isActive && stars.map((_, i) => {
        const orbitR = orbitRadii[i % orbitRadii.length] * size;
        const angle = (i * 137.508) % 360; // golden angle
        const rad = (angle - 90) * (Math.PI / 180);
        const cx = size / 2 + orbitR * Math.cos(rad);
        const cy = size / 2 + orbitR * Math.sin(rad);
        const starPx = i % 10 === 0 ? 4 : i % 5 === 0 ? 3 : 2;
        const twinkle = `${(1.5 + (i % 7) * 0.3).toFixed(1)}s`;
        const delay = `${((i * 0.37) % 2).toFixed(1)}s`;

        return (
          <div
            key={`star-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: starPx,
              height: starPx,
              left: cx,
              top: cy,
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              boxShadow: `0 0 ${starPx * 3}px rgba(255,255,255,0.9), 0 0 ${starPx * 6}px rgba(245,158,11,0.5)`,
              animation: `VUXIO-star-tw ${twinkle} ease-in-out infinite ${delay}`,
            }}
          />
        );
      })}

      {/* Guardian — ponto branco que orbita */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ animation: 'VUXIO-rotate-cw 8s linear infinite' }}
        >
          <div
            className="absolute rounded-full"
            style={{
              width: 6,
              height: 6,
              background: '#fff',
              boxShadow: '0 0 12px #f59e0b, 0 0 4px #fff',
              top: '3%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      )}

      {/* Núcleo */}
      <div
        className="relative flex items-center justify-center rounded-full z-10 transition-all duration-300"
        style={{
          width: nucleusSize,
          height: nucleusSize,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(245,158,11,0.2)',
          backdropFilter: 'blur(8px)',
          boxShadow: isActive
            ? `0 0 ${isSpeaking ? 50 : 20}px rgba(245,158,11,${isSpeaking ? 0.4 : 0.12})`
            : 'none',
          animation: isSpeaking ? 'VUXIO-nucleus-pulse 1s ease-in-out infinite' : undefined,
        }}
      >
        {/* Gradiente solar */}
        <div
          className="rounded-full overflow-hidden relative transition-all duration-700"
          style={{
            width: '88%',
            height: '88%',
            background: 'linear-gradient(135deg, #f59e0b, #f97316, #fbbf24)',
            opacity: isActive ? (isSpeaking ? 1 : 0.85) : 0.2,
            animation: isActive ? 'VUXIO-rotate-cw 10s linear infinite' : undefined,
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
            }}
          />
        </div>

        {/* SVG decorativo */}
        <div className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            style={{
              opacity: isActive ? 1 : 0.15,
              animation: isActive ? 'VUXIO-rotate-cw 20s linear infinite' : undefined,
            }}
          >
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(245,158,11,0.2)" strokeWidth="0.5" strokeDasharray="3 5" />
            <path d="M50 5 L50 12 M95 50 L88 50 M50 95 L50 88 M5 50 L12 50"
              stroke="rgba(245,158,11,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
};
