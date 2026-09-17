/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/types/three.d.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Ambient declarations for Three.js studio and visual foundation types.
 */

declare module "three" {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    addScaledVector(v: Vector3, s: number): this;
    distanceTo(v: Vector3): number;
    lengthSq(): number;
    applyQuaternion(q: unknown): this;
    setFromSpherical(s: Spherical): this;
  }

  export class Spherical {
    radius: number;
    phi: number;
    theta: number;
    constructor(radius?: number, phi?: number, theta?: number);
    set(radius: number, phi: number, theta: number): this;
    setFromVector3(v: Vector3): this;
    makeSafe(): this;
    clone(): Spherical;
    copy(s: Spherical): this;
  }

  export class Object3D {
    position: Vector3;
    scale: Vector3;
    rotation: { x: number; y: number; z: number };
    quaternion: unknown;
    children: Object3D[];
    geometry?: BufferGeometry;
    material?: Material | Material[];
    add(...object: Object3D[]): this;
    remove(...object: Object3D[]): this;
    lookAt(x: number | Vector3, y?: number, z?: number): void;
    traverse(callback: (object: Object3D) => void): void;
  }

  export class Camera extends Object3D {}

  export class PerspectiveCamera extends Camera {
    fov: number;
    aspect: number;
    near: number;
    far: number;
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    updateProjectionMatrix(): void;
  }

  export class Scene extends Object3D {
    fog: unknown;
    background: unknown;
    clear(): void;
  }

  export class Texture {
    dispose(): void;
    colorSpace?: unknown;
    wrapS?: unknown;
    wrapT?: unknown;
  }

  export class CanvasTexture extends Texture {
    needsUpdate: boolean;
    constructor(canvas: unknown);
  }

  export class Material {
    dispose(): void;
    opacity?: number;
    transparent?: boolean;
  }

  export class MeshLambertMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
  }

  export class ShadowMaterial extends Material {
    constructor(parameters?: Record<string, unknown>);
  }

  export class BufferGeometry {
    dispose(): void;
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
      phiStart?: number,
      phiLength?: number,
      thetaStart?: number,
      thetaLength?: number,
    );
  }

  export class CircleGeometry extends BufferGeometry {
    constructor(radius?: number, segments?: number, thetaStart?: number, thetaLength?: number);
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
    castShadow: boolean;
    receiveShadow: boolean;
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
  }

  export class Points extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
  }

  export class Line extends Object3D {
    geometry: BufferGeometry;
    material: Material | Material[];
  }

  export class Group extends Object3D {}

  export class GridHelper extends Object3D {
    constructor(size?: number, divisions?: number, color1?: unknown, color2?: unknown);
    material: Material;
  }

  export class Light extends Object3D {}

  export class DirectionalLight extends Light {
    castShadow: boolean;
    shadow: {
      mapSize: { width: number; height: number };
      camera: {
        near: number;
        far: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
      };
      bias: number;
    };
    constructor(color?: unknown, intensity?: number);
  }

  export class HemisphereLight extends Light {
    constructor(skyColor?: unknown, groundColor?: unknown, intensity?: number);
  }

  export class SpotLight extends Light {
    constructor(color?: unknown, intensity?: number);
  }

  export class FogExp2 {
    color: unknown;
    density: number;
    constructor(color: unknown, density?: number);
  }

  export class WebGLRenderer {
    domElement: HTMLCanvasElement;
    toneMapping: unknown;
    toneMappingExposure: number;
    outputColorSpace: unknown;
    shadowMap: { enabled: boolean; type: unknown };
    info: {
      memory: { geometries: number; textures: number };
      render: { calls: number; triangles: number; lines: number; points: number };
    };
    constructor(parameters?: Record<string, unknown>);
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setPixelRatio(pixelRatio: number): void;
    render(scene: Object3D, camera: Camera): void;
    dispose(): void;
    forceContextLoss(): void;
  }

  export const ACESFilmicToneMapping: unique symbol;
  export const PCFShadowMap: unique symbol;
  export const SRGBColorSpace: unique symbol;
  export const ClampToEdgeWrapping: unique symbol;
}
