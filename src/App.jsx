import { useEffect, useState } from "react";
import { GlobalStateProvider, useGlobalState } from "./context/GlobalState";
import ParentView from "./ParentView";
import ChildDashboard from "./ChildDashboard";
import SimulationPanel from "./components/SimulationPanel";
import { FamilyCreateRoom, ParentJoinRoom } from "./components/RoomScreen";

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
    if (!window.location.hash) {
      window.location.hash = "#/";
    }
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
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
            className="rounded-2xl bg-teal px-6 py-6 font-parent text-[28px] font-bold wrap-break-word text-cream"
          >
            Parent phone
          </a>
          <a
            href="#/child"
            className="rounded-2xl border-4 border-teal px-6 py-6 font-parent text-[28px] font-bold wrap-break-word text-teal"
          >
            Family dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

function RoutedApp() {
  const route = useHashRoute();
  const { roomCode } = useGlobalState();

  return (
    <>
      <SimulationPanel />
      {route === "/parent" ? (
        roomCode ? <ParentView /> : <ParentJoinRoom />
      ) : null}
      {route === "/child" ? (
        roomCode ? <ChildDashboard /> : <FamilyCreateRoom />
      ) : null}
      {route === "/" ? <HomeChooser /> : null}
    </>
  );
}

export default function App() {
  return (
    <GlobalStateProvider>
      <RoutedApp />
    </GlobalStateProvider>
  );
}
