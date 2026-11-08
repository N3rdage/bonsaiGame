import Phaser from 'phaser';
import type { Season } from '../sim/seasons';
import type { BonsaiTree, GameState } from '../sim/types';
import { TreeViewer } from '../viewer/TreeViewer';
import { hudText } from '../world/hud';
import { fixedSteps, joystickInput, keyboardInput } from '../world/input';
import { createPlayer, stepPlayer, type MoveInput, type PlayerState } from '../world/player';
import { SHED_ROOM } from '../world/shedRoom';

/** What the boot scene hands the world. */
export interface WorldSceneData {
  readonly state: GameState;
  /** Tree the V key and the View button open: the starter, or a `?tree=` fixture. */
  readonly viewTree: BonsaiTree | undefined;
  /** Season the viewer draws foliage for. */
  readonly viewerSeason: Season;
  /** Hook fields fixed at boot. */
  readonly hookBase: Pick<
    BonsaiTestHook,
    'version' | 'season' | 'day' | 'trees' | 'starterScore' | 'starterHeightCm'
  >;
}

const PLAYER_W = 16;
const PLAYER_H = 24;
const LABEL_STYLE = { fontFamily: 'monospace', fontSize: '8px', color: '#d8e6c8' };

type MoveKeys = Record<
  'left' | 'right' | 'up' | 'down' | 'a' | 'd' | 'w' | 's',
  Phaser.Input.Keyboard.Key
>;

/**
 * The shed with placeholder art: floor, walls and labelled prop rectangles,
 * and the player as a rectangle depth-sorted by y against the props. Room data,
 * movement and the HUD text come from the pure modules in src/world/; this
 * scene only reads input, draws and publishes the test hook.
 *
 * The 3D viewer is a DOM canvas over this one. While it is open the world
 * ignores its own keys and pointers and does not step.
 */
export class WorldScene extends Phaser.Scene {
  private ctx!: WorldSceneData;
  private viewer!: TreeViewer;
  private keys!: MoveKeys;
  private player!: PlayerState;
  private playerRect!: Phaser.GameObjects.Rectangle;
  private hud!: Phaser.GameObjects.Text;
  private accumulatorMs = 0;
  private frames = 0;
  private joystick: { id: number; x: number; y: number; input: MoveInput } | undefined;

  constructor() {
    super('world');
  }

  create(data: WorldSceneData): void {
    this.ctx = data;
    this.accumulatorMs = 0;
    this.frames = 0;
    this.joystick = undefined;
    const room = SHED_ROOM;

    this.add.rectangle(0, 0, room.width, room.height, room.floor).setOrigin(0).setDepth(-1);
    for (const w of room.walls) {
      this.add.rectangle(w.x, w.y, w.w, w.h, 0x5b4a36).setOrigin(0).setDepth(-1);
    }
    for (const p of room.props) {
      const bottom = p.y + p.h / 2;
      this.add.rectangle(p.x, p.y, p.w, p.h, 0x7a6248).setStrokeStyle(1, 0xb39a74).setDepth(bottom);
      this.add.text(p.x, p.y, p.label, LABEL_STYLE).setOrigin(0.5).setDepth(bottom);
    }

    this.player = createPlayer(room);
    this.playerRect = this.add.rectangle(0, 0, PLAYER_W, PLAYER_H, 0xc9d8a8).setOrigin(0.5, 1);
    this.drawPlayer();

    this.hud = this.add
      .text(room.width - 8, 2, hudText(data.state), {
        ...LABEL_STYLE,
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(1, 0)
      .setDepth(10_000);
    const viewButton = this.add
      .text(6, room.height - 6, 'View tree (V)', { ...LABEL_STYLE, fontSize: '10px' })
      .setOrigin(0, 1)
      .setDepth(10_000)
      .setInteractive({ useHandCursor: true });
    viewButton.on('pointerup', () => {
      this.openViewer();
    });

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('WorldScene needs the keyboard plugin');
    const K = Phaser.Input.Keyboard.KeyCodes;
    // No capture: the viewer listens to the same keys on window while open.
    const key = (code: number): Phaser.Input.Keyboard.Key => keyboard.addKey(code, false);
    this.keys = {
      left: key(K.LEFT),
      right: key(K.RIGHT),
      up: key(K.UP),
      down: key(K.DOWN),
      a: key(K.A),
      d: key(K.D),
      w: key(K.W),
      s: key(K.S),
    };
    // A keydown event, not a polled key: a quick tap can go down and up within
    // one frame. While the viewer is open V is its View mode, so it is ignored here.
    keyboard.on('keydown-V', () => {
      this.openViewer();
    });

    this.input.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        if (this.viewer.isOpen || over.length > 0 || this.joystick) return;
        this.joystick = { id: pointer.id, x: pointer.x, y: pointer.y, input: { x: 0, y: 0 } };
      },
    );
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.joystick?.id) return;
      this.joystick.input = joystickInput(pointer.x - this.joystick.x, pointer.y - this.joystick.y);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.joystick?.id) this.joystick = undefined;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    this.viewer = new TreeViewer(document.body);
    this.viewer.onRender = this.publishHook;
    this.viewer.onClose = this.publishHook;
    this.events.once('shutdown', () => {
      this.viewer.destroy();
    });
    this.publishHook();
  }

  override update(_time: number, delta: number): void {
    const viewerOpen = this.viewer.isOpen;
    this.hud.setVisible(!viewerOpen);
    if (viewerOpen) {
      this.joystick = undefined;
      this.accumulatorMs = 0;
      return;
    }

    const { steps, accumulatorMs } = fixedSteps(this.accumulatorMs, delta);
    this.accumulatorMs = accumulatorMs;
    if (steps === 0) return;
    const input = this.joystick?.input ?? this.keyboardMove();
    for (let i = 0; i < steps; i += 1) {
      this.player = stepPlayer(this.player, input, SHED_ROOM);
      this.frames += 1;
    }
    this.drawPlayer();
    this.hud.setText(hudText(this.ctx.state));
    this.publishHook();
  }

  private keyboardMove(): MoveInput {
    const k = this.keys;
    return keyboardInput({
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      up: k.up.isDown || k.w.isDown,
      down: k.down.isDown || k.s.isDown,
    });
  }

  private drawPlayer(): void {
    this.playerRect.setPosition(this.player.x, this.player.y).setDepth(this.player.y);
  }

  private openViewer(): void {
    const { viewTree, viewerSeason, state } = this.ctx;
    if (!viewTree || this.viewer.isOpen) return;
    this.joystick = undefined;
    this.viewer.open(viewTree, viewerSeason, state);
    this.hud.setVisible(false);
    this.publishHook();
  }

  private readonly publishHook = (): void => {
    const { state, hookBase } = this.ctx;
    window.__bonsai = {
      ...hookBase,
      ready: true,
      scene: this.scene.key,
      // The game state's own flag, not the viewer's, so a test sees what the
      // simulation would see after the viewer has let go.
      paused: state.paused,
      viewer: this.viewer.snapshot(),
      room: SHED_ROOM.key,
      player: { x: this.player.x, y: this.player.y, facing: this.player.facing },
      hud: hudText(state),
      frames: this.frames,
    };
  };
}
