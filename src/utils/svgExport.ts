import type { Canvas as FabricCanvasType, FabricObject } from 'fabric'
import type { ExtendedFabricObject } from '../types/FabricExtensions'

// Tile offsets for the 3x3 grid (excluding center [0,0])
const TILE_OFFSETS: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],          [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

export interface LayerBackground {
  order: number
  backgroundColor: string
  backgroundAlpha: number
}

/**
 * Generate SVG string from center tile objects
 * Returns SVG with viewBox set to the center tile region
 * Creates temporary copies at all 9 tile positions for proper tiling
 *
 * Handles both virtual tiling mode (1 canonical object at [0,0]) and
 * legacy mode (25 copies across 5x5 grid).
 */
export async function generateCenterTileSVG(
  canvas: FabricCanvasType,
  tileSize: number,
  layerBackgrounds: LayerBackground[] = []
): Promise<string> {
  // Get all canonical tiled objects (excluding grid lines and proxies)
  const canonicalObjects = canvas.getObjects().filter((obj) => {
    const extObj = obj as ExtendedFabricObject
    const isGridLine = (obj as any).gridLine === true
    const isProxy = (obj as any).proxyMetadata?.isProxy === true
    const hasTilePosition = extObj.tiledMetadata?.tilePosition !== undefined

    return !isGridLine && !isProxy && hasTilePosition
  }) as ExtendedFabricObject[]

  // Generate background rects for layers (sorted by order, lowest first)
  const sortedBackgrounds = [...layerBackgrounds].sort((a, b) => a.order - b.order)
  const backgroundRects = sortedBackgrounds
    .map(bg => `<rect width="${tileSize}" height="${tileSize}" fill="${bg.backgroundColor}" fill-opacity="${bg.backgroundAlpha}"/>`)
    .join('')

  if (canonicalObjects.length === 0) {
    // Return empty SVG with layer backgrounds
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}"><rect width="${tileSize}" height="${tileSize}" fill="#1a1a25"/>${backgroundRects}</svg>`
  }

  // Get all objects that should be hidden (grid lines and proxies)
  const objectsToHide = canvas.getObjects().filter((obj) => {
    return (obj as any).gridLine === true || (obj as any).proxyMetadata?.isProxy === true
  })

  // Temporarily hide grid lines and proxies
  objectsToHide.forEach(obj => obj.set({ visible: false }))

  // Create temporary copies at all 8 surrounding tile positions
  const temporaryCopies: FabricObject[] = []

  for (const canonical of canonicalObjects) {
    const originalLeft = canonical.left || 0
    const originalTop = canonical.top || 0

    for (const [tx, ty] of TILE_OFFSETS) {
      // Clone the object (async in Fabric v6)
      const copy = await canonical.clone()
      copy.set({
        left: originalLeft + tx * tileSize,
        top: originalTop + ty * tileSize,
      })
      // Mark as temporary so we can identify it later
      ;(copy as any)._isTemporaryCopy = true
      canvas.add(copy)
      temporaryCopies.push(copy)
    }
  }

  canvas.requestRenderAll()

  try {
    // ViewBox is at center tile [tileSize, 2*tileSize)
    const viewBoxX = tileSize
    const viewBoxY = tileSize

    // Generate SVG with viewBox set to the center tile
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

    // Add base background color and layer backgrounds to SVG
    // Use regex to find the opening <svg> tag and insert after it
    let withBackground = svgString

    if (backgroundRects) {
      // Insert background rects right after the opening <svg ...> tag
      // The regex matches <svg followed by any attributes until the closing >
      withBackground = svgString.replace(
        /(<svg[^>]*>)/,
        `$1<rect width="${tileSize}" height="${tileSize}" fill="#1a1a25"/>${backgroundRects}`
      )
    } else {
      // Just add the base background
      withBackground = svgString.replace(
        /(<svg[^>]*>)/,
        `$1<rect width="${tileSize}" height="${tileSize}" fill="#1a1a25"/>`
      )
    }

    return withBackground
  } finally {
    // Remove temporary copies
    for (const copy of temporaryCopies) {
      canvas.remove(copy)
    }

    // Restore visibility
    objectsToHide.forEach(obj => obj.set({ visible: true }))
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
