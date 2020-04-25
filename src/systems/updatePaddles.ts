import { InputValues } from '@tboyt/telegraph';
import { keyCodes } from '../util/keyCodes';
import { PongWorld } from '../Game';
import { Paddle } from '../components/Paddle';
import { Velocity } from '../components/Velocity';
import { Entity } from '../ecs';
import { PADDLE_SPEED } from '../constants';
import { Position } from '../components/Position';
import * as V from '../util/vectorMaths';

function updateVector(newVec: V.Vector2): (oldVec: V.Vector2) => void {
  return (oldVec: V.Vector2): void => {
    oldVec.x = newVec.x;
    oldVec.y = newVec.y;
  };
}

export function updatePaddles(
  world: PongWorld,
  dt: number,
  inputs: InputValues[]
): void {
  // TODO: store player handles instead of assuming here?
  const p1i = inputs[0];
  const p2i = inputs[1];

  // TODO: this feels like an odd way to do this
  // could use empty tag components instead? LeftPaddle/RightPaddle?
  const paddles = world.find(Paddle);
  let leftPaddle: Entity | undefined;
  let rightPaddle: Entity | undefined;
  for (const entity of paddles) {
    const side = world.get(entity, Paddle).side;
    if (side === 'left') {
      leftPaddle = entity;
    } else if (side === 'right') {
      rightPaddle = entity;
    }
  }

  if (!leftPaddle) {
    throw new Error('missing left paddle');
  }
  if (!rightPaddle) {
    throw new Error('missing right paddle');
  }

  const updatePaddle = (input: InputValues, v: Velocity): void => {
    if (input.includes(keyCodes.upArrow)) {
      v.y = -PADDLE_SPEED;
    } else if (input.includes(keyCodes.downArrow)) {
      v.y = PADDLE_SPEED;
    } else {
      v.y = 0;
    }
  };

  world.patch(leftPaddle, Velocity, (v) => updatePaddle(p1i, v));
  world.patch(rightPaddle, Velocity, (v) => updatePaddle(p2i, v));

  for (const paddle of paddles) {
    const originalPosition = world.get(paddle, Position);
    const newPosition = V.add(
      originalPosition,
      V.multiply(world.get(paddle, Velocity), dt)
    );
    // TODO: this causes it to get replaced every frame which is wasteful given
    // how immer works. maybe a new function could be created instead
    world.patch(paddle, Position, updateVector(newPosition));
  }
}
