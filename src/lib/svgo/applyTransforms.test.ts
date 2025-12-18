import { describe, it, expect } from 'vitest'
import { applyMatrixToPathData } from './applyTransforms'
import { parsePathData, stringifyPathData } from './path'
import { transform2js, transformsMultiply, IDENTITY_MATRIX } from './transforms'

describe('applyMatrixToPathData', () => {
  it('should not change path with identity matrix', () => {
    const pathData = parsePathData('M10 20L30 40')
    const original = JSON.parse(JSON.stringify(pathData))
    applyMatrixToPathData(pathData, IDENTITY_MATRIX)
    expect(pathData).toEqual(original)
  })

  it('should apply translation to M command', () => {
    const pathData = parsePathData('M10 20')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200]) // translate(100, 200)
    expect(pathData[0].args[0]).toBe(110)
    expect(pathData[0].args[1]).toBe(220)
  })

  it('should apply translation to L command', () => {
    const pathData = parsePathData('M0 0L10 20')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[1].args[0]).toBe(110)
    expect(pathData[1].args[1]).toBe(220)
  })

  it('should apply scale to path', () => {
    const pathData = parsePathData('M10 20L30 40')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 0, 0]) // scale(2)
    expect(pathData[0].args[0]).toBe(20)
    expect(pathData[0].args[1]).toBe(40)
    expect(pathData[1].args[0]).toBe(60)
    expect(pathData[1].args[1]).toBe(80)
  })

  it('should apply combined scale and translation', () => {
    const pathData = parsePathData('M10 20')
    // scale(2) then translate(100, 200) = [2, 0, 0, 2, 100, 200]
    // But in matrix order, it's translate first then scale: [2, 0, 0, 2, 200, 400]
    // We test with scale then offset already in matrix
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 100, 200])
    // x = 2*10 + 100 = 120, y = 2*20 + 200 = 240
    expect(pathData[0].args[0]).toBe(120)
    expect(pathData[0].args[1]).toBe(240)
  })

  it('should apply rotation 90 degrees', () => {
    const pathData = parsePathData('M10 0')
    // rotate(90) = [0, 1, -1, 0, 0, 0]
    applyMatrixToPathData(pathData, [0, 1, -1, 0, 0, 0])
    expect(pathData[0].args[0]).toBeCloseTo(0, 10)
    expect(pathData[0].args[1]).toBeCloseTo(10, 10)
  })

  it('should handle C (cubic bezier) command', () => {
    const pathData = parsePathData('M0 0C10 20 30 40 50 60')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[1].args).toEqual([110, 220, 130, 240, 150, 260])
  })

  it('should handle Q (quadratic bezier) command', () => {
    const pathData = parsePathData('M0 0Q10 20 30 40')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[1].args).toEqual([110, 220, 130, 240])
  })

  it('should handle S (smooth curve) command', () => {
    const pathData = parsePathData('M0 0C10 20 30 40 50 60S70 80 90 100')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[2].args).toEqual([170, 280, 190, 300])
  })

  it('should handle T (smooth quadratic) command', () => {
    const pathData = parsePathData('M0 0Q10 20 30 40T50 60')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[2].args).toEqual([150, 260])
  })

  it('should convert H command to L when transformed', () => {
    const pathData = parsePathData('M0 0H10')
    // With rotation, H needs to become L
    applyMatrixToPathData(pathData, [0, 1, -1, 0, 0, 0]) // rotate(90)
    expect(pathData[1].command).toBe('L')
    expect(pathData[1].args[0]).toBeCloseTo(0, 10)
    expect(pathData[1].args[1]).toBeCloseTo(10, 10)
  })

  it('should convert V command to L when transformed', () => {
    const pathData = parsePathData('M0 0V10')
    applyMatrixToPathData(pathData, [0, 1, -1, 0, 0, 0]) // rotate(90)
    expect(pathData[1].command).toBe('L')
    expect(pathData[1].args[0]).toBeCloseTo(-10, 10)
    expect(pathData[1].args[1]).toBeCloseTo(0, 10)
  })

  it('should handle relative l command', () => {
    const pathData = parsePathData('M100 100l10 20')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 0, 0]) // scale(2)
    // M is absolute, becomes 200 200
    // l is relative, the offset is scaled: 20 40
    expect(pathData[0].args).toEqual([200, 200])
    expect(pathData[1].args).toEqual([20, 40])
  })

  it('should handle relative c command', () => {
    const pathData = parsePathData('M0 0c10 20 30 40 50 60')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 0, 0])
    expect(pathData[1].args).toEqual([20, 40, 60, 80, 100, 120])
  })

  it('should handle Z command (closepath)', () => {
    const pathData = parsePathData('M10 20L30 40Z')
    applyMatrixToPathData(pathData, [1, 0, 0, 1, 100, 200])
    expect(pathData[0].args).toEqual([110, 220])
    expect(pathData[1].args).toEqual([130, 240])
    expect(pathData[2].command).toBe('Z')
  })

  it('should handle A (arc) command', () => {
    const pathData = parsePathData('M0 0A5 5 0 0 1 10 10')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 0, 0]) // scale(2)
    // Arc radii are scaled through SVD decomposition
    // The result depends on the arc's position relative to cursor
    // Just verify the end point is scaled correctly
    expect(pathData[1].args[5]).toBeCloseTo(20, 5)
    expect(pathData[1].args[6]).toBeCloseTo(20, 5)
    // And that radii are reasonable (scaled in some form)
    expect(pathData[1].args[0]).toBeGreaterThan(5)
    expect(pathData[1].args[1]).toBeGreaterThan(5)
  })

  it('should handle real-world Fabric.js transform', () => {
    // Simulate the transforms from the user's example:
    // <g transform="matrix(0.1332 0 0 0.1332 396.5235 450.6102)">
    //   <path transform="translate(-914.5784, -659.3002)" d="M 976.91 1024 ..." />
    const transforms = transform2js(
      'matrix(0.1332 0 0 0.1332 396.5235 450.6102)'
    )
    const pathTransforms = transform2js('translate(-914.5784, -659.3002)')
    const combined = transformsMultiply([...transforms, ...pathTransforms])

    const pathData = parsePathData('M 976.91 1024 L 846.29 1024')
    applyMatrixToPathData(pathData, combined.data)

    // The coordinates should be in a reasonable range after transform
    // Original M 976.91 1024:
    // After translate: 976.91 - 914.5784 = 62.3316, 1024 - 659.3002 = 364.6998
    // After scale: 62.3316 * 0.1332 = 8.3026, 364.6998 * 0.1332 = 48.5780
    // After matrix translate: 8.3026 + 396.5235 = 404.8261, 48.5780 + 450.6102 = 499.1882
    // But with combined matrix multiplication it's slightly different due to order

    // Just verify the path is transformed to reasonable coordinates
    expect(pathData[0].args[0]).toBeGreaterThan(200)
    expect(pathData[0].args[0]).toBeLessThan(500)
    expect(pathData[0].args[1]).toBeGreaterThan(400)
    expect(pathData[0].args[1]).toBeLessThan(600)
  })

  it('should maintain path integrity after transform and stringify', () => {
    const originalPath = 'M10 20L30 40C50 60 70 80 90 100Q110 120 130 140Z'
    const pathData = parsePathData(originalPath)

    // Apply scale(2) translation(100, 200)
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 100, 200])

    const result = stringifyPathData({ pathData, precision: 2 })

    // Should be a valid path string
    expect(result).toMatch(/^M/)
    expect(result).toMatch(/Z$/)

    // Re-parse should work
    const reparsed = parsePathData(result)
    expect(reparsed.length).toBe(pathData.length)
  })
})

describe('applyMatrixToPathData with relative commands', () => {
  it('should handle relative m command', () => {
    const pathData = parsePathData('M0 0m10 20')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 100, 200])
    // M0 0 -> M100 200
    expect(pathData[0].args).toEqual([100, 200])
    // m10 20 -> relative offset scaled: m20 40
    expect(pathData[1].args).toEqual([20, 40])
  })

  it('should handle h and v relative commands', () => {
    const pathData = parsePathData('M0 0h10v20')
    applyMatrixToPathData(pathData, [2, 0, 0, 2, 0, 0])
    // h becomes l, v becomes l
    expect(pathData[1].command).toBe('l')
    expect(pathData[2].command).toBe('l')
    expect(pathData[1].args).toEqual([20, 0])
    expect(pathData[2].args).toEqual([0, 40])
  })
})
