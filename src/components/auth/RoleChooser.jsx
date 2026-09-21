import { LayoutDashboard, Smartphone } from "lucide-react";
import { useGlobalState } from "../../context/GlobalState";
import WaterFluxBackdrop from "../ui/WaterFluxBackdrop";

export default function RoleChooser() {
  const { chooseRole, parentName, roomCode, authEmail, signOutUser } = useGlobalState();

  return (
    <WaterFluxBackdrop>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="flux-glass w-full max-w-2xl p-6 sm:p-10">
          <p className="flux-kicker">Aasra · WaterFlux</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-cream sm:text-4xl">
            Who is using this phone?
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-aqua-100/90 sm:text-base">
            Signed in{authEmail ? ` as ${authEmail}` : ""}.{" "}
            {parentName ? `${parentName} is protected.` : "This household is protected."}{" "}
            Pairing code {roomCode || "------"}.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseRole("parent")}
              className="flux-role-card"
            >
              <span className="flux-role-icon">
                <Smartphone className="size-8" aria-hidden="true" />
              </span>
              <span className="mt-4 block font-display text-2xl font-bold">Parent phone</span>
              <span className="mt-2 block text-sm leading-relaxed text-aqua-100">
                Large buttons{parentName ? ` for ${parentName}` : ""}. One action at a time.
              </span>
            </button>
            <button
              type="button"
              onClick={() => chooseRole("family")}
              className="flux-role-card flux-role-card-accent"
            >
              <span className="flux-role-icon">
                <LayoutDashboard className="size-8" aria-hidden="true" />
              </span>
              <span className="mt-4 block font-display text-2xl font-bold">Family dashboard</span>
              <span className="mt-2 block text-sm leading-relaxed text-aqua-100">
                Live alerts, payments, reminders, and voice.
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => signOutUser()}
            className="mt-8 text-sm font-semibold text-aqua-200 underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    </WaterFluxBackdrop>
  );
}
