import { describe, expect, it } from 'vitest';
import { createTree } from '../sim/tree';
import type { BonsaiTree } from '../sim/types';
import { treeArt } from './treeArt';

const tree = (over: Partial<BonsaiTree> = {}): BonsaiTree => ({
  ...createTree('juniper', 'cutting', 0),
  ...over,
});

describe('tree art (obj_tree_sprite Draw_0)', () => {
  it("is the prototype's 48 px sprite halved at 24 px, its pot's base on the anchor", () => {
    const a = treeArt(tree(), 'summer', 100, 200, 24);
    expect(a.scale).toBe(0.5);
    // The centre origin sits 18 prototype px above the pot's base.
    expect(a.outline.points.map((p) => [p.x, p.y])).toEqual([
      [95, 195],
      [105, 195],
      [104, 200],
      [96, 200],
    ]);
    expect(a.rim.rect).toEqual({ x: 94.5, y: 194.5, w: 11, h: 1.5 });
    expect(a.trunk.rect).toEqual({ x: 99, y: 187, w: 2, h: 8 });
    expect(a.shadow).toEqual({ x: 100, y: 200.25, w: 16, h: 2.5, alpha: 0.25 });
    expect(a.canopy?.circles).toEqual([
      { x: 96.5, y: 187, r: 4 },
      { x: 103, y: 188, r: 4 },
      { x: 100, y: 184, r: 4 },
    ]);
    expect(a.labelY).toBe(180);
  });

  it('scales with the sprite size', () => {
    const a = treeArt(tree(), 'summer', 0, 0, 48);
    expect(a.scale).toBe(1);
    expect(a.trunk.rect).toEqual({ x: -2, y: -26, w: 4, h: 16 });
    expect(a.labelY).toBe(-40);
  });

  it('draws the standard pot in terracotta: no feet, no sheen, the body shading to the outline colour', () => {
    const a = treeArt(tree(), 'summer', 0, 0, 48);
    expect(a.feet).toEqual([]);
    expect(a.sheen).toBeUndefined();
    expect([a.rim.fill, a.rim.line, a.outline.colour]).toEqual([0xaa6941, 0x55321e, 0x55321e]);
    expect(a.body).toHaveLength(10);
    expect(a.body[0]?.colour).toBe(0x935836);
    expect(a.body[9]?.colour).toBe(0x58341f);
    expect(a.body[0]?.points.map((p) => p.x)).toEqual([-10, 10, 9.8, -9.8]);
  });

  it('draws the fancy pot in celadon with its two feet and the glaze sheen', () => {
    const a = treeArt(tree({ potTier: 1 }), 'summer', 0, 0, 48);
    expect(a.feet).toEqual([
      { x: -8, y: -1, w: 4, h: 4 },
      { x: 4, y: -1, w: 4, h: 4 },
    ]);
    expect(a.feetColour).toBe(0x234644);
    expect(a.sheen).toEqual({ rect: { x: -8, y: -8, w: 2, h: 7 }, colour: 0x96c8be });
    expect(a.rim.fill).toBe(0x5f968c);
  });

  it("fills the leaves in the species' seasonal colour, outlined 50 a channel darker", () => {
    expect(treeArt(tree(), 'spring', 0, 0, 24).canopy).toMatchObject({
      fill: 0x5c7d4f,
      line: 0x2a4b1d,
    });
    expect(treeArt(tree(), 'summer', 0, 0, 24).canopy?.fill).toBe(0x4a6741);
    const maple = tree({ speciesKey: 'maple' });
    expect(treeArt(maple, 'autumn', 0, 0, 24).canopy).toMatchObject({
      fill: 0xb33a2a,
      line: 0x810800,
    });
    // A deciduous maple drops its leaves in winter, as in the 3D viewer.
    expect(treeArt(maple, 'winter', 0, 0, 24).canopy).toBeUndefined();
  });

  it("draws the trunk in the species' sprite colour, the juniper's being Draw_0's rgb(75, 50, 30)", () => {
    const trunk = (speciesKey: BonsaiTree['speciesKey']): number =>
      treeArt(tree({ speciesKey }), 'summer', 0, 0, 24).trunk.colour;
    expect(trunk('juniper')).toBe(0x4b321e);
    expect(trunk('maple')).toBe(0x5a5650);
    expect(trunk('pine')).toBe(0x32221a);
  });
});
