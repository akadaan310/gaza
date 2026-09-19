import { useFrame } from "@react-three/fiber";
import { useWorldStore } from "../store/worldStore";

// Runs first each frame (mounted before Guide/Portal/CommandCenter) so those
// components' "I'm in range" writes for this frame always win; when none of
// them are in range, focus clears instead of sticking to the last visited.
export function FocusResetter() {
  useFrame(() => {
    if (useWorldStore.getState().focus !== null) {
      useWorldStore.getState().setFocus(null);
    }
  });
  return null;
}
