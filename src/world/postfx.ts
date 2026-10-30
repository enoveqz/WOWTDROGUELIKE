import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * Nachbearbeitung: Bloom (Magie, Kristalle, Lava leuchten), satte Farben,
 * leichte Vignette. Wird bei Qualität „Niedrig“ oder ausgeschaltetem Bloom
 * komplett umgangen.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSat: { value: 1.12 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.32 },
    uWarm: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat;
    uniform float uContrast;
    uniform float uVignette;
    uniform vec3 uWarm;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.18) * uContrast + 0.18;
      c.rgb *= uWarm;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.15, 1.0)));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      gl_FragColor = vec4(max(c.rgb, 0.0), c.a);
    }`,
};

export class PostFX {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private renderer: THREE.WebGLRenderer;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, size.x / 2), Math.max(1, size.y / 2)), 0.55, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GradeShader));
    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(Math.max(1, (w * pixelRatio) / 2), Math.max(1, (h * pixelRatio) / 2));
  }

  /** Stärke des Leuchtens je Szene (Vulkan etwas mehr, Schnee weniger). */
  setBloom(strength: number, threshold = 0.82): void {
    this.bloom.strength = strength;
    this.bloom.threshold = threshold;
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.enabled) {
      this.renderer.render(scene, camera);
      return;
    }
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
