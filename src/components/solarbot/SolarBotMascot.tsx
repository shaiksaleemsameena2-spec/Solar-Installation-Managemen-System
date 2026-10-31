import { useState, useEffect } from "react";

interface Props {
  onClick: () => void;
  isOpen: boolean;
  hasUnread?: boolean;
}

export function SolarBotMascot({ onClick, isOpen, hasUnread = false }: Props) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Periodic random blinking effect (every 3.5 - 6 seconds)
  useEffect(() => {
    let blinkTimeout: number;
    let resetTimeout: number;

    const triggerBlink = () => {
      setIsBlinking(true);
      resetTimeout = window.setTimeout(() => {
        setIsBlinking(false);
        const nextDelay = 3000 + Math.random() * 3500;
        blinkTimeout = window.setTimeout(triggerBlink, nextDelay);
      }, 180);
    };

    blinkTimeout = window.setTimeout(triggerBlink, 3500);

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(resetTimeout);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="SolarBot — Your Solar Assistant"
      className="group relative flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 transition-transform duration-300"
    >
      {/* Ambient Pulsing Aura */}
      <div
        className={`absolute -inset-2 rounded-full transition-opacity duration-500 blur-md ${
          isOpen
            ? "bg-emerald-500/30 opacity-100"
            : isHovered
            ? "bg-amber-400/35 opacity-100 scale-110"
            : "bg-emerald-500/20 opacity-60 animate-pulse"
        }`}
      />

      {/* 3D-Styled Mascot Body Container with Floating Animation */}
      <div
        className={`relative z-10 w-20 h-24 sm:w-22 sm:h-26 cursor-pointer select-none transition-transform duration-300 ${
          isHovered ? "scale-105 -translate-y-1.5" : "hover:scale-102"
        }`}
        style={{
          animation: "solarbot-float 4.2s ease-in-out infinite",
        }}
      >
        <svg
          viewBox="0 0 160 190"
          className="w-full h-full drop-shadow-xl overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradients for metallic 3D shading */}
            <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F1F5F9" />
              <stop offset="70%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>

            <linearGradient id="robotDarkMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>

            <linearGradient id="emeraldArmor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            <linearGradient id="solarGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            <linearGradient id="visorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#022C22" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#064E3B" stopOpacity="0.95" />
            </linearGradient>

            <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="chestSunGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="60%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
            </radialGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. FLOATING HANDS / THRUSTERS */}
          {/* Left Hand */}
          <g className="transition-transform duration-300" style={{ transformOrigin: "35px 125px" }}>
            <ellipse cx="32" cy="128" rx="9" ry="14" fill="url(#robotBodyGrad)" stroke="#64748B" strokeWidth="1.5" />
            <ellipse cx="32" cy="128" rx="5" ry="8" fill="url(#emeraldArmor)" />
            {/* Small solar ring */}
            <circle cx="32" cy="128" r="3" fill="#FDE68A" />
          </g>

          {/* Right Hand */}
          <g className="transition-transform duration-300" style={{ transformOrigin: "125px 125px" }}>
            <ellipse cx="128" cy="128" rx="9" ry="14" fill="url(#robotBodyGrad)" stroke="#64748B" strokeWidth="1.5" />
            <ellipse cx="128" cy="128" rx="5" ry="8" fill="url(#emeraldArmor)" />
            {/* Small solar ring */}
            <circle cx="128" cy="128" r="3" fill="#FDE68A" />
          </g>

          {/* 2. ROBOT TORSO / CHASSIS */}
          {/* Neck collar */}
          <path d="M62 90 L98 90 L92 98 L68 98 Z" fill="url(#robotDarkMetal)" stroke="#334155" strokeWidth="1" />

          {/* Main Torso */}
          <path
            d="M50 96 C50 96, 80 92, 110 96 C115 118, 112 145, 106 156 C96 166, 64 166, 54 156 C48 145, 45 118, 50 96 Z"
            fill="url(#robotBodyGrad)"
            stroke="#94A3B8"
            strokeWidth="2"
          />

          {/* Emerald & Gold Torso Trim Plates */}
          <path
            d="M56 102 C66 100, 94 100, 104 102 C107 114, 106 130, 102 140 C94 148, 66 148, 58 140 C54 130, 53 114, 56 102 Z"
            fill="url(#robotDarkMetal)"
          />

          {/* Golden Shoulder Guard Accents */}
          <path d="M48 98 Q50 93 58 95 L56 105 Q49 104 48 98 Z" fill="url(#solarGoldGrad)" />
          <path d="M112 98 Q110 93 102 95 L104 105 Q111 104 112 98 Z" fill="url(#solarGoldGrad)" />

          {/* 3. CHEST SOLAR ENERGY REACTOR MEDALLION */}
          <g>
            {/* Outer reactor housing */}
            <circle cx="80" cy="126" r="17" fill="url(#emeraldArmor)" stroke="#064E3B" strokeWidth="1.5" />
            <circle cx="80" cy="126" r="13" fill="#0F172A" />

            {/* Glowing sun energy burst */}
            <circle cx="80" cy="126" r="10" fill="url(#chestSunGlow)" filter="url(#softGlow)" />

            {/* Solar Sun / Energy Symbol */}
            <circle cx="80" cy="126" r="4.5" fill="#FFFBEB" />
            {/* 8 Sun Rays */}
            <line x1="80" y1="117" x2="80" y2="120" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="80" y1="132" x2="80" y2="135" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="71" y1="126" x2="74" y2="126" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="86" y1="126" x2="89" y2="126" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="74" y1="120" x2="76" y2="122" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="84" y1="130" x2="86" y2="132" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="74" y1="132" x2="76" y2="130" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="84" y1="122" x2="86" y2="120" stroke="#FDE68A" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Lower Thruster Vent */}
          <ellipse cx="80" cy="160" rx="14" ry="4" fill="url(#robotDarkMetal)" stroke="#047857" strokeWidth="1.5" />
          <ellipse cx="80" cy="161" rx="8" ry="2" fill="#34D399" filter="url(#softGlow)" />

          {/* 4. ROBOT HEAD */}
          {/* Head Antenna */}
          <rect x="78" y="16" width="4" height="15" fill="url(#robotDarkMetal)" rx="1.5" />
          {/* Solar Crystal Beacon (pulses) */}
          <circle cx="80" cy="14" r="7" fill="url(#solarGoldGrad)" filter="url(#softGlow)" />
          <circle cx="80" cy="14" r="3.5" fill="#FFFBEB" />

          {/* Ears / Side Communication Sensors */}
          {/* Left ear */}
          <path d="M38 48 Q32 48 30 56 Q28 66 34 72 L42 68 Z" fill="url(#emeraldArmor)" stroke="#047857" strokeWidth="1" />
          <circle cx="34" cy="60" r="2.5" fill="#FDE68A" />
          {/* Right ear */}
          <path d="M122 48 Q128 48 130 56 Q132 66 126 72 L118 68 Z" fill="url(#emeraldArmor)" stroke="#047857" strokeWidth="1" />
          <circle cx="126" cy="60" r="2.5" fill="#FDE68A" />

          {/* Head Shell */}
          <path
            d="M42 56 C42 34, 60 26, 80 26 C100 26, 118 34, 118 56 C118 78, 106 88, 80 88 C54 88, 42 78, 42 56 Z"
            fill="url(#robotBodyGrad)"
            stroke="#94A3B8"
            strokeWidth="2.5"
          />

          {/* Golden Brow Inset */}
          <path d="M56 36 Q80 32 104 36" stroke="url(#solarGoldGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Curved Visor Screen */}
          <path
            d="M48 54 C48 44, 58 40, 80 40 C102 40, 112 44, 112 54 C112 68, 100 74, 80 74 C60 74, 48 68, 48 54 Z"
            fill="url(#visorGlass)"
            stroke="#1E293B"
            strokeWidth="2"
          />

          {/* Visor Glass Highlight reflection */}
          <path
            d="M54 44 Q76 42 96 46"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.45"
            fill="none"
          />

          {/* 5. EXPRESSIVE GLOWING EYES */}
          {/* Left Eye */}
          <g>
            {isBlinking ? (
              // Closed eye line during blink
              <line x1="58" y1="58" x2="72" y2="58" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
            ) : isHovered ? (
              // Happy curved eye on hover: ^
              <path d="M58 60 Q65 52 72 60" stroke="#34D399" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#softGlow)" />
            ) : (
              // Normal open eye with glowing pupil
              <>
                <ellipse cx="65" cy="57" rx="6.5" ry="8" fill="url(#eyeGlow)" filter="url(#softGlow)" />
                <ellipse cx="65" cy="57" rx="4.5" ry="6" fill="#A7F3D0" />
                <circle cx="67" cy="54" r="1.8" fill="#FFFFFF" />
              </>
            )}
          </g>

          {/* Right Eye */}
          <g>
            {isBlinking ? (
              // Closed eye line during blink
              <line x1="88" y1="58" x2="102" y2="58" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
            ) : isHovered ? (
              // Happy curved eye on hover: ^
              <path d="M88 60 Q95 52 102 60" stroke="#34D399" strokeWidth="3.5" strokeLinecap="round" fill="none" filter="url(#softGlow)" />
            ) : (
              // Normal open eye with glowing pupil
              <>
                <ellipse cx="95" cy="57" rx="6.5" ry="8" fill="url(#eyeGlow)" filter="url(#softGlow)" />
                <ellipse cx="95" cy="57" rx="4.5" ry="6" fill="#A7F3D0" />
                <circle cx="97" cy="54" r="1.8" fill="#FFFFFF" />
              </>
            )}
          </g>

          {/* Subtle Friendly Smile on Visor */}
          <path
            d="M74 67 Q80 70 86 67"
            stroke="#34D399"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity={isHovered ? "1" : "0.7"}
          />
        </svg>

        {/* Floating Ambient Shadow Beneath Robot */}
        <div
          className="mx-auto mt-1 h-2.5 w-14 rounded-full bg-slate-900/40 blur-xs transition-all duration-300"
          style={{
            animation: "solarbot-shadow 4.2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Unread Message Notification Dot */}
      {hasUnread && !isOpen && (
        <span className="absolute top-1 right-2 z-20 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white" />
        </span>
      )}

      {/* Keyframe Styles for Floating Animation */}
      <style>{`
        @keyframes solarbot-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-8px) rotate(1deg);
          }
        }
        @keyframes solarbot-shadow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.45;
          }
          50% {
            transform: scale(0.82);
            opacity: 0.22;
          }
        }
      `}</style>
    </button>
  );
}

