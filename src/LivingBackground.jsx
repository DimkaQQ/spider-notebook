import React, { useRef, useEffect } from 'react';

/* Ported verbatim from App.jsx - LivingMotherboardBackground */
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function LivingBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    const mobile = isMobileDevice();
    let paused = false;
    let scrollTimeout;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    const handleScroll = () => {
      if (!paused) {
        paused = true;
        cancelAnimationFrame(animationFrameId);
      }
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        paused = false;
        animationFrameId = requestAnimationFrame(renderLoop);
      }, 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const generateBuses = () => {
      const buses = [];
      const numBuses = mobile ? Math.max(4, Math.floor(width / 300)) : Math.max(14, Math.floor(width / 110));

      for (let b = 0; b < numBuses; b++) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        const trackCount = mobile ? Math.floor(Math.random() * 2) + 2 : Math.floor(Math.random() * 3) + 3;
        const spacing = 12;
        const length = Math.random() * 350 + 250;

        const angle = Math.PI / 4;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);

        const tracks = [];
        for (let t = 0; t < trackCount; t++) {
          const offsetStartX = startX + t * spacing * -directionY;
          const offsetStartY = startY + t * spacing * directionX;

          const segments = [];
          segments.push({ x: offsetStartX, y: offsetStartY });

          const seg1Length = length * 0.45;
          const x1 = offsetStartX + directionX * seg1Length;
          const y1 = offsetStartY + directionY * seg1Length;
          segments.push({ x: x1, y: y1 });

          const isHorizontalTurn = Math.random() > 0.5;
          const seg2Length = length * 0.55;
          let x2 = x1;
          let y2 = y1;

          if (isHorizontalTurn) {
            x2 += seg2Length;
          } else {
            y2 += seg2Length;
          }
          segments.push({ x: x2, y: y2 });

          tracks.push({ points: segments, width: Math.random() * 0.8 + 0.6, pulses: [] });
        }

        buses.push({ tracks, color: Math.random() > 0.4 ? '#00EFFF' : '#62FF5B' });
      }
      return buses;
    };

    let buses = generateBuses();

    const resetBusesOnLimit = () => {
      buses = generateBuses();
    };
    window.addEventListener('resize', resetBusesOnLimit, { passive: true });

    let mouse = { x: width / 2, y: height / 2, tx: width / 2, ty: height / 2 };
    const handleMouseMove = (e) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const spawnPulses = () => {
      buses.forEach((bus) => {
        if (Math.random() < (mobile ? 0.06 : 0.12)) {
          const trackIndex = Math.floor(Math.random() * bus.tracks.length);
          const track = bus.tracks[trackIndex];
          if (track.pulses.length < 2) {
            track.pulses.push({
              segmentIndex: 0,
              progress: 0,
              speed: Math.random() * 0.012 + 0.008,
              size: Math.random() * 2 + 1.2
            });
          }
        }
      });
    };

    let lastFrameTime = 0;
    const frameInterval = mobile ? 33 : 0;

    const renderLoop = (timestamp) => {
      if (paused) return;
      animationFrameId = requestAnimationFrame(renderLoop);

      if (mobile && timestamp - lastFrameTime < frameInterval) return;
      lastFrameTime = timestamp;

      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, width, height);

      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      const radialGradient = ctx.createRadialGradient(mouse.x, mouse.y, 5, mouse.x, mouse.y, 500);
      radialGradient.addColorStop(0, 'rgba(0, 239, 255, 0.14)');
      radialGradient.addColorStop(0.3, 'rgba(98, 255, 91, 0.04)');
      radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGradient;
      ctx.fillRect(0, 0, width, height);

      buses.forEach((bus) => {
        bus.tracks.forEach((track) => {
          if (track.points.length < 2) return;

          const midX = track.points[0].x;
          const midY = track.points[0].y;
          const distToMouse = Math.hypot(midX - mouse.x, midY - mouse.y);

          const opacityFactor = Math.max(0.06, 1 - distToMouse / 650);
          ctx.strokeStyle = bus.color;
          ctx.globalAlpha = opacityFactor;
          ctx.lineWidth = track.width;

          ctx.beginPath();
          ctx.moveTo(track.points[0].x, track.points[0].y);
          for (let p = 1; p < track.points.length; p++) {
            ctx.lineTo(track.points[p].x, track.points[p].y);
          }
          ctx.stroke();

          const endPoint = track.points[track.points.length - 1];
          ctx.fillStyle = bus.color;
          if (!mobile) {
            ctx.shadowBlur = distToMouse < 450 ? 6 : 0;
            ctx.shadowColor = bus.color;
          }

          ctx.beginPath();
          ctx.arc(endPoint.x, endPoint.y, track.width * 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
        });
      });

      spawnPulses();

      buses.forEach((bus) => {
        bus.tracks.forEach((track) => {
          for (let pIdx = track.pulses.length - 1; pIdx >= 0; pIdx--) {
            const p = track.pulses[pIdx];
            const startNode = track.points[p.segmentIndex];
            const endNode = track.points[p.segmentIndex + 1];

            if (!startNode || !endNode) {
              track.pulses.splice(pIdx, 1);
              continue;
            }

            p.progress += p.speed;

            const currentX = startNode.x + (endNode.x - startNode.x) * p.progress;
            const currentY = startNode.y + (endNode.y - startNode.y) * p.progress;

            if (!mobile) {
              ctx.shadowBlur = 10;
              ctx.shadowColor = bus.color;
            }
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            if (p.progress >= 1) {
              p.progress = 0;
              p.segmentIndex += 1;
              if (p.segmentIndex >= track.points.length - 1) {
                ctx.fillStyle = '#ffffff';
                if (!mobile) {
                  ctx.shadowBlur = 12;
                  ctx.shadowColor = bus.color;
                }
                ctx.beginPath();
                ctx.arc(currentX, currentY, p.size * 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                track.pulses.splice(pIdx, 1);
              }
            }
          }
        });
      });

      if (!mobile) {
        ctx.strokeStyle = 'rgba(0, 239, 255, 0.02)';
        ctx.lineWidth = 1;
        const step = 90;
        for (let x = 0; x < width; x += step) {
          for (let y = 0; y < height; y += step) {
            if ((x / step + y / step) % 3 === 0) {
              ctx.beginPath();
              ctx.moveTo(x - 3, y);
              ctx.lineTo(x + 3, y);
              ctx.moveTo(x, y - 3);
              ctx.lineTo(x, y + 3);
              ctx.stroke();
            }
          }
        }
      }
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(scrollTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', resetBusesOnLimit);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full pointer-events-none z-0" />
  );
}