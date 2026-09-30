'use client';

import React, { useEffect, useRef } from 'react';

interface CyberVisualizerProps {
  analyser?: AnalyserNode | null;
  isPlaying?: boolean;
  className?: string;
  mode?: 'bars' | 'wave' | 'circular';
}

export const CyberVisualizer: React.FC<CyberVisualizerProps> = ({
  analyser,
  isPlaying = false,
  className = 'w-full h-32',
  mode = 'bars',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let phase = 0;

    const render = () => {
      animationId = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      // Clear with slight alpha for trailing motion blur
      ctx.fillStyle = 'rgba(11, 13, 19, 0.25)';
      ctx.fillRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Simulated idle ambient pulse
        phase += 0.04;
        for (let i = 0; i < bufferLength; i++) {
          const sim = Math.sin(phase + i * 0.15) * 0.5 + 0.5;
          dataArray[i] = isPlaying ? Math.floor(sim * 160 + 40) : Math.floor(sim * 35 + 10);
        }
      }

      if (mode === 'bars') {
        const barCount = 48;
        const barWidth = width / barCount;
        const step = Math.floor(bufferLength / barCount);

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * height * 0.85);
          const x = i * barWidth;
          const y = height - barHeight;

          // Gradient from Neon Cyan (#00F0FF) to Magenta (#FF007A) to Purple (#7000FF)
          const grad = ctx.createLinearGradient(0, height, 0, y);
          grad.addColorStop(0, '#00F0FF');
          grad.addColorStop(0.5, '#7000FF');
          grad.addColorStop(1, '#FF007A');

          ctx.fillStyle = grad;
          ctx.shadowColor = '#00F0FF';
          ctx.shadowBlur = isPlaying ? 12 : 2;

          // Rounded bar caps
          ctx.beginPath();
          ctx.roundRect(x + 2, y, barWidth - 4, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Highlight dot on top of bar
          if (isPlaying && percent > 0.4) {
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = '#FF007A';
            ctx.shadowBlur = 10;
            ctx.fillRect(x + 2, y - 4, barWidth - 4, 2);
          }
        }
      } else {
        // Waveform / Oscilloscope line
        ctx.beginPath();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00F0FF';
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 15;

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, mode]);

  // Set internal canvas resolution to match client display
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = canvas.parentElement?.clientHeight || 120;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#07090E]/80 border border-cyan-500/20 shadow-[0_0_25px_rgba(0,240,255,0.12)] ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-zinc-600'}`} />
        <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400/80">
          {isPlaying ? 'LIVE FFT SPECTRUM' : 'SYSTEM READY'}
        </span>
      </div>
    </div>
  );
};
