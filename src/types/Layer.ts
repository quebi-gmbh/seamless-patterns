export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
  objectIds: string[] // References to Fabric objects in this layer
  createdAt: number
  updatedAt: number
}

export interface LayerManagerState {
  layers: Layer[]
  activeLayerId: string | null
}
