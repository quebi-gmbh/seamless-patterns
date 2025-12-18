export type Tool =
  | 'brush'
  | 'varioBrush'
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
