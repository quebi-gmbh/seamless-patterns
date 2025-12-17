import { useEffect, useState } from 'react'
import { Button, ListBox, ListBoxItem, TextField, Input } from 'react-aria-components'
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import type { LayerManager, Layer } from '../../core/LayerManager'

interface LayerPanelProps {
  layerManager: LayerManager | null
  currentLayerId: string
  onLayerChange: (layerId: string) => void
}

export function LayerPanel({ layerManager, currentLayerId, onLayerChange }: LayerPanelProps) {
  const [layers, setLayers] = useState<Layer[]>([])
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const refreshLayers = () => {
    if (!layerManager) return
    setLayers(layerManager.getLayers())
  }

  useEffect(() => {
    refreshLayers()
  }, [layerManager])

  const handleCreateLayer = () => {
    if (!layerManager) return
    const newLayer = layerManager.createLayer()
    refreshLayers()
    onLayerChange(newLayer.id)
  }

  const handleDeleteLayer = (layerId: string) => {
    if (!layerManager) return
    try {
      layerManager.deleteLayer(layerId)
      refreshLayers()
      // Switch to first available layer
      const remainingLayers = layerManager.getLayers()
      if (remainingLayers.length > 0) {
        onLayerChange(remainingLayers[0].id)
      }
    } catch (error) {
      console.error('Cannot delete layer:', error)
    }
  }

  const handleToggleVisibility = (layerId: string) => {
    if (!layerManager) return
    const layer = layerManager.getLayer(layerId)
    if (layer) {
      layerManager.updateLayer(layerId, { visible: !layer.visible })
      refreshLayers()
    }
  }

  const handleToggleLock = (layerId: string) => {
    if (!layerManager) return
    const layer = layerManager.getLayer(layerId)
    if (layer) {
      layerManager.updateLayer(layerId, { locked: !layer.locked })
      refreshLayers()
    }
  }

  const handleStartRename = (layer: Layer) => {
    setEditingLayerId(layer.id)
    setEditingName(layer.name)
  }

  const handleFinishRename = () => {
    if (!layerManager || !editingLayerId) return
    layerManager.updateLayer(editingLayerId, { name: editingName })
    setEditingLayerId(null)
    refreshLayers()
  }

  const handleMoveUp = (index: number) => {
    if (!layerManager || index === 0) return
    layerManager.reorderLayers(index, index - 1)
    refreshLayers()
  }

  const handleMoveDown = (index: number) => {
    if (!layerManager || index === layers.length - 1) return
    layerManager.reorderLayers(index, index + 1)
    refreshLayers()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">Layers</span>
        <Button
          onPress={handleCreateLayer}
          className="p-1.5 bg-accent-teal hover:bg-accent-teal/90 rounded transition-colors"
          aria-label="Create new layer"
        >
          <Plus size={16} />
        </Button>
      </div>

      <ListBox
        aria-label="Layer list"
        selectionMode="single"
        selectedKeys={[currentLayerId]}
        onSelectionChange={(keys) => {
          const key = Array.from(keys)[0]
          if (key) onLayerChange(key.toString())
        }}
        className="flex flex-col gap-1"
      >
        {layers.map((layer, index) => (
          <ListBoxItem
            key={layer.id}
            id={layer.id}
            textValue={layer.name}
            className={({ isSelected, isFocusVisible }) => `
              group flex items-center gap-2 px-3 py-2 rounded
              transition-colors cursor-pointer
              ${isSelected ? 'bg-accent-teal/20' : 'hover:bg-white/5'}
              ${isFocusVisible ? 'ring-2 ring-accent-teal' : ''}
              ${layer.locked ? 'opacity-60' : ''}
            `}
          >
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                onPress={() => handleToggleVisibility(layer.id)}
                className={`p-1 hover:bg-white/10 rounded ${
                  layer.visible ? '' : 'opacity-50'
                }`}
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </Button>

              <Button
                onPress={() => handleToggleLock(layer.id)}
                className={`p-1 hover:bg-white/10 rounded ${
                  layer.locked ? 'text-accent-coral' : ''
                }`}
                aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
              >
                {layer.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </Button>
            </div>

            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              {editingLayerId === layer.id ? (
                <TextField
                  value={editingName}
                  onChange={setEditingName}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename()
                    if (e.key === 'Escape') setEditingLayerId(null)
                  }}
                  autoFocus
                  className="w-full"
                  aria-label="Layer name"
                >
                  <Input className="w-full px-2 py-1 bg-white/10 border border-border-subtle rounded text-sm focus:ring-2 focus:ring-accent-teal outline-none" />
                </TextField>
              ) : (
                <span
                  className="text-sm text-text-primary truncate block"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    handleStartRename(layer)
                  }}
                >
                  {layer.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                onPress={() => handleMoveUp(index)}
                isDisabled={index === 0}
                className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Move layer up"
              >
                <ChevronUp size={14} />
              </Button>
              <Button
                onPress={() => handleMoveDown(index)}
                isDisabled={index === layers.length - 1}
                className="p-1 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Move layer down"
              >
                <ChevronDown size={14} />
              </Button>
              <Button
                onPress={() => handleDeleteLayer(layer.id)}
                className="p-1 hover:bg-accent-coral/20 text-accent-coral rounded"
                aria-label="Delete layer"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </ListBoxItem>
        ))}
      </ListBox>
    </div>
  )
}
