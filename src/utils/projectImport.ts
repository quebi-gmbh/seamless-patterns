import type { Canvas } from 'fabric'
import { util as fabricUtil } from 'fabric'
import type { LayerManager } from '../core/LayerManager'
import type { TilingEngine } from '../core/TilingEngine'
import type { ProjectData } from '../types/ProjectFormat'
import type { ExtendedFabricObject } from '../types/FabricExtensions'

/**
 * Validate project data structure
 */
export function validateProjectData(data: any): data is ProjectData {
  if (!data || typeof data !== 'object') {
    console.error('Invalid project data: not an object')
    return false
  }

  if (!data.version || typeof data.version !== 'string') {
    console.error('Invalid project data: missing or invalid version')
    return false
  }

  if (!data.metadata || typeof data.metadata !== 'object') {
    console.error('Invalid project data: missing or invalid metadata')
    return false
  }

  if (!Array.isArray(data.layers)) {
    console.error('Invalid project data: layers must be an array')
    return false
  }

  // Validate each layer
  for (const layer of data.layers) {
    if (!layer.id || !layer.name || typeof layer.visible !== 'boolean' ||
        typeof layer.locked !== 'boolean' || typeof layer.order !== 'number') {
      console.error('Invalid layer structure:', layer)
      return false
    }

    if (!Array.isArray(layer.entities)) {
      console.error('Invalid layer: entities must be an array')
      return false
    }
  }

  // Log version mismatch warnings
  if (data.version !== '1.0.0') {
    console.warn(`Project version ${data.version} may not be fully compatible`)
  }

  return true
}

/**
 * Deserialize project data and restore canvas state
 */
export async function deserializeProject(
  projectData: ProjectData,
  fabricCanvas: Canvas,
  layerManager: LayerManager,
  tilingEngine: TilingEngine
): Promise<void> {
  // Step 1: Validate
  if (!validateProjectData(projectData)) {
    throw new Error('Invalid project data')
  }

  // Step 2: Clear existing state
  layerManager.clear()

  // Step 3: Import layers
  const layers = projectData.layers.map(({ entities, ...layer }) => layer)
  layerManager.importLayers(layers)

  // Step 4: Deserialize and recreate entities
  for (const serializedLayer of projectData.layers) {
    // Sort entities by order to maintain z-index
    const sortedEntities = [...serializedLayer.entities].sort((a, b) => a.order - b.order)

    for (const entity of sortedEntities) {
      try {
        // Deserialize Fabric object
        const [fabricObject] = await fabricUtil.enlivenObjects([entity.fabricObject])

        if (!fabricObject) {
          console.error('Failed to enliven object:', entity)
          continue
        }

        // Ensure custom properties are preserved
        const extObj = fabricObject as ExtendedFabricObject
        if (!extObj.id) extObj.id = entity.fabricObject.id
        if (!extObj.layerId) extObj.layerId = entity.fabricObject.layerId || serializedLayer.id
        if (!extObj.tiledMetadata) extObj.tiledMetadata = entity.fabricObject.tiledMetadata

        // Get position from the object
        const position = { x: extObj.left || 0, y: extObj.top || 0 }

        // Remove the object from canvas (it was added by enlivenObjects)
        if (fabricCanvas.contains(extObj)) {
          fabricCanvas.remove(extObj)
        }

        // Recreate as tiled object using tilingEngine
        await tilingEngine.createTiledObject(extObj, position, extObj.layerId!)
      } catch (error) {
        console.error('Failed to import entity:', entity, error)
        // Continue with other entities even if one fails
      }
    }
  }

  // Step 5: Request render
  fabricCanvas.requestRenderAll()
}

/**
 * Import project from a .tiles file
 */
export async function importProjectFromFile(
  file: File,
  fabricCanvas: Canvas,
  layerManager: LayerManager,
  tilingEngine: TilingEngine
): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string
        const projectData = JSON.parse(text)

        await deserializeProject(projectData, fabricCanvas, layerManager, tilingEngine)
        resolve()
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error('Failed to parse project file: Invalid JSON'))
        } else if (error instanceof Error) {
          reject(error)
        } else {
          reject(new Error('Failed to import project'))
        }
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsText(file)
  })
}
