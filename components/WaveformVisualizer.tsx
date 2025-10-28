import React, { useRef, useEffect } from 'react';
import { BotStatus } from '../types';

interface WaveformVisualizerProps {
  status: BotStatus;
  onClick: () => void;
  analyser?: AnalyserNode | null;
}

const statusConfig = {
  [BotStatus.IDLE]: { color: 'rgba(0, 255, 255, 0.7)', lines: 3, freq: 0.01, amp: 20, speed: 0.5, glow: 'rgba(0, 255, 255, 0.4)' },
  [BotStatus.CONNECTING]: { color: 'rgba(255, 255, 255, 0.7)', lines: 1, freq: 0.005, amp: 25, speed: 1, glow: 'rgba(255, 255, 255, 0.5)' },
  [BotStatus.LISTENING]: { color: 'rgba(0, 255, 255, 0.9)', lines: 4, freq: 0.02, amp: 30, speed: 1, glow: 'rgba(0, 255, 255, 0.7)' },
  [BotStatus.THINKING]: { color: 'rgba(250, 204, 21, 0.9)', lines: 6, freq: 0.025, amp: 35, speed: 2.5, glow: 'rgba(250, 204, 21, 0.7)' },
  [BotStatus.SPEAKING]: { color: 'rgba(192, 38, 211, 0.9)', lines: 6, freq: 0.04, amp: 40, speed: 2.5, glow: 'rgba(192, 38, 211, 0.7)' },
  [BotStatus.SINGING]: { color: 'rgba(217, 70, 239, 0.9)', lines: 8, freq: 0.05, amp: 45, speed: 2, glow: 'rgba(217, 70, 239, 0.7)' },
  [BotStatus.GENERATING_AUDIO]: { color: 'rgba(168, 85, 247, 0.9)', lines: 5, freq: 0.02, amp: 30, speed: 2, glow: 'rgba(168, 85, 247, 0.7)' },
  [BotStatus.RECOVERING]: { color: 'rgba(251, 146, 60, 0.9)', lines: 5, freq: 0.03, amp: 30, speed: 3, glow: 'rgba(251, 146, 60, 0.6)' },
  [BotStatus.ERROR]: { color: 'rgba(239, 68, 68, 0.8)', lines: 1, freq: 0, amp: 0, speed: 0, glow: 'rgba(239, 68, 68, 0.5)' },
};

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ status, onClick, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let frame = 0;
    let dataArray: Uint8Array | null = null;
    if (analyser) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }

    const draw = () => {
      frame++;
      const config = statusConfig[statusRef.current] || statusConfig[BotStatus.IDLE];
      const { width, height } = canvas.getBoundingClientRect();
      const center = { x: width / 2, y: height / 2 };
      const radius = Math.min(width, height) / 3;

      let dynamicAmp = config.amp;

      if (statusRef.current === BotStatus.LISTENING && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map average volume (0-255 range) to a dynamic amplitude
        dynamicAmp = (avg / 128.0) * 40 + 10;
      }

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < config.lines; i++) {
        ctx.beginPath();
        ctx.strokeStyle = config.color;
        ctx.lineWidth = i === 0 ? 3 : 1.5;

        for (let angle = 0; angle <= 360; angle++) {
          const radian = angle * (Math.PI / 180);
          const time = frame * config.speed * 0.02;
          
          const wave = Math.sin(angle * config.freq * (i + 1) + time);
          const amp = dynamicAmp * (1 - i / config.lines);
          
          const r = radius + wave * amp;
          const x = center.x + r * Math.cos(radian);
          const y = center.y + r * Math.sin(radian);
          
          if (angle === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyser]);

  const glowConfig = statusConfig[status] || statusConfig[BotStatus.IDLE];
  
  return (
    <div
      className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={status === BotStatus.IDLE ? "Start conversation" : "Stop conversation"}
    >
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${status === BotStatus.LISTENING || status === BotStatus.THINKING || status === BotStatus.SINGING || status === BotStatus.GENERATING_AUDIO || status === BotStatus.RECOVERING ? 'animate-pulse-glow' : ''}`}
        style={{
          boxShadow: `0 0 40px 10px ${glowConfig.glow}`,
          filter: `blur(5px)`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};