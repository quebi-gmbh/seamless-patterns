export type Tool =
  | 'brush'
  | 'eraser'
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'path'

export interface ToolState {
  tool: Tool
  brushSize: number
  color: string
  isDrawing: boolean
}
