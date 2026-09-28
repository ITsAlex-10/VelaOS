import React from 'react';
import velaLogoImg from '../assets/images/Vela_logo.png';

interface VelaLogoProps {
  className?: string;
  style?: React.CSSProperties;
  variant?: 'stacked' | 'horizontal' | 'mark-only';
  showBackground?: boolean;
}

export const VelaLogo: React.FC<VelaLogoProps> = ({
  className = 'h-32 w-auto',
  style,
  variant = 'stacked',
  showBackground = false,
}) => {
  return (
    <img 
      src={velaLogoImg} 
      alt="Vela Logo" 
      className={className} 
      style={{ 
        objectFit: 'contain', 
        maxHeight: variant === 'horizontal' ? '120px' : '240px',
        width: 'auto',
        ...style 
      }} 
    />
  );
};
