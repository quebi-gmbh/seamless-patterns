import { useEffect, useMemo, useState } from "react";

function Particles() {
  const [particleCount, setParticleCount] = useState(30);

  useEffect(() => {
    const updateParticleCount = () => {
      // Start with 30 at mobile (375px), scale up from there (~1 particle per 40px above mobile)
      const baseCount = 30;
      const mobileWidth = 375;
      const extraParticles = Math.max(
        0,
        Math.floor((window.innerWidth - mobileWidth) / 40),
      );
      setParticleCount(baseCount + extraParticles);
    };

    updateParticleCount();
    window.addEventListener("resize", updateParticleCount);
    return () => window.removeEventListener("resize", updateParticleCount);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 10}s`,
        duration: `${8 + Math.random() * 8}s`,
        size: Math.random() > 0.7 ? "3px" : "2px",
      })),
    [particleCount],
  );

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </>
  );
}

export function Background() {
  return (
    <>
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Grid pattern with fade */}
      <div className="grid-pattern pointer-events-none absolute inset-0" />

      {/* Scanlines effect */}
      <div className="scanline pointer-events-none absolute inset-0" />

      {/* Noise texture */}
      <div className="noise-overlay pointer-events-none absolute inset-0" />

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0">
        <Particles />
      </div>

      {/* Corner accents */}
      <div className="pointer-events-none absolute top-0 left-0 h-32 w-32 border-t border-l border-cyan-500/10" />
      <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 border-t border-r border-cyan-500/10" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 border-b border-l border-cyan-500/10" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-32 border-b border-r border-cyan-500/10" />
    </>
  );
}
