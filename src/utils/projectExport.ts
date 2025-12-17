import type { Canvas } from 'fabric'
import type { LayerManager } from '../core/LayerManager'
import type { EntityGroupManager } from '../core/EntityGroupManager'
import type { ProjectData, SerializedLayer, SerializedEntity } from '../types/ProjectFormat'

const APP_VERSION = '0.0.1'
const PROJECT_VERSION = '1.0.0'

/**
 * Serialize the current project state to JSON
 */
export function serializeProject(
  _fabricCanvas: Canvas,
  layerManager: LayerManager,
  tileSize: number,
  entityGroupManager?: EntityGroupManager | null
): ProjectData {
  const now = new Date().toISOString()
  const layers = layerManager.getLayers()

  const serializedLayers: SerializedLayer[] = layers.map((layer) => {
    // Get only center tile objects for this layer
    const centerObjects = layerManager.getCenterTileObjectsByLayer(layer.id)

    // Serialize each object with order preserved
    const entities: SerializedEntity[] = centerObjects.map((obj, index) => ({
      mirrorGroupId: obj.tiledMetadata!.mirrorGroupId,
      order: index,
      // Include custom properties in serialization
      fabricObject: obj.toObject(['id', 'layerId', 'tiledMetadata']),
    }))

    return {
      ...layer,
      entities,
    }
  })

  // Serialize entity groups
  const entityGroups = entityGroupManager?.serialize() ?? []

  return {
    version: PROJECT_VERSION,
    appVersion: APP_VERSION,
    metadata: {
      tileSize,
      createdAt: now,
      modifiedAt: now,
    },
    layers: serializedLayers,
    entityGroups,
  }
}

/**
 * Export project as a downloadable .tiles JSON file
 */
export function exportProjectAsJSON(
  fabricCanvas: Canvas,
  layerManager: LayerManager,
  tileSize: number,
  filename: string,
  entityGroupManager?: EntityGroupManager | null
): void {
  const projectData = serializeProject(fabricCanvas, layerManager, tileSize, entityGroupManager)
  const jsonString = JSON.stringify(projectData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  // Ensure filename has .tiles extension
  const finalFilename = filename.endsWith('.tiles') ? filename : `${filename}.tiles`

  // Trigger download
  const link = document.createElement('a')
  link.href = url
  link.download = finalFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
