import { useState, useEffect } from 'react'
import { NumberField, Label, Input, Slider, SliderOutput, SliderTrack, SliderThumb } from 'react-aria-components'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { Circle } from 'fabric'

interface PropertiesPanelProps {
  selectedObject: ExtendedFabricObject | null
  onUpdateProperties: (properties: Record<string, unknown>) => void
}

export function PropertiesPanel({ selectedObject, onUpdateProperties }: PropertiesPanelProps) {
  const [properties, setProperties] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!selectedObject) {
      setProperties({})
      return
    }

    const type = selectedObject.type || 'object'
    const extracted: Record<string, unknown> = {}

    switch (type) {
      case 'rect':
        extracted.width = selectedObject.width || 0
        extracted.height = selectedObject.height || 0
        extracted.fill = selectedObject.fill || '#000000'
        extracted.stroke = selectedObject.stroke || 'transparent'
        extracted.strokeWidth = selectedObject.strokeWidth || 0
        extracted.opacity = selectedObject.opacity || 1
        break
      case 'circle':
        extracted.radius = (selectedObject as Circle).radius || 0
        extracted.fill = selectedObject.fill || '#000000'
        extracted.stroke = selectedObject.stroke || 'transparent'
        extracted.strokeWidth = selectedObject.strokeWidth || 0
        extracted.opacity = selectedObject.opacity || 1
        break
      case 'path':
        extracted.fill = selectedObject.fill || 'transparent'
        extracted.stroke = selectedObject.stroke || '#000000'
        extracted.strokeWidth = selectedObject.strokeWidth || 1
        extracted.opacity = selectedObject.opacity || 1
        break
      case 'image':
        extracted.opacity = selectedObject.opacity || 1
        break
    }

    setProperties(extracted)
  }, [selectedObject])

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
    const updated = { ...properties, [key]: value }
    setProperties(updated)
    onUpdateProperties({ [key]: value })
  }

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
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

      <NumberField
        value={properties.height as number || 0}
        onChange={(val) => handleChange('height', val)}
        minValue={1}
        className="flex flex-col gap-1"
        aria-label="Height"
      >
        <Label className="text-xs font-medium text-text-muted">Height</Label>
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Fill Color</Label>
        <input
          type="color"
          value={properties.fill as string || '#000000'}
          onChange={(e) => handleChange('fill', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Fill color"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Stroke Color</Label>
        <input
          type="color"
          value={properties.stroke === 'transparent' ? '#000000' : properties.stroke as string || '#000000'}
          onChange={(e) => handleChange('stroke', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Stroke color"
        />
      </div>

      <NumberField
        value={properties.strokeWidth as number || 0}
        onChange={(val) => handleChange('strokeWidth', val)}
        minValue={0}
        className="flex flex-col gap-1"
        aria-label="Stroke width"
      >
        <Label className="text-xs font-medium text-text-muted">Stroke Width</Label>
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

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
        <SliderTrack className="relative w-full h-2 bg-white/10 rounded">
          <SliderThumb className="h-4 w-4 bg-accent-teal rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal" />
        </SliderTrack>
      </Slider>
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
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Fill Color</Label>
        <input
          type="color"
          value={properties.fill as string || '#000000'}
          onChange={(e) => handleChange('fill', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Fill color"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Stroke Color</Label>
        <input
          type="color"
          value={properties.stroke === 'transparent' ? '#000000' : properties.stroke as string || '#000000'}
          onChange={(e) => handleChange('stroke', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Stroke color"
        />
      </div>

      <NumberField
        value={properties.strokeWidth as number || 0}
        onChange={(val) => handleChange('strokeWidth', val)}
        minValue={0}
        className="flex flex-col gap-1"
        aria-label="Stroke width"
      >
        <Label className="text-xs font-medium text-text-muted">Stroke Width</Label>
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

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
        <SliderTrack className="relative w-full h-2 bg-white/10 rounded">
          <SliderThumb className="h-4 w-4 bg-accent-teal rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal" />
        </SliderTrack>
      </Slider>
    </div>
  )

  const renderPathProperties = () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Fill Color</Label>
        <input
          type="color"
          value={properties.fill === 'transparent' ? '#000000' : properties.fill as string || '#000000'}
          onChange={(e) => handleChange('fill', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Fill color"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs font-medium text-text-muted">Stroke Color</Label>
        <input
          type="color"
          value={properties.stroke as string || '#000000'}
          onChange={(e) => handleChange('stroke', e.target.value)}
          className="h-10 w-full rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-teal"
          aria-label="Stroke color"
        />
      </div>

      <NumberField
        value={properties.strokeWidth as number || 1}
        onChange={(val) => handleChange('strokeWidth', val)}
        minValue={0}
        className="flex flex-col gap-1"
        aria-label="Stroke width"
      >
        <Label className="text-xs font-medium text-text-muted">Stroke Width</Label>
        <Input className="px-3 py-2 bg-white/5 border border-border-subtle rounded focus:ring-2 focus:ring-accent-teal outline-none text-sm" />
      </NumberField>

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
        <SliderTrack className="relative w-full h-2 bg-white/10 rounded">
          <SliderThumb className="h-4 w-4 bg-accent-teal rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal" />
        </SliderTrack>
      </Slider>
    </div>
  )

  const renderImageProperties = () => (
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
      <SliderTrack className="relative w-full h-2 bg-white/10 rounded">
        <SliderThumb className="h-4 w-4 bg-accent-teal rounded-full top-1/2 -translate-y-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal" />
      </SliderTrack>
    </Slider>
  )

  return (
    <>
      {type === 'rect' && renderRectProperties()}
      {type === 'circle' && renderCircleProperties()}
      {type === 'path' && renderPathProperties()}
      {type === 'image' && renderImageProperties()}
    </>
  )
}
