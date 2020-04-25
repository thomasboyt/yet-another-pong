import { Component } from '../ecs';

export class Ball extends Component {
  $tag!: 'ball';
}

export function createBall(): Ball {
  return new Ball();
}
