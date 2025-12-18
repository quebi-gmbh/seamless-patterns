/**
 * Browser-compatible version adapted from SVGO plugins/applyTransforms.js
 * Applies transform matrices directly to path coordinates
 */

import type { PathDataItem } from './types';
import { transformArc } from './transforms';

/**
 * Transform a point using the full matrix (including translation).
 * Used for absolute coordinates.
 */
const transformAbsolutePoint = (
  matrix: readonly number[],
  x: number,
  y: number
): [number, number] => {
  const newX = matrix[0] * x + matrix[2] * y + matrix[4];
  const newY = matrix[1] * x + matrix[3] * y + matrix[5];
  return [newX, newY];
};

/**
 * Transform a point without translation.
 * Used for relative coordinates (offsets).
 */
const transformRelativePoint = (
  matrix: readonly number[],
  x: number,
  y: number
): [number, number] => {
  const newX = matrix[0] * x + matrix[2] * y;
  const newY = matrix[1] * x + matrix[3] * y;
  return [newX, newY];
};

/**
 * Apply a transformation matrix to path data in-place.
 * Modifies the pathData array directly.
 *
 * @param pathData - Array of path data items to transform
 * @param matrix - Transform matrix [a, b, c, d, e, f]
 */
export const applyMatrixToPathData = (
  pathData: PathDataItem[],
  matrix: readonly number[]
): void => {
  // Track cursor position for relative commands and arc transforms
  const start: [number, number] = [0, 0];
  const cursor: [number, number] = [0, 0];

  for (const pathItem of pathData) {
    let { command, args } = pathItem;

    // moveto (x y)
    if (command === 'M') {
      cursor[0] = args[0];
      cursor[1] = args[1];
      start[0] = cursor[0];
      start[1] = cursor[1];
      const [x, y] = transformAbsolutePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }
    if (command === 'm') {
      cursor[0] += args[0];
      cursor[1] += args[1];
      start[0] = cursor[0];
      start[1] = cursor[1];
      const [x, y] = transformRelativePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }

    // lineto (x y)
    if (command === 'L') {
      cursor[0] = args[0];
      cursor[1] = args[1];
      const [x, y] = transformAbsolutePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }
    if (command === 'l') {
      cursor[0] += args[0];
      cursor[1] += args[1];
      const [x, y] = transformRelativePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }

    // horizontal lineto (x) - convert to lineto since transforms can change direction
    if (command === 'H') {
      const prevY = cursor[1];
      cursor[0] = args[0];
      const [x, y] = transformAbsolutePoint(matrix, args[0], prevY);
      // Convert H to L since the transform may introduce a Y component
      pathItem.command = 'L';
      pathItem.args = [x, y];
    }
    if (command === 'h') {
      cursor[0] += args[0];
      const [x, y] = transformRelativePoint(matrix, args[0], 0);
      // Convert h to l
      pathItem.command = 'l';
      pathItem.args = [x, y];
    }

    // vertical lineto (y) - convert to lineto since transforms can change direction
    if (command === 'V') {
      cursor[1] = args[0];
      const [x, y] = transformAbsolutePoint(matrix, cursor[0], args[0]);
      // Convert V to L
      pathItem.command = 'L';
      pathItem.args = [x, y];
    }
    if (command === 'v') {
      cursor[1] += args[0];
      const [x, y] = transformRelativePoint(matrix, 0, args[0]);
      // Convert v to l
      pathItem.command = 'l';
      pathItem.args = [x, y];
    }

    // curveto (x1 y1 x2 y2 x y)
    if (command === 'C') {
      cursor[0] = args[4];
      cursor[1] = args[5];
      const [x1, y1] = transformAbsolutePoint(matrix, args[0], args[1]);
      const [x2, y2] = transformAbsolutePoint(matrix, args[2], args[3]);
      const [x, y] = transformAbsolutePoint(matrix, args[4], args[5]);
      args[0] = x1;
      args[1] = y1;
      args[2] = x2;
      args[3] = y2;
      args[4] = x;
      args[5] = y;
    }
    if (command === 'c') {
      cursor[0] += args[4];
      cursor[1] += args[5];
      const [x1, y1] = transformRelativePoint(matrix, args[0], args[1]);
      const [x2, y2] = transformRelativePoint(matrix, args[2], args[3]);
      const [x, y] = transformRelativePoint(matrix, args[4], args[5]);
      args[0] = x1;
      args[1] = y1;
      args[2] = x2;
      args[3] = y2;
      args[4] = x;
      args[5] = y;
    }

    // smooth curveto (x2 y2 x y)
    if (command === 'S') {
      cursor[0] = args[2];
      cursor[1] = args[3];
      const [x2, y2] = transformAbsolutePoint(matrix, args[0], args[1]);
      const [x, y] = transformAbsolutePoint(matrix, args[2], args[3]);
      args[0] = x2;
      args[1] = y2;
      args[2] = x;
      args[3] = y;
    }
    if (command === 's') {
      cursor[0] += args[2];
      cursor[1] += args[3];
      const [x2, y2] = transformRelativePoint(matrix, args[0], args[1]);
      const [x, y] = transformRelativePoint(matrix, args[2], args[3]);
      args[0] = x2;
      args[1] = y2;
      args[2] = x;
      args[3] = y;
    }

    // quadratic Bézier curveto (x1 y1 x y)
    if (command === 'Q') {
      cursor[0] = args[2];
      cursor[1] = args[3];
      const [x1, y1] = transformAbsolutePoint(matrix, args[0], args[1]);
      const [x, y] = transformAbsolutePoint(matrix, args[2], args[3]);
      args[0] = x1;
      args[1] = y1;
      args[2] = x;
      args[3] = y;
    }
    if (command === 'q') {
      cursor[0] += args[2];
      cursor[1] += args[3];
      const [x1, y1] = transformRelativePoint(matrix, args[0], args[1]);
      const [x, y] = transformRelativePoint(matrix, args[2], args[3]);
      args[0] = x1;
      args[1] = y1;
      args[2] = x;
      args[3] = y;
    }

    // smooth quadratic Bézier curveto (x y)
    if (command === 'T') {
      cursor[0] = args[0];
      cursor[1] = args[1];
      const [x, y] = transformAbsolutePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }
    if (command === 't') {
      cursor[0] += args[0];
      cursor[1] += args[1];
      const [x, y] = transformRelativePoint(matrix, args[0], args[1]);
      args[0] = x;
      args[1] = y;
    }

    // elliptical arc (rx ry x-axis-rotation large-arc-flag sweep-flag x y)
    if (command === 'A') {
      transformArc(cursor, args, matrix);
      cursor[0] = args[5];
      cursor[1] = args[6];
      // reduce number of digits in rotation angle
      if (Math.abs(args[2]) > 80) {
        const a = args[0];
        const rotation = args[2];
        args[0] = args[1];
        args[1] = a;
        args[2] = rotation + (rotation > 0 ? -90 : 90);
      }
      const [x, y] = transformAbsolutePoint(matrix, args[5], args[6]);
      args[5] = x;
      args[6] = y;
    }
    if (command === 'a') {
      transformArc([0, 0], args, matrix);
      cursor[0] += args[5];
      cursor[1] += args[6];
      // reduce number of digits in rotation angle
      if (Math.abs(args[2]) > 80) {
        const a = args[0];
        const rotation = args[2];
        args[0] = args[1];
        args[1] = a;
        args[2] = rotation + (rotation > 0 ? -90 : 90);
      }
      const [x, y] = transformRelativePoint(matrix, args[5], args[6]);
      args[5] = x;
      args[6] = y;
    }

    // closepath
    if (command === 'z' || command === 'Z') {
      cursor[0] = start[0];
      cursor[1] = start[1];
    }
  }
};
