/**
 * 轻量扫描 Go 源码，估算渐进时间与辅助空间结论（启发式）。
 */

export interface GoComplexityLabels {
  timeLabel: string
  spaceLabel: string
}

function stripGoLineComment(line: string): string {
  let i = 0
  let out = ''
  let inString: '"' | '`' | "'" | null = null
  while (i < line.length) {
    const c = line[i]
    if (inString === '"') {
      if (c === '\\' && i + 1 < line.length) {
        out += c + line[i + 1]
        i += 2
        continue
      }
      if (c === '"') inString = null
      out += c
      i++
      continue
    }
    if (inString === '`') {
      if (c === '`') inString = null
      out += c
      i++
      continue
    }
    if (inString === "'") {
      if (c === '\\' && i + 1 < line.length) {
        out += c + line[i + 1]
        i += 2
        continue
      }
      if (c === "'") inString = null
      out += c
      i++
      continue
    }
    if (c === '/' && line[i + 1] === '/') {
      break
    }
    if (c === '"') inString = '"'
    else if (c === '`') inString = '`'
    else if (c === "'") inString = "'"
    out += c
    i++
  }
  return out
}

function deltaBraces(line: string): number {
  let d = 0
  let inString: '"' | '`' | "'" | null = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inString === '"') {
      if (c === '\\') {
        i++
        continue
      }
      if (c === '"') inString = null
      continue
    }
    if (inString === '`') {
      if (c === '`') inString = null
      continue
    }
    if (inString === "'") {
      if (c === '\\') {
        i++
        continue
      }
      if (c === "'") inString = null
      continue
    }
    if (c === '"' || c === '`' || c === "'") {
      inString = c as '"' | '`' | "'"
      continue
    }
    if (c === '/' && line[i + 1] === '/') break
    if (c === '{') d++
    if (c === '}') d--
  }
  return d
}

function maxForNestLevel(lines: string[]): number {
  let blockDepth = 0
  const raw: { line: number; blockDepth: number }[] = []
  lines.forEach((line, idx) => {
    const logical = stripGoLineComment(line)
    const beforeDepth = blockDepth
    if (/\bfor\b/.test(logical)) {
      raw.push({ line: idx + 1, blockDepth: beforeDepth })
    }
    blockDepth += deltaBraces(logical)
    if (blockDepth < 0) blockDepth = 0
  })
  if (raw.length === 0) return 0
  const sorted = [...raw].sort((a, b) => a.line - b.line)
  const stack: number[] = []
  let maxNest = 0
  for (const L of sorted) {
    while (stack.length > 0 && stack[stack.length - 1] >= L.blockDepth) {
      stack.pop()
    }
    stack.push(L.blockDepth)
    maxNest = Math.max(maxNest, stack.length)
  }
  return maxNest
}

export function analyzeGoComplexity(code: string): GoComplexityLabels {
  const lines = code.split('\n')
  const loopCount = lines.reduce((n, line) => (/\bfor\b/.test(stripGoLineComment(line)) ? n + 1 : n), 0)
  const nest = maxForNestLevel(lines)

  const lower = code.toLowerCase()
  const funcNames = [...new Set([...code.matchAll(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]))]

  let recursive = false
  for (const fn of funcNames) {
    const esc = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const hits = code.match(new RegExp(`\\b${esc}\\s*\\(`, 'g'))
    if (hits && hits.length >= 2) {
      recursive = true
      break
    }
  }

  const partitionLike = /\bpartition\b/.test(lower) || /\bpivot\b/.test(lower)
  const dfsLike = /\bdfs\b/.test(lower) || /\bbacktrack\b/.test(lower)

  let timeLabel = '结合循环上界与递归结构具体分析'
  let spaceLabel = '结合是否分配与输入同阶的辅助结构具体分析'

  if (recursive && partitionLike) {
    timeLabel = '平均 O(n log n) · 最坏 O(n²)'
    spaceLabel = 'O(log n)～O(n)（递归栈 · 最坏链式划分）'
  } else if (recursive && dfsLike) {
    timeLabel = '依图规模或状态空间而定（常见 O(V+E) 或指数级）'
    spaceLabel = 'O(递归深度) + 访问标记等'
  } else if (recursive) {
    timeLabel = '取决于递归子问题个数与每层工作量之积'
    spaceLabel = 'O(递归深度)（及每层局部变量）'
  }

  if (loopCount === 0 && !recursive) {
    timeLabel = '未检测到 for/range · 多为 O(1)'
    spaceLabel = 'O(1)'
  } else if (loopCount > 0 && !recursive) {
    if (loopCount === 1) {
      timeLabel = '常见 O(n)（若单次循环上界与 n 同阶）'
      spaceLabel = 'O(1)（原地、不复制整个输入）'
    } else if (nest >= 2) {
      const k = Math.min(nest, 5)
      timeLabel = `嵌套循环常见 O(n^${k})（各层若在 n 上线性）`
      spaceLabel = 'O(1)～O(n)（视是否额外开缓冲）'
    }
  }

  if (recursive && /\bappend\b|\bmake\s*\(\s*\[\]/i.test(code)) {
    spaceLabel = `${spaceLabel} · 或对切片分配的额外开销`
  }

  return { timeLabel, spaceLabel }
}
