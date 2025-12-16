import { useEffect, useState } from 'react'
import { Button, ListBox, ListBoxItem } from 'react-aria-components'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { LayerManager } from '../../core/LayerManager'

interface EntityPanelProps {
  fabricCanvas: Canvas | null
  layerManager: LayerManager | null
  currentLayerId?: string
  selectedEntityId?: string | null
  onSelectEntity?: (mirrorGroupId: string) => void
  onDuplicateEntity?: (mirrorGroupId: string) => void
  onEditSVG?: (mirrorGroupId: string, svgCode: string) => void
}

interface EntityGroup {
  mirrorGroupId: string
  name: string
  type: string
  objects: ExtendedFabricObject[]
  layerId?: string
  isSVG: boolean
  zIndex?: number
}

export function EntityPanel({ fabricCanvas, layerManager, currentLayerId, selectedEntityId, onSelectEntity, onDuplicateEntity, onEditSVG }: EntityPanelProps) {
  const [entities, setEntities] = useState<EntityGroup[]>([])
  const [showOnlyCurrentLayer, setShowOnlyCurrentLayer] = useState(true)

  const refreshEntities = () => {
    if (!fabricCanvas || !layerManager) return

    const groups = layerManager.getMirrorGroups()
    const allObjects = fabricCanvas.getObjects() as ExtendedFabricObject[]
    const entityList: EntityGroup[] = []

    groups.forEach((objects, mirrorGroupId) => {
      if (objects.length === 0) return

      const firstObj = objects[0]
      const type = firstObj.type || 'object'
      const layerId = firstObj.layerId

      const isSVG = type === 'group'
      const zIndex = allObjects.indexOf(firstObj)

      entityList.push({
        mirrorGroupId,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${mirrorGroupId.split('_').pop()?.substring(0, 4)}`,
        type,
        objects,
        layerId,
        isSVG,
        zIndex,
      })
    })

    const filteredList = showOnlyCurrentLayer && currentLayerId
      ? entityList.filter(entity => entity.layerId === currentLayerId)
      : entityList

    filteredList.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

    setEntities(filteredList)
  }

  useEffect(() => {
    if (!fabricCanvas) return

    refreshEntities()

    const handleObjectChange = () => {
      refreshEntities()
    }

    fabricCanvas.on('object:added', handleObjectChange)
    fabricCanvas.on('object:removed', handleObjectChange)
    fabricCanvas.on('object:modified', handleObjectChange)

    return () => {
      fabricCanvas.off('object:added', handleObjectChange)
      fabricCanvas.off('object:removed', handleObjectChange)
      fabricCanvas.off('object:modified', handleObjectChange)
    }
  }, [fabricCanvas, layerManager, currentLayerId, showOnlyCurrentLayer])

  const handleDelete = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.deleteMirrorGroup(mirrorGroupId)
  }

  const handleSelectEntity = (mirrorGroupId: string) => {
    if (onSelectEntity) {
      onSelectEntity(mirrorGroupId)
    }
  }

  const handleDuplicate = (mirrorGroupId: string) => {
    if (!onDuplicateEntity) return
    onDuplicateEntity(mirrorGroupId)
  }

  const handleEditSVG = (mirrorGroupId: string) => {
    if (!layerManager || !onEditSVG) return
    const svgCode = layerManager.getSVGCode(mirrorGroupId)
    if (svgCode) {
      onEditSVG(mirrorGroupId, svgCode)
    }
  }

  const moveEntityForward = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.bringMirrorGroupForward(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityBackward = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.sendMirrorGroupBackward(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityToFront = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.bringMirrorGroupToFront(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityToBack = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.sendMirrorGroupToBack(mirrorGroupId)
    refreshEntities()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{entities.length} objects</span>
        <Button
          onPress={() => setShowOnlyCurrentLayer(!showOnlyCurrentLayer)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showOnlyCurrentLayer
              ? 'bg-accent-teal/20 text-accent-teal'
              : 'bg-white/5 text-text-muted hover:bg-white/10'
          }`}
          aria-label={showOnlyCurrentLayer ? 'Show all layers' : 'Show current layer only'}
        >
          {showOnlyCurrentLayer ? '🔍' : '👁'}
        </Button>
      </div>

      {entities.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">
          No objects yet
        </div>
      ) : (
        <ListBox
          aria-label="Entity list"
          selectionMode="single"
          selectedKeys={selectedEntityId ? [selectedEntityId] : []}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0]
            if (key) handleSelectEntity(key.toString())
          }}
          className="flex flex-col gap-1"
        >
          {entities.map((entity, index) => (
            <ListBoxItem
              key={entity.mirrorGroupId}
              id={entity.mirrorGroupId}
              textValue={entity.name}
              className={({ isSelected, isFocusVisible }) => `
                group flex items-center justify-between px-3 py-2 rounded
                transition-colors cursor-pointer
                ${isSelected ? 'bg-accent-teal/20' : 'hover:bg-white/5'}
                ${isFocusVisible ? 'ring-2 ring-accent-teal' : ''}
              `}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">{getEntityIcon(entity.type)}</span>
                <span className="text-sm text-text-primary truncate">{entity.name}</span>
                <span className="text-xs text-text-muted">{entity.objects.length}</span>
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Z-order controls */}
                <div className="flex items-center gap-0.5">
                  <Button
                    onPress={() => moveEntityToFront(entity.mirrorGroupId)}
                    isDisabled={index === 0}
                    className="p-1 text-xs hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Bring to front"
                  >
                    ⏫
                  </Button>
                  <Button
                    onPress={() => moveEntityForward(entity.mirrorGroupId)}
                    isDisabled={index === 0}
                    className="p-1 text-xs hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Bring forward"
                  >
                    ⬆️
                  </Button>
                  <Button
                    onPress={() => moveEntityBackward(entity.mirrorGroupId)}
                    isDisabled={index === entities.length - 1}
                    className="p-1 text-xs hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Send backward"
                  >
                    ⬇️
                  </Button>
                  <Button
                    onPress={() => moveEntityToBack(entity.mirrorGroupId)}
                    isDisabled={index === entities.length - 1}
                    className="p-1 text-xs hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Send to back"
                  >
                    ⏬
                  </Button>
                </div>

                {/* Action buttons */}
                {entity.isSVG && (
                  <Button
                    onPress={() => handleEditSVG(entity.mirrorGroupId)}
                    className="p-1 hover:bg-white/10 rounded"
                    aria-label="Edit SVG code"
                  >
                    ✏️
                  </Button>
                )}
                <Button
                  onPress={() => handleDuplicate(entity.mirrorGroupId)}
                  className="p-1 hover:bg-white/10 rounded"
                  aria-label="Duplicate object"
                >
                  📋
                </Button>
                <Button
                  onPress={() => handleDelete(entity.mirrorGroupId)}
                  className="p-1 hover:bg-accent-coral/20 text-accent-coral rounded"
                  aria-label="Delete object"
                >
                  🗑
                </Button>
              </div>
            </ListBoxItem>
          ))}
        </ListBox>
      )}
    </div>
  )
}

function getEntityIcon(type: string): string {
  switch (type) {
    case 'rect':
      return '▭'
    case 'circle':
      return '●'
    case 'path':
      return '✏'
    case 'image':
      return '🖼'
    case 'group':
      return '📦'
    default:
      return '◆'
  }
}
