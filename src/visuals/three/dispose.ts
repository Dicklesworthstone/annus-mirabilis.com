/**
 * Annus Mirabilis: Three.js Scene Graph Disposal Traversal
 *
 * Implements AGENTS.md "Worker behavior, memory, and lifecycle":
 * - Dispose of Three.js geometries, materials, textures, render targets, controls,
 *   subscriptions, and workers when their owners end.
 * - Testable without a WebGL context via structural typing.
 */

export interface Disposable {
  dispose(): void;
}

export interface DisposableViewNode {
  type?: string;
  geometry?: Disposable | null;
  material?: Disposable | Disposable[] | null;
  children?: DisposableViewNode[];
  parent?: DisposableViewNode | null;
  clear?(): void;
  remove?(...children: DisposableViewNode[]): void;
  [key: string]: unknown;
}

export interface DisposalStats {
  disposedGeometries: number;
  disposedMaterials: number;
  disposedTextures: number;
  nodesTraversed: number;
}

/**
 * Disposes a material and any textures attached to its standard map slots.
 */
export function disposeMaterial(
  mat: unknown,
  visitedTextures = new Set<unknown>(),
): { disposedMaterials: number; disposedTextures: number } {
  if (!mat || typeof mat !== "object") {
    return { disposedMaterials: 0, disposedTextures: 0 };
  }

  let disposedMaterials = 0;
  let disposedTextures = 0;

  // If array of materials (multi-material mesh)
  if (Array.isArray(mat)) {
    for (const m of mat) {
      const sub = disposeMaterial(m, visitedTextures);
      disposedMaterials += sub.disposedMaterials;
      disposedTextures += sub.disposedTextures;
    }
    return { disposedMaterials, disposedTextures };
  }

  const matObj = mat as Record<string, unknown> & Disposable;

  // Scan common Three.js texture slots
  const textureSlots = [
    "map",
    "alphaMap",
    "aoMap",
    "bumpMap",
    "displacementMap",
    "emissiveMap",
    "envMap",
    "gradientMap",
    "lightMap",
    "metalnessMap",
    "normalMap",
    "roughnessMap",
    "specularMap",
  ];

  for (const slot of textureSlots) {
    const tex = matObj[slot];
    if (tex && typeof tex === "object" && "dispose" in tex && !visitedTextures.has(tex)) {
      visitedTextures.add(tex);
      try {
        (tex as Disposable).dispose();
        disposedTextures++;
      } catch {}
    }
  }

  if (typeof matObj.dispose === "function") {
    matObj.dispose();
    disposedMaterials++;
  }

  return { disposedMaterials, disposedTextures };
}

/**
 * Traverses an entire Three.js scene graph, recursively disposing geometries,
 * materials, and textures without requiring a live WebGL context.
 */
export function disposeSceneGraph(root: unknown): DisposalStats {
  const stats: DisposalStats = {
    disposedGeometries: 0,
    disposedMaterials: 0,
    disposedTextures: 0,
    nodesTraversed: 0,
  };

  if (!root || typeof root !== "object") return stats;

  const visitedGeometries = new Set<unknown>();
  const visitedMaterials = new Set<unknown>();
  const visitedTextures = new Set<unknown>();

  function traverse(node: unknown): void {
    if (!node || typeof node !== "object") return;
    stats.nodesTraversed++;

    const n = node as DisposableViewNode;

    // Dispose Geometry
    if (n.geometry && typeof n.geometry === "object" && typeof n.geometry.dispose === "function") {
      if (!visitedGeometries.has(n.geometry)) {
        visitedGeometries.add(n.geometry);
        n.geometry.dispose();
        stats.disposedGeometries++;
      }
    }

    // Dispose Material(s)
    if (n.material) {
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      for (const m of mats) {
        if (m && typeof m === "object" && !visitedMaterials.has(m)) {
          visitedMaterials.add(m);
          const res = disposeMaterial(m, visitedTextures);
          stats.disposedMaterials += res.disposedMaterials;
          stats.disposedTextures += res.disposedTextures;
        }
      }
    }

    // Traverse children
    if (Array.isArray(n.children)) {
      const childList = [...n.children];
      for (const child of childList) {
        traverse(child);
      }
      if (typeof n.clear === "function") {
        n.clear();
      } else {
        n.children.length = 0;
      }
    }
  }

  traverse(root);
  return stats;
}
