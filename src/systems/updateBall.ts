import { Paddle } from '../components/Paddle';
import { Position, createPosition } from '../components/Position';
import { Velocity, createVelocity } from '../components/Velocity';
import { Ball } from '../components/Ball';
import { RectangleShape } from '../components/RectangleShape';

import { PongWorld } from '../Game';
import * as V from '../util/vectorMaths';
import { aabbTest } from '../util/aabbTest';
import { BALL_SPEED, GAME_HEIGHT, GAME_WIDTH } from '../constants';

export function updateBall(world: PongWorld, dt: number): void {
  const paddles = world.find(Paddle);
  const ball = world.find(Ball)[0];

  const originalPosition = world.get(ball, Position);
  let newPosition = V.add(
    originalPosition,
    V.multiply(world.get(ball, Velocity), dt)
  );

  const paddleRects = paddles
    .map((paddle): [Position, RectangleShape] => [
      world.get(paddle, Position),
      world.get(paddle, RectangleShape),
    ])
    .map(([pos, rect]) => ({
      pos,
      x: pos.x - rect.w / 2,
      y: pos.y - rect.h / 2,
      w: rect.w,
      h: rect.h,
    }));

  const ballRadius = world.get(ball, RectangleShape).w / 2;
  const ballRect = {
    x: newPosition.x - ballRadius,
    y: newPosition.y - ballRadius,
    w: ballRadius * 2,
    h: ballRadius * 2,
  };

  paddleRects.forEach((paddleRect) => {
    if (aabbTest(ballRect, paddleRect)) {
      // first revert to old position
      newPosition = originalPosition;

      // then set new movement vector to bounce back...
      const velVector = V.unit(V.subtract(newPosition, paddleRect.pos));
      world.replace(
        ball,
        Velocity,
        createVelocity(V.multiply(velVector, BALL_SPEED))
      );
    }
  });

  // reflect off top/bottom edges of screen
  if (ballRect.y < 0) {
    world.replace(
      ball,
      Velocity,
      createVelocity(V.reflect(world.get(ball, Velocity), { x: 0, y: 1 }))
    );
  } else if (ballRect.y + ballRect.h > GAME_HEIGHT) {
    world.replace(
      ball,
      Velocity,
      createVelocity(V.reflect(world.get(ball, Velocity), { x: 0, y: -1 }))
    );
  }

  world.replace(ball, Position, createPosition(newPosition));

  if (ballRect.x < 0) {
    world.updateState((state) => {
      state.rightScore += 1;
    });
    world.replace(ball, Position, createPosition({ x: 100, y: 120 }));
    world.replace(ball, Velocity, createVelocity({ x: -BALL_SPEED, y: 0 }));
  } else if (ballRect.x > GAME_WIDTH) {
    world.updateState((state) => {
      state.leftScore += 1;
    });
    world.replace(ball, Position, createPosition({ x: 220, y: 120 }));
    world.replace(ball, Velocity, createVelocity({ x: -BALL_SPEED, y: 0 }));
  }
}
