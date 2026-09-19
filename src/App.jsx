import { useEffect, useState } from "react";
import { LayoutDashboard, Smartphone } from "lucide-react";
import { GlobalStateProvider, useGlobalState } from "./context/GlobalState";
import ParentView from "./ParentView";
import ChildDashboard from "./ChildDashboard";
import PaymentToasts from "./components/PaymentToasts";
import SimulationPanel from "./components/SimulationPanel";
import { ToastProvider } from "./components/Toast";
import DemoButtons from "./components/auth/DemoButtons";
import ElderLogin from "./components/auth/ElderLogin";
import FamilyLogin from "./components/auth/FamilyLogin";
import FamilySetup from "./components/auth/FamilySetup";
import ParentShareResult from "./components/parent/ParentShareResult";
import {
  captureIncomingShare,
  clearShareUrl,
  clearStashedShareText,
  isShareRoute,
  peekStashedShareText,
} from "./lib/shareTarget";

function currentHash() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  return hash.startsWith("/") ? hash : `/${hash}`;
}

function useHashRoute() {
  const [route, setRoute] = useState(currentHash);

  useEffect(() => {
    function onChange() {
      setRoute(currentHash());
    }
    window.addEventListener("hashchange", onChange);
    if (!window.location.hash && !isShareRoute()) {
      window.location.hash = "#/";
    }
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <p className="font-parent text-[28px] font-bold text-teal">Aasra</p>
    </div>
  );
}

function HomeChooser() {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-cream px-4 sm:px-6">
      <div className="w-full max-w-md min-w-0 text-center">
        <p className="font-parent text-[24px] text-teal">Aasra</p>
        <h1 className="mt-2 font-parent text-[32px] font-bold leading-tight wrap-break-word text-teal sm:text-[40px]">
          Family scam-shield
        </h1>
        <div className="mt-10 grid gap-4">
          <a
            href="#/parent"
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-teal px-6 py-6 font-parent text-[28px] font-bold wrap-break-word text-cream"
          >
            <Smartphone className="size-8 shrink-0" aria-hidden="true" />
            Parent phone
          </a>
          <a
            href="#/child"
            className="inline-flex items-center justify-center gap-3 rounded-2xl border-4 border-teal px-6 py-6 font-parent text-[28px] font-bold wrap-break-word text-teal"
          >
            <LayoutDashboard className="size-8 shrink-0" aria-hidden="true" />
            Family dashboard
          </a>
        </div>
        <DemoButtons variant="parent" />
      </div>
    </div>
  );
}

function ShareShell({ children }) {
  return (
    <div className="flex min-h-screen justify-center overflow-x-hidden bg-teal">
      <div className="flex min-h-screen w-full max-w-107.5 min-w-0 flex-col bg-cream px-4 py-6 font-parent text-teal sm:px-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}

function RoutedApp() {
  const route = useHashRoute();
  const {
    roomCode,
    householdId,
    role,
    authReady,
    needsSetup,
    lang,
    pendingSms,
    boardReady,
    receiveSms,
    clearSmsWarning,
  } = useGlobalState();
  const signedIn = Boolean((householdId || roomCode) && role);

  useEffect(() => {
    if (!isShareRoute()) return;
    captureIncomingShare();
    clearShareUrl();
  }, [route]);

  useEffect(() => {
    if (!authReady) return;
    if ((householdId || roomCode) && !boardReady) return;
    if (pendingSms?.shared) return;
    const body = peekStashedShareText();
    if (!body) return;
    receiveSms({ sender: "Shared by Amma", body, shared: true });
  }, [authReady, boardReady, householdId, roomCode, pendingSms?.shared, receiveSms]);

  function finishSharedSms() {
    clearStashedShareText();
    clearSmsWarning();
  }

  useEffect(() => {
    if (!signedIn || needsSetup) return;
    if (pendingSms?.shared && role !== "family") return;
    const want = role === "family" ? "#/child" : "#/parent";
    if (window.location.hash !== want) {
      window.location.hash = want;
    }
  }, [signedIn, role, needsSetup, pendingSms?.shared]);

  if (!authReady) {
    return <AuthLoading />;
  }

  return (
    <>
      <SimulationPanel />
      <PaymentToasts />
      {needsSetup ? <FamilySetup /> : null}
      {!needsSetup && pendingSms?.shared && !signedIn ? (
        <ParentShareResult
          lang={lang}
          message={pendingSms}
          onDone={finishSharedSms}
          ParentShell={ShareShell}
        />
      ) : null}
      {!needsSetup && signedIn && role === "family" ? <ChildDashboard /> : null}
      {!needsSetup && signedIn && role !== "family" ? <ParentView /> : null}
      {!needsSetup && !signedIn && !pendingSms?.shared && route === "/parent" ? (
        <ElderLogin />
      ) : null}
      {!needsSetup && !signedIn && !pendingSms?.shared && route === "/child" ? (
        <FamilyLogin />
      ) : null}
      {!needsSetup && !signedIn && !pendingSms?.shared && route === "/" ? (
        <HomeChooser />
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <GlobalStateProvider>
      <ToastProvider>
        <RoutedApp />
      </ToastProvider>
    </GlobalStateProvider>
  );
}
