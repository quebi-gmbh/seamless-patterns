let counter = 0

export function generateUniqueId(prefix: string = 'obj'): string {
  return `${prefix}_${Date.now()}_${counter++}`
}
