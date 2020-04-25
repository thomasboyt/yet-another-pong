import { Component } from '../ecs';

export class Paddle extends Component {
  $tag!: 'paddle';
  side: 'left' | 'right' = 'left';
}

export function createPaddle(side: 'left' | 'right'): Paddle {
  const p = new Paddle();
  p.side = side;
  return p;
}
