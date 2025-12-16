import type { Layer } from '../core/LayerManager'

/**
 * Metadata for the project file
 */
export interface ProjectMetadata {
  tileSize: number
  createdAt: string
  modifiedAt: string
}

/**
 * Serialized entity (one per mirror group)
 */
export interface SerializedEntity {
  mirrorGroupId: string
  order: number
  fabricObject: any // Fabric.js serialized object
}

/**
 * Layer with its entities
 */
export interface SerializedLayer extends Layer {
  entities: SerializedEntity[]
}

/**
 * Complete project file format
 */
export interface ProjectData {
  version: string
  appVersion: string
  metadata: ProjectMetadata
  layers: SerializedLayer[]
}
