/**
 * Backlog #446 (style frames, throwaway): the finished look's light, as a
 * material plugin in the same slot the toon plugin uses. The base colour
 * (texture times vertex colour times diffuse) is lit by a hemisphere fill
 * (sky above, a warm or plum bounce below, so a shadow has a hue rather than
 * grey), plus the sun through the take's ramp (stepped, or blended for the
 * painterly takes) times the shadow map, plus up to three warm point glows
 * (fire, lamp, candles) with a soft falloff, banded in the papercraft take.
 * `emit` adds the base colour unlit: a flame, the sky in a window, a
 * lampshade lit from inside.
 */

import type { Material } from '@babylonjs/core/Materials/material';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';

export interface StyleLight {
  toLight: [number, number, number];
  sun: [number, number, number];
  sky: [number, number, number];
  ground: [number, number, number];
  /** Position (Babylon frame) and reach, metres; colour times power. */
  glows: { at: [number, number, number, number]; colour: [number, number, number] }[];
}

const f = (v: number): string => v.toFixed(5);

function rampGlsl(levels: readonly number[], soft: number): string {
  const n = levels.length;
  const s = Math.max(soft, 0.02);
  const pick = levels
    .slice(0, -1)
    .map((l, i) => `if (i < ${f(i + 0.5)}) return ${f(l)};`)
    .join(' ');
  return `
    float styleLevel(float i) { ${pick} return ${f(levels[n - 1] ?? 1)}; }
    float styleRamp(float ndl) {
      float x = clamp((ndl * 0.5 + 0.5) * ${f(n)} - 0.5, 0.0, ${f(n - 1)});
      float i = floor(x);
      float t = smoothstep(${f(0.5 - s / 2)}, ${f(0.5 + s / 2)}, x - i);
      return mix(styleLevel(i), styleLevel(min(i + 1.0, ${f(n - 1)})), t);
    }`;
}

/** Babylon's base constructor asks for the shader code before a subclass's fields exist, so the options wait here. */
let pending: StyleOptions = { ramp: [1], soft: 0, banded: false };

class StylePlugin extends MaterialPluginBase {
  private opts: StyleOptions | undefined;
  constructor(
    material: Material,
    private readonly light: StyleLight,
    options: StyleOptions,
  ) {
    pending = options;
    super(material, 'Style446', 200, { STYLE446: false }, true, true);
    this.opts = options;
  }

  private get lit(): number {
    return this.opts?.lit ?? 1;
  }

  private get emit(): number {
    return this.opts?.emit ?? 0;
  }

  override getClassName(): string {
    return 'Style446Plugin';
  }

  override prepareDefines(defines: MaterialDefines): void {
    defines.STYLE446 = true;
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    fragment: string;
  } {
    const names = [
      ['sToLight', 3, 'vec3'],
      ['sSun', 3, 'vec3'],
      ['sSky', 3, 'vec3'],
      ['sGround', 3, 'vec3'],
      ['sG0', 4, 'vec4'],
      ['sG0c', 3, 'vec3'],
      ['sG1', 4, 'vec4'],
      ['sG1c', 3, 'vec3'],
      ['sG2', 4, 'vec4'],
      ['sG2c', 3, 'vec3'],
      ['sLitEmit', 2, 'vec2'],
    ] as const;
    return {
      ubo: names.map(([name, size, type]) => ({ name, size, type })),
      fragment: names.map(([name, , type]) => `uniform ${type} ${name};`).join('\n'),
    };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    const { light } = this;
    ubo.updateFloat3('sToLight', ...light.toLight);
    ubo.updateFloat3('sSun', ...light.sun);
    ubo.updateFloat3('sSky', ...light.sky);
    ubo.updateFloat3('sGround', ...light.ground);
    for (let i = 0; i < 3; i++) {
      const g = light.glows[i] ?? { at: [0, -100, 0, 0.001], colour: [0, 0, 0] };
      ubo.updateFloat4(`sG${String(i)}`, ...g.at);
      ubo.updateFloat3(`sG${String(i)}c`, ...g.colour);
    }
    ubo.updateFloat2('sLitEmit', this.lit, this.emit);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== 'fragment') return null;
    const o = this.opts ?? pending;
    const band = o.banded ? 'fall = floor(fall * 6.0 + 0.5) / 6.0;' : '';
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `${rampGlsl(o.ramp, o.soft)}
        vec3 styleGlow(vec4 g, vec3 c, vec3 n, vec3 p) {
          vec3 d = g.xyz - p;
          float dist = length(d);
          float fall = clamp(1.0 - dist / g.w, 0.0, 1.0);
          fall = fall * fall;
          ${band}
          float face = clamp(dot(n, d / max(dist, 0.001)) * 0.6 + 0.4, 0.0, 1.0);
          return c * fall * face;
        }`,
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        vec3 sN = normalize(normalW);
        vec3 sFill = mix(sGround, sSky, sN.y * 0.5 + 0.5) * mix(0.75, 1.0, shadow);
        vec3 sLight = sFill + sSun * styleRamp(dot(sN, sToLight)) * shadow;
        sLight += styleGlow(sG0, sG0c, sN, vPositionW);
        sLight += styleGlow(sG1, sG1c, sN, vPositionW);
        sLight += styleGlow(sG2, sG2c, sN, vPositionW);
        color.rgb = baseColor.rgb * diffuseColor * (sLight * sLitEmit.x + sLitEmit.y);`,
    };
  }
}

export interface StyleOptions {
  readonly ramp: readonly number[];
  readonly soft: number;
  readonly banded: boolean;
  /** 1 lit, 0 unlit. */
  readonly lit?: number;
  /** The base colour added unlit. */
  readonly emit?: number;
}

export function styleLit(material: Material, light: StyleLight, o: StyleOptions): void {
  new StylePlugin(material, light, o);
}
