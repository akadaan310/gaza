import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWorldStore } from "../store/worldStore";

const SAMPLE_SECONDS = 2.5;
const LOW_FPS_THRESHOLD = 24;

// Real GPUs run this scene comfortably; software rendering (or a genuinely
// low-end device) won't. Rather than assume one or the other, sample the
// actual frame time for a couple of seconds after launch and drop to a
// cheaper render path — this is the "graceful fallback" the brief asks
// for, decided from measurement rather than a device/browser sniff.
export function PerformanceMonitor() {
  const sampleFrames = useRef(0);
  const sampleElapsed = useRef(0);
  const decided = useRef(false);

  useFrame((_, delta) => {
    if (decided.current) return;
    sampleFrames.current += 1;
    sampleElapsed.current += delta;
    if (sampleElapsed.current < SAMPLE_SECONDS) return;

    decided.current = true;
    const fps = sampleFrames.current / sampleElapsed.current;
    if (fps < LOW_FPS_THRESHOLD) {
      useWorldStore.getState().setPerfTier("low");
    }
  });

  return null;
}
