import { useEffect, useState } from "react";
import { GlobalStateProvider, useGlobalState } from "./context/GlobalState";
import ParentView from "./ParentView";
import ChildDashboard from "./ChildDashboard";
import CallAnalyzerRuntime from "./components/CallAnalyzerRuntime";
import LiveVoiceRuntime from "./components/LiveVoiceRuntime";
import PaymentToasts from "./components/PaymentToasts";
import SimulationPanel from "./components/SimulationPanel";
import { ToastProvider } from "./components/Toast";
import ElderLogin from "./components/auth/ElderLogin";
import FamilyLogin from "./components/auth/FamilyLogin";
import FamilySetup from "./components/auth/FamilySetup";
import OrgSetup from "./components/auth/OrgSetup";
import WelcomeSplash from "./components/auth/WelcomeSplash";
import ParentShareResult from "./components/parent/ParentShareResult";
import AasraMark from "./components/ui/AasraMark";
import WaterFluxBackdrop from "./components/ui/WaterFluxBackdrop";
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
    <WaterFluxBackdrop>
      <div className="flex min-h-screen flex-col items-center justify-center">
        <AasraMark size={88} />
        <p className="mt-5 font-display text-5xl font-extrabold tracking-tight text-cream">Aasra</p>
      </div>
    </WaterFluxBackdrop>
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
  const [entry, setEntry] = useState("splash");
  const {
    roomCode,
    householdId,
    role,
    authReady,
    needsSetup,
    setupKind,
    needsRole,
    lang,
    pendingSms,
    boardReady,
    receiveSms,
    clearSmsWarning,
    parentName,
    chooseRole,
    authEmail,
  } = useGlobalState();
  const authenticated = Boolean(householdId || roomCode);
  const signedIn = authenticated && Boolean(role) && !needsRole;

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
    receiveSms({ sender: `Shared by ${parentName || "family"}`, body, shared: true });
  }, [authReady, boardReady, householdId, roomCode, pendingSms?.shared, receiveSms, parentName]);

  function finishSharedSms() {
    clearStashedShareText();
    clearSmsWarning();
  }

  useEffect(() => {
    if (!authenticated || !needsRole) return;
    chooseRole(authEmail ? "family" : "parent");
  }, [authenticated, needsRole, authEmail, chooseRole]);

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
      <LiveVoiceRuntime />
      <CallAnalyzerRuntime />
      <PaymentToasts />
      {needsSetup ? setupKind === "org" ? <OrgSetup /> : <FamilySetup /> : null}
      {!needsSetup && pendingSms?.shared && !signedIn ? (
        <ParentShareResult
          lang={lang}
          message={pendingSms}
          onDone={finishSharedSms}
          ParentShell={ShareShell}
        />
      ) : null}
      {!needsSetup && authenticated && (needsRole || !role) ? <AuthLoading /> : null}
      {!needsSetup && signedIn && role === "family" ? <ChildDashboard /> : null}
      {!needsSetup && signedIn && role !== "family" ? <ParentView /> : null}
      {!needsSetup && !authenticated && !pendingSms?.shared ? (
        entry === "parent" ? (
          <ElderLogin onBack={() => setEntry("splash")} />
        ) : entry === "family" ? (
          <FamilyLogin onBack={() => setEntry("splash")} />
        ) : entry === "org" ? (
          <FamilyLogin variant="org" onBack={() => setEntry("splash")} />
        ) : (
          <WelcomeSplash
            onParent={() => setEntry("parent")}
            onFamily={() => setEntry("family")}
            onOrg={() => setEntry("org")}
          />
        )
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
