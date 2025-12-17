import type { Canvas as FabricCanvasType } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'

/**
 * Detect if canvas is using virtual tiling mode.
 * In virtual tiling mode, all canonical objects have tilePosition [0,0].
 * In legacy mode, objects exist at all 25 tile positions.
 */
function isVirtualTilingMode(canvas: FabricCanvasType): boolean {
  const tiledObjects = canvas.getObjects().filter((obj) => {
    const extObj = obj as ExtendedFabricObject
    return (obj as any).gridLine !== true && extObj.tiledMetadata?.tilePosition !== undefined
  })

  if (tiledObjects.length === 0) return false

  // Check if ALL objects are at tile [0,0] - this indicates virtual tiling mode
  // In legacy mode, there would be objects at other tile positions too
  return tiledObjects.every((obj) => {
    const extObj = obj as ExtendedFabricObject
    const pos = extObj.tiledMetadata?.tilePosition
    return pos && pos[0] === 0 && pos[1] === 0
  })
}

/**
 * Generate SVG string from center tile objects
 * Returns SVG with viewBox set to the center tile region
 * Renders all 9 tiles in the 3x3 grid to ensure proper tiling at edges
 *
 * Handles both virtual tiling mode (1 canonical object at [0,0]) and
 * legacy mode (25 copies across 5x5 grid).
 */
export function generateCenterTileSVG(
  canvas: FabricCanvasType,
  tileSize: number
): string {
  // Get all tiled objects (excluding grid lines)
  const tiledObjects = canvas.getObjects().filter((obj) => {
    const extObj = obj as ExtendedFabricObject
    const isGridLine = (obj as any).gridLine === true
    const hasTilePosition = extObj.tiledMetadata?.tilePosition !== undefined

    return !isGridLine && hasTilePosition
  })

  if (tiledObjects.length === 0) {
    // Return empty SVG for empty canvas
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}"><rect width="${tileSize}" height="${tileSize}" fill="#1a1a25"/></svg>`
  }

  // Get all objects that should be hidden (only grid lines)
  const gridLines = canvas.getObjects().filter((obj) => {
    return (obj as any).gridLine === true
  })

  // Temporarily hide grid lines
  gridLines.forEach(obj => obj.set({ visible: false }))
  canvas.requestRenderAll()

  // Detect if we're in virtual tiling mode
  const virtualMode = isVirtualTilingMode(canvas)

  try {
    // Determine the viewBox based on tiling mode:
    // - Virtual tiling: canonical objects are at [0, tileSize) range (tile [0,0])
    // - Legacy mode: objects exist at center tile [tileSize, 2*tileSize) (tile [1,1] in 5x5 grid)
    //   but we actually have copies at all tiles, so we target [tileSize, tileSize]
    const viewBoxX = virtualMode ? 0 : tileSize
    const viewBoxY = virtualMode ? 0 : tileSize

    // Generate SVG with viewBox set to the appropriate tile
    const svgString = canvas.toSVG({
      viewBox: {
        x: viewBoxX,
        y: viewBoxY,
        width: tileSize,
        height: tileSize
      },
      width: `${tileSize}`,
      height: `${tileSize}`
    })

    // Add background color to SVG if not present
    const withBackground = svgString.replace(
      '<svg',
      `<svg style="background-color: #1a1a25"`
    )

    return withBackground
  } finally {
    // Restore visibility
    gridLines.forEach(obj => obj.set({ visible: true }))
    canvas.requestRenderAll()
  }
}

/**
 * Rasterize an SVG string to a PNG data URL at the specified resolution
 */
export async function rasterizeSVG(
  svgString: string,
  targetWidth: number,
  targetHeight: number,
  imageSmoothingEnabled: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create blob URL from SVG string
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const img = new Image()

    img.onload = () => {
      try {
        // Create canvas at target resolution
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        // Configure image smoothing
        ctx.imageSmoothingEnabled = imageSmoothingEnabled
        if (imageSmoothingEnabled) {
          ctx.imageSmoothingQuality = 'high'
        }

        // Draw SVG to canvas at target resolution
        // The browser automatically scales the SVG
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        // Clean up blob URL
        URL.revokeObjectURL(url)

        // Return as PNG data URL
        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load SVG'))
    }

    img.src = url
  })
}

/**
 * Convert PNG data URL to another format (JPEG or BMP)
 */
export async function convertFormat(
  pngDataUrl: string,
  format: 'jpeg' | 'bmp',
  quality: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        // For JPEG, fill white background (no transparency support)
        if (format === 'jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        ctx.drawImage(img, 0, 0)

        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/bmp'
        resolve(canvas.toDataURL(mimeType, quality))
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for format conversion'))
    img.src = pngDataUrl
  })
}

/**
 * Download a file from a data URL or text content
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'application/octet-stream'
): void {
  const link = document.createElement('a')
  link.download = filename

  // If content is already a data URL, use it directly
  if (content.startsWith('data:')) {
    link.href = content
  } else {
    // Create blob for text content (e.g., SVG strings)
    const blob = new Blob([content], { type: mimeType })
    link.href = URL.createObjectURL(blob)
  }

  link.click()

  // Clean up blob URL if we created one
  if (!content.startsWith('data:')) {
    URL.revokeObjectURL(link.href)
  }
}

/**
 * Validate that a resolution is within acceptable bounds
 */
export function validateResolution(resolution: number): boolean {
  const MAX_RESOLUTION = 8192
  const MIN_RESOLUTION = 128
  return resolution >= MIN_RESOLUTION && resolution <= MAX_RESOLUTION
}
