import type { FabricObject } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'
import { mergePathStrings } from '../lib/svgo/mergePaths'
import { parsePathData, stringifyPathData } from '../lib/svgo/path'
import { transform2js, transformsMultiply, isIdentityMatrix } from '../lib/svgo/transforms'
import { applyMatrixToPathData } from '../lib/svgo/applyTransforms'
import { convertSvgShapeToPath, canConvertToPath } from '../lib/svgo/convertShapeToPath'

/**
 * Extracted path data for merging
 */
export interface PathData {
  pathString: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
  left: number
  top: number
  scaleX: number
  scaleY: number
  angle: number
}

/**
 * Extract transform attribute value from an SVG element
 */
function extractTransformAttr(svgString: string, element: string): string {
  const regex = new RegExp(`<${element}[^>]*\\stransform="([^"]*)"`, 'i')
  const match = svgString.match(regex)
  return match ? match[1] : ''
}

/**
 * Extract path data from a Fabric.js object (Path or shape)
 * Converts shapes to paths and applies transforms to get absolute coordinates
 */
export function extractPathData(obj: FabricObject): PathData {
  // Get the object's SVG representation
  const svgString = obj.toSVG()
  const objType = obj.type || 'unknown'
  console.log(`[extractPathData] Object type: ${objType}`)
  console.log('[extractPathData] SVG string:', svgString.substring(0, 400))

  // Extract transforms from <g> element
  const gTransform = extractTransformAttr(svgString, 'g')
  console.log('[extractPathData] g transform:', gTransform)

  // Parse g transform
  const gTransforms = transform2js(gTransform)

  let pathString = ''
  let elementTransforms: ReturnType<typeof transform2js> = []

  // Check if this is already a path element
  const pathMatch = svgString.match(/<path[^>]*\sd="([^"]+)"/)
  if (pathMatch) {
    // It's a path - extract d attribute and path transform
    pathString = pathMatch[1]
    const pathTransform = extractTransformAttr(svgString, 'path')
    console.log('[extractPathData] path transform:', pathTransform)
    elementTransforms = transform2js(pathTransform)
  } else {
    // It's a shape - try to convert it to a path
    console.log('[extractPathData] Not a path, attempting shape conversion...')
    const converted = convertSvgShapeToPath(svgString)
    if (converted) {
      pathString = converted.pathString
      console.log(`[extractPathData] Converted ${converted.shapeType} to path:`, pathString.substring(0, 100))
      // Extract transform from the shape element
      const shapeTransform = extractTransformAttr(svgString, converted.shapeType)
      console.log(`[extractPathData] ${converted.shapeType} transform:`, shapeTransform)
      elementTransforms = transform2js(shapeTransform)
    } else {
      console.error('[extractPathData] Failed to convert shape to path')
    }
  }

  // Combine all transforms
  const allTransforms = [...gTransforms, ...elementTransforms]
  const combinedMatrix = transformsMultiply(allTransforms)
  console.log('[extractPathData] Combined matrix:', combinedMatrix.data)

  console.log('[extractPathData] Original path:', pathString.substring(0, 100))

  // Apply transforms to path data if there are any
  if (allTransforms.length > 0 && !isIdentityMatrix(combinedMatrix.data)) {
    try {
      const pathData = parsePathData(pathString)
      if (pathData.length > 0) {
        applyMatrixToPathData(pathData, combinedMatrix.data)
        pathString = stringifyPathData({ pathData, precision: 3 })
        console.log('[extractPathData] Transformed path:', pathString.substring(0, 100))
      }
    } catch (error) {
      console.error('[extractPathData] Failed to apply transforms:', error)
    }
  }

  return {
    pathString,
    fill: (obj as FabricObject & { fill?: string }).fill as string | null,
    stroke: (obj as FabricObject & { stroke?: string }).stroke as string | null,
    strokeWidth: (obj as FabricObject & { strokeWidth?: number }).strokeWidth || 0,
    left: obj.left || 0,
    top: obj.top || 0,
    scaleX: obj.scaleX || 1,
    scaleY: obj.scaleY || 1,
    angle: obj.angle || 0,
  }
}

/**
 * Merge multiple paths into a single path string
 * Uses browser-compatible path merging from local SVGO implementation
 */
export function mergePaths(paths: PathData[]): string | null {
  console.log('[mergePaths] Input paths:', paths.length)

  if (paths.length === 0) {
    console.log('[mergePaths] No paths to merge')
    return null
  }
  if (paths.length === 1) {
    console.log('[mergePaths] Only one path, returning as-is')
    return paths[0].pathString
  }

  // Filter out empty paths
  const validPaths = paths.filter(p => p.pathString && p.pathString.trim())
  console.log('[mergePaths] Valid paths after filtering:', validPaths.length)

  if (validPaths.length === 0) {
    console.log('[mergePaths] No valid paths after filtering')
    return null
  }
  if (validPaths.length === 1) {
    console.log('[mergePaths] Only one valid path after filtering')
    return validPaths[0].pathString
  }

  // Extract path strings
  const pathStrings = validPaths.map(p => p.pathString.trim())
  console.log('[mergePaths] Path strings to merge:', pathStrings.map(s => s.substring(0, 30) + '...'))

  // Merge using local SVGO implementation
  try {
    console.log('[mergePaths] Calling mergePathStrings...')
    const merged = mergePathStrings(pathStrings, {
      force: true,
      floatPrecision: 3,
    })
    console.log('[mergePaths] Merge result:', merged?.substring(0, 50) + (merged && merged.length > 50 ? '...' : ''))

    return merged
  } catch (error) {
    console.error('[mergePaths] Failed to merge paths:', error)
    // Fall back to simple concatenation
    const fallback = pathStrings.join(' ')
    console.log('[mergePaths] Using fallback concatenation')
    return fallback
  }
}

/**
 * Check if the given objects can be merged
 * Returns true if all objects are paths or convertible shapes
 */
export function canMergePaths(objects: ExtendedFabricObject[]): boolean {
  if (objects.length < 2) return false

  return objects.every(obj => {
    // Check if object is a path or a shape that can be converted to path
    return canConvertToPath(obj.type || '')
  })
}

/**
 * Get the bounding box that contains all paths
 */
export function getCombinedBounds(paths: PathData[]): { left: number; top: number; width: number; height: number } {
  if (paths.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }

  // This is a simplified version - actual bounds would need path parsing
  // For now, use the first path's position as reference
  const first = paths[0]
  return {
    left: first.left,
    top: first.top,
    width: 100, // Placeholder
    height: 100, // Placeholder
  }
}
