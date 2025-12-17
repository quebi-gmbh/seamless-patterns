import type { FabricObject } from 'fabric'

export interface TiledObjectMetadata {
  isMirror: boolean // Deprecated - all objects are equal now
  primaryObjectId?: string // Deprecated - no primary concept
  mirrorGroupId: string // Shared ID for all 25 tiled copies
  tilePosition: [number, number] // Which tile (-2 to 2, -2 to 2)
  entityGroupId?: string // Reference to parent entity group (if grouped)
}

// Entity group for grouping multiple entities together
export interface EntityGroup {
  id: string
  name: string
  memberMirrorGroupIds: string[]
  layerId: string
}

// Extend Fabric.js Object type with custom properties
export interface ExtendedFabricObject extends FabricObject {
  tiledMetadata?: TiledObjectMetadata
  layerId?: string
  id?: string
}
