import * as V from './vectorMaths';
import { Vector2 } from './vectorMaths';

export function interpolatePosition(
  pos: Vector2,
  vel: Vector2,
  lerp: number
): Vector2 {
  return V.add(pos, V.multiply(vel, lerp));
}
