import {
  Telegraph,
  PlayerType,
  TelegraphEvent,
  SaveResult,
  SyncInputResultValue,
  AddLocalInputResult,
} from '@tboyt/telegraph';
import Peer from 'peerjs';
import { World, Snapshot } from './ecs';
import { GAME_WIDTH, GAME_HEIGHT, BALL_SPEED } from './constants';
import { Inputter } from './util/Inputter';
import { updateStatus, renderCrashError } from './util/renderDebugInfo';
import { hash } from './util/hash';

import { update } from './systems/update';
import { render } from './systems/render';
import { createPosition } from './components/Position';
import { createVelocity } from './components/Velocity';
import { createBall } from './components/Ball';
import { createPaddle } from './components/Paddle';
import { createRectangleShape } from './components/RectangleShape';

const FIXED_STEP = 1000 / 60;

export interface PongState {
  leftScore: 0;
  rightScore: 0;
}

export class PongWorld extends World<PongState> {
  // TODO: I don't know how I feel about extending World {}, probably should
  // have a wrapper of some sort instead, or just add this state to the normal
  // world.state and make the onSave/onLoad callback responsible for ignoring
  // it(?)
  unsyncedState = {
    localPlayerHandle: -1,
    remotePlayerHandle: -1,
  };
}

export class Game {
  private frameCount = 0;
  private stopped = false;
  private telegraph: Telegraph<string>;
  private ctx!: CanvasRenderingContext2D;
  private inputter = new Inputter();
  private world: PongWorld;

  constructor(peer: Peer, remotePeerId: string, localPlayerNumber: number) {
    this.createCanvas();
    this.inputter.bind(this.ctx.canvas);

    this.world = new PongWorld({
      leftScore: 0,
      rightScore: 0,
    });

    const leftPaddle = this.world.create();
    this.world.add(leftPaddle, createPaddle('left'));
    this.world.add(leftPaddle, createPosition({ x: 30, y: 120 }));
    this.world.add(leftPaddle, createVelocity({ x: 0, y: 0 }));
    this.world.add(leftPaddle, createRectangleShape(10, 40));

    const rightPaddle = this.world.create();
    this.world.add(rightPaddle, createPaddle('right'));
    this.world.add(rightPaddle, createPosition({ x: 270, y: 120 }));
    this.world.add(rightPaddle, createVelocity({ x: 0, y: 0 }));
    this.world.add(rightPaddle, createRectangleShape(10, 40));

    const ball = this.world.create();
    this.world.add(ball, createBall());
    this.world.add(ball, createPosition({ x: 160, y: 120 }));
    this.world.add(ball, createVelocity({ x: BALL_SPEED, y: 0 }));
    this.world.add(ball, createRectangleShape(16, 16));

    this.telegraph = new Telegraph({
      peer,
      disconnectNotifyStart: 1000,
      disconnectTimeout: 3000,
      numPlayers: 2,

      callbacks: {
        onAdvanceFrame: (): void => this.runRollbackUpdate(),
        onLoadState: (snapshot): void => {
          this.world.loadSnapshot(snapshot);
        },
        onSaveState: (): SaveResult<Snapshot<PongState>> => {
          return {
            state: this.world.snapshot(),
            checksum: null,
          };
        },
        onEvent: (evt: TelegraphEvent): void => {
          console.log('[Telegraph]', evt.type);
          if (evt.type === 'running' || evt.type === 'connectionResumed') {
            updateStatus({ state: 'running' });
          } else if (evt.type === 'connected') {
            this.world.unsyncedState.remotePlayerHandle =
              evt.connected.playerHandle;
          } else if (evt.type === 'connectionInterrupted') {
            updateStatus({ state: 'interrupted' });
          } else if (evt.type === 'disconnected') {
            updateStatus({ state: 'disconnected' });
          }
        },
      },
    });

    this.world.unsyncedState.localPlayerHandle = this.telegraph.addPlayer({
      playerNumber: localPlayerNumber,
      type: PlayerType.local,
    }).value!;

    this.telegraph.setFrameDelay(this.world.unsyncedState.localPlayerHandle, 2);

    this.telegraph.addPlayer({
      playerNumber: localPlayerNumber === 1 ? 2 : 1,
      type: PlayerType.remote,
      remote: {
        peerId: remotePeerId,
      },
    });
  }

  private createCanvas(): void {
    // Initialize canvas
    const canvas = document.querySelector('canvas');

    if (!canvas) {
      throw new Error('failed to find canvas on page');
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    if (!this.ctx) {
      throw new Error('failed to create 2d context');
    }
  }

  private advanceFrame({ inputs }: SyncInputResultValue): void {
    update(this.world, FIXED_STEP, inputs);
    this.telegraph.advanceFrame();
  }

  private runRollbackUpdate(): void {
    const inputResult = this.telegraph.syncInput();
    if (!inputResult.value) {
      throw new Error(
        `rollback failure: missing input, code ${inputResult.code}`
      );
    }
    console.log('rollback input', inputResult.value.inputs);
    this.advanceFrame(inputResult.value);
  }

  private runFixedUpdate(): void {
    let didAdvance = false;

    const addLocalInputResult = this.readInput();

    if (!addLocalInputResult || addLocalInputResult.code === 'ok') {
      const inputResult = this.telegraph.syncInput();
      if (inputResult.code === 'ok') {
        this.advanceFrame(inputResult.value!);
        didAdvance = true;
      } else {
        console.log('[Game] non-ok result for syncInput:', inputResult.code);
      }
    }

    this.telegraph.afterTick();

    if (didAdvance) {
      this.frameCount += 1;
      if (this.frameCount % 60 === 0) {
        this.updateStats();
      }
    }
  }

  readInput(): AddLocalInputResult | null {
    if (this.world.unsyncedState.localPlayerHandle === null) {
      return null;
    }

    const localInputs = this.inputter.getInputState();
    return this.telegraph.addLocalInput(
      this.world.unsyncedState.localPlayerHandle,
      localInputs
    );
  }

  updateStats(): void {
    const checksum = hash(JSON.stringify(this.world.snapshot()));
    console.log('frame', this.frameCount, checksum);

    const remotePlayerHandle = this.world.unsyncedState.remotePlayerHandle;
    if (remotePlayerHandle !== null) {
      const stats = this.telegraph.getNetworkStats(remotePlayerHandle).value!;
      updateStatus({
        frame: this.frameCount,
        checksum: checksum,
        ping: Math.floor(stats.ping),
        sendQueueLength: stats.sendQueueLength,
      });
    }
  }

  // game loop. see:
  // - https://gist.github.com/godwhoa/e6225ae99853aac1f633
  // - http://gameprogrammingpatterns.com/game-loop.html
  run(): void {
    if (this.stopped) {
      // stop run loop
      return;
    }

    let lastTime = performance.now();
    let lag = 0;

    /**
     * The "real" (RAF-bound) run loop.
     */
    const loop = (): void => {
      // Compute delta and elapsed time
      const time = performance.now();
      const delta = time - lastTime;

      if (delta > 1000) {
        // TODO: if this happens... might have other options? idk
        throw new Error('unrecoverable time delta');
      }
      lag += delta;

      while (lag >= FIXED_STEP) {
        this.runFixedUpdate();
        lag -= FIXED_STEP;
      }

      const lagOffset = lag / FIXED_STEP;
      render(this.world, this.ctx, lagOffset);

      lastTime = time;
      requestAnimationFrame(loop);
    };

    loop();
  }

  stop(): void {
    this.stopped = true;
  }
}

export function createGame(
  peer: Peer,
  remotePeerId: string,
  localPlayerNumber: number
): void {
  const game = new Game(peer, remotePeerId, localPlayerNumber);
  game.run();

  window.onerror = (err): void => {
    console.error('Stopping game!');
    game.stop();
    peer.destroy();

    if (err instanceof Event) {
      renderCrashError((err as ErrorEvent).error || '(unknown)');
    } else {
      renderCrashError(err);
    }
  };
}
