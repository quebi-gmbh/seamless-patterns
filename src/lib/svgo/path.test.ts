import { describe, it, expect } from 'vitest'
import { parsePathData, stringifyPathData } from './path'

describe('parsePathData', () => {
  it('should parse a simple moveto command', () => {
    const result = parsePathData('M 10 20')
    expect(result).toEqual([{ command: 'M', args: [10, 20] }])
  })

  it('should parse a relative moveto command', () => {
    const result = parsePathData('m 10 20')
    expect(result).toEqual([{ command: 'm', args: [10, 20] }]) // Parser preserves original case
  })

  it('should parse moveto followed by lineto', () => {
    const result = parsePathData('M 10 20 L 30 40')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'L', args: [30, 40] }
    ])
  })

  it('should parse implicit lineto after moveto', () => {
    const result = parsePathData('M 10 20 30 40')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'L', args: [30, 40] }
    ])
  })

  it('should parse cubic bezier curve', () => {
    const result = parsePathData('M 10 20 C 30 40 50 60 70 80')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'C', args: [30, 40, 50, 60, 70, 80] }
    ])
  })

  it('should parse quadratic bezier curve', () => {
    const result = parsePathData('M 10 20 Q 30 40 50 60')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'Q', args: [30, 40, 50, 60] }
    ])
  })

  it('should parse arc command', () => {
    const result = parsePathData('M 10 20 A 5 5 0 0 1 15 25')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'A', args: [5, 5, 0, 0, 1, 15, 25] }
    ])
  })

  it('should parse closepath command', () => {
    const result = parsePathData('M 10 20 L 30 40 Z')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'L', args: [30, 40] },
      { command: 'Z', args: [] }
    ])
  })

  it('should handle decimal numbers', () => {
    const result = parsePathData('M 10.5 20.75')
    expect(result).toEqual([{ command: 'M', args: [10.5, 20.75] }])
  })

  it('should handle negative numbers', () => {
    const result = parsePathData('M -10 -20')
    expect(result).toEqual([{ command: 'M', args: [-10, -20] }])
  })

  it('should handle numbers without spaces (compact format)', () => {
    const result = parsePathData('M10 20L30 40')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'L', args: [30, 40] }
    ])
  })

  it('should handle comma-separated values', () => {
    const result = parsePathData('M 10,20 L 30,40')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'L', args: [30, 40] }
    ])
  })

  it('should handle horizontal lineto', () => {
    const result = parsePathData('M 10 20 H 30')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'H', args: [30] }
    ])
  })

  it('should handle vertical lineto', () => {
    const result = parsePathData('M 10 20 V 40')
    expect(result).toEqual([
      { command: 'M', args: [10, 20] },
      { command: 'V', args: [40] }
    ])
  })

  it('should return empty array for empty string', () => {
    const result = parsePathData('')
    expect(result).toEqual([])
  })

  it('should return empty array for invalid path (not starting with M/m)', () => {
    const result = parsePathData('L 10 20')
    expect(result).toEqual([])
  })

  it('should parse complex real-world path', () => {
    const result = parsePathData('M 1366.47 1024 L 1343.76 1024 Q 1343.45 1021.23 1343.77 1019.27')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ command: 'M', args: [1366.47, 1024] })
    expect(result[1]).toEqual({ command: 'L', args: [1343.76, 1024] })
    expect(result[2]).toEqual({ command: 'Q', args: [1343.45, 1021.23, 1343.77, 1019.27] })
  })
})

describe('stringifyPathData', () => {
  it('should stringify a simple moveto command', () => {
    const result = stringifyPathData({
      pathData: [{ command: 'M', args: [10, 20] }]
    })
    expect(result).toBe('M10 20')
  })

  it('should stringify moveto followed by lineto', () => {
    const result = stringifyPathData({
      pathData: [
        { command: 'M', args: [10, 20] },
        { command: 'L', args: [30, 40] }
      ]
    })
    expect(result).toBe('M10 20 30 40')  // L is implicit after M
  })

  it('should stringify cubic bezier curve', () => {
    const result = stringifyPathData({
      pathData: [
        { command: 'M', args: [10, 20] },
        { command: 'C', args: [30, 40, 50, 60, 70, 80] }
      ]
    })
    expect(result).toBe('M10 20C30 40 50 60 70 80')
  })

  it('should apply precision rounding', () => {
    const result = stringifyPathData({
      pathData: [{ command: 'M', args: [10.123456, 20.987654] }],
      precision: 2
    })
    expect(result).toBe('M10.12 20.99')
  })

  it('should remove leading zeros', () => {
    const result = stringifyPathData({
      pathData: [{ command: 'M', args: [0.5, 0.25] }]
    })
    expect(result).toBe('M.5.25')
  })

  it('should handle negative numbers without extra space', () => {
    const result = stringifyPathData({
      pathData: [{ command: 'M', args: [10, -20] }]
    })
    expect(result).toBe('M10-20')
  })

  it('should stringify closepath', () => {
    const result = stringifyPathData({
      pathData: [
        { command: 'M', args: [10, 20] },
        { command: 'L', args: [30, 40] },
        { command: 'Z', args: [] }
      ]
    })
    expect(result).toContain('Z')
  })

  it('should combine consecutive same commands', () => {
    const result = stringifyPathData({
      pathData: [
        { command: 'M', args: [10, 20] },
        { command: 'L', args: [30, 40] },
        { command: 'L', args: [50, 60] }
      ]
    })
    // Should combine the L commands
    expect(result).toBe('M10 20 30 40 50 60')
  })
})

describe('parsePathData and stringifyPathData roundtrip', () => {
  it('should roundtrip a simple path', () => {
    const original = 'M10 20L30 40'
    const parsed = parsePathData(original)
    const stringified = stringifyPathData({ pathData: parsed })
    const reparsed = parsePathData(stringified)

    expect(reparsed).toEqual(parsed)
  })

  it('should roundtrip a complex path', () => {
    const original = 'M100 200C300 400 500 600 700 800Q900 1000 1100 1200Z'
    const parsed = parsePathData(original)
    const stringified = stringifyPathData({ pathData: parsed })
    const reparsed = parsePathData(stringified)

    expect(reparsed).toEqual(parsed)
  })
})
