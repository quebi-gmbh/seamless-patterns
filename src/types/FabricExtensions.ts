import type { FabricObject } from 'fabric'

export interface TiledObjectMetadata {
  isMirror: boolean // Deprecated - all objects are equal now
  primaryObjectId?: string // Deprecated - no primary concept
  mirrorGroupId: string // Shared ID for all 25 tiled copies
  tilePosition: [number, number] // Which tile (-2 to 2, -2 to 2)
}

// Extend Fabric.js Object type with custom properties
export interface ExtendedFabricObject extends FabricObject {
  tiledMetadata?: TiledObjectMetadata
  layerId?: string
  id?: string
}
