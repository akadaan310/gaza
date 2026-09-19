import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { useWorldStore } from "../store/worldStore";

const EYE_HEIGHT = 1.75;
const WALK_SPEED = 5.5;
const RUN_MULT = 1.9;
const INTERSTELLAR_SPEED_MULT = 34;
const AUTO_NAV_SPEED_MULT = 1; // auto-walk runs at the normal "running" pace, not teleport-fast
const AUTO_NAV_ARRIVE_M = 2.2;
const AUTO_NAV_TURN_RATE = 3.2; // rad/s

// Mutable, non-reactive input channels for the touch UI (rendered outside
// the canvas). Written directly by MobileControls, read every frame here —
// avoids a store write per pixel of drag.
export const mobileMoveInput = { x: 0, y: 0, running: false };
export const mobileLookDelta = { dx: 0, dy: 0 };

export function isTouchDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function FirstPersonController() {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const touch = useMemo(() => isTouchDevice(), []);
  const yawPitch = useRef({ yaw: 0.6, pitch: -0.05 });

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, 30);
    camera.rotation.order = "YXZ";
    camera.rotation.set(yawPitch.current.pitch, yawPitch.current.yaw, 0);
  }, [camera]);

  useEffect(() => {
    if (touch) return;
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [touch]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    let moveX = 0, moveY = 0, running = false;

    if (touch) {
      moveX = mobileMoveInput.x;
      moveY = mobileMoveInput.y;
      running = mobileMoveInput.running;
    } else {
      if (keys.current["KeyW"] || keys.current["ArrowUp"]) moveY += 1;
      if (keys.current["KeyS"] || keys.current["ArrowDown"]) moveY -= 1;
      if (keys.current["KeyA"] || keys.current["ArrowLeft"]) moveX -= 1;
      if (keys.current["KeyD"] || keys.current["ArrowRight"]) moveX += 1;
      running = Boolean(keys.current["ShiftLeft"] || keys.current["ShiftRight"]);
    }

    const manualInputMagnitude = Math.hypot(moveX, moveY);
    const state = useWorldStore.getState();

    if (state.teleportRequest && !state.inInterstellar) {
      const [tx, ty] = state.teleportRequest;
      camera.position.set(tx, EYE_HEIGHT, -ty);
      state.clearTeleportRequest();
      state.setPlayerLocal([tx, ty], yawPitch.current.yaw);
      state.setPlayerWorldPos([camera.position.x, camera.position.y, camera.position.z]);
      return;
    }

    const autoNav = state.autoNav;

    // Any deliberate manual movement hands control straight back to the
    // visitor — auto-walk assists, it never fights the person steering.
    if (autoNav && manualInputMagnitude > 0.12 && !state.inInterstellar) {
      state.cancelAutoNav();
    }

    const activeAutoNav = state.autoNav && !state.inInterstellar ? state.autoNav : null;

    if (activeAutoNav) {
      const target = activeAutoNav.path[activeAutoNav.targetIndex];
      const curLocal = state.playerLocal;
      const dEast = target[0] - curLocal[0];
      const dNorth = target[1] - curLocal[1];
      const dist = Math.hypot(dEast, dNorth);

      if (dist < AUTO_NAV_ARRIVE_M) {
        state.advanceAutoNav();
      } else {
        const targetYaw = Math.atan2(-dEast, dNorth);
        yawPitch.current.yaw = lerpAngle(yawPitch.current.yaw, targetYaw, Math.min(1, AUTO_NAV_TURN_RATE * delta));
        camera.rotation.set(yawPitch.current.pitch, yawPitch.current.yaw, 0);
        moveX = 0;
        moveY = 1;
        running = true;
      }
    } else if (touch) {
      yawPitch.current.yaw -= mobileLookDelta.dx * 0.0028;
      yawPitch.current.pitch -= mobileLookDelta.dy * 0.0028;
      yawPitch.current.pitch = THREE.MathUtils.clamp(yawPitch.current.pitch, -1.3, 1.3);
      camera.rotation.set(yawPitch.current.pitch, yawPitch.current.yaw, 0);
      mobileLookDelta.dx = 0;
      mobileLookDelta.dy = 0;
    } else {
      // Desktop manual look: PointerLockControls drives camera.rotation
      // directly via mouse events. Keep our ref in sync so auto-nav starts
      // its turn from the visitor's actual current heading, not a stale one.
      yawPitch.current.yaw = camera.rotation.y;
      yawPitch.current.pitch = camera.rotation.x;
    }

    const len = Math.hypot(moveX, moveY);
    if (len > 1) {
      moveX /= len;
      moveY /= len;
    }
    const inInterstellar = state.inInterstellar;
    const navMult = activeAutoNav ? AUTO_NAV_SPEED_MULT : 1;
    const speed =
      WALK_SPEED * (running ? RUN_MULT : 1) * (inInterstellar ? INTERSTELLAR_SPEED_MULT : navMult);
    const yaw = camera.rotation.y;

    if (inInterstellar) {
      // Free flight: forward follows the full look direction (pitch included).
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      camera.position.addScaledVector(forward, moveY * speed * delta);
      camera.position.addScaledVector(right, moveX * speed * delta);
    } else {
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      camera.position.addScaledVector(forward, moveY * speed * delta);
      camera.position.addScaledVector(right, moveX * speed * delta);
      camera.position.y = EYE_HEIGHT;

      const localX = camera.position.x;
      const localY = -camera.position.z;
      useWorldStore.getState().setPlayerLocal([localX, localY], yaw);
    }
    useWorldStore.getState().setPlayerWorldPos([camera.position.x, camera.position.y, camera.position.z]);
  });

  if (touch) return null;

  return (
    <PointerLockControls
      onLock={() => useWorldStore.getState().setPointerLocked(true)}
      onUnlock={() => useWorldStore.getState().setPointerLocked(false)}
    />
  );
}
