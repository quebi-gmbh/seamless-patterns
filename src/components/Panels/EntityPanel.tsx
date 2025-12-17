import { useEffect, useState } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator } from 'react-aria-components'
import {
  Square, Circle, Pencil, Image, Package, Diamond,
  Eye, Filter, MoreVertical, ChevronsUp, ChevronUp,
  ChevronDown, ChevronsDown, FileCode, Copy, Trash2,
  Group, Ungroup, ChevronRight, FolderOpen
} from 'lucide-react'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { LayerManager } from '../../core/LayerManager'
import type { EntityGroupManager } from '../../core/EntityGroupManager'
import type { EntityGroup } from '../../types/FabricExtensions'

interface EntityPanelProps {
  fabricCanvas: Canvas | null
  layerManager: LayerManager | null
  entityGroupManager: EntityGroupManager | null
  currentLayerId?: string
  selectedEntityIds: Set<string>
  onSelectEntity?: (mirrorGroupId: string) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  onDuplicateEntity?: (mirrorGroupId: string) => void
  onEditSVG?: (mirrorGroupId: string, svgCode: string) => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
}

interface EntityDisplayItem {
  mirrorGroupId: string
  name: string
  type: string
  objects: ExtendedFabricObject[]
  layerId?: string
  isSVG: boolean
  zIndex?: number
  entityGroupId?: string
}

interface GroupDisplayItem {
  group: EntityGroup
  members: EntityDisplayItem[]
  isExpanded: boolean
}

interface TreeNode {
  type: 'group' | 'entity'
  data: GroupDisplayItem | EntityDisplayItem
}

export function EntityPanel({
  fabricCanvas,
  layerManager,
  entityGroupManager,
  currentLayerId,
  selectedEntityIds,
  onSelectEntity,
  onSelectionChange,
  onDuplicateEntity,
  onEditSVG,
  onGroupSelected,
  onUngroupSelected,
}: EntityPanelProps) {
  const [entities, setEntities] = useState<EntityDisplayItem[]>([])
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showOnlyCurrentLayer, setShowOnlyCurrentLayer] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Force refresh when selection changes (groups may have been created/destroyed)
  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [selectedEntityIds])

  const refreshEntities = () => {
    if (!fabricCanvas || !layerManager) return

    const groups = layerManager.getMirrorGroups()
    const allObjects = fabricCanvas.getObjects() as ExtendedFabricObject[]
    const entityList: EntityDisplayItem[] = []

    groups.forEach((objects, mirrorGroupId) => {
      if (objects.length === 0) return

      const firstObj = objects[0]
      const type = firstObj.type || 'object'
      const layerId = firstObj.layerId

      const isSVG = type === 'group'
      const zIndex = allObjects.indexOf(firstObj)

      // Get entity group info if this entity is in a group
      const entityGroupId = firstObj.tiledMetadata?.entityGroupId

      entityList.push({
        mirrorGroupId,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${mirrorGroupId.split('_').pop()?.substring(0, 4)}`,
        type,
        objects,
        layerId,
        isSVG,
        zIndex,
        entityGroupId,
      })
    })

    const filteredList = showOnlyCurrentLayer && currentLayerId
      ? entityList.filter(entity => entity.layerId === currentLayerId)
      : entityList

    filteredList.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

    setEntities(filteredList)

    // Build tree structure - pass expandedGroups to avoid stale closure
    buildTreeNodes(filteredList, expandedGroups)
  }

  const buildTreeNodes = (entityList: EntityDisplayItem[], currentExpandedGroups: Set<string>) => {
    if (!entityGroupManager) {
      // No group manager, just show flat list
      setTreeNodes(entityList.map(entity => ({ type: 'entity', data: entity })))
      return
    }

    const allGroups = entityGroupManager.getAllGroups()
    const groupedEntityIds = new Set<string>()

    // Build group nodes with their members
    const groupNodes: GroupDisplayItem[] = []
    for (const group of allGroups) {
      // Filter to only include groups relevant to current layer filter
      const members = entityList.filter(e => group.memberMirrorGroupIds.includes(e.mirrorGroupId))
      if (members.length > 0) {
        members.forEach(m => groupedEntityIds.add(m.mirrorGroupId))
        groupNodes.push({
          group,
          members,
          isExpanded: currentExpandedGroups.has(group.id),
        })
      }
    }

    // Get ungrouped entities
    const ungroupedEntities = entityList.filter(e => !groupedEntityIds.has(e.mirrorGroupId))

    // Combine: groups and ungrouped entities, sorted by z-index of first member
    const combined: { zIndex: number; node: TreeNode }[] = []

    for (const groupNode of groupNodes) {
      const maxZIndex = Math.max(...groupNode.members.map(m => m.zIndex || 0))
      combined.push({ zIndex: maxZIndex, node: { type: 'group', data: groupNode } })
    }

    for (const entity of ungroupedEntities) {
      combined.push({ zIndex: entity.zIndex || 0, node: { type: 'entity', data: entity } })
    }

    combined.sort((a, b) => b.zIndex - a.zIndex)
    setTreeNodes(combined.map(c => c.node))
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
  }, [fabricCanvas, layerManager, entityGroupManager, currentLayerId, showOnlyCurrentLayer, expandedGroups, refreshKey])

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleSelectEntity = (mirrorGroupId: string, addToSelection: boolean = false) => {
    let newSelection: Set<string>
    if (addToSelection) {
      newSelection = new Set(selectedEntityIds)
      if (newSelection.has(mirrorGroupId)) {
        newSelection.delete(mirrorGroupId)
      } else {
        newSelection.add(mirrorGroupId)
      }
    } else {
      newSelection = new Set([mirrorGroupId])
    }
    onSelectionChange?.(newSelection)
    onSelectEntity?.(mirrorGroupId)
  }

  const handleSelectGroup = (group: EntityGroup, addToSelection: boolean = false) => {
    let newSelection: Set<string>
    if (addToSelection) {
      newSelection = new Set(selectedEntityIds)
      // Toggle all members
      const allSelected = group.memberMirrorGroupIds.every(id => selectedEntityIds.has(id))
      if (allSelected) {
        group.memberMirrorGroupIds.forEach(id => newSelection.delete(id))
      } else {
        group.memberMirrorGroupIds.forEach(id => newSelection.add(id))
      }
    } else {
      newSelection = new Set(group.memberMirrorGroupIds)
    }
    onSelectionChange?.(newSelection)
    // Select first member on canvas
    if (group.memberMirrorGroupIds.length > 0) {
      onSelectEntity?.(group.memberMirrorGroupIds[0])
    }
  }

  const handleDelete = (mirrorGroupId: string) => {
    if (!layerManager) return
    layerManager.deleteMirrorGroup(mirrorGroupId)
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

  // Check if any selected entity is in a group
  const hasSelectedGroup = Array.from(selectedEntityIds).some((id) => {
    const entity = entities.find((e) => e.mirrorGroupId === id)
    return entity?.entityGroupId !== undefined
  })

  const renderEntityItem = (entity: EntityDisplayItem, isNested: boolean = false) => {
    const isSelected = selectedEntityIds.has(entity.mirrorGroupId)

    return (
      <div
        key={entity.mirrorGroupId}
        className={`
          flex items-center justify-between px-3 py-2 rounded
          transition-colors cursor-pointer
          ${isSelected ? 'bg-accent-teal/20' : 'hover:bg-white/5'}
          ${isNested ? 'ml-6' : ''}
        `}
        onClick={(e) => handleSelectEntity(entity.mirrorGroupId, e.shiftKey || e.ctrlKey || e.metaKey)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-text-muted">{getEntityIcon(entity.type)}</span>
          <span className="text-sm text-text-primary truncate">{entity.name}</span>
          <span className="text-xs text-text-muted">{entity.objects.length}</span>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <MenuTrigger>
            <Button
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary"
              aria-label="Actions"
            >
              <MoreVertical size={16} />
            </Button>
            <Popover
              placement="bottom end"
              className="bg-bg-panel border border-border-subtle rounded-lg shadow-xl min-w-40 overflow-hidden"
            >
              <Menu
                className="outline-none p-1"
                onAction={(key) => {
                  switch (key) {
                    case 'bring-to-front':
                      moveEntityToFront(entity.mirrorGroupId)
                      break
                    case 'bring-forward':
                      moveEntityForward(entity.mirrorGroupId)
                      break
                    case 'send-backward':
                      moveEntityBackward(entity.mirrorGroupId)
                      break
                    case 'send-to-back':
                      moveEntityToBack(entity.mirrorGroupId)
                      break
                    case 'edit-svg':
                      handleEditSVG(entity.mirrorGroupId)
                      break
                    case 'duplicate':
                      handleDuplicate(entity.mirrorGroupId)
                      break
                    case 'delete':
                      handleDelete(entity.mirrorGroupId)
                      break
                  }
                }}
              >
                <MenuItem
                  id="bring-to-front"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronsUp size={16} /> Bring to Front
                </MenuItem>
                <MenuItem
                  id="bring-forward"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronUp size={16} /> Bring Forward
                </MenuItem>
                <MenuItem
                  id="send-backward"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronDown size={16} /> Send Backward
                </MenuItem>
                <MenuItem
                  id="send-to-back"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronsDown size={16} /> Send to Back
                </MenuItem>
                <Separator className="my-1 h-px bg-border-subtle" />
                {entity.isSVG && (
                  <MenuItem
                    id="edit-svg"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10"
                  >
                    <FileCode size={16} /> Edit SVG
                  </MenuItem>
                )}
                <MenuItem
                  id="duplicate"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10"
                >
                  <Copy size={16} /> Duplicate
                </MenuItem>
                <Separator className="my-1 h-px bg-border-subtle" />
                <MenuItem
                  id="delete"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-accent-coral outline-none cursor-pointer rounded hover:bg-accent-coral/20"
                >
                  <Trash2 size={16} /> Delete
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      </div>
    )
  }

  const renderGroupItem = (groupData: GroupDisplayItem) => {
    const { group, members, isExpanded } = groupData
    const allSelected = members.every(m => selectedEntityIds.has(m.mirrorGroupId))
    const someSelected = members.some(m => selectedEntityIds.has(m.mirrorGroupId))

    return (
      <div key={group.id} className="flex flex-col">
        {/* Group header */}
        <div
          className={`
            flex items-center justify-between px-3 py-2 rounded
            transition-colors cursor-pointer
            ${allSelected ? 'bg-accent-teal/20' : someSelected ? 'bg-accent-teal/10' : 'hover:bg-white/5'}
          `}
          onClick={(e) => handleSelectGroup(group, e.shiftKey || e.ctrlKey || e.metaKey)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              className="p-0.5 hover:bg-white/10 rounded text-text-muted"
              onClick={(e) => {
                e.stopPropagation()
                toggleGroupExpanded(group.id)
              }}
            >
              <ChevronRight
                size={14}
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
            <span className="text-accent-teal">
              <FolderOpen size={16} />
            </span>
            <span className="text-sm text-text-primary truncate">{group.name}</span>
            <span className="text-xs text-text-muted">({members.length})</span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <MenuTrigger>
              <Button
                className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-text-primary"
                aria-label="Group actions"
              >
                <MoreVertical size={16} />
              </Button>
              <Popover
                placement="bottom end"
                className="bg-bg-panel border border-border-subtle rounded-lg shadow-xl min-w-40 overflow-hidden"
              >
                <Menu
                  className="outline-none p-1"
                  onAction={(key) => {
                    if (key === 'ungroup') {
                      // Select the group first, then ungroup
                      onSelectionChange?.(new Set(group.memberMirrorGroupIds))
                      onUngroupSelected?.()
                    }
                  }}
                >
                  <MenuItem
                    id="ungroup"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary outline-none cursor-pointer rounded hover:bg-white/10"
                  >
                    <Ungroup size={16} /> Ungroup
                  </MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </div>
        </div>

        {/* Group children */}
        {isExpanded && (
          <div className="flex flex-col gap-1 mt-1">
            {members.map(member => renderEntityItem(member, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{entities.length} objects</span>
        <div className="flex items-center gap-1">
          <Button
            onPress={onGroupSelected}
            isDisabled={selectedEntityIds.size < 2}
            className="px-2 py-1 text-xs rounded transition-colors bg-white/5 text-text-muted hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Group selected (Ctrl+G)"
          >
            <Group size={14} />
          </Button>
          <Button
            onPress={onUngroupSelected}
            isDisabled={!hasSelectedGroup}
            className="px-2 py-1 text-xs rounded transition-colors bg-white/5 text-text-muted hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Ungroup (Ctrl+Shift+G)"
          >
            <Ungroup size={14} />
          </Button>
          <Button
            onPress={() => setShowOnlyCurrentLayer(!showOnlyCurrentLayer)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showOnlyCurrentLayer
                ? 'bg-accent-teal/20 text-accent-teal'
                : 'bg-white/5 text-text-muted hover:bg-white/10'
            }`}
            aria-label={showOnlyCurrentLayer ? 'Show all layers' : 'Show current layer only'}
          >
            {showOnlyCurrentLayer ? <Filter size={14} /> : <Eye size={14} />}
          </Button>
        </div>
      </div>

      {entities.length === 0 ? (
        <div className="py-8 text-center text-sm text-text-muted">
          No objects yet
        </div>
      ) : (
        <div className="flex flex-col gap-1" role="tree" aria-label="Entity tree">
          {treeNodes.map((node) => {
            if (node.type === 'group') {
              return renderGroupItem(node.data as GroupDisplayItem)
            } else {
              return renderEntityItem(node.data as EntityDisplayItem)
            }
          })}
        </div>
      )}
    </div>
  )
}

function getEntityIcon(type: string): JSX.Element {
  const size = 16
  switch (type) {
    case 'rect':
      return <Square size={size} />
    case 'circle':
      return <Circle size={size} />
    case 'path':
      return <Pencil size={size} />
    case 'image':
      return <Image size={size} />
    case 'group':
      return <Package size={size} />
    default:
      return <Diamond size={size} />
  }
}
