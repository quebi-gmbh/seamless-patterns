import { useEffect, useState, useRef } from 'react'
import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator } from 'react-aria-components'
import {
  Square, Circle, Pencil, Image, Package, Diamond,
  Eye, Filter, MoreVertical, ChevronsUp, ChevronUp,
  ChevronDown, ChevronsDown, FileCode, Copy, Trash2,
  Group, Ungroup, ChevronRight, FolderOpen, GripVertical
} from 'lucide-react'
import type { Canvas } from 'fabric'
import type { ExtendedFabricObject } from '../../types/FabricExtensions'
import type { LayerManager } from '../../core/LayerManager'
import type { EntityGroupManager } from '../../core/EntityGroupManager'
import type { EntityGroup } from '../../types/FabricExtensions'
import type { UndoRedoManager } from '../../core/UndoRedoManager'
import type { VirtualTilingContext } from '../../hooks/useFabricCanvas'
import { DeleteCommand } from '../../core/commands/DeleteCommand'
import { ZOrderCommand, type ZOrderOperation } from '../../core/commands/ZOrderCommand'

interface EntityPanelProps {
  fabricCanvas: Canvas | null
  layerManager: LayerManager | null
  entityGroupManager: EntityGroupManager | null
  currentLayerId?: string
  selectedEntityIds: Set<string>
  hoveredEntityIds?: Set<string>
  onSelectEntity?: (mirrorGroupId: string) => void
  onSelectionChange?: (selectedIds: Set<string>) => void
  onHoverEntity?: (hoveredIds: Set<string>) => void
  onDuplicateEntity?: (mirrorGroupId: string) => void
  onEditSVG?: (mirrorGroupId: string, svgCode: string) => void
  onGroupSelected?: () => void
  onUngroupSelected?: () => void
  onDuplicateGroup?: (groupId: string) => void
  undoRedoManager?: UndoRedoManager | null
  virtualTilingContext?: VirtualTilingContext | null
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
  hoveredEntityIds,
  onSelectEntity,
  onSelectionChange,
  onHoverEntity,
  onDuplicateEntity,
  onEditSVG,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateGroup,
  undoRedoManager,
  virtualTilingContext,
}: EntityPanelProps) {
  const [entities, setEntities] = useState<EntityDisplayItem[]>([])
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showOnlyCurrentLayer, setShowOnlyCurrentLayer] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Drag-and-drop state
  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const dragCounterRef = useRef(0)

  // Force refresh when selection changes (groups may have been created/destroyed)
  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [selectedEntityIds])

  const refreshEntities = () => {
    if (!fabricCanvas || !layerManager) return

    const groups = layerManager.getMirrorGroups()
    const entityList: EntityDisplayItem[] = []

    groups.forEach((objects, mirrorGroupId) => {
      if (objects.length === 0) return

      const firstObj = objects[0]
      const type = firstObj.type || 'object'
      const layerId = firstObj.layerId

      const isSVG = type === 'group'
      // Use canonical store z-order index instead of canvas object order
      const zIndex = virtualTilingContext?.canonicalStore?.getZOrderIndex(mirrorGroupId) ?? 0

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

    // Create undo command before deleting
    if (undoRedoManager && virtualTilingContext?.canonicalStore) {
      const canonical = virtualTilingContext.canonicalStore.get(mirrorGroupId)
      if (canonical) {
        const command = new DeleteCommand(
          mirrorGroupId,
          canonical,
          undoRedoManager.getDependencies()
        )
        undoRedoManager.execute(command)
        return // Command's execute will do the delete
      }
    }

    // Fallback if no undo system
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

  const createZOrderCommand = (mirrorGroupId: string, operation: ZOrderOperation, getNewIndex: () => number) => {
    if (!undoRedoManager || !virtualTilingContext?.canonicalStore) return false

    const beforeIndex = virtualTilingContext.canonicalStore.getZOrderIndex(mirrorGroupId)
    if (beforeIndex === -1) return false

    // Calculate what the new index will be after the operation
    const afterIndex = getNewIndex()

    const command = new ZOrderCommand(
      mirrorGroupId,
      beforeIndex,
      afterIndex,
      operation,
      undoRedoManager.getDependencies()
    )
    undoRedoManager.execute(command)
    return true
  }

  const moveEntityForward = (mirrorGroupId: string) => {
    if (!layerManager || !virtualTilingContext?.canonicalStore) return

    const store = virtualTilingContext.canonicalStore
    const currentIndex = store.getZOrderIndex(mirrorGroupId)
    const total = store.getAll().length

    if (createZOrderCommand(mirrorGroupId, 'forward', () => Math.min(currentIndex + 1, total - 1))) {
      refreshEntities()
      return
    }

    layerManager.bringMirrorGroupForward(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityBackward = (mirrorGroupId: string) => {
    if (!layerManager || !virtualTilingContext?.canonicalStore) return

    const store = virtualTilingContext.canonicalStore
    const currentIndex = store.getZOrderIndex(mirrorGroupId)

    if (createZOrderCommand(mirrorGroupId, 'backward', () => Math.max(currentIndex - 1, 0))) {
      refreshEntities()
      return
    }

    layerManager.sendMirrorGroupBackward(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityToFront = (mirrorGroupId: string) => {
    if (!layerManager || !virtualTilingContext?.canonicalStore) return

    const store = virtualTilingContext.canonicalStore
    const total = store.getAll().length

    if (createZOrderCommand(mirrorGroupId, 'front', () => total - 1)) {
      refreshEntities()
      return
    }

    layerManager.bringMirrorGroupToFront(mirrorGroupId)
    refreshEntities()
  }

  const moveEntityToBack = (mirrorGroupId: string) => {
    if (!layerManager || !virtualTilingContext?.canonicalStore) return

    if (createZOrderCommand(mirrorGroupId, 'back', () => 0)) {
      refreshEntities()
      return
    }

    layerManager.sendMirrorGroupToBack(mirrorGroupId)
    refreshEntities()
  }

  // Check if any selected entity is in a group
  const hasSelectedGroup = Array.from(selectedEntityIds).some((id) => {
    const entity = entities.find((e) => e.mirrorGroupId === id)
    return entity?.entityGroupId !== undefined
  })

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, mirrorGroupId: string) => {
    setDraggedEntityId(mirrorGroupId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', mirrorGroupId)
    // Add a slight delay to show the drag effect
    const target = e.currentTarget as HTMLElement
    setTimeout(() => {
      target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedEntityId(null)
    setDropTargetId(null)
    setDropPosition(null)
    dragCounterRef.current = 0
    const target = e.currentTarget as HTMLElement
    target.style.opacity = '1'
  }

  const handleDragEnter = (e: React.DragEvent, mirrorGroupId: string) => {
    e.preventDefault()
    dragCounterRef.current++
    if (mirrorGroupId !== draggedEntityId) {
      setDropTargetId(mirrorGroupId)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDropTargetId(null)
      setDropPosition(null)
    }
  }

  const handleDragOver = (e: React.DragEvent, mirrorGroupId: string) => {
    e.preventDefault()
    if (mirrorGroupId === draggedEntityId) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'
    setDropPosition(position)
    setDropTargetId(mirrorGroupId)
  }

  const handleDrop = (e: React.DragEvent, targetMirrorGroupId: string) => {
    e.preventDefault()
    const sourceMirrorGroupId = e.dataTransfer.getData('text/plain')

    if (!sourceMirrorGroupId || sourceMirrorGroupId === targetMirrorGroupId) {
      setDraggedEntityId(null)
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    if (!virtualTilingContext?.canonicalStore || !undoRedoManager) {
      setDraggedEntityId(null)
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    const store = virtualTilingContext.canonicalStore
    const sourceIndex = store.getZOrderIndex(sourceMirrorGroupId)
    const targetIndex = store.getZOrderIndex(targetMirrorGroupId)

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedEntityId(null)
      setDropTargetId(null)
      setDropPosition(null)
      return
    }

    // Calculate new index based on drop position
    // In the UI, higher z-index items appear first (top of list = front)
    // dropPosition 'before' means drop above = higher z-index
    // dropPosition 'after' means drop below = lower z-index
    let newIndex: number
    if (dropPosition === 'before') {
      // Drop above target = take target's index (push target down)
      newIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1
    } else {
      // Drop below target = take index below target
      newIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    }

    // Clamp to valid range
    const total = store.getAll().length
    newIndex = Math.max(0, Math.min(newIndex, total - 1))

    if (newIndex !== sourceIndex) {
      const command = new ZOrderCommand(
        sourceMirrorGroupId,
        sourceIndex,
        newIndex,
        'forward', // Generic operation type
        undoRedoManager.getDependencies()
      )
      undoRedoManager.execute(command)
      refreshEntities()
    }

    setDraggedEntityId(null)
    setDropTargetId(null)
    setDropPosition(null)
  }

  const renderEntityItem = (entity: EntityDisplayItem, isNested: boolean = false) => {
    const isSelected = selectedEntityIds.has(entity.mirrorGroupId)
    const isHovered = hoveredEntityIds?.has(entity.mirrorGroupId) ?? false
    const isDragTarget = dropTargetId === entity.mirrorGroupId
    const isDragging = draggedEntityId === entity.mirrorGroupId

    return (
      <div
        key={entity.mirrorGroupId}
        draggable={!isNested} // Only allow dragging non-nested items for now
        onDragStart={(e) => handleDragStart(e, entity.mirrorGroupId)}
        onDragEnd={handleDragEnd}
        onDragEnter={(e) => handleDragEnter(e, entity.mirrorGroupId)}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => handleDragOver(e, entity.mirrorGroupId)}
        onDrop={(e) => handleDrop(e, entity.mirrorGroupId)}
        onMouseEnter={() => onHoverEntity?.(new Set([entity.mirrorGroupId]))}
        onMouseLeave={() => onHoverEntity?.(new Set())}
        className={`
          flex items-center justify-between px-3 py-2 rounded-lg
          transition-all cursor-pointer relative
          ${isSelected ? 'bg-primary/20 shadow-[0_0_10px_rgba(45,212,168,0.1)]' : isHovered ? 'bg-primary/10 border border-primary/30' : 'hover:bg-white/5'}
          ${isNested ? 'ml-6' : ''}
          ${isDragging ? 'opacity-50' : ''}
          ${isDragTarget && dropPosition === 'before' ? 'border-t-2 border-primary' : ''}
          ${isDragTarget && dropPosition === 'after' ? 'border-b-2 border-primary' : ''}
        `}
        onClick={(e) => handleSelectEntity(entity.mirrorGroupId, e.shiftKey || e.ctrlKey || e.metaKey)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isNested && (
            <span className="text-text-muted cursor-grab active:cursor-grabbing">
              <GripVertical size={14} />
            </span>
          )}
          <span className={isSelected ? 'text-primary' : 'text-text-muted'}>{getEntityIcon(entity.type)}</span>
          <span className="text-sm text-white truncate">{entity.name}</span>
          <span className="text-xs text-text-muted">{entity.objects.length}</span>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <MenuTrigger>
            <Button
              className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-all"
              aria-label="Actions"
            >
              <MoreVertical size={16} />
            </Button>
            <Popover
              placement="bottom end"
              className="bg-bg-panel border border-primary/20 rounded-xl shadow-xl min-w-40 overflow-hidden panel-glow"
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
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronsUp size={16} /> Bring to Front
                </MenuItem>
                <MenuItem
                  id="bring-forward"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronUp size={16} /> Bring Forward
                </MenuItem>
                <MenuItem
                  id="send-backward"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronDown size={16} /> Send Backward
                </MenuItem>
                <MenuItem
                  id="send-to-back"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronsDown size={16} /> Send to Back
                </MenuItem>
                <Separator className="my-1 h-px bg-primary/10" />
                <MenuItem
                  id="edit-svg"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 transition-all"
                >
                  <FileCode size={16} /> Show/Edit SVG
                </MenuItem>
                <MenuItem
                  id="duplicate"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 transition-all"
                >
                  <Copy size={16} /> Duplicate
                </MenuItem>
                <Separator className="my-1 h-px bg-primary/10" />
                <MenuItem
                  id="delete"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-accent-coral outline-none cursor-pointer rounded-lg hover:bg-accent-coral/20 transition-all"
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
    const isHovered = hoveredEntityIds ? members.some(m => hoveredEntityIds.has(m.mirrorGroupId)) : false

    return (
      <div key={group.id} className="flex flex-col">
        {/* Group header */}
        <div
          className={`
            flex items-center justify-between px-3 py-2 rounded-lg
            transition-all cursor-pointer
            ${allSelected ? 'bg-primary/20 shadow-[0_0_10px_rgba(45,212,168,0.1)]' : someSelected ? 'bg-primary/10' : isHovered ? 'bg-primary/5 border border-primary/20' : 'hover:bg-white/5'}
          `}
          onClick={(e) => handleSelectGroup(group, e.shiftKey || e.ctrlKey || e.metaKey)}
          onMouseEnter={() => onHoverEntity?.(new Set(members.map(m => m.mirrorGroupId)))}
          onMouseLeave={() => onHoverEntity?.(new Set())}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              className="p-0.5 hover:bg-white/10 rounded-lg text-text-muted transition-all"
              onClick={(e) => {
                e.stopPropagation()
                toggleGroupExpanded(group.id)
              }}
            >
              <ChevronRight
                size={14}
                className={`transition-transform ${isExpanded ? 'rotate-90 text-primary' : ''}`}
              />
            </button>
            <span className="text-primary">
              <FolderOpen size={16} />
            </span>
            <span className="text-sm text-white truncate">{group.name}</span>
            <span className="text-xs text-text-muted">({members.length})</span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <MenuTrigger>
              <Button
                className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-all"
                aria-label="Group actions"
              >
                <MoreVertical size={16} />
              </Button>
              <Popover
                placement="bottom end"
                className="bg-bg-panel border border-primary/20 rounded-xl shadow-xl min-w-40 overflow-hidden panel-glow"
              >
                <Menu
                  className="outline-none p-1"
                  onAction={(key) => {
                    if (key === 'ungroup') {
                      // Select the group first, then ungroup
                      onSelectionChange?.(new Set(group.memberMirrorGroupIds))
                      onUngroupSelected?.()
                    } else if (key === 'duplicate') {
                      onDuplicateGroup?.(group.id)
                    } else if (key === 'delete') {
                      // Delete the group and all its children
                      if (entityGroupManager) {
                        entityGroupManager.deleteGroup(group.id, true)
                      }
                    }
                  }}
                >
                  <MenuItem
                    id="ungroup"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 transition-all"
                  >
                    <Ungroup size={16} /> Ungroup
                  </MenuItem>
                  <MenuItem
                    id="duplicate"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white outline-none cursor-pointer rounded-lg hover:bg-white/10 transition-all"
                  >
                    <Copy size={16} /> Duplicate
                  </MenuItem>
                  <Separator className="my-1 h-px bg-primary/10" />
                  <MenuItem
                    id="delete"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-accent-coral outline-none cursor-pointer rounded-lg hover:bg-accent-coral/20 transition-all"
                  >
                    <Trash2 size={16} /> Delete Group
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
            className="px-2 py-1 text-xs rounded-lg transition-all bg-white/5 text-text-muted hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Group selected (Ctrl+G)"
          >
            <Group size={14} />
          </Button>
          <Button
            onPress={onUngroupSelected}
            isDisabled={!hasSelectedGroup}
            className="px-2 py-1 text-xs rounded-lg transition-all bg-white/5 text-text-muted hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Ungroup (Ctrl+Shift+G)"
          >
            <Ungroup size={14} />
          </Button>
          <Button
            onPress={() => setShowOnlyCurrentLayer(!showOnlyCurrentLayer)}
            className={`px-2 py-1 text-xs rounded-lg transition-all ${
              showOnlyCurrentLayer
                ? 'bg-primary/20 text-primary shadow-[0_0_8px_rgba(45,212,168,0.2)]'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-white'
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
