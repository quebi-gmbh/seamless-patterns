import { useZoomView } from '../../hooks/useZoomView'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'

interface ZoomViewProps {
  fabricCanvas: Canvas | null
  zoomLevel: number
  followMode: 'cursor' | 'object' | 'manual'
  selectedObject: ExtendedFabricObject | null
  enabled: boolean
  onZoomLevelChange: (level: number) => void
  onFollowModeChange: (mode: 'cursor' | 'object' | 'manual') => void
}

export function ZoomView({
  fabricCanvas,
  zoomLevel,
  followMode,
  selectedObject,
  enabled,
  onZoomLevelChange,
  onFollowModeChange,
}: ZoomViewProps) {
  const { zoomCanvasRef, centerPoint } = useZoomView({
    fabricCanvas,
    zoomLevel,
    followMode,
    selectedObject,
    enabled,
  })

  if (!enabled) return null

  return (
    <div className="flex flex-col gap-3 bg-bg-elevated rounded-xl border border-border-subtle p-4 shadow-xl">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Zoom View</span>
        <span className="text-xs font-mono text-text-muted bg-bg-dark px-2 py-1 rounded border border-border-subtle tabular-nums">
          {Math.round(centerPoint.x)}, {Math.round(centerPoint.y)}
        </span>
      </div>

      <div className="relative w-52 h-52 rounded-lg overflow-hidden border-2 border-border-subtle bg-bg-dark shadow-lg">
        <canvas
          ref={zoomCanvasRef}
          width={200}
          height={200}
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      <div className="flex flex-col gap-3">
        {/* Zoom Level */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Zoom</label>
          <div className="grid grid-cols-3 gap-2">
            {[2, 3, 4].map((level) => (
              <button
                key={level}
                className={`px-2 py-1.5 rounded text-xs font-medium border transition-all tabular-nums ${
                  zoomLevel === level
                    ? 'bg-accent-teal border-accent-teal text-white'
                    : 'bg-bg-dark border-border-subtle text-text-muted hover:border-text-muted'
                }`}
                onClick={() => onZoomLevelChange(level)}
              >
                {level}x
              </button>
            ))}
          </div>
        </div>

        {/* Follow Mode */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-text-muted">Follow</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              className={`p-2 rounded border transition-all flex items-center justify-center ${
                followMode === 'cursor'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onClick={() => onFollowModeChange('cursor')}
              title="Follow cursor"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${followMode === 'cursor' ? 'opacity-100' : 'opacity-60'}`}>
                <path d="M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
              </svg>
            </button>
            <button
              className={`p-2 rounded border transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
                followMode === 'object'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onClick={() => onFollowModeChange('object')}
              title="Follow selected object"
              disabled={!selectedObject}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${followMode === 'object' ? 'opacity-100' : 'opacity-60'}`}>
                <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z" />
              </svg>
            </button>
            <button
              className={`p-2 rounded border transition-all flex items-center justify-center ${
                followMode === 'manual'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onClick={() => onFollowModeChange('manual')}
              title="Manual control"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${followMode === 'manual' ? 'opacity-100' : 'opacity-60'}`}>
                <path d="M13.13,14.56L14.5,13.2L21,19.7V18.28L15.28,12.5L16.64,11.14L22.36,16.86V3.67L16.64,9.39L15.28,8L22.36,0.91H9.17L15.28,7L13.92,8.36L8.2,2.64V4.06L13.92,9.78L12.56,11.14L4,2.58V4L11.14,11.14L9.78,12.5L4.06,6.78V8.2L8.36,12.5L7,13.87L2.58,9.45H4L11.14,16.59L9.78,18L0.91,9.08V22.27L9.78,13.4L11.14,14.76L4,21.9H5.41L12.5,14.76L13.86,16.13L7.08,22.91H20.27L13.13,15.77V14.56M9.17,22.36L6.11,19.3L7.47,17.94L9.17,19.64V22.36M17.94,19.3L16.58,17.94L19.64,14.88H22.36L17.94,19.3Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
