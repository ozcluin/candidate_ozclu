'use client';

import { useState, useEffect } from 'react';
import styles from './OzcluLogo.module.css';

interface OzcluLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** 
   * Theme variant — controls the text/stroke color of the C-eye and letters.
   * 'dark' = dark strokes (for light backgrounds)
   * 'light' = light strokes (for dark backgrounds)
   */
  theme?: 'dark' | 'light';
}

const sizeMap = {
  xs: { height: 22 },
  sm: { height: 28 },
  md: { height: 38 },
  lg: { height: 54 },
};

export default function OzcluLogo({ size = 'md', className = '', theme = 'dark' }: OzcluLogoProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const triggerAnimation = () => {
      setIsAnimating(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
    };

    window.addEventListener('scroll', triggerAnimation, { passive: true });
    window.addEventListener('touchstart', triggerAnimation, { passive: true });

    return () => {
      window.removeEventListener('scroll', triggerAnimation);
      window.removeEventListener('touchstart', triggerAnimation);
      clearTimeout(timeoutId);
    };
  }, []);

  const s = sizeMap[size];
  const textFill = theme === 'light' ? '#edf3e7' : '#181d16';
  const strokeColor = theme === 'light' ? '#edf3e7' : '#181d16';

  return (
    <span
      className={`${styles.logo} ${styles[size]} ${isAnimating ? styles.animating : ''} ${className}`}
      aria-label="OzClu"
    >
      <svg
        viewBox="0 0 200 40"
        height={s.height}
        className={styles.logoSvg}
        aria-hidden="true"
        role="img"
      >
        <defs>
          <radialGradient id="ozclu-glass-lens-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="90%" stopColor="#C6982E" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#C6982E" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* OZ — Magnifying Glass where Z is the handle (golden) */}
        <g className={styles.goldenO}>
          {/* Glass lens fill */}
          <circle cx="18" cy="14" r="10" fill="url(#ozclu-glass-lens-grad)" />
          {/* Glass frame (O) */}
          <circle cx="18" cy="14" r="10" fill="none" stroke="#C6982E" strokeWidth="3.2" />
          {/* Lens glint */}
          <path
            d="M 9.7 12.5 A 8.4 8.4 0 0 1 16.5 5.7"
            fill="none"
            stroke="#FFF4CC"
            strokeWidth="1.6"
            strokeLinecap="round"
            className={styles.glassGlint}
          />
          {/* Secondary soft reflection */}
          <path
            d="M 23.5 19.5 A 8.4 8.4 0 0 1 19.5 21.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.35"
          />
          {/* Z-shaped handle */}
          <path
            d="M26 21 L38 21 L26 33 L38 33"
            fill="none"
            stroke="#C6982E"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* C — Eye shape */}
        <g className={styles.eyeC} transform="translate(48, 5)">
          {/* Upper lid */}
          <path
            className={styles.upperLid}
            d="M0 15 Q8 1.5, 18 3.5"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Lower lid */}
          <path
            className={styles.lowerLid}
            d="M0 15 Q8 28.5, 18 26.5"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Iris */}
          <circle cx="14" cy="15" r="7.5" fill="#016e1c" />
          {/* Pupil */}
          <circle cx="14" cy="15" r="3.4" fill="#181d16" />
          {/* Iris glint */}
          <circle cx="11" cy="12.2" r="1.8" fill="white" opacity="0.85" />
        </g>

        {/* l */}
        <text
          x="82"
          y="30"
          className={styles.letterL}
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="28"
          fontWeight="700"
          fill={textFill}
        >
          l
        </text>

        {/* u */}
        <text
          x="92"
          y="30"
          className={styles.letterU}
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="28"
          fontWeight="700"
          fill={textFill}
        >
          u
        </text>

        {/* Hidden e — reveals on hover */}
        <text
          x="112"
          y="30"
          className={styles.hiddenE}
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="28"
          fontWeight="700"
          fill={textFill}
        >
          e
        </text>
      </svg>
    </span>
  );
}
