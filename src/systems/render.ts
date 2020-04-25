import { Entity } from '../ecs';
import { PongWorld } from '../Game';
import { RectangleShape } from '../components/RectangleShape';
import { Position } from '../components/Position';
import { interpolatePosition } from '../util/interpolatePosition';
import { Velocity } from '../components/Velocity';
import { Paddle } from '../components/Paddle';
import { Ball } from '../components/Ball';

export function render(
  world: PongWorld,
  ctx: CanvasRenderingContext2D,
  lerp: number
): void {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = 'white';

  function drawPaddles(paddle: Entity[]): void {
    paddle.forEach((entity) => {
      const { w, h } = world.get(entity, RectangleShape);
      const { x: cx, y: cy } = interpolatePosition(
        world.get(entity, Position),
        world.get(entity, Velocity),
        lerp
      );
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    });
  }

  function drawBall(ball: Entity): void {
    const { w } = world.get(ball, RectangleShape);
    const { x: cx, y: cy } = interpolatePosition(
      world.get(ball, Position),
      world.get(ball, Velocity),
      lerp
    );
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawScores(leftScore: number, rightScore: number): void {
    ctx.textAlign = 'center';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`${leftScore}`, 40, 24);
    ctx.fillText(`${rightScore}`, 280, 20);
  }

  drawPaddles(world.find(Paddle));
  drawBall(world.find(Ball)[0]);
  const state = world.getState();
  drawScores(state.leftScore, state.rightScore);
}
