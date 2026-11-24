/**
 * The world's light on a StandardMaterial, as a material plugin. The plugin is
 * chosen over a ramp texture because StandardMaterial has no gradient-map
 * slot, and over a custom material because a plugin leaves the material's
 * vertex colours, thin instances and receive-shadows path as they are. It
 * replaces only the last step of the lit colour: the base colour (palette wash,
 * texture or vertex colour) times a hemisphere fill (the ground's colour below,
 * the sky's above, so a shadow has a hue; dimmer in cast shadow) plus the sun
 * through the soft ramp of `look.ts` for the signed N.L (which Babylon's own
 * diffuse term clamps away) times the shadow map's factor. The world has one
 * directional light; the fill stands in for the rest of the sky and the room.
 */

import type { Material } from '@babylonjs/core/Materials/material';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import { LOOK, lookLight, rampGlsl } from './look';
import type { Vec3 } from './meshes';

const UNIFORMS = ['vLookToLight', 'vLookSun', 'vLookSky', 'vLookGround'] as const;

class LookPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly toLight: Vec3,
  ) {
    super(material, 'Look', 200, { LOOK: false }, true, true);
  }

  override getClassName(): string {
    return 'LookPlugin';
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines.LOOK = true;
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    fragment: string;
  } {
    return {
      ubo: UNIFORMS.map((name) => ({ name, size: 3, type: 'vec3' })),
      fragment: UNIFORMS.map((name) => `uniform vec3 ${name};`).join('\n'),
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    const { sun, sky, ground } = lookLight();
    uniformBuffer.updateFloat3('vLookToLight', this.toLight.x, this.toLight.y, this.toLight.z);
    uniformBuffer.updateFloat3('vLookSun', ...sun);
    uniformBuffer.updateFloat3('vLookSky', ...sky);
    uniformBuffer.updateFloat3('vLookGround', ...ground);
  }

  /** Called by the base constructor before this class's fields exist, so it reads only the look's constants. */
  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: rampGlsl(),
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        vec3 lookN = normalize(normalW);
        vec3 lookFill = mix(vLookGround, vLookSky, lookN.y * 0.5 + 0.5) * mix(${LOOK.shadowFill.toFixed(5)}, 1.0, shadow);
        color.rgb = baseColor.rgb * diffuseColor * (lookFill + vLookSun * lookRamp(dot(lookN, vLookToLight)) * shadow);`,
    };
  }
}

/** Lights `material` with the look; `toLight` is the unit vector toward the sun in Babylon's frame. */
export function lookLit(material: Material, toLight: Vec3): void {
  new LookPlugin(material, toLight);
}
