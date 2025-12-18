import { describe, it, expect } from 'vitest'
import { mergePathStrings, mergePathData } from './mergePaths'
import { parsePathData } from './path'

describe('mergePathStrings', () => {
  it('should return null for empty array', () => {
    const result = mergePathStrings([])
    expect(result).toBeNull()
  })

  it('should return the same string for single path', () => {
    const result = mergePathStrings(['M10 20L30 40'])
    expect(result).toBe('M10 20L30 40')
  })

  it('should merge two simple paths', () => {
    const result = mergePathStrings(['M10 20L30 40', 'M50 60L70 80'])
    expect(result).not.toBeNull()
    // Should contain both path data
    const parsed = parsePathData(result!)
    expect(parsed.length).toBeGreaterThan(2)
    // First path's commands
    expect(parsed[0]).toEqual({ command: 'M', args: [10, 20] })
    // Second path should also be present
    const hasSecondPath = parsed.some(
      cmd => cmd.command === 'M' && cmd.args[0] === 50 && cmd.args[1] === 60
    )
    expect(hasSecondPath).toBe(true)
  })

  it('should merge paths with different commands', () => {
    const result = mergePathStrings([
      'M10 20L30 40',
      'M50 60C70 80 90 100 110 120'
    ])
    expect(result).not.toBeNull()
    const parsed = parsePathData(result!)
    // Should have M, L (implicit), M, C
    expect(parsed.some(cmd => cmd.command === 'C')).toBe(true)
  })

  it('should handle paths with closepath', () => {
    const result = mergePathStrings([
      'M10 20L30 40Z',
      'M50 60L70 80Z'
    ])
    expect(result).not.toBeNull()
    const parsed = parsePathData(result!)
    // Should have two Z commands
    const zCount = parsed.filter(cmd => cmd.command === 'Z' || cmd.command === 'z').length
    expect(zCount).toBe(2)
  })

  it('should apply precision option', () => {
    // Need at least 2 paths to trigger merging/stringifying with precision
    const result = mergePathStrings(
      ['M10.123456 20.987654', 'M30.555555 40.666666'],
      { floatPrecision: 2 }
    )
    expect(result).not.toBeNull()
    expect(result).toContain('10.12')
    expect(result).toContain('20.99')
    expect(result).toContain('30.56')
    expect(result).toContain('40.67')
  })

  it('should skip invalid/empty paths', () => {
    const result = mergePathStrings(['M10 20L30 40', '', 'M50 60L70 80'])
    expect(result).not.toBeNull()
    const parsed = parsePathData(result!)
    // Should have commands from both valid paths
    expect(parsed.length).toBeGreaterThan(2)
  })

  it('should skip paths that dont start with M/m', () => {
    const result = mergePathStrings(['M10 20L30 40', 'L50 60', 'M70 80L90 100'])
    expect(result).not.toBeNull()
    // The "L50 60" path should be skipped
    const parsed = parsePathData(result!)
    expect(parsed.length).toBe(4) // M L M L
  })

  it('should merge real-world complex paths', () => {
    const path1 = 'M 1366.47 1024 L 1343.76 1024 Q 1343.45 1021.23 1343.77 1019.27'
    const path2 = 'M 774.85 1024 L 696.84 1024 C 696.27 1019.97 695.87 1015.81 694.74 1012.06'

    const result = mergePathStrings([path1, path2])
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    // Should have all commands from both paths
    expect(parsed.length).toBe(6) // M L Q M L C

    // Verify first path's start
    expect(parsed[0].command).toBe('M')
    expect(parsed[0].args[0]).toBeCloseTo(1366.47, 1)

    // Verify second path's start is present
    const secondM = parsed.find((cmd, i) => i > 0 && cmd.command === 'M')
    expect(secondM).toBeDefined()
    expect(secondM!.args[0]).toBeCloseTo(774.85, 1)
  })

  it('should handle paths with arc commands', () => {
    const result = mergePathStrings([
      'M10 20A5 5 0 0 1 15 25',
      'M30 40A10 10 0 1 0 50 60'
    ])
    expect(result).not.toBeNull()
    const parsed = parsePathData(result!)
    const arcCount = parsed.filter(cmd => cmd.command === 'A' || cmd.command === 'a').length
    expect(arcCount).toBe(2)
  })

  it('should preserve all commands when merging multiple paths', () => {
    const paths = [
      'M0 0L10 10',
      'M20 20L30 30',
      'M40 40L50 50'
    ]
    const result = mergePathStrings(paths)
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    // 3 M commands + 3 L commands = 6 total
    expect(parsed.length).toBe(6)

    const mCount = parsed.filter(cmd => cmd.command === 'M').length
    expect(mCount).toBe(3)
  })
})

describe('mergePathData', () => {
  it('should return empty array for empty input', () => {
    const result = mergePathData([])
    expect(result).toEqual([])
  })

  it('should return the same data for single path', () => {
    const pathData = parsePathData('M10 20L30 40')
    const result = mergePathData([pathData])
    expect(result).toEqual(pathData)
  })

  it('should merge two path data arrays', () => {
    const path1 = parsePathData('M10 20L30 40')
    const path2 = parsePathData('M50 60L70 80')

    const result = mergePathData([path1, path2])
    expect(result.length).toBe(4) // M L M L
    expect(result[0]).toEqual({ command: 'M', args: [10, 20] })
    expect(result[2]).toEqual({ command: 'M', args: [50, 60] })
  })

  it('should merge multiple path data arrays', () => {
    const paths = [
      parsePathData('M0 0L10 10'),
      parsePathData('M20 20L30 30'),
      parsePathData('M40 40L50 50')
    ]

    const result = mergePathData(paths)
    expect(result.length).toBe(6)
  })
})

describe('edge cases', () => {
  it('should handle whitespace-only strings', () => {
    const result = mergePathStrings(['   ', '\t\n', 'M10 20'])
    // Should skip whitespace-only strings
    expect(result).toBe('M10 20')
  })

  it('should handle very long paths', () => {
    // Create a path with many commands
    let longPath = 'M0 0'
    for (let i = 1; i <= 100; i++) {
      longPath += ` L${i * 10} ${i * 10}`
    }

    const result = mergePathStrings([longPath, 'M1000 1000L1010 1010'])
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    expect(parsed.length).toBe(103) // 1 M + 100 L + 1 M + 1 L
  })

  it('should handle scientific notation numbers', () => {
    const result = mergePathStrings(['M1e2 2e2L3e2 4e2'])
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    expect(parsed[0].args[0]).toBe(100)
    expect(parsed[0].args[1]).toBe(200)
  })

  it('should handle negative coordinates', () => {
    const result = mergePathStrings(['M-10 -20L-30 -40', 'M-50 -60L-70 -80'])
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    expect(parsed[0].args[0]).toBe(-10)
    expect(parsed[0].args[1]).toBe(-20)
  })

  it('should handle mixed relative and absolute commands', () => {
    // Note: relative commands are converted to absolute in parsing
    const result = mergePathStrings(['M10 20l30 40', 'M50 60l70 80'])
    expect(result).not.toBeNull()

    const parsed = parsePathData(result!)
    expect(parsed.length).toBeGreaterThan(0)
  })
})
