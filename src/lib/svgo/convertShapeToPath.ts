/**
 * Browser-compatible version adapted from SVGO plugins/convertShapeToPath.js
 * Converts basic SVG shapes to path format for merging
 */

import { stringifyPathData } from './path';
import type { PathDataItem } from './types';

export interface ConvertShapeToPathOptions {
  /** Convert circles and ellipses using arc commands (default: true) */
  convertArcs?: boolean;
  /** Floating point precision (default: 3) */
  floatPrecision?: number;
}

export interface ShapeAttributes {
  // rect
  x?: string;
  y?: string;
  width?: string;
  height?: string;
  rx?: string;
  ry?: string;
  // circle
  cx?: string;
  cy?: string;
  r?: string;
  // ellipse (also uses cx, cy)
  // rx, ry already defined
  // line
  x1?: string;
  y1?: string;
  x2?: string;
  y2?: string;
  // polygon/polyline
  points?: string;
}

const regNumber = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/**
 * Convert a rect element to path data
 */
export function rectToPath(attrs: ShapeAttributes, precision?: number): string | null {
  if (attrs.width == null || attrs.height == null) {
    return null;
  }

  const x = Number(attrs.x || '0');
  const y = Number(attrs.y || '0');
  const width = Number(attrs.width);
  const height = Number(attrs.height);

  if (Number.isNaN(x - y + width - height)) {
    return null;
  }

  // Handle rounded rectangles
  let rx = attrs.rx != null ? Number(attrs.rx) : (attrs.ry != null ? Number(attrs.ry) : 0);
  let ry = attrs.ry != null ? Number(attrs.ry) : (attrs.rx != null ? Number(attrs.rx) : 0);

  // Clamp rx/ry to half of width/height
  rx = Math.min(rx, width / 2);
  ry = Math.min(ry, height / 2);

  let pathData: PathDataItem[];

  if (rx > 0 || ry > 0) {
    // Rounded rectangle
    pathData = [
      { command: 'M', args: [x + rx, y] },
      { command: 'H', args: [x + width - rx] },
      { command: 'A', args: [rx, ry, 0, 0, 1, x + width, y + ry] },
      { command: 'V', args: [y + height - ry] },
      { command: 'A', args: [rx, ry, 0, 0, 1, x + width - rx, y + height] },
      { command: 'H', args: [x + rx] },
      { command: 'A', args: [rx, ry, 0, 0, 1, x, y + height - ry] },
      { command: 'V', args: [y + ry] },
      { command: 'A', args: [rx, ry, 0, 0, 1, x + rx, y] },
      { command: 'z', args: [] },
    ];
  } else {
    // Simple rectangle
    pathData = [
      { command: 'M', args: [x, y] },
      { command: 'H', args: [x + width] },
      { command: 'V', args: [y + height] },
      { command: 'H', args: [x] },
      { command: 'z', args: [] },
    ];
  }

  return stringifyPathData({ pathData, precision });
}

/**
 * Convert a line element to path data
 */
export function lineToPath(attrs: ShapeAttributes, precision?: number): string | null {
  const x1 = Number(attrs.x1 || '0');
  const y1 = Number(attrs.y1 || '0');
  const x2 = Number(attrs.x2 || '0');
  const y2 = Number(attrs.y2 || '0');

  if (Number.isNaN(x1 - y1 + x2 - y2)) {
    return null;
  }

  const pathData: PathDataItem[] = [
    { command: 'M', args: [x1, y1] },
    { command: 'L', args: [x2, y2] },
  ];

  return stringifyPathData({ pathData, precision });
}

/**
 * Convert a circle element to path data
 */
export function circleToPath(attrs: ShapeAttributes, precision?: number): string | null {
  const cx = Number(attrs.cx || '0');
  const cy = Number(attrs.cy || '0');
  const r = Number(attrs.r || '0');

  if (Number.isNaN(cx - cy + r) || r <= 0) {
    return null;
  }

  const pathData: PathDataItem[] = [
    { command: 'M', args: [cx, cy - r] },
    { command: 'A', args: [r, r, 0, 1, 0, cx, cy + r] },
    { command: 'A', args: [r, r, 0, 1, 0, cx, cy - r] },
    { command: 'z', args: [] },
  ];

  return stringifyPathData({ pathData, precision });
}

/**
 * Convert an ellipse element to path data
 */
export function ellipseToPath(attrs: ShapeAttributes, precision?: number): string | null {
  const cx = Number(attrs.cx || '0');
  const cy = Number(attrs.cy || '0');
  const rx = Number(attrs.rx || '0');
  const ry = Number(attrs.ry || '0');

  if (Number.isNaN(cx - cy + rx - ry) || rx <= 0 || ry <= 0) {
    return null;
  }

  const pathData: PathDataItem[] = [
    { command: 'M', args: [cx, cy - ry] },
    { command: 'A', args: [rx, ry, 0, 1, 0, cx, cy + ry] },
    { command: 'A', args: [rx, ry, 0, 1, 0, cx, cy - ry] },
    { command: 'z', args: [] },
  ];

  return stringifyPathData({ pathData, precision });
}

/**
 * Convert a polygon element to path data
 */
export function polygonToPath(attrs: ShapeAttributes, precision?: number): string | null {
  if (attrs.points == null) {
    return null;
  }

  const coords = (attrs.points.match(regNumber) || []).map(Number);
  if (coords.length < 4) {
    return null;
  }

  const pathData: PathDataItem[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    pathData.push({
      command: i === 0 ? 'M' : 'L',
      args: coords.slice(i, i + 2),
    });
  }
  pathData.push({ command: 'z', args: [] });

  return stringifyPathData({ pathData, precision });
}

/**
 * Convert a polyline element to path data
 */
export function polylineToPath(attrs: ShapeAttributes, precision?: number): string | null {
  if (attrs.points == null) {
    return null;
  }

  const coords = (attrs.points.match(regNumber) || []).map(Number);
  if (coords.length < 4) {
    return null;
  }

  const pathData: PathDataItem[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    pathData.push({
      command: i === 0 ? 'M' : 'L',
      args: coords.slice(i, i + 2),
    });
  }

  return stringifyPathData({ pathData, precision });
}

/**
 * Extract shape attributes from an SVG element string
 */
export function extractShapeAttributes(svgString: string, elementName: string): ShapeAttributes | null {
  // Match the element and extract its attributes
  const elementRegex = new RegExp(`<${elementName}\\s+([^>]*)`, 'i');
  const elementMatch = svgString.match(elementRegex);

  if (!elementMatch) {
    return null;
  }

  const attrString = elementMatch[1];
  const attrs: ShapeAttributes = {};

  // Extract individual attributes
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const [, name, value] = match;
    (attrs as Record<string, string>)[name] = value;
  }

  return attrs;
}

/**
 * Convert any supported shape in an SVG string to a path string
 * Returns the path d attribute value, or null if conversion failed
 */
export function convertSvgShapeToPath(
  svgString: string,
  options: ConvertShapeToPathOptions = {}
): { pathString: string; shapeType: string } | null {
  const { convertArcs = true, floatPrecision: precision = 3 } = options;

  // Try each shape type
  const shapeTypes = ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'];

  for (const shapeType of shapeTypes) {
    // Check if this shape type exists in the SVG
    if (!svgString.includes(`<${shapeType}`)) {
      continue;
    }

    const attrs = extractShapeAttributes(svgString, shapeType);
    if (!attrs) {
      continue;
    }

    let pathString: string | null = null;

    switch (shapeType) {
      case 'rect':
        pathString = rectToPath(attrs, precision);
        break;
      case 'circle':
        if (convertArcs) {
          pathString = circleToPath(attrs, precision);
        }
        break;
      case 'ellipse':
        if (convertArcs) {
          pathString = ellipseToPath(attrs, precision);
        }
        break;
      case 'line':
        pathString = lineToPath(attrs, precision);
        break;
      case 'polygon':
        pathString = polygonToPath(attrs, precision);
        break;
      case 'polyline':
        pathString = polylineToPath(attrs, precision);
        break;
    }

    if (pathString) {
      return { pathString, shapeType };
    }
  }

  return null;
}

/**
 * Supported shape types that can be converted to paths
 */
export const SUPPORTED_SHAPE_TYPES = ['rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'] as const;
export type SupportedShapeType = typeof SUPPORTED_SHAPE_TYPES[number];

/**
 * Check if a Fabric.js object type can be converted to a path
 */
export function canConvertToPath(fabricType: string): boolean {
  // Map Fabric.js types to SVG shape types
  const typeMap: Record<string, boolean> = {
    path: true,
    rect: true,
    circle: true,
    ellipse: true,
    line: true,
    polygon: true,
    polyline: true,
    triangle: true, // Fabric's triangle is a polygon
  };

  return typeMap[fabricType] ?? false;
}
