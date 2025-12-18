import { describe, it, expect } from 'vitest'
import {
  transform2js,
  transformToMatrix,
  transformsMultiply,
  multiplyTransformMatrices,
  isIdentityMatrix,
  IDENTITY_MATRIX,
} from './transforms'

describe('transform2js', () => {
  it('should return empty array for empty string', () => {
    expect(transform2js('')).toEqual([])
  })

  it('should return empty array for whitespace only', () => {
    expect(transform2js('   ')).toEqual([])
  })

  it('should parse matrix transform', () => {
    const result = transform2js('matrix(1, 0, 0, 1, 10, 20)')
    expect(result).toEqual([{ name: 'matrix', data: [1, 0, 0, 1, 10, 20] }])
  })

  it('should parse matrix without spaces', () => {
    const result = transform2js('matrix(1,0,0,1,10,20)')
    expect(result).toEqual([{ name: 'matrix', data: [1, 0, 0, 1, 10, 20] }])
  })

  it('should parse translate transform', () => {
    const result = transform2js('translate(10, 20)')
    expect(result).toEqual([{ name: 'translate', data: [10, 20] }])
  })

  it('should parse translate with single value', () => {
    const result = transform2js('translate(10)')
    expect(result).toEqual([{ name: 'translate', data: [10] }])
  })

  it('should parse scale transform', () => {
    const result = transform2js('scale(2)')
    expect(result).toEqual([{ name: 'scale', data: [2] }])
  })

  it('should parse scale with two values', () => {
    const result = transform2js('scale(2, 3)')
    expect(result).toEqual([{ name: 'scale', data: [2, 3] }])
  })

  it('should parse rotate transform', () => {
    const result = transform2js('rotate(45)')
    expect(result).toEqual([{ name: 'rotate', data: [45] }])
  })

  it('should parse rotate with center point', () => {
    const result = transform2js('rotate(45, 100, 100)')
    expect(result).toEqual([{ name: 'rotate', data: [45, 100, 100] }])
  })

  it('should parse skewX transform', () => {
    const result = transform2js('skewX(30)')
    expect(result).toEqual([{ name: 'skewX', data: [30] }])
  })

  it('should parse skewY transform', () => {
    const result = transform2js('skewY(30)')
    expect(result).toEqual([{ name: 'skewY', data: [30] }])
  })

  it('should parse multiple transforms', () => {
    const result = transform2js('translate(10, 20) scale(2) rotate(45)')
    expect(result).toEqual([
      { name: 'translate', data: [10, 20] },
      { name: 'scale', data: [2] },
      { name: 'rotate', data: [45] },
    ])
  })

  it('should parse transforms with decimal values', () => {
    const result = transform2js('matrix(0.1332 0 0 0.1332 396.5235 450.6102)')
    expect(result).toEqual([
      { name: 'matrix', data: [0.1332, 0, 0, 0.1332, 396.5235, 450.6102] },
    ])
  })

  it('should parse transforms with negative values', () => {
    const result = transform2js('translate(-914.5784, -659.3002)')
    expect(result).toEqual([{ name: 'translate', data: [-914.5784, -659.3002] }])
  })

  it('should handle scientific notation', () => {
    const result = transform2js('translate(1e2, 2e-1)')
    expect(result).toEqual([{ name: 'translate', data: [100, 0.2] }])
  })
})

describe('transformToMatrix', () => {
  it('should return matrix data as-is', () => {
    const result = transformToMatrix({ name: 'matrix', data: [1, 2, 3, 4, 5, 6] })
    expect(result).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should convert translate to matrix', () => {
    const result = transformToMatrix({ name: 'translate', data: [10, 20] })
    expect(result).toEqual([1, 0, 0, 1, 10, 20])
  })

  it('should convert translate with single value', () => {
    const result = transformToMatrix({ name: 'translate', data: [10] })
    expect(result).toEqual([1, 0, 0, 1, 10, 0])
  })

  it('should convert uniform scale to matrix', () => {
    const result = transformToMatrix({ name: 'scale', data: [2] })
    expect(result).toEqual([2, 0, 0, 2, 0, 0])
  })

  it('should convert non-uniform scale to matrix', () => {
    const result = transformToMatrix({ name: 'scale', data: [2, 3] })
    expect(result).toEqual([2, 0, 0, 3, 0, 0])
  })

  it('should convert rotate 90 degrees to matrix', () => {
    const result = transformToMatrix({ name: 'rotate', data: [90] })
    expect(result[0]).toBeCloseTo(0, 10)
    expect(result[1]).toBeCloseTo(1, 10)
    expect(result[2]).toBeCloseTo(-1, 10)
    expect(result[3]).toBeCloseTo(0, 10)
    expect(result[4]).toBeCloseTo(0, 10)
    expect(result[5]).toBeCloseTo(0, 10)
  })

  it('should convert skewX to matrix', () => {
    const result = transformToMatrix({ name: 'skewX', data: [45] })
    expect(result[0]).toBe(1)
    expect(result[1]).toBe(0)
    expect(result[2]).toBeCloseTo(1, 10)
    expect(result[3]).toBe(1)
    expect(result[4]).toBe(0)
    expect(result[5]).toBe(0)
  })

  it('should convert skewY to matrix', () => {
    const result = transformToMatrix({ name: 'skewY', data: [45] })
    expect(result[0]).toBe(1)
    expect(result[1]).toBeCloseTo(1, 10)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(1)
    expect(result[4]).toBe(0)
    expect(result[5]).toBe(0)
  })
})

describe('multiplyTransformMatrices', () => {
  it('should return same matrix when multiplied by identity', () => {
    const matrix = [2, 0, 0, 3, 10, 20]
    const result = multiplyTransformMatrices(IDENTITY_MATRIX, matrix)
    expect(result).toEqual(matrix)
  })

  it('should combine two translations', () => {
    const t1 = [1, 0, 0, 1, 10, 20]
    const t2 = [1, 0, 0, 1, 30, 40]
    const result = multiplyTransformMatrices(t1, t2)
    expect(result).toEqual([1, 0, 0, 1, 40, 60])
  })

  it('should combine two scales', () => {
    const s1 = [2, 0, 0, 2, 0, 0]
    const s2 = [3, 0, 0, 3, 0, 0]
    const result = multiplyTransformMatrices(s1, s2)
    expect(result).toEqual([6, 0, 0, 6, 0, 0])
  })
})

describe('transformsMultiply', () => {
  it('should return identity matrix for empty array', () => {
    const result = transformsMultiply([])
    expect(result.name).toBe('matrix')
    expect(result.data).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('should return single transform as matrix', () => {
    const result = transformsMultiply([{ name: 'translate', data: [10, 20] }])
    expect(result.name).toBe('matrix')
    expect(result.data).toEqual([1, 0, 0, 1, 10, 20])
  })

  it('should multiply multiple transforms', () => {
    const result = transformsMultiply([
      { name: 'translate', data: [10, 20] },
      { name: 'scale', data: [2] },
    ])
    expect(result.name).toBe('matrix')
    // Matrix multiplication: translate * scale
    // translate = [1,0,0,1,10,20], scale = [2,0,0,2,0,0]
    // result[4] = 1*0 + 0*0 + 10 = 10
    // result[5] = 0*0 + 1*0 + 20 = 20
    // The translation component isn't affected by the scale in this multiplication order
    expect(result.data).toEqual([2, 0, 0, 2, 10, 20])
  })

  it('should handle real-world transform from Fabric.js', () => {
    // matrix(0.1332 0 0 0.1332 396.5235 450.6102) translate(-914.5784, -659.3002)
    const result = transformsMultiply([
      { name: 'matrix', data: [0.1332, 0, 0, 0.1332, 396.5235, 450.6102] },
      { name: 'translate', data: [-914.5784, -659.3002] },
    ])
    expect(result.name).toBe('matrix')
    // The final translation should be adjusted by the scale
    expect(result.data[0]).toBeCloseTo(0.1332, 4)
    expect(result.data[3]).toBeCloseTo(0.1332, 4)
    // tx = 0.1332 * -914.5784 + 396.5235 = -121.8226 + 396.5235 = 274.7009
    expect(result.data[4]).toBeCloseTo(274.7, 1)
    // ty = 0.1332 * -659.3002 + 450.6102 = -87.8184 + 450.6102 = 362.7918
    expect(result.data[5]).toBeCloseTo(362.79, 1)
  })
})

describe('isIdentityMatrix', () => {
  it('should return true for identity matrix', () => {
    expect(isIdentityMatrix([1, 0, 0, 1, 0, 0])).toBe(true)
  })

  it('should return false for translation', () => {
    expect(isIdentityMatrix([1, 0, 0, 1, 10, 0])).toBe(false)
  })

  it('should return false for scale', () => {
    expect(isIdentityMatrix([2, 0, 0, 2, 0, 0])).toBe(false)
  })

  it('should return false for rotation', () => {
    expect(isIdentityMatrix([0, 1, -1, 0, 0, 0])).toBe(false)
  })
})
