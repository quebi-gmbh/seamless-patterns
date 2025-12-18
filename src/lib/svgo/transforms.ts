/**
 * Browser-compatible version adapted from SVGO plugins/_transforms.js
 * Handles parsing and manipulation of SVG transform attributes
 */

export interface TransformItem {
  name: string;
  data: number[];
}

const transformTypes = new Set([
  'matrix',
  'translate',
  'scale',
  'rotate',
  'skewX',
  'skewY',
]);

const regTransformSplit =
  /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*(.+?)\s*\)[\s,]*/;
const regNumericValues = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/**
 * Math utilities for degree/radian conversion
 */
const mth = {
  rad: (deg: number): number => {
    return (deg * Math.PI) / 180;
  },
  deg: (rad: number): number => {
    return (rad * 180) / Math.PI;
  },
  cos: (deg: number): number => {
    return Math.cos(mth.rad(deg));
  },
  sin: (deg: number): number => {
    return Math.sin(mth.rad(deg));
  },
  tan: (deg: number): number => {
    return Math.tan(mth.rad(deg));
  },
};

/**
 * Convert transform string to JS representation.
 *
 * @param transformString - SVG transform attribute value like "matrix(1,0,0,1,0,0)" or "translate(10,20) scale(2)"
 * @returns Array of transform items, or empty array if malformed
 */
export const transform2js = (transformString: string): TransformItem[] => {
  if (!transformString || !transformString.trim()) {
    return [];
  }

  const transforms: TransformItem[] = [];
  let currentTransform: TransformItem | null = null;

  // split value into ['', 'translate', '10 50', '', 'scale', '2', '', 'rotate', '-45', '']
  for (const item of transformString.split(regTransformSplit)) {
    if (!item) {
      continue;
    }

    if (transformTypes.has(item)) {
      currentTransform = { name: item, data: [] };
      transforms.push(currentTransform);
    } else {
      let num;
      // then split it into [10, 50] and collect as context.data
      while ((num = regNumericValues.exec(item))) {
        if (currentTransform != null) {
          currentTransform.data.push(Number(num[0]));
        }
      }
    }
  }

  return currentTransform == null || currentTransform.data.length === 0
    ? []
    : transforms;
};

/**
 * Convert a single transform to its matrix representation.
 * Matrix format: [a, b, c, d, e, f] representing:
 * | a c e |
 * | b d f |
 * | 0 0 1 |
 */
export const transformToMatrix = (transform: TransformItem): number[] => {
  if (transform.name === 'matrix') {
    return transform.data;
  }
  switch (transform.name) {
    case 'translate':
      // [1, 0, 0, 1, tx, ty]
      return [1, 0, 0, 1, transform.data[0], transform.data[1] || 0];
    case 'scale': {
      // [sx, 0, 0, sy, 0, 0]
      const sx = transform.data[0];
      const sy = transform.data[1] ?? sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      // [cos(a), sin(a), -sin(a), cos(a), x, y]
      const cos = mth.cos(transform.data[0]);
      const sin = mth.sin(transform.data[0]);
      const cx = transform.data[1] || 0;
      const cy = transform.data[2] || 0;
      return [
        cos,
        sin,
        -sin,
        cos,
        (1 - cos) * cx + sin * cy,
        (1 - cos) * cy - sin * cx,
      ];
    }
    case 'skewX':
      // [1, 0, tan(a), 1, 0, 0]
      return [1, 0, mth.tan(transform.data[0]), 1, 0, 0];
    case 'skewY':
      // [1, tan(a), 0, 1, 0, 0]
      return [1, mth.tan(transform.data[0]), 0, 1, 0, 0];
    default:
      throw Error(`Unknown transform ${transform.name}`);
  }
};

/**
 * Multiply two transformation matrices.
 */
export const multiplyTransformMatrices = (
  a: readonly number[],
  b: readonly number[]
): number[] => {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
};

/**
 * Multiply multiple transforms into a single matrix.
 *
 * @param transforms - Array of transform items to multiply
 * @returns Single matrix transform item
 */
export const transformsMultiply = (
  transforms: readonly TransformItem[]
): TransformItem => {
  const matrixData = transforms.map((transform) => {
    if (transform.name === 'matrix') {
      return transform.data;
    }
    return transformToMatrix(transform);
  });

  const matrixTransform: TransformItem = {
    name: 'matrix',
    data:
      matrixData.length > 0
        ? matrixData.reduce(multiplyTransformMatrices)
        : [1, 0, 0, 1, 0, 0], // identity matrix
  };

  return matrixTransform;
};

/**
 * Applies transformation to an arc. To do so, we represent ellipse as a matrix,
 * multiply it by the transformation matrix and use a singular value
 * decomposition to represent in a form rotate(θ)·scale(a b)·rotate(φ). This
 * gives us new ellipse params a, b and θ.
 *
 * @param cursor - Current cursor position [x, y]
 * @param arc - Arc parameters [rx, ry, angle, largeArc, sweep, x, y]
 * @param transform - Transform matrix [a, b, c, d, e, f]
 * @returns Modified arc parameters
 */
export const transformArc = (
  cursor: readonly [number, number],
  arc: number[],
  transform: readonly number[]
): number[] => {
  const x = arc[5] - cursor[0];
  const y = arc[6] - cursor[1];
  let a = arc[0];
  let b = arc[1];
  const rot = (arc[2] * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  // skip if radius is 0
  if (a > 0 && b > 0) {
    let h =
      Math.pow(x * cos + y * sin, 2) / (4 * a * a) +
      Math.pow(y * cos - x * sin, 2) / (4 * b * b);
    if (h > 1) {
      h = Math.sqrt(h);
      a *= h;
      b *= h;
    }
  }

  const ellipse = [a * cos, a * sin, -b * sin, b * cos, 0, 0];
  const m = multiplyTransformMatrices(transform, ellipse);

  // Decompose the new ellipse matrix
  const lastCol = m[2] * m[2] + m[3] * m[3];
  const squareSum = m[0] * m[0] + m[1] * m[1] + lastCol;
  const root =
    Math.hypot(m[0] - m[3], m[1] + m[2]) * Math.hypot(m[0] + m[3], m[1] - m[2]);

  if (!root) {
    // circle
    arc[0] = arc[1] = Math.sqrt(squareSum / 2);
    arc[2] = 0;
  } else {
    const majorAxisSqr = (squareSum + root) / 2;
    const minorAxisSqr = (squareSum - root) / 2;
    const major = Math.abs(majorAxisSqr - lastCol) > 1e-6;
    const sub = (major ? majorAxisSqr : minorAxisSqr) - lastCol;
    const rowsSum = m[0] * m[2] + m[1] * m[3];
    const term1 = m[0] * sub + m[2] * rowsSum;
    const term2 = m[1] * sub + m[3] * rowsSum;
    arc[0] = Math.sqrt(majorAxisSqr);
    arc[1] = Math.sqrt(minorAxisSqr);
    arc[2] =
      (((major ? term2 < 0 : term1 > 0) ? -1 : 1) *
        Math.acos((major ? term1 : term2) / Math.hypot(term1, term2)) *
        180) /
      Math.PI;
  }

  if (transform[0] < 0 !== transform[3] < 0) {
    // Flip the sweep flag if coordinates are being flipped horizontally XOR vertically
    arc[4] = 1 - arc[4];
  }

  return arc;
};

/**
 * Identity matrix for convenience
 */
export const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

/**
 * Check if a matrix is the identity matrix
 */
export const isIdentityMatrix = (matrix: readonly number[]): boolean => {
  return (
    matrix[0] === 1 &&
    matrix[1] === 0 &&
    matrix[2] === 0 &&
    matrix[3] === 1 &&
    matrix[4] === 0 &&
    matrix[5] === 0
  );
};
