import React from 'react';

interface VelaLogoProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'stacked' | 'horizontal' | 'mark-only';
  showBackground?: boolean;
}

export const VelaLogo: React.FC<VelaLogoProps> = ({
  className = 'h-24 w-auto',
  style,
  variant = 'stacked',
  showBackground = false,
}) => {
  // Common Sail and Wave Gradients
  const Gradients = () => (
    <defs>
      {/* Left Sail Gradient: rich dark crimson */}
      <linearGradient id="velaLeftSailGrad" x1="0%" y1="0%" x2="100%" y2="80%">
        <stop offset="0%" stopColor="#7a0a10" />
        <stop offset="35%" stopColor="#941018" />
        <stop offset="75%" stopColor="#b81620" />
        <stop offset="100%" stopColor="#c91a24" />
      </linearGradient>

      {/* Right Sail Gradient: vibrant crimson with bright highlight */}
      <linearGradient id="velaRightSailGrad" x1="25%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#eb252e" />
        <stop offset="40%" stopColor="#d91e26" />
        <stop offset="75%" stopColor="#b8141c" />
        <stop offset="100%" stopColor="#880a10" />
      </linearGradient>

      {/* Bottom Wave Swoosh Gradient */}
      <linearGradient id="velaSwooshGrad" x1="0%" y1="40%" x2="100%" y2="60%">
        <stop offset="0%" stopColor="#991019" />
        <stop offset="30%" stopColor="#b8151e" />
        <stop offset="60%" stopColor="#cf1a23" />
        <stop offset="85%" stopColor="#dd2028" />
        <stop offset="100%" stopColor="#bd161f" />
      </linearGradient>
    </defs>
  );

  // The 3 Sail Elements
  const SailMark = () => (
    <g id="vela-sails" className="drop-shadow-[0_4px_20px_rgba(235,37,46,0.3)]">
      {/* Left Sail (Jib) */}
      <path
        d="M 480 282 C 472 370 420 500 356 598 C 390 595 430 591 462 586 C 476 495 484 390 480 282 Z"
        fill="url(#velaLeftSailGrad)"
      />

      {/* Right Sail (Mainsail) */}
      <path
        d="M 534 224 C 530 310 508 440 486 580 C 525 572 575 562 626 550 C 638 480 638 350 534 224 Z"
        fill="url(#velaRightSailGrad)"
      />

      {/* Bottom Wave Swoosh */}
      <path
        d="M 260 620 C 315 648 368 658 412 658 C 490 658 620 626 758 597 C 675 607 560 624 475 628 C 410 630 335 620 260 620 Z"
        fill="url(#velaSwooshGrad)"
      />
    </g>
  );

  if (variant === 'mark-only') {
    return (
      <svg
        viewBox="240 200 540 480"
        className={className}
        style={style}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Gradients />
        {showBackground && <rect x="240" y="200" width="540" height="480" fill="#000000" rx="32" />}
        <SailMark />
      </svg>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3.5 ${className}`} style={style}>
        <svg
          viewBox="240 200 540 480"
          className="h-full w-auto max-h-12 aspect-[540/480] shrink-0"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <Gradients />
          <SailMark />
        </svg>
        <div className="flex items-baseline tracking-[0.24em] font-sans font-medium text-xs sm:text-sm uppercase select-none">
          <span className="text-white">AGÊNCIA</span>
          <span className="text-[#D01E27] ml-1.5 font-semibold">VELA</span>
        </div>
      </div>
    );
  }

  // Default: 'stacked' — Identical to the attached image
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Gradients />
      {showBackground && <rect width="1000" height="1000" fill="#000000" rx="40" />}
      <SailMark />
      {/* Typography AGÊNCIA VELA */}
      <g id="vela-text">
        <text
          x="500"
          y="805"
          textAnchor="middle"
          fontFamily="'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize="48"
          fontWeight="400"
          letterSpacing="0.28em"
        >
          <tspan fill="#FFFFFF">AGÊNCIA </tspan>
          <tspan fill="#D01E27" fontWeight="500">VELA</tspan>
        </text>
      </g>
    </svg>
  );
};
