// ============================================================
// CAMERA — poses, a small orbit, and the drift while typing
// ============================================================
// About eighty lines instead of pulling in OrbitControls: this needs
// spherical coordinates, damping, pinch zoom and bounds, and nothing
// else. OrbitControls brings key handling, pan, and an event model the
// stage does not want, and it is not tree-shakeable.
//
// The behaviour that matters is the drift. While the customer types
// their child's name, the camera eases toward the slot being edited so
// they can see the letters appear, then returns to the resting pose a
// beat after the last keystroke. Under reduced motion every ease becomes
// a cut — the framing still changes, it just does not travel.
// ============================================================

import { PerspectiveCamera, Spherical, Vector3 } from "three";

export interface Pose {
  /** Where the camera orbits around. */
  target: [number, number, number];
  /** Distance from the target. */
  distance: number;
  /** Horizontal angle, radians. 0 looks along +z. */
  azimuth: number;
  /** Vertical angle from straight up, radians. */
  polar: number;
  fov?: number;
  /**
   * Aim at the piece's stitching rather than at `target`, when the rig
   * can say where that is.
   *
   * A close-up needs this. The blanket's design lives on two diagonals
   * with a bare middle, so a close-up aimed at the origin frames empty
   * cloth — which is exactly what the retuned `detail` pose did the
   * first time it was rendered: a perfect, well-lit photograph of
   * nothing.
   */
  focus?: "stitching";
}

export const POSES: Record<string, Pose> = {
  // Three-quarter top view on the table — the default, and what the
  // product photos look like.
  flat: { target: [0, 0, 0], distance: 3.2, azimuth: 0, polar: 0.62, fov: 35 },
  // Close in, so the weave and the individual crosses read. Kept at a
  // similar angle to `flat` rather than dropped to table level: a polar
  // near the horizon foreshortens a large flat piece into a blank plane
  // with its stitching squashed onto the far edge, which is what this
  // pose used to do (polar 1.15) and what it looked like every time
  // anyone actually rendered it.
  detail: { target: [0, 0, 0], distance: 1.55, azimuth: 0.4, polar: 0.58, fov: 32, focus: "stitching" },
  // Straight down: the whole layout at once, like a chart. The most
  // legible view of a blanket by some distance.
  chart: { target: [0, 0, 0], distance: 4.0, azimuth: 0, polar: 0.08, fov: 35 },
  // NOTE: there is no "backing" pose, and there cannot be one from the
  // camera alone. The orbit clamps polar below MAX_POLAR so the camera
  // never goes under the table, and the satin backing is a plane on the
  // underside — so a pose aimed at it can only ever show the piece's
  // edge. Showing the backing means a rig that lifts a corner.
};

const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI / 2 - 0.02; // never below the table
const MIN_DISTANCE = 1.2;
const MAX_DISTANCE = 8;

export interface OrbitHandle {
  /** Advance the damping. Returns true while still moving. */
  update: (dt: number) => boolean;
  /** Ease to a pose. Instant when reduced motion is on. */
  goTo: (pose: Pose, instant?: boolean) => void;
  /** Look at a point without changing the orbit — the typing drift. */
  focusOn: (point: [number, number, number] | null) => void;
  orbitBy: (dAzimuth: number, dPolar: number) => void;
  zoomBy: (factor: number) => void;
  dispose: () => void;
}

export function createOrbit(
  camera: PerspectiveCamera,
  initial: Pose,
  opts: { reducedMotion?: () => boolean } = {},
): OrbitHandle {
  const reduced = opts.reducedMotion ?? (() => false);

  const spherical = new Spherical(initial.distance, initial.polar, initial.azimuth);
  const goal = new Spherical(initial.distance, initial.polar, initial.azimuth);
  const target = new Vector3(...initial.target);
  const goalTarget = new Vector3(...initial.target);
  let fov = initial.fov ?? camera.fov;
  let goalFov = fov;
  /** Extra look-at offset while a slot is being edited. */
  const focus = new Vector3();
  const goalFocus = new Vector3();

  const position = new Vector3();

  const apply = () => {
    position.setFromSpherical(spherical).add(target);
    camera.position.copy(position);
    camera.lookAt(target.x + focus.x, target.y + focus.y, target.z + focus.z);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };

  const snap = () => {
    spherical.copy(goal);
    target.copy(goalTarget);
    focus.copy(goalFocus);
    fov = goalFov;
    apply();
  };

  const update = (dt: number): boolean => {
    if (reduced()) {
      const moving =
        Math.abs(spherical.radius - goal.radius) > 1e-4 ||
        !target.equals(goalTarget) ||
        !focus.equals(goalFocus);
      if (moving) snap();
      return false;
    }
    // Frame-rate independent damping: the same easing at 30 and 60 fps.
    const k = 1 - Math.exp(-8 * Math.min(dt, 0.1));
    spherical.radius += (goal.radius - spherical.radius) * k;
    spherical.phi += (goal.phi - spherical.phi) * k;
    spherical.theta += (goal.theta - spherical.theta) * k;
    target.lerp(goalTarget, k);
    focus.lerp(goalFocus, k);
    fov += (goalFov - fov) * k;
    apply();

    return (
      Math.abs(goal.radius - spherical.radius) > 1e-3 ||
      Math.abs(goal.phi - spherical.phi) > 1e-4 ||
      Math.abs(goal.theta - spherical.theta) > 1e-4 ||
      target.distanceToSquared(goalTarget) > 1e-6 ||
      focus.distanceToSquared(goalFocus) > 1e-6 ||
      Math.abs(goalFov - fov) > 1e-3
    );
  };

  const goTo = (pose: Pose, instant = false) => {
    goal.set(pose.distance, pose.polar, pose.azimuth);
    goalTarget.set(...pose.target);
    goalFov = pose.fov ?? goalFov;
    if (instant || reduced()) snap();
  };

  const focusOn = (point: [number, number, number] | null) => {
    if (!point) goalFocus.set(0, 0, 0);
    else goalFocus.set(point[0] - goalTarget.x, point[1] - goalTarget.y, point[2] - goalTarget.z).multiplyScalar(0.35);
    if (reduced()) snap();
  };

  const orbitBy = (dAzimuth: number, dPolar: number) => {
    goal.theta += dAzimuth;
    goal.phi = Math.max(MIN_POLAR, Math.min(MAX_POLAR, goal.phi + dPolar));
    if (reduced()) snap();
  };

  const zoomBy = (factor: number) => {
    goal.radius = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, goal.radius * factor));
    if (reduced()) snap();
  };

  snap();

  return { update, goTo, focusOn, orbitBy, zoomBy, dispose: () => {} };
}
