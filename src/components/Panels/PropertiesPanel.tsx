import { useState, useEffect } from 'react'
import { NumberField, Label, Input, Slider, SliderOutput, SliderTrack, SliderThumb } from 'react-aria-components'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { Circle } from 'fabric'

interface PropertiesPanelProps {
  selectedObject: ExtendedFabricObject | null
  onUpdateProperties: (properties: Record<string, unknown>) => void
  updateCounter?: number
}

// Helper to convert any color format to hex for HTML color input
const toHexColor = (color: unknown): string => {
  if (!color || color === 'transparent' || color === null) return '#000000'
  if (typeof color !== 'string') return '#000000'

  // Already hex format
  if (color.startsWith('#')) {
    // Ensure it's 7 characters (#rrggbb)
    if (color.length === 4) {
      // Expand #rgb to #rrggbb
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    }
    return color
  }

  // Handle rgb/rgba format
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }

  // Return as-is if it looks like a valid color, otherwise default
  return color.startsWith('#') ? color : '#000000'
}

export function PropertiesPanel({ selectedObject, onUpdateProperties, updateCounter }: PropertiesPanelProps) {
  const [properties, setProperties] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!selectedObject) {
      setProperties({})
      return
    }

    const type = selectedObject.type || 'object'
    const extracted: Record<string, unknown> = {}

    // Helper to extract fill/stroke enabled state
    const extractFillStroke = () => {
      const fillColor = selectedObject.fill
      const strokeColor = selectedObject.stroke

      const hasFill = fillColor &&
                      fillColor !== 'transparent' &&
                      fillColor !== null
      extracted.fillEnabled = !!hasFill
      extracted.fill = hasFill ? toHexColor(fillColor) : '#000000'

      const hasStroke = strokeColor &&
                        strokeColor !== 'transparent' &&
                        strokeColor !== null
      extracted.strokeEnabled = !!hasStroke
      extracted.stroke = hasStroke ? toHexColor(strokeColor) : '#000000'
      extracted.strokeWidth = selectedObject.strokeWidth || 1
    }

    switch (type) {
      case 'rect':
        extracted.width = selectedObject.width || 0
        extracted.height = selectedObject.height || 0
        extractFillStroke()
        extracted.opacity = selectedObject.opacity || 1
        break
      case 'circle':
        extracted.radius = (selectedObject as Circle).radius || 0
        extractFillStroke()
        extracted.opacity = selectedObject.opacity || 1
        break
      case 'path':
        extractFillStroke()
        extracted.opacity = selectedObject.opacity ?? 1
        break
      case 'image':
        extracted.opacity = selectedObject.opacity || 1
        break
    }

    setProperties(extracted)
  }, [selectedObject, updateCounter])

  if (!selectedObject) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        Select an object to view properties
      </div>
    )
  }

  const type = selectedObject.type || 'object'

  if (type === 'group') {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        Use the Edit button to edit SVG code
      </div>
    )
  }

  const handleChange = (key: string, value: unknown) => {
    setProperties(prev => ({ ...prev, [key]: value }))
    // Only send actual Fabric.js properties to the object, not UI-only state like fillEnabled/strokeEnabled
    if (key !== 'fillEnabled' && key !== 'strokeEnabled') {
      onUpdateProperties({ [key]: value })
    }
  }

  // Handle fill toggle - updates both UI state and fabric object atomically
  const handleFillToggle = (enabled: boolean) => {
    const currentFill = toHexColor(properties.fill)
    const newFill = enabled ? currentFill : 'transparent'
    setProperties(prev => ({ ...prev, fillEnabled: enabled, fill: currentFill }))
    onUpdateProperties({ fill: newFill })
  }

  // Handle stroke toggle - updates both UI state and fabric object atomically
  const handleStrokeToggle = (enabled: boolean) => {
    const currentStroke = toHexColor(properties.stroke)
    const newStroke = enabled ? currentStroke : 'transparent'
    setProperties(prev => ({ ...prev, strokeEnabled: enabled, stroke: currentStroke }))
    onUpdateProperties({ stroke: newStroke })
  }

  // Reusable fill/stroke controls with toggle
  const renderFillStrokeControls = () => (
    <>
      {/* Fill Checkbox + Color */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="fillEnabled"
            checked={properties.fillEnabled as boolean ?? false}
            onChange={(e) => handleFillToggle(e.target.checked)}
            className="h-4 w-4 rounded border-primary/20 bg-white/5 text-primary focus:ring-2 focus:ring-primary cursor-pointer"
          />
          <Label htmlFor="fillEnabled" className="text-xs font-medium text-text-muted cursor-pointer">Fill</Label>
        </div>
        {(properties.fillEnabled as boolean) && (
          <input
            type="color"
            value={properties.fill as string || '#000000'}
            onChange={(e) => handleChange('fill', e.target.value)}
            className="h-10 w-full rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Fill color"
          />
        )}
      </div>

      {/* Stroke Checkbox + Color + Width */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="strokeEnabled"
            checked={properties.strokeEnabled as boolean ?? false}
            onChange={(e) => handleStrokeToggle(e.target.checked)}
            className="h-4 w-4 rounded border-primary/20 bg-white/5 text-primary focus:ring-2 focus:ring-primary cursor-pointer"
          />
          <Label htmlFor="strokeEnabled" className="text-xs font-medium text-text-muted cursor-pointer">Border/Stroke</Label>
        </div>
        {(properties.strokeEnabled as boolean) && (
          <>
            <input
              type="color"
              value={properties.stroke as string || '#000000'}
              onChange={(e) => handleChange('stroke', e.target.value)}
              className="h-10 w-full rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Stroke color"
            />
            <NumberField
              value={properties.strokeWidth as number || 1}
              onChange={(val) => handleChange('strokeWidth', val)}
              minValue={0}
              className="flex flex-col gap-1"
              aria-label="Stroke width"
            >
              <Label className="text-xs font-medium text-text-muted">Stroke Width</Label>
              <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
            </NumberField>
          </>
        )}
      </div>
    </>
  )

  // Reusable opacity slider
  const renderOpacitySlider = () => (
    <Slider
      value={[((properties.opacity as number || 1) * 100)]}
      onChange={(val) => handleChange('opacity', val[0] / 100)}
      minValue={0}
      maxValue={100}
      step={10}
      className="flex flex-col gap-2"
      aria-label="Opacity"
    >
      <div className="flex justify-between items-center">
        <Label className="text-xs font-medium text-text-muted">Opacity</Label>
        <SliderOutput className="text-xs text-text-muted">
          {({state}) => `${state.values[0]}%`}
        </SliderOutput>
      </div>
      <SliderTrack className="relative w-full h-2 bg-white/10 rounded-lg">
        <SliderThumb className="h-4 w-4 bg-primary rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-[0_0_10px_rgba(45,212,168,0.4)] transition-all hover:scale-110" />
      </SliderTrack>
    </Slider>
  )

  const renderRectProperties = () => (
    <div className="flex flex-col gap-4">
      <NumberField
        value={properties.width as number || 0}
        onChange={(val) => handleChange('width', val)}
        minValue={1}
        className="flex flex-col gap-1"
        aria-label="Width"
      >
        <Label className="text-xs font-medium text-text-muted">Width</Label>
        <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
      </NumberField>

      <NumberField
        value={properties.height as number || 0}
        onChange={(val) => handleChange('height', val)}
        minValue={1}
        className="flex flex-col gap-1"
        aria-label="Height"
      >
        <Label className="text-xs font-medium text-text-muted">Height</Label>
        <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
      </NumberField>

      {renderFillStrokeControls()}
      {renderOpacitySlider()}
    </div>
  )

  const renderCircleProperties = () => (
    <div className="flex flex-col gap-4">
      <NumberField
        value={properties.radius as number || 0}
        onChange={(val) => handleChange('radius', val)}
        minValue={1}
        className="flex flex-col gap-1"
        aria-label="Radius"
      >
        <Label className="text-xs font-medium text-text-muted">Radius</Label>
        <Input className="px-3 py-2 bg-white/5 border border-primary/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary/40 outline-none text-sm transition-all" />
      </NumberField>

      {renderFillStrokeControls()}
      {renderOpacitySlider()}
    </div>
  )

  const renderPathProperties = () => (
    <div className="flex flex-col gap-4">
      {renderFillStrokeControls()}
      {renderOpacitySlider()}
    </div>
  )

  const renderImageProperties = () => renderOpacitySlider()

  // For debugging - log type if it's unexpected
  const isKnownType = ['rect', 'circle', 'path', 'image', 'group'].includes(type)

  return (
    <>
      {type === 'rect' && renderRectProperties()}
      {type === 'circle' && renderCircleProperties()}
      {type === 'path' && renderPathProperties()}
      {type === 'image' && renderImageProperties()}
      {!isKnownType && (
        <div className="py-4 text-center text-sm text-text-muted">
          Unknown object type: {type}
        </div>
      )}
    </>
  )
}
