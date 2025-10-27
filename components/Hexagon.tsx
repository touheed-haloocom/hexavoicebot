
import React from 'react';
import { BotStatus } from '../types';
import { MicrophoneIcon, StopIcon, LoadingIcon, ThinkingIcon } from './Icons';

interface HexagonProps {
  status: BotStatus;
  onClick: () => void;
}

export const Hexagon: React.FC<HexagonProps> = ({ status, onClick }) => {
  const getIcon = () => {
    switch (status) {
      case BotStatus.IDLE:
      case BotStatus.ERROR:
        return <MicrophoneIcon className="w-16 h-16" />;
      case BotStatus.CONNECTING:
        return <LoadingIcon className="w-16 h-16 animate-spin" />;
      case BotStatus.LISTENING:
        return <MicrophoneIcon className="w-16 h-16" />;
      case BotStatus.THINKING:
        return <ThinkingIcon className="w-16 h-16 animate-pulse" />;
      case BotStatus.SPEAKING:
        return <StopIcon className="w-16 h-16" />;
      default:
        return null;
    }
  };

  const getAnimationClass = () => {
    switch (status) {
      case BotStatus.LISTENING:
        return 'animate-pulse';
      case BotStatus.SPEAKING:
        return 'animate-bounce';
      default:
        return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className="group absolute w-full h-full flex items-center justify-center focus:outline-none"
      aria-label={status === BotStatus.IDLE ? "Start conversation" : "Stop conversation"}
    >
      <svg
        viewBox="0 0 200 220"
        className="absolute w-full h-full"
        style={{ filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5))' }}
      >
        <defs>
          <clipPath id="hexagon-clip">
            <path d="M100 0 L200 55 L200 165 L100 220 L0 165 L0 55 Z" />
          </clipPath>
          <linearGradient id="hexagon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#22d3ee', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#c026d3', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Background glow */}
        <path
          d="M100 0 L200 55 L200 165 L100 220 L0 165 L0 55 Z"
          fill="url(#hexagon-gradient)"
          className={`transition-transform duration-500 ease-in-out transform scale-105 group-hover:scale-110 opacity-30`}
        />

        {/* Main shape */}
        <g clipPath="url(#hexagon-clip)">
          <rect x="-50" y="-50" width="300" height="300" fill="rgb(17,24,39)" />
        </g>

        {/* Border */}
        <path
          d="M100 0 L200 55 L200 165 L100 220 L0 165 L0 55 Z"
          fill="none"
          stroke="url(#hexagon-gradient)"
          strokeWidth="4"
          className={`transition-transform duration-300 ease-in-out transform group-hover:scale-105 ${getAnimationClass()}`}
        />
      </svg>
      <div className="z-10 text-cyan-400 group-hover:text-white transition-colors duration-300">
        {getIcon()}
      </div>
    </button>
  );
};
