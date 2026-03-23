/**
 * 按路径读取对象值，支持数组索引
 * 例：getByPath(obj, "experience[0].details")
 */
export function getByPath(obj: any, path: string): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  return parts.reduce((curr, key) => curr?.[key], obj)
}

/**
 * 按路径写入对象值，返回新对象（不可变）
 */
export function setByPath(obj: any, path: string, value: any): any {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  const result = structuredClone(obj)
  let curr = result
  for (let i = 0; i < parts.length - 1; i++) {
    curr = curr[parts[i]]
  }
  curr[parts[parts.length - 1]] = value
  return result
}

/**
 * 按 paths 数组批量写入 after 中的值到 resume
 */
export function applyPatchPaths(resume: any, paths: string[], after: any): any {
  let result = resume
  for (const path of paths) {
    const value = getByPath(after, path)
    if (value !== undefined) {
      result = setByPath(result, path, value)
    }
  }
  return result
}
