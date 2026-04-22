import React from 'react';

interface VimoAvatarProps {
  size?: number;
  isSpeaking?: boolean;
  isConnected?: boolean;
}

export const VimoAvatar: React.FC<VimoAvatarProps> = ({
  size = 56,
  isSpeaking = false,
  isConnected = false,
}) => {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, #7c3aed, #a855f7, #ec4899, #6366f1, #7c3aed)',
          padding: 2,
          borderRadius: '50%',
          animation: isConnected ? 'vimo-spin 4s linear infinite' : 'none',
          opacity: isConnected ? 1 : 0.3,
        }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{ background: '#13132b' }}
        />
      </div>

      {/* Pulse rings when speaking */}
      {isSpeaking && (
        <>
          <div className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(168,85,247,0.15)', animationDuration: '1s' }} />
          <div className="absolute inset-[-6px] rounded-full animate-ping"
            style={{ background: 'rgba(168,85,247,0.08)', animationDuration: '1.4s', animationDelay: '0.2s' }} />
        </>
      )}

      {/* Inner sphere */}
      <div
        className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          width: size - 8,
          height: size - 8,
          background: 'radial-gradient(circle at 35% 35%, #a855f7, #6366f1 50%, #1e1b4b)',
          boxShadow: isConnected
            ? `0 0 ${isSpeaking ? 24 : 12}px rgba(168,85,247,${isSpeaking ? 0.6 : 0.35}), inset 0 0 12px rgba(255,255,255,0.08)`
            : '0 0 6px rgba(168,85,247,0.15)',
        }}
      >
        {/* Particle dots overlay */}
        <svg viewBox="0 0 40 40" className="w-full h-full absolute inset-0"
          style={{ opacity: isConnected ? 0.6 : 0.2 }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const angle = (i / 18) * 2 * Math.PI;
            const r = 10 + (i % 3) * 4;
            const x = 20 + r * Math.cos(angle);
            const y = 20 + r * Math.sin(angle);
            return (
              <circle key={i} cx={x} cy={y} r={0.8 + (i % 2) * 0.6}
                fill={i % 2 === 0 ? '#e879f9' : '#818cf8'}
                opacity={0.6 + (i % 3) * 0.15}
              />
            );
          })}
          <circle cx="20" cy="20" r="3" fill="white" opacity="0.7" />
        </svg>
      </div>

      <style>{`
        @keyframes vimo-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
