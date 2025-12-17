import { useState, useEffect } from 'react'
import { NumberField, Label, Input, Button, Switch } from 'react-aria-components'
import { Lock, Unlock } from 'lucide-react'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'

interface PlacementPanelProps {
  selectedObject: ExtendedFabricObject | null
  onUpdatePosition: (x: number, y: number) => void
  onUpdateRotation: (angle: number) => void
  onUpdateScale: (scaleX: number, scaleY: number) => void
  onUpdateFlip: (flipX: boolean, flipY: boolean) => void
  snapToGrid: boolean
  onToggleSnapToGrid: (enabled: boolean) => void
  gridSize: number
  onChangeGridSize: (size: number) => void
  updateCounter: number
}

export function PlacementPanel({
  selectedObject,
  onUpdatePosition,
  onUpdateRotation,
  onUpdateScale,
  onUpdateFlip,
  snapToGrid,
  onToggleSnapToGrid,
  gridSize,
  onChangeGridSize,
  updateCounter,
}: PlacementPanelProps) {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [scaleX, setScaleX] = useState(1)
  const [scaleY, setScaleY] = useState(1)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)

  // Update local state when selected object changes or its properties change
  useEffect(() => {
    if (!selectedObject) return

    setX(Math.round(selectedObject.left || 0))
    setY(Math.round(selectedObject.top || 0))
    setRotation(Math.round(selectedObject.angle || 0))
    setScaleX(selectedObject.scaleX || 1)
    setScaleY(selectedObject.scaleY || 1)
    setFlipX(selectedObject.flipX || false)
    setFlipY(selectedObject.flipY || false)
  }, [
    selectedObject,
    selectedObject?.left,
    selectedObject?.top,
    selectedObject?.angle,
    selectedObject?.scaleX,
    selectedObject?.scaleY,
    selectedObject?.flipX,
    selectedObject?.flipY,
    updateCounter,
  ])

  if (!selectedObject) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        Select an object to use advanced placement controls
      </div>
    )
  }

  const handleXChange = (value: number) => {
    setX(value)
    onUpdatePosition(value, y)
  }

  const handleYChange = (value: number) => {
    setY(value)
    onUpdatePosition(x, value)
  }

  const handleRotationChange = (value: number) => {
    // Clamp to 0-360 range
    const numValue = ((value % 360) + 360) % 360
    setRotation(numValue)
    onUpdateRotation(numValue)
  }

  const handleScaleXChange = (value: number) => {
    if (value > 0) {
      setScaleX(value)
      if (lockAspectRatio) {
        setScaleY(value)
        onUpdateScale(value, value)
      } else {
        onUpdateScale(value, scaleY)
      }
    }
  }

  const handleScaleYChange = (value: number) => {
    if (value > 0) {
      setScaleY(value)
      if (lockAspectRatio) {
        setScaleX(value)
        onUpdateScale(value, value)
      } else {
        onUpdateScale(scaleX, value)
      }
    }
  }

  const gridSizes = [8, 16, 32, 64]

  return (
    <div className="flex flex-col gap-4">
      {/* Position Controls */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-medium text-text-muted">Position</Label>
        <NumberField
          value={x}
          onChange={handleXChange}
          step={snapToGrid ? gridSize : 1}
          className="flex flex-col gap-1"
          aria-label="X position"
        >
          <Label className="text-xs text-text-muted">X</Label>
          <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
        </NumberField>
        <NumberField
          value={y}
          onChange={handleYChange}
          step={snapToGrid ? gridSize : 1}
          className="flex flex-col gap-1"
          aria-label="Y position"
        >
          <Label className="text-xs text-text-muted">Y</Label>
          <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
        </NumberField>
      </div>

      {/* Rotation Control */}
      <NumberField
        value={rotation}
        onChange={handleRotationChange}
        minValue={0}
        maxValue={360}
        step={1}
        className="flex flex-col gap-1"
        aria-label="Rotation"
      >
        <Label className="text-xs font-medium text-text-muted">Rotation</Label>
        <div className="flex items-center gap-2">
          <Input className="flex-1 px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
          <span className="text-xs text-text-muted">°</span>
        </div>
      </NumberField>

      {/* Scale Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-text-muted">Scale</Label>
          <Button
            onPress={() => setLockAspectRatio(!lockAspectRatio)}
            className={`p-1.5 rounded-lg transition-all ${
              lockAspectRatio
                ? 'bg-primary/20 text-primary shadow-[0_0_8px_rgba(45,212,168,0.2)]'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
            }`}
            aria-label={lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
          >
            {lockAspectRatio ? <Lock size={16} /> : <Unlock size={16} />}
          </Button>
        </div>
        <NumberField
          value={parseFloat(scaleX.toFixed(2))}
          onChange={handleScaleXChange}
          step={0.1}
          minValue={0.1}
          className="flex flex-col gap-1"
          aria-label="Scale X"
        >
          <Label className="text-xs text-text-muted">X</Label>
          <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
        </NumberField>
        <NumberField
          value={parseFloat(scaleY.toFixed(2))}
          onChange={handleScaleYChange}
          step={0.1}
          minValue={0.1}
          isDisabled={lockAspectRatio}
          className="flex flex-col gap-1"
          aria-label="Scale Y"
        >
          <Label className="text-xs text-text-muted">Y</Label>
          <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
        </NumberField>
      </div>

      {/* Mirror Controls */}
      <div className="flex flex-col gap-3">
        <Label className="text-xs font-medium text-text-muted">Mirror</Label>
        <div className="flex gap-4">
          <Switch
            isSelected={flipX}
            onChange={(value) => {
              setFlipX(value)
              onUpdateFlip(value, flipY)
            }}
            className="group flex items-center gap-2"
          >
            <div className="flex h-5 w-9 items-center rounded-full bg-white/10 px-0.5 transition-all group-data-selected:bg-primary group-data-selected:shadow-[0_0_10px_rgba(45,212,168,0.3)]">
              <span className="h-4 w-4 rounded-full bg-white transition-transform duration-200 group-data-selected:translate-x-4" />
            </div>
            <Label className="text-sm text-white cursor-pointer">X</Label>
          </Switch>
          <Switch
            isSelected={flipY}
            onChange={(value) => {
              setFlipY(value)
              onUpdateFlip(flipX, value)
            }}
            className="group flex items-center gap-2"
          >
            <div className="flex h-5 w-9 items-center rounded-full bg-white/10 px-0.5 transition-all group-data-selected:bg-primary group-data-selected:shadow-[0_0_10px_rgba(45,212,168,0.3)]">
              <span className="h-4 w-4 rounded-full bg-white transition-transform duration-200 group-data-selected:translate-x-4" />
            </div>
            <Label className="text-sm text-white cursor-pointer">Y</Label>
          </Switch>
        </div>
      </div>

      {/* Snap to Grid */}
      <div className="flex flex-col gap-3">
        <Switch
          isSelected={snapToGrid}
          onChange={onToggleSnapToGrid}
          className="group flex items-center gap-2"
        >
          <div className="flex h-5 w-9 items-center rounded-full bg-white/10 px-0.5 transition-all group-data-selected:bg-primary group-data-selected:shadow-[0_0_10px_rgba(45,212,168,0.3)]">
            <span className="h-4 w-4 rounded-full bg-white transition-transform duration-200 group-data-selected:translate-x-4" />
          </div>
          <Label className="text-sm text-white cursor-pointer">Snap to Grid</Label>
        </Switch>
        {snapToGrid && (
          <div className="flex gap-2">
            {gridSizes.map((size) => (
              <Button
                key={size}
                onPress={() => onChangeGridSize(size)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                  gridSize === size
                    ? 'bg-primary/20 text-primary shadow-[0_0_8px_rgba(45,212,168,0.2)]'
                    : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
                }`}
                aria-label={`Set grid size to ${size} pixels`}
              >
                {size}px
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="p-3 bg-white/5 rounded-lg border border-primary/10">
        <div className="text-xs font-medium text-text-muted mb-2">Keyboard Shortcuts</div>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Arrow Keys</span>
            <span className="text-white">Move 1px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Shift + Arrow</span>
            <span className="text-white">Move 10px</span>
          </div>
        </div>
      </div>
    </div>
  )
}
