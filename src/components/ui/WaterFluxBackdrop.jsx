import { useEffect, useState } from "react";

export default function WaterFluxBackdrop({ children, variant = "auth" }) {
  const [pos, setPos] = useState({ x: 50, y: 42 });
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      setReduce(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function onMove(event) {
    if (reduce) return;
    const box = event.currentTarget.getBoundingClientRect();
    setPos({
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    });
  }

  const shiftA = {
    transform: `translate3d(${(pos.x - 50) * 0.28}px, ${(pos.y - 50) * 0.2}px, 0)`,
  };
  const shiftB = {
    transform: `translate3d(${(pos.x - 50) * -0.18}px, ${(pos.y - 50) * 0.14}px, 0)`,
  };
  const shiftC = {
    transform: `translate3d(${(pos.x - 50) * 0.1}px, ${(pos.y - 50) * -0.12}px, 0)`,
  };

  return (
    <div
      className={`flux-scene ${variant === "dashboard" ? "flux-scene-dashboard" : ""}`}
      onMouseMove={onMove}
    >
      <div className="flux-layer flux-layer-base" aria-hidden="true" />
      <div className="flux-layer flux-orb flux-orb-a" style={shiftA} aria-hidden="true" />
      <div className="flux-layer flux-orb flux-orb-b" style={shiftB} aria-hidden="true" />
      <div className="flux-layer flux-orb flux-orb-c" style={shiftC} aria-hidden="true" />
      <div className="flux-caustic" aria-hidden="true" />
      <svg className="flux-wave" viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="flux-wave-path flux-wave-back"
          d="M0,80 C240,140 480,20 720,80 C960,140 1200,40 1440,90 L1440,180 L0,180 Z"
        />
        <path
          className="flux-wave-path flux-wave-front"
          d="M0,110 C220,70 520,160 760,110 C1000,60 1240,140 1440,100 L1440,180 L0,180 Z"
        />
      </svg>
      <div className="flux-content">{children}</div>
    </div>
  );
}
