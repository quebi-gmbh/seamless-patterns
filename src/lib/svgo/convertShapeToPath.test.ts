import { describe, it, expect } from 'vitest'
import {
  rectToPath,
  circleToPath,
  ellipseToPath,
  lineToPath,
  polygonToPath,
  polylineToPath,
  extractShapeAttributes,
  convertSvgShapeToPath,
  canConvertToPath,
} from './convertShapeToPath'

describe('rectToPath', () => {
  it('should convert a simple rectangle', () => {
    const result = rectToPath({ x: '10', y: '20', width: '100', height: '50' })
    expect(result).toBe('M10 20H110V70H10z')
  })

  it('should handle rectangle at origin', () => {
    const result = rectToPath({ width: '100', height: '50' })
    expect(result).toBe('M0 0H100V50H0z')
  })

  it('should handle rounded rectangle', () => {
    const result = rectToPath({ x: '0', y: '0', width: '100', height: '50', rx: '10' })
    expect(result).toContain('A') // Should have arc commands
    expect(result).toMatch(/^M10 0/) // Should start at x + rx
  })

  it('should clamp rx/ry to half of width/height', () => {
    const result = rectToPath({ x: '0', y: '0', width: '20', height: '10', rx: '100', ry: '100' })
    // rx should be clamped to 10 (half of width), ry to 5 (half of height)
    expect(result).toContain('A10 5') // First arc should show clamped values
  })

  it('should return null for missing width', () => {
    const result = rectToPath({ height: '50' })
    expect(result).toBeNull()
  })

  it('should return null for missing height', () => {
    const result = rectToPath({ width: '100' })
    expect(result).toBeNull()
  })
})

describe('circleToPath', () => {
  it('should convert a circle', () => {
    const result = circleToPath({ cx: '50', cy: '50', r: '25' })
    expect(result).toContain('M50 25') // Start at top of circle
    expect(result).toContain('A25 25') // Arc with radius
    expect(result).toContain('z') // Should close
  })

  it('should handle circle at origin', () => {
    const result = circleToPath({ r: '10' })
    // Path starts at cy - r = 0 - 10 = -10
    expect(result).toMatch(/M0-10/) // Start at top (stringifyPathData may omit space before negative)
  })

  it('should return null for zero radius', () => {
    const result = circleToPath({ cx: '50', cy: '50', r: '0' })
    expect(result).toBeNull()
  })

  it('should return null for missing radius', () => {
    const result = circleToPath({ cx: '50', cy: '50' })
    expect(result).toBeNull()
  })
})

describe('ellipseToPath', () => {
  it('should convert an ellipse', () => {
    const result = ellipseToPath({ cx: '50', cy: '50', rx: '30', ry: '20' })
    expect(result).toContain('M50 30') // Start at top (cy - ry)
    expect(result).toContain('A30 20') // Arc with rx and ry
    expect(result).toContain('z')
  })

  it('should handle ellipse at origin', () => {
    const result = ellipseToPath({ rx: '10', ry: '5' })
    // Path starts at cy - ry = 0 - 5 = -5
    expect(result).toMatch(/M0-5/) // Start at top (stringifyPathData may omit space before negative)
  })

  it('should return null for zero rx', () => {
    const result = ellipseToPath({ cx: '50', cy: '50', rx: '0', ry: '20' })
    expect(result).toBeNull()
  })

  it('should return null for zero ry', () => {
    const result = ellipseToPath({ cx: '50', cy: '50', rx: '30', ry: '0' })
    expect(result).toBeNull()
  })
})

describe('lineToPath', () => {
  it('should convert a line', () => {
    const result = lineToPath({ x1: '10', y1: '20', x2: '100', y2: '80' })
    // stringifyPathData omits command when same as previous, and may output as space-separated
    expect(result).toMatch(/M10 20.*100 80/)
  })

  it('should handle line from origin', () => {
    const result = lineToPath({ x2: '50', y2: '50' })
    expect(result).toMatch(/M0 0.*50 50/)
  })

  it('should handle horizontal line', () => {
    const result = lineToPath({ x1: '0', y1: '50', x2: '100', y2: '50' })
    expect(result).toMatch(/M0 50.*100 50/)
  })

  it('should handle vertical line', () => {
    const result = lineToPath({ x1: '50', y1: '0', x2: '50', y2: '100' })
    expect(result).toMatch(/M50 0.*50 100/)
  })
})

describe('polygonToPath', () => {
  it('should convert a triangle polygon', () => {
    const result = polygonToPath({ points: '50,0 100,100 0,100' })
    // stringifyPathData may omit repeated L commands
    expect(result).toMatch(/M50 0.*100 100.*0 100z/)
  })

  it('should handle spaces in points', () => {
    const result = polygonToPath({ points: '50 0 100 100 0 100' })
    expect(result).toMatch(/M50 0.*100 100.*0 100z/)
  })

  it('should handle mixed separators', () => {
    const result = polygonToPath({ points: '50,0, 100,100, 0,100' })
    expect(result).toMatch(/M50 0.*100 100.*0 100z/)
  })

  it('should return null for missing points', () => {
    const result = polygonToPath({})
    expect(result).toBeNull()
  })

  it('should return null for insufficient points', () => {
    const result = polygonToPath({ points: '50,0' }) // Only one point
    expect(result).toBeNull()
  })
})

describe('polylineToPath', () => {
  it('should convert a polyline', () => {
    const result = polylineToPath({ points: '0,0 50,50 100,0' })
    // stringifyPathData may omit repeated L commands
    expect(result).toMatch(/M0 0.*50 50.*100 0/)
  })

  it('should not close the path (unlike polygon)', () => {
    const result = polylineToPath({ points: '0,0 50,50 100,0' })
    expect(result).not.toContain('z')
  })

  it('should return null for missing points', () => {
    const result = polylineToPath({})
    expect(result).toBeNull()
  })
})

describe('extractShapeAttributes', () => {
  it('should extract rect attributes', () => {
    const svg = '<rect x="10" y="20" width="100" height="50" />'
    const attrs = extractShapeAttributes(svg, 'rect')
    expect(attrs).toEqual({
      x: '10',
      y: '20',
      width: '100',
      height: '50',
    })
  })

  it('should extract circle attributes', () => {
    const svg = '<circle cx="50" cy="50" r="25" />'
    const attrs = extractShapeAttributes(svg, 'circle')
    expect(attrs).toEqual({
      cx: '50',
      cy: '50',
      r: '25',
    })
  })

  it('should handle attributes with extra styles', () => {
    const svg = '<rect x="10" y="20" width="100" height="50" fill="red" stroke="blue" />'
    const attrs = extractShapeAttributes(svg, 'rect')
    expect(attrs?.x).toBe('10')
    expect(attrs?.width).toBe('100')
  })

  it('should return null for missing element', () => {
    const svg = '<circle cx="50" cy="50" r="25" />'
    const attrs = extractShapeAttributes(svg, 'rect')
    expect(attrs).toBeNull()
  })

  it('should handle SVG with group wrapper', () => {
    const svg = '<g transform="translate(10,20)"><rect x="0" y="0" width="50" height="50" /></g>'
    const attrs = extractShapeAttributes(svg, 'rect')
    expect(attrs?.width).toBe('50')
  })
})

describe('convertSvgShapeToPath', () => {
  it('should convert rect SVG', () => {
    const svg = '<rect x="10" y="20" width="100" height="50" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('rect')
    expect(result?.pathString).toBe('M10 20H110V70H10z')
  })

  it('should convert circle SVG', () => {
    const svg = '<circle cx="50" cy="50" r="25" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('circle')
    expect(result?.pathString).toContain('A25 25')
  })

  it('should convert ellipse SVG', () => {
    const svg = '<ellipse cx="50" cy="50" rx="30" ry="20" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('ellipse')
    expect(result?.pathString).toContain('A30 20')
  })

  it('should convert line SVG', () => {
    const svg = '<line x1="0" y1="0" x2="100" y2="100" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('line')
    expect(result?.pathString).toMatch(/M0 0.*100 100/)
  })

  it('should convert polygon SVG', () => {
    const svg = '<polygon points="50,0 100,100 0,100" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('polygon')
    expect(result?.pathString).toContain('z')
  })

  it('should convert polyline SVG', () => {
    const svg = '<polyline points="0,0 50,50 100,0" />'
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('polyline')
    expect(result?.pathString).not.toContain('z')
  })

  it('should handle SVG with group wrapper (like Fabric.js output)', () => {
    const svg = `<g transform="matrix(1 0 0 1 100 100)">
      <rect x="-50" y="-25" width="100" height="50" />
    </g>`
    const result = convertSvgShapeToPath(svg)
    expect(result?.shapeType).toBe('rect')
    expect(result?.pathString).toBeTruthy()
  })

  it('should return null for path element (already a path)', () => {
    const svg = '<path d="M0 0L100 100" />'
    const result = convertSvgShapeToPath(svg)
    expect(result).toBeNull() // Should return null since it's not a shape
  })

  it('should return null for unsupported element', () => {
    const svg = '<text>Hello</text>'
    const result = convertSvgShapeToPath(svg)
    expect(result).toBeNull()
  })

  it('should skip circle conversion when convertArcs is false', () => {
    const svg = '<circle cx="50" cy="50" r="25" />'
    const result = convertSvgShapeToPath(svg, { convertArcs: false })
    expect(result).toBeNull()
  })

  it('should use custom precision', () => {
    const svg = '<rect x="10.123456" y="20.654321" width="100" height="50" />'
    const result = convertSvgShapeToPath(svg, { floatPrecision: 1 })
    expect(result?.pathString).toContain('10.1')
    expect(result?.pathString).toContain('20.7')
  })
})

describe('canConvertToPath', () => {
  it('should return true for path', () => {
    expect(canConvertToPath('path')).toBe(true)
  })

  it('should return true for rect', () => {
    expect(canConvertToPath('rect')).toBe(true)
  })

  it('should return true for circle', () => {
    expect(canConvertToPath('circle')).toBe(true)
  })

  it('should return true for ellipse', () => {
    expect(canConvertToPath('ellipse')).toBe(true)
  })

  it('should return true for line', () => {
    expect(canConvertToPath('line')).toBe(true)
  })

  it('should return true for polygon', () => {
    expect(canConvertToPath('polygon')).toBe(true)
  })

  it('should return true for polyline', () => {
    expect(canConvertToPath('polyline')).toBe(true)
  })

  it('should return true for triangle (Fabric.js type)', () => {
    expect(canConvertToPath('triangle')).toBe(true)
  })

  it('should return false for text', () => {
    expect(canConvertToPath('text')).toBe(false)
  })

  it('should return false for image', () => {
    expect(canConvertToPath('image')).toBe(false)
  })

  it('should return false for group', () => {
    expect(canConvertToPath('group')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(canConvertToPath('')).toBe(false)
  })
})
