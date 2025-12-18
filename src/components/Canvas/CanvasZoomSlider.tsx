import { RotateCcw } from 'lucide-react'

interface CanvasZoomSliderProps {
  zoom: number
  onZoomChange: (zoom: number) => void
}

export function CanvasZoomSlider({ zoom, onZoomChange }: CanvasZoomSliderProps) {
  const percentage = Math.round(zoom * 100)

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-text-muted whitespace-nowrap">Zoom</span>
      <input
        type="range"
        min={100}
        max={400}
        step={25}
        value={percentage}
        onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
        className="flex-1 h-1.5 bg-bg-dark rounded-full appearance-none cursor-pointer accent-primary"
      />
      <span className="text-xs font-mono text-text-muted bg-bg-dark px-2 py-1 rounded border border-primary/10 tabular-nums min-w-[3.5rem] text-center">
        {percentage}%
      </span>
      {zoom !== 1 && (
        <button
          onClick={() => onZoomChange(1)}
          className="p-1.5 rounded border border-primary/10 bg-bg-dark text-text-muted hover:text-text-primary hover:border-primary/30 transition-colors"
          title="Reset to 100%"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  )
}
