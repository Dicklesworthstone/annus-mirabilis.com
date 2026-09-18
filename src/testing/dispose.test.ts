import { describe, expect, test } from "bun:test";
import { lifecycleDiagnostics } from "../experiments/lifecycle/diagnostics.ts";
import {
  type Disposable,
  type DisposableViewNode,
  disposeMaterial,
  disposeSceneGraph,
} from "../visuals/three/dispose.ts";
import { HeavyFixtureLaboratory } from "./runtime-fixtures/heavyFixture.ts";

function createMockDisposable(onDispose?: () => void): Disposable {
  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        throw new Error("Already disposed");
      }
      disposed = true;
      if (onDispose) onDispose();
    },
  };
}

describe("Three.js scene graph traversal and disposal without WebGL context", () => {
  test("disposeSceneGraph traverses hierarchy and disposes geometries, materials, and textures", () => {
    let disposedGeometries = 0;
    let disposedMaterials = 0;
    let disposedTextures = 0;

    const tex1 = createMockDisposable(() => disposedTextures++);
    const tex2 = createMockDisposable(() => disposedTextures++);
    const tex3 = createMockDisposable(() => disposedTextures++);

    const geom1 = createMockDisposable(() => disposedGeometries++);
    const geom2 = createMockDisposable(() => disposedGeometries++);

    const mat1 = {
      ...createMockDisposable(() => disposedMaterials++),
      map: tex1,
      normalMap: tex2,
    };

    const mat2 = {
      ...createMockDisposable(() => disposedMaterials++),
      roughnessMap: tex3,
    };

    const scene: DisposableViewNode = {
      type: "Scene",
      children: [
        {
          type: "Mesh",
          geometry: geom1,
          material: mat1,
        },
        {
          type: "Group",
          children: [
            {
              type: "Mesh",
              geometry: geom2,
              material: [mat2], // multi-material array
            },
          ],
        },
      ],
    };

    const stats = disposeSceneGraph(scene);

    expect(stats.disposedGeometries).toBe(2);
    expect(stats.disposedMaterials).toBe(2);
    expect(stats.disposedTextures).toBe(3);
    expect(disposedGeometries).toBe(2);
    expect(disposedMaterials).toBe(2);
    expect(disposedTextures).toBe(3);
  });
});

describe("Mount/unmount lifecycle baseline guarantees", () => {
  test("mounting and unmounting a runtime fixture 100 times leaves all counters at baseline", () => {
    lifecycleDiagnostics.reset();
    expect(lifecycleDiagnostics.snapshot()).toEqual({
      liveWorkers: 0,
      activeWebGLContexts: 0,
      createdWebGLContexts: 0,
      lostWebGLContexts: 0,
      disposedWebGLContexts: 0,
      trackedListeners: 0,
      animationFrames: 0,
      activeObservers: 0,
      liveBufferBytes: 0,
      pooledBufferBytes: 0,
      suspendedLaboratories: 0,
    });

    for (let i = 0; i < 100; i++) {
      const lab = new HeavyFixtureLaboratory({
        id: `mount-test-lab-${i}`,
        particleCount: 50,
      });

      lab.mount();
      expect(lab.isMounted).toBe(true);
      expect(lifecycleDiagnostics.liveWorkers).toBe(1);
      expect(lifecycleDiagnostics.activeWebGLContexts).toBe(1);

      lab.step(2);
      lab.unmount();
      expect(lab.isMounted).toBe(false);
    }

    // After 100 mount/unmount iterations, all active counters must return to baseline 0
    lifecycleDiagnostics.assertBaseline();

    const snapshot = lifecycleDiagnostics.snapshot();
    expect(snapshot.liveWorkers).toBe(0);
    expect(snapshot.activeWebGLContexts).toBe(0);
    expect(snapshot.trackedListeners).toBe(0);
    expect(snapshot.animationFrames).toBe(0);
    expect(snapshot.activeObservers).toBe(0);
    expect(snapshot.liveBufferBytes).toBe(0);
    expect(snapshot.createdWebGLContexts).toBe(100);
    expect(snapshot.disposedWebGLContexts).toBe(100);
  });
});
