import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, N8AO, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useWorldStore } from "./store/worldStore";
import { GazaWorld } from "./world/GazaWorld";
import { InterstellarScene } from "./world/InterstellarScene";
import { SkySystem } from "./world/SkySystem";
import { Guide } from "./world/Guide";
import { GuideField } from "./world/GuideField";
import { ActivatedRelations } from "./world/ActivatedRelations";
import { Portal } from "./world/Portal";
import { CommandCenter } from "./world/CommandCenter";
import { FocusResetter } from "./world/FocusResetter";
import { PerformanceMonitor } from "./world/PerformanceMonitor";
import { FirstPersonController, isTouchDevice } from "./player/FirstPersonController";
import { IntroOverlay } from "./ui/IntroOverlay";
import { ResearchPanel } from "./ui/ResearchPanel";
import { CommandCenterPanel } from "./ui/CommandCenterPanel";
import { MobileControls } from "./ui/MobileControls";
import { NavigationPanel } from "./ui/NavigationPanel";
import { navigateTo } from "./world/autoNavActions";
import { GUIDE_LOCAL, PORTAL_LOCAL, COMMAND_CENTER_LOCAL } from "./world/landmarks";
import "./ui/world-ui.css";
import "./App.css";

function KeyboardBindings() {
  useEffect(() => {
    if (isTouchDevice()) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyR") useWorldStore.getState().toggleResearchMode();
      if (e.code === "KeyE") useWorldStore.getState().triggerInteract();
      // Number-key auto-nav: the pointer is captured by Pointer Lock while
      // looking around, so on-screen destination buttons aren't reliably
      // mouse-clickable mid-play — hotkeys are the robust path on desktop.
      if (e.code === "Digit1") navigateTo("The Guide", GUIDE_LOCAL);
      if (e.code === "Digit2") navigateTo("Bridge Portal", PORTAL_LOCAL);
      if (e.code === "Digit3") navigateTo("Command Center", COMMAND_CENTER_LOCAL);
      if (e.code === "Escape") useWorldStore.getState().cancelAutoNav();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return null;
}

export default function App() {
  const inInterstellar = useWorldStore((s) => s.inInterstellar);
  const commandCenterOpen = useWorldStore((s) => s.commandCenterOpen);
  const perfTier = useWorldStore((s) => s.perfTier);
  const touch = isTouchDevice();
  const lowPerf = perfTier === "low";

  return (
    <div className="app-root">
      <Canvas
        shadows={!lowPerf}
        camera={{ fov: 68, near: 0.1, far: 6000 }}
        gl={{ antialias: !lowPerf, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.55 }}
        dpr={lowPerf ? 1 : touch ? [1, 1.5] : [1, 2]}
      >
        <Suspense fallback={null}>
          <KeyboardBindings />
          <FocusResetter />
          <PerformanceMonitor />
          <FirstPersonController />
          {inInterstellar ? (
            <InterstellarScene />
          ) : (
            <>
              <SkySystem />
              <GazaWorld />
              <GuideField />
              <ActivatedRelations />
              <Guide />
              <Portal />
              <CommandCenter />
            </>
          )}
          <EffectComposer multisampling={0}>
            {lowPerf ? (
              <Bloom mipmapBlur={false} intensity={0.35} luminanceThreshold={0.6} luminanceSmoothing={0.15} />
            ) : (
              <>
                <N8AO aoRadius={2.2} intensity={1.0} distanceFalloff={1} quality="medium" />
                <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.5} luminanceSmoothing={0.15} />
                <Vignette eskil={false} offset={0.15} darkness={0.45} />
              </>
            )}
          </EffectComposer>
        </Suspense>
      </Canvas>

      <div className="crosshair" />
      <IntroOverlay />
      <ResearchPanel />
      <NavigationPanel />
      {commandCenterOpen && <CommandCenterPanel />}
      {touch && (
        <MobileControls
          onInteract={() => useWorldStore.getState().triggerInteract()}
          onToggleResearch={() => useWorldStore.getState().toggleResearchMode()}
        />
      )}
    </div>
  );
}
