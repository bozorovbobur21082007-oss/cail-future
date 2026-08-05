import React from 'react';
import logoFull from '@/assets/baht-logo.png';
import logoMark from '@/assets/baht-mark.png';

interface BrandLogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

/** BAHT TEXTILE brend belgisi */
export default function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  return (
    <img
      src={variant === 'full' ? logoFull : logoMark}
      alt="BAHT TEXTILE"
      className={className}
      draggable={false}
    />
  );
}
