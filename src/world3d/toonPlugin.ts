/**
 * The stepped light ramp on a StandardMaterial, as a material plugin. The
 * plugin is chosen over a ramp texture because StandardMaterial has no
 * gradient-map slot, and over a custom material because a plugin leaves the
 * material's vertex colours, thin instances and receive-shadows path as they
 * are. It replaces only the last step of the lit colour: the base colour
 * (palette wash or vertex colour) times the ramp's level for N.L (signed,
 * which Babylon's own diffuse term clamps away) times the shadow map's
 * factor, so the cast shadows still darken by SHADOW_ALPHA. The ramp is
 * `src/viewer/toon.ts`'s, as GLSL from `toonLevelGlsl`. The world has one
 * directional light and no ambient fill: the ramp's darkest level is the fill.
 */

import type { Material } from '@babylonjs/core/Materials/material';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';
import type { Vec3 } from './meshes';
import { toonLevelGlsl } from './toon';

const UNIFORM = 'vToonToLight';

class ToonPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private readonly toLight: Vec3,
  ) {
    super(material, 'Toon', 200, { TOON: false }, true, true);
  }

  override getClassName(): string {
    return 'ToonPlugin';
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines.TOON = true;
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    fragment: string;
  } {
    return {
      ubo: [{ name: UNIFORM, size: 3, type: 'vec3' }],
      fragment: `uniform vec3 ${UNIFORM};`,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat3(UNIFORM, this.toLight.x, this.toLight.y, this.toLight.z);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: toonLevelGlsl(),
      CUSTOM_FRAGMENT_BEFORE_FOG: `color.rgb = baseColor.rgb * diffuseColor * toonLevel(dot(normalW, ${UNIFORM})) * shadow;`,
    };
  }
}

/** Lights `material` through the ramp; `toLight` is the unit vector toward the sun in Babylon's frame. */
export function toonLit(material: Material, toLight: Vec3): void {
  new ToonPlugin(material, toLight);
}
