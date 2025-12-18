import { Canvas, BaseBrush, Path, Point, TBrushEventData } from 'fabric'
import polygonClipping from 'polygon-clipping'
import simplify from 'simplify-js'
import fitCurve from 'fit-curve'

interface StrokePoint {
  x: number
  y: number
  width: number
}

interface SimplePoint {
  x: number
  y: number
}

type Ring = [number, number][]
type Polygon = Ring[]
type MultiPolygon = Polygon[]

/**
 * VarioBrush - A brush where stroke width varies inversely with movement speed.
 *
 * Formula: actualWidth = (sizeFactor * 100) / speed
 * - At 100 px/sec with sizeFactor=10 → 10px width
 * - At 50 px/sec with sizeFactor=10 → 20px width
 * - At 200 px/sec with sizeFactor=10 → 5px width
 *
 * Uses polygon-clipping for union, simplify-js for point reduction,
 * and fit-curve for smooth Bezier output.
 */
export class VarioBrush extends BaseBrush {
  private points: StrokePoint[] = []
  private lastTime: number = 0
  private lastPoint: Point | null = null
  private smoothedWidth: number
  private sizeFactor: number
  private strokeStartTime: number = 0

  declare color: string
  declare canvas: Canvas

  constructor(canvas: Canvas, sizeFactor: number = 10) {
    super(canvas)
    this.sizeFactor = sizeFactor
    this.smoothedWidth = sizeFactor
    this.color = '#000000'
  }

  /**
   * Called when mouse/touch starts
   */
  onMouseDown(pointer: Point, _ev: TBrushEventData): void {
    const now = performance.now()
    this.strokeStartTime = now
    // Start with minimal width for fade-in effect
    this.smoothedWidth = 1
    this.points = [{ x: pointer.x, y: pointer.y, width: this.smoothedWidth }]
    this.lastTime = now
    this.lastPoint = pointer
    this._render()
  }

  /**
   * Called during mouse/touch move
   */
  onMouseMove(pointer: Point, _ev: TBrushEventData): void {
    if (!this.lastPoint) return

    const now = performance.now()
    const timeDelta = now - this.lastTime

    // Avoid division by zero and filter out very fast events
    if (timeDelta < 1) return

    const distance = Math.hypot(pointer.x - this.lastPoint.x, pointer.y - this.lastPoint.y)

    // Skip if barely moved (prevents jitter)
    if (distance < 1) return

    const speed = (distance / timeDelta) * 1000 // Convert to px/sec

    // Inverse relationship: slower = wider
    // Formula: width = (sizeFactor * 100) / speed
    // Use minimum speed of 10 px/sec to prevent extremely wide strokes
    const effectiveSpeed = Math.max(speed, 10)
    const targetWidth = (this.sizeFactor * 100) / effectiveSpeed

    // Clamp width: minimum 1px, maximum 2x the brush size
    const maxWidth = this.sizeFactor * 2
    const clampedWidth = Math.min(Math.max(targetWidth, 1), maxWidth)

    // Apply fade-in effect during first second of stroke
    const strokeElapsed = now - this.strokeStartTime
    const fadeInDuration = 1000 // 1 second
    const fadeInFactor = Math.min(strokeElapsed / fadeInDuration, 1)
    const fadedWidth = clampedWidth * fadeInFactor

    // Apply exponential smoothing to prevent jarring width changes
    this.smoothedWidth = this.smoothedWidth * 0.7 + fadedWidth * 0.3

    this.points.push({ x: pointer.x, y: pointer.y, width: this.smoothedWidth })
    this._render()

    this.lastTime = now
    this.lastPoint = pointer
  }

  /**
   * Called when mouse/touch ends
   */
  onMouseUp(_ev: TBrushEventData): boolean {
    if (this.points.length < 2) {
      // Single click - create a dot
      if (this.points.length === 1) {
        const point = this.points[0]
        this.points.push({ x: point.x + 0.1, y: point.y + 0.1, width: point.width })
      } else {
        return false
      }
    }

    const pathData = this._createPathData()
    if (!pathData) return false

    const path = new Path(pathData, {
      fill: this.color,
      stroke: null,
      strokeWidth: 0,
    })

    this.canvas.add(path)
    this.canvas.fire('path:created', { path })
    this.canvas.clearContext(this.canvas.contextTop)

    // Reset state
    this.points = []
    this.lastPoint = null

    return true
  }

  /**
   * Render the stroke preview on the top canvas context.
   * Uses simple overlapping shapes for performance (no union during preview).
   */
  _render(): void {
    const ctx = this.canvas.contextTop
    if (!ctx) return

    this.canvas.clearContext(ctx)
    ctx.save()

    const vpt = this.canvas.viewportTransform
    if (vpt) {
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5])
    }

    ctx.fillStyle = this.color

    if (this.points.length < 1) {
      ctx.restore()
      return
    }

    // Draw circles at each point
    for (const p of this.points) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.width / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw quads between consecutive points
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i]
      const p2 = this.points[i + 1]

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.hypot(dx, dy)
      if (len < 0.001) continue

      // Perpendicular unit vector
      const nx = -dy / len
      const ny = dx / len

      const w1 = p1.width / 2
      const w2 = p2.width / 2

      ctx.beginPath()
      ctx.moveTo(p1.x + nx * w1, p1.y + ny * w1)
      ctx.lineTo(p1.x - nx * w1, p1.y - ny * w1)
      ctx.lineTo(p2.x - nx * w2, p2.y - ny * w2)
      ctx.lineTo(p2.x + nx * w2, p2.y + ny * w2)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }

  /**
   * Resample input points to reduce density while preserving width variation.
   * Uses simplify-js on positions, then interpolates widths.
   */
  private _resamplePoints(points: StrokePoint[], tolerance: number = 2): StrokePoint[] {
    if (points.length < 3) return points

    // Simplify the path using Douglas-Peucker
    const simplified = simplify(
      points.map((p) => ({ x: p.x, y: p.y })),
      tolerance,
      true // high quality
    )

    // Map simplified points back to stroke points with interpolated widths
    const result: StrokePoint[] = []
    for (const sp of simplified) {
      // Find closest original point to get width
      let minDist = Infinity
      let closestWidth = points[0].width
      for (const op of points) {
        const dist = Math.hypot(sp.x - op.x, sp.y - op.y)
        if (dist < minDist) {
          minDist = dist
          closestWidth = op.width
        }
      }
      result.push({ x: sp.x, y: sp.y, width: closestWidth })
    }

    return result
  }

  /**
   * Create a circle polygon with specified center, radius, and segments
   */
  private _createCircle(cx: number, cy: number, r: number, segments: number): Ring {
    const points: Ring = []
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
    }
    return points
  }

  /**
   * Build polygon by unioning quads and circles.
   * This handles self-intersections cleanly.
   */
  private _buildPolygon(): SimplePoint[] {
    // Step 1: Resample input points to reduce density
    const resampledPoints = this._resamplePoints(this.points, 3)
    if (resampledPoints.length < 2) return []

    const allPolygons: Ring[] = []

    // Create quads for each segment
    for (let i = 0; i < resampledPoints.length - 1; i++) {
      const p1 = resampledPoints[i]
      const p2 = resampledPoints[i + 1]

      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      const len = Math.hypot(dx, dy)
      if (len < 0.001) continue

      // Perpendicular unit vector
      const nx = -dy / len
      const ny = dx / len

      const w1 = p1.width / 2
      const w2 = p2.width / 2

      // Quad corners - must be in counter-clockwise order for polygon-clipping
      const quad: Ring = [
        [p1.x + nx * w1, p1.y + ny * w1],
        [p2.x + nx * w2, p2.y + ny * w2],
        [p2.x - nx * w2, p2.y - ny * w2],
        [p1.x - nx * w1, p1.y - ny * w1],
        [p1.x + nx * w1, p1.y + ny * w1], // close
      ]
      allPolygons.push(quad)
    }

    // Create circles at each point for round joins (use more segments for smoother look)
    for (const p of resampledPoints) {
      const circle = this._createCircle(p.x, p.y, p.width / 2, 24)
      allPolygons.push(circle)
    }

    // Union all polygons
    if (allPolygons.length === 0) return []

    try {
      let result: MultiPolygon = [[allPolygons[0]]]
      for (let i = 1; i < allPolygons.length; i++) {
        result = polygonClipping.union(result, [[allPolygons[i]]])
      }

      // Convert to SimplePoint[] - take the outer ring of the first polygon
      if (result.length > 0 && result[0].length > 0) {
        let outline = result[0][0].map(([x, y]) => ({ x, y }))

        // Step 2: Simplify the output polygon
        outline = simplify(outline, 0.5, true)

        return outline
      }
    } catch (e) {
      // Fallback to simple rendering if union fails
      console.warn('Polygon union failed, using fallback', e)
    }

    return []
  }

  /**
   * Create SVG path data with smooth Bezier curves
   */
  private _createPathData(): string | null {
    const polygon = this._buildPolygon()
    if (polygon.length < 3) return null

    // Convert to format expected by fit-curve: [[x, y], [x, y], ...]
    const points: [number, number][] = polygon.map((p) => [p.x, p.y])

    // Close the polygon by adding the first point at the end
    if (
      points.length > 0 &&
      (points[0][0] !== points[points.length - 1][0] ||
        points[0][1] !== points[points.length - 1][1])
    ) {
      points.push([points[0][0], points[0][1]])
    }

    try {
      // Fit Bezier curves through the points
      // Error tolerance controls smoothness vs accuracy
      const bezierCurves = fitCurve(points, 2.0) // tolerance of 2 pixels

      if (bezierCurves.length === 0) {
        // Fallback to simple polygon
        return this._createSimplePathData(polygon)
      }

      // Build SVG path from Bezier curves
      let pathData = `M ${bezierCurves[0][0][0].toFixed(2)} ${bezierCurves[0][0][1].toFixed(2)}`

      for (const curve of bezierCurves) {
        // curve is [p0, p1, p2, p3] where p0=start, p1,p2=control points, p3=end
        pathData += ` C ${curve[1][0].toFixed(2)} ${curve[1][1].toFixed(2)}, ${curve[2][0].toFixed(2)} ${curve[2][1].toFixed(2)}, ${curve[3][0].toFixed(2)} ${curve[3][1].toFixed(2)}`
      }

      pathData += ' Z'
      return pathData
    } catch (e) {
      console.warn('Bezier fitting failed, using simple path', e)
      return this._createSimplePathData(polygon)
    }
  }

  /**
   * Create simple SVG path data (fallback)
   */
  private _createSimplePathData(polygon: SimplePoint[]): string | null {
    if (polygon.length < 3) return null

    let pathData = `M ${polygon[0].x.toFixed(2)} ${polygon[0].y.toFixed(2)}`

    for (let i = 1; i < polygon.length; i++) {
      pathData += ` L ${polygon[i].x.toFixed(2)} ${polygon[i].y.toFixed(2)}`
    }

    pathData += ' Z'
    return pathData
  }
}
