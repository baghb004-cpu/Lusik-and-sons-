// ============================================================
// SCENE — light the cloth like a table by a window
// ============================================================
// No downloaded environment map. The look the photos have is one soft
// window from the upper left, a dim fill from the opposite side, and a
// warm bounce off a wooden table. Three lights get there and cost
// nothing to load.
// ============================================================

import {
  AmbientLight, Color, DirectionalLight, HemisphereLight, Scene,
} from "three";

export interface SceneHandle {
  scene: Scene;
  key: DirectionalLight;
}

export function createScene(shadows: boolean): SceneHandle {
  const scene = new Scene();
  // Transparent background: the stage crossfades over the poster, and the
  // page's own cream shows through rather than a painted rectangle.
  scene.background = null;

  // The window.
  const key = new DirectionalLight(0xfff4e2, 2.4);
  key.position.set(-2.4, 3.2, 2.0);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0012;
  }
  scene.add(key);

  // Cool fill from the far side so the shadowed edge is not black.
  const fill = new DirectionalLight(0xdfe8ff, 0.45);
  fill.position.set(2.6, 1.4, -1.6);
  scene.add(fill);

  // Sky above, warm table bounce below.
  scene.add(new HemisphereLight(0xffffff, new Color(0xd8c4a4).getHex(), 0.55));
  scene.add(new AmbientLight(0xffffff, 0.18));

  return { scene, key };
}
