/**
 * SVG utility functions for handling inner content extraction and wrapping
 */

/**
 * Extract inner content from SVG (strip root <svg> tag)
 * If the input doesn't contain an <svg> tag, assumes it's already inner content
 */
export function extractSVGInnerContent(svgCode: string): string | null {
  const trimmed = svgCode.trim()

  if (!trimmed) {
    return null
  }

  // Parse as XML
  const parser = new DOMParser()
  const doc = parser.parseFromString(trimmed, 'image/svg+xml')
  const parserError = doc.querySelector('parsererror')

  if (parserError) {
    return null // Invalid SVG
  }

  const svgElement = doc.querySelector('svg')
  if (!svgElement) {
    // No SVG tag - assume it's already inner content
    return trimmed
  }

  // Extract all children as string
  const innerContent = Array.from(svgElement.children)
    .map(child => new XMLSerializer().serializeToString(child))
    .join('\n')

  return innerContent || ''
}

/**
 * Wrap inner SVG content with proper <svg> tag
 */
export function wrapSVGContent(
  innerContent: string,
  width: number = 100,
  height: number = 100,
  viewBox?: string
): string {
  const vb = viewBox || `0 0 ${width} ${height}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vb}">
${innerContent}
</svg>`
}

/**
 * Extract viewBox from SVG if present
 */
export function extractViewBox(svgCode: string): string | null {
  try {
    const trimmed = svgCode.trim()
    const parser = new DOMParser()
    const doc = parser.parseFromString(trimmed, 'image/svg+xml')
    const svgElement = doc.querySelector('svg')

    return svgElement?.getAttribute('viewBox') || null
  } catch {
    return null
  }
}

/**
 * Validate SVG content (inner or complete)
 * Returns true if the content is valid SVG XML
 */
export function validateSVGContent(content: string): boolean {
  try {
    const trimmed = content.trim()

    if (!trimmed) {
      return false
    }

    const parser = new DOMParser()

    // If content doesn't have an <svg> tag, wrap it for validation
    const testContent = trimmed.toLowerCase().includes('<svg')
      ? trimmed
      : wrapSVGContent(trimmed)

    const doc = parser.parseFromString(testContent, 'image/svg+xml')
    const parserError = doc.querySelector('parsererror')

    return !parserError
  } catch {
    return false
  }
}
