import { useZoomView } from '../../hooks/useZoomView'
import { Button } from 'react-aria-components'
import { MousePointer, Crosshair, Move } from 'lucide-react'
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
            <Button
              className={`p-2 rounded border transition-all flex items-center justify-center ${
                followMode === 'cursor'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onPress={() => onFollowModeChange('cursor')}
              aria-label="Follow cursor"
            >
              <MousePointer size={16} className={followMode === 'cursor' ? 'opacity-100' : 'opacity-60'} />
            </Button>
            <Button
              className={`p-2 rounded border transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
                followMode === 'object'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onPress={() => onFollowModeChange('object')}
              aria-label="Follow selected object"
              isDisabled={!selectedObject}
            >
              <Crosshair size={16} className={followMode === 'object' ? 'opacity-100' : 'opacity-60'} />
            </Button>
            <Button
              className={`p-2 rounded border transition-all flex items-center justify-center ${
                followMode === 'manual'
                  ? 'bg-accent-teal border-accent-teal'
                  : 'bg-bg-dark border-border-subtle hover:border-text-muted'
              }`}
              onPress={() => onFollowModeChange('manual')}
              aria-label="Manual control"
            >
              <Move size={16} className={followMode === 'manual' ? 'opacity-100' : 'opacity-60'} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
