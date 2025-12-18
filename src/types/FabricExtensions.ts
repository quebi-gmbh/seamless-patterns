import type { FabricObject } from 'fabric'

export interface TiledObjectMetadata {
  isMirror: boolean // Deprecated - all objects are equal now
  primaryObjectId?: string // Deprecated - no primary concept
  mirrorGroupId: string // Shared ID for all 25 tiled copies (or canonical object ID in virtual tiling)
  tilePosition: [number, number] // Which tile (-2 to 2, -2 to 2) - always [0,0] for canonical objects
  entityGroupId?: string // Reference to parent entity group (if grouped)
}

// Metadata for selection proxy objects
export interface ProxyMetadata {
  isProxy: true // Always true for proxy objects
  canonicalObjectId: string // ID of the canonical object this proxy represents
  mirrorGroupId: string // mirrorGroupId of the canonical object
  tileOffset: [number, number] // Which tile offset this proxy is positioned at
  sizeAdjust: [number, number] // [leftAdjust, topAdjust] for min-size centering
  baseSize: [number, number] // [width, height] of canonical at creation time (before scale)
  baseScale: [number, number] // [scaleX, scaleY] of canonical at creation time
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
  proxyMetadata?: ProxyMetadata // Only present on proxy objects
  layerId?: string
  id?: string
}
