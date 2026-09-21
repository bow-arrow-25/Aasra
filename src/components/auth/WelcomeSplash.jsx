import { useEffect, useState } from "react";
import { Building2, LayoutDashboard, Smartphone } from "lucide-react";
import WaterFluxBackdrop from "../ui/WaterFluxBackdrop";
import AasraMark from "../ui/AasraMark";

export default function WelcomeSplash({ onParent, onFamily, onOrg }) {
  const [ready, setReady] = useState(false);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <WaterFluxBackdrop>
      <div
        className="flex min-h-screen flex-col items-center justify-center px-5 py-12"
        onClick={() => setReady(true)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setShift({
            x: ((event.clientX - box.left) / box.width - 0.5) * 28,
            y: ((event.clientY - box.top) / box.height - 0.5) * 18,
          });
        }}
      >
        <div className="splash-stack text-center">
          <div className="splash-mark-wrap">
            <div style={{ transform: `translate3d(${shift.x}px, ${shift.y}px, 0)` }}>
              <AasraMark size={108} className="splash-mark" />
            </div>
          </div>
          <p className="flux-kicker mt-7">Family scam-shield</p>
          <h1 className="splash-title">Aasra</h1>
          <p className="splash-tag">A quiet shield for the people we love.</p>
        </div>

        <div className={`splash-doors ${ready ? "splash-doors-ready" : ""}`}>
          <button type="button" onClick={onParent} className="flux-role-card">
            <span className="flux-role-icon">
              <Smartphone className="size-7" aria-hidden="true" />
            </span>
            <span className="mt-4 block font-display text-2xl font-bold">Parent phone</span>
            <span className="mt-2 block text-sm leading-relaxed text-aqua-100">
              Large type. One action at a time. PIN lock on this device.
            </span>
          </button>
          <button type="button" onClick={onFamily} className="flux-role-card flux-role-card-accent">
            <span className="flux-role-icon">
              <LayoutDashboard className="size-7" aria-hidden="true" />
            </span>
            <span className="mt-4 block font-display text-2xl font-bold">Family dashboard</span>
            <span className="mt-2 block text-sm leading-relaxed text-aqua-100">
              Live alerts, payments, reminders, and voice — on a separate screen.
            </span>
          </button>
          <button type="button" onClick={onOrg} className="flux-role-card">
            <span className="flux-role-icon">
              <Building2 className="size-7" aria-hidden="true" />
            </span>
            <span className="mt-4 block font-display text-2xl font-bold">Care home</span>
            <span className="mt-2 block text-sm leading-relaxed text-aqua-100">
              One admin email. Residents join with room and name. Tick food and daily checks.
            </span>
          </button>
        </div>
      </div>
    </WaterFluxBackdrop>
  );
}
