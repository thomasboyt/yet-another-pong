import { InputValues } from '@tboyt/telegraph';
import { PongWorld } from '../Game';
import { updateBall } from './updateBall';
import { updatePaddles } from './updatePaddles';

export function update(
  world: PongWorld,
  dt: number,
  inputs: InputValues[]
): void {
  updatePaddles(world, dt, inputs);
  updateBall(world, dt);
}
