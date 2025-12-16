export type EntityType = 'rect' | 'circle' | 'path' | 'image' | 'group'

export interface EntityEditData {
  mirrorGroupId: string
  type: EntityType
  properties: Record<string, any>
}

export interface RectProperties {
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}

export interface CircleProperties {
  radius: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}

export interface PathProperties {
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  pathData?: string
}

export interface ImageProperties {
  opacity: number
  src?: string
}
