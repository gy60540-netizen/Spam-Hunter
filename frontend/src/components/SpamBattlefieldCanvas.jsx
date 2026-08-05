import React, { useEffect, useRef } from 'react';

export default function SpamBattlefieldCanvas() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false, radius: 110 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Responsive sizing
    const handleResize = () => {
      if (canvas && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);

    // Detect mobile for performance tuning
    const isMobile = window.innerWidth < 768;
    const maxNodes = isMobile ? 25 : 65;

    // Node & Spark Class Definitions
    class Node {
      constructor(w, h) {
        this.w = w;
        this.h = h;
        this.reset();
        // Stagger initial positions randomly across the canvas
        this.x = Math.random() * w;
        this.y = Math.random() * h;
      }

      reset() {
        this.x = Math.random() * this.w;
        // Start near top or bottom to avoid popping in middle
        this.y = Math.random() > 0.5 ? -10 : this.h + 10;
        this.vx = (Math.random() - 0.5) * 0.7;
        this.vy = (Math.random() - 0.5) * 0.7;
        this.radius = Math.random() * 2.5 + 2;
        this.type = Math.random() > 0.82 ? 'red' : 'cyan'; // ~18% spam
        this.status = 'normal'; // normal, scanning, locked, dissolving
        this.timer = 0;
        this.confidence = (95 + Math.random() * 4.9).toFixed(1);
        this.username = this.type === 'red' 
          ? ['spammer_99', 'bot_winner', 'gift_crypto', 'easy_cash_bot', 'get_rich_fast'][Math.floor(Math.random() * 5)]
          : ['user_active', 'creativ_mind', 'designer_pro', 'honest_fan', 'tech_guru', 'traveler'][Math.floor(Math.random() * 6)];
        this.sparks = [];
        this.hoverTimer = 0;
      }

      update(mx, my, mActive, mRadius, sweepY) {
        if (this.status === 'normal') {
          // Standard motion
          this.x += this.vx;
          this.y += this.vy;

          // Screen bounds bounce
          if (this.x < 0 || this.x > this.w) this.vx *= -1;
          if (this.y < 0 || this.y > this.h) this.vy *= -1;

          // Mouse Gravitational Attraction
          if (mActive) {
            const dx = mx - this.x;
            const dy = my - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mRadius) {
              const force = (mRadius - dist) / mRadius;
              this.x += (dx / dist) * force * 0.8;
              this.y += (dy / dist) * force * 0.8;

              // Manual Mouse Hover Targeting
              if (this.type === 'red') {
                this.hoverTimer += 1;
                if (this.hoverTimer > 60) { // Hovered for ~1s
                  this.status = 'scanning';
                  this.timer = 0;
                  this.vx = 0;
                  this.vy = 0;
                }
              }
            } else {
              this.hoverTimer = Math.max(0, this.hoverTimer - 1);
            }
          }

          // Sweep-Line detection logic
          const distToSweep = Math.abs(this.y - sweepY);
          if (this.type === 'red' && distToSweep < 8 && Math.random() < 0.15) {
            this.status = 'scanning';
            this.timer = 0;
            this.vx = 0;
            this.vy = 0;
          }
        } else if (this.status === 'scanning') {
          this.timer += 1;
          if (this.timer > 30) {
            this.status = 'locked';
            this.timer = 0;
          }
        } else if (this.status === 'locked') {
          this.timer += 1;
          if (this.timer > 40) {
            this.status = 'dissolving';
            this.timer = 0;
            // Generate sparks/particles
            for (let i = 0; i < 15; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 2 + 1;
              this.sparks.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                decay: Math.random() * 0.03 + 0.02
              });
            }
          }
        } else if (this.status === 'dissolving') {
          let activeSparksCount = 0;
          this.sparks.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.alpha -= s.decay;
            if (s.alpha > 0) activeSparksCount++;
          });

          if (activeSparksCount === 0) {
            this.reset();
          }
        }
      }

      draw(cCtx, mx, my, mActive, mRadius) {
        if (this.status === 'dissolving') {
          // Draw exploding particles
          this.sparks.forEach(s => {
            if (s.alpha <= 0) return;
            cCtx.save();
            cCtx.globalAlpha = s.alpha;
            cCtx.beginPath();
            cCtx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
            cCtx.fillStyle = '#FF2E63';
            cCtx.shadowBlur = 8;
            cCtx.shadowColor = '#FF2E63';
            cCtx.fill();
            cCtx.restore();
          });
          return;
        }

        // Base Circle
        cCtx.beginPath();
        cCtx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        if (this.type === 'red') {
          cCtx.fillStyle = this.status === 'normal' ? 'rgba(255, 46, 99, 0.7)' : '#FF2E63';
          cCtx.fill();
        } else {
          cCtx.fillStyle = 'rgba(0, 229, 255, 0.6)';
          cCtx.fill();
        }

        // Radar Cursor Interaction drawing
        let isCursorNear = false;
        if (mActive) {
          const dx = mx - this.x;
          const dy = my - this.y;
          if (dx * dx + dy * dy < mRadius * mRadius) {
            isCursorNear = true;
          }
        }

        // Draw HUD Details when near mouse or during AI scan
        if (isCursorNear || this.status === 'scanning' || this.status === 'locked') {
          cCtx.save();
          
          if (this.type === 'red') {
            // Target box/brackets
            cCtx.strokeStyle = '#FF2E63';
            cCtx.lineWidth = 1;
            cCtx.strokeRect(this.x - 8, this.y - 8, 16, 16);
            
            // Draw targeting text
            cCtx.fillStyle = '#FF2E63';
            cCtx.font = '8px monospace';
            
            if (this.status === 'scanning') {
              cCtx.fillText(`[SCANNING...]`, this.x + 12, this.y - 4);
            } else if (this.status === 'locked') {
              // Floating badge details
              cCtx.fillStyle = 'rgba(255, 46, 99, 0.15)';
              cCtx.fillRect(this.x + 12, this.y - 12, 70, 18);
              cCtx.strokeStyle = '#FF2E63';
              cCtx.strokeRect(this.x + 12, this.y - 12, 70, 18);
              
              cCtx.fillStyle = '#FF2E63';
              cCtx.font = '7px monospace';
              cCtx.fillText(`BOT DETECTED`, this.x + 16, this.y - 4);
              cCtx.fillText(`SPAM: ${this.confidence}%`, this.x + 16, this.y + 3);
            } else {
              cCtx.fillText(`@${this.username}`, this.x + 12, this.y - 4);
              cCtx.fillText(`[SPAM TARGET]`, this.x + 12, this.y + 5);
            }
          } else {
            // Cyan legitimate account
            cCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
            cCtx.beginPath();
            cCtx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            cCtx.stroke();
            
            cCtx.fillStyle = 'rgba(0, 229, 255, 0.85)';
            cCtx.font = '8px monospace';
            cCtx.fillText(`@${this.username}`, this.x + 10, this.y - 2);
            cCtx.fillText(`VERIFIED`, this.x + 10, this.y + 6);
          }
          cCtx.restore();
        }
      }
    }

    // Initialize nodes
    const nodes = [];
    for (let i = 0; i < maxNodes; i++) {
      nodes.push(new Node(canvas.width || 800, canvas.height || 600));
    }

    // AI Sweep Line state
    let sweepY = 0;
    let sweepDirection = 1;
    const sweepSpeed = isMobile ? 1.0 : 1.4;

    // Mouse Listeners
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const parent = containerRef.current;
    if (parent) {
      parent.addEventListener('mousemove', handleMouseMove);
      parent.addEventListener('mouseleave', handleMouseLeave);
    }

    // Animation Loop
    const animate = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mActive = mouseRef.current.active;
      const mRadius = mouseRef.current.radius;

      // Update and Draw Background grid (Subtle grid)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.025)';
      ctx.lineWidth = 0.5;
      const gridSize = 45;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Cursor Radar Ring
      if (mActive) {
        ctx.save();
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, mRadius);
        grad.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
        grad.addColorStop(0.7, 'rgba(0, 229, 255, 0.015)');
        grad.addColorStop(1, 'rgba(0, 229, 255, 0.05)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, mRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(mx, my, mRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Update Sweep Line
      sweepY += sweepSpeed * sweepDirection;
      if (sweepY > canvas.height) {
        sweepY = canvas.height;
        sweepDirection = -1;
      } else if (sweepY < 0) {
        sweepY = 0;
        sweepDirection = 1;
      }

      // Draw Sweep Line
      ctx.save();
      const sweepGrad = ctx.createLinearGradient(0, sweepY - 3, 0, sweepY + 3);
      sweepGrad.addColorStop(0, 'rgba(99, 102, 241, 0)');
      sweepGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.35)');
      sweepGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, sweepY - 4, canvas.width, 8);
      
      // Sweep HUD Label
      ctx.fillStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.font = '6.5px monospace';
      ctx.fillText(`SYS SCANNING CORE NETWORK...`, 15, sweepY - 6);
      ctx.restore();

      // Update and draw nodes
      nodes.forEach(node => {
        node.update(mx, my, mActive, mRadius, sweepY);
        node.draw(ctx, mx, my, mActive, mRadius);
      });

      // Draw Faint Connection lines (Neural Networks)
      ctx.save();
      ctx.lineWidth = 0.4;
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (n1.status === 'dissolving') continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          if (n2.status === 'dissolving') continue;

          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 90) {
            // Stronger connections for safe accounts, red connections for spammers
            if (n1.type === 'red' || n2.type === 'red') {
              ctx.strokeStyle = `rgba(255, 46, 99, ${0.1 * (90 - dist) / 90})`;
            } else {
              ctx.strokeStyle = `rgba(0, 229, 255, ${0.08 * (90 - dist) / 90})`;
            }
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (parent) {
        parent.removeEventListener('mousemove', handleMouseMove);
        parent.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }}
    >
      <canvas 
        ref={canvasRef} 
        style={{ 
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
}
