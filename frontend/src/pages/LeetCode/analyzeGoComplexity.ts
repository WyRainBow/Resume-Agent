/**
 * 对当前编辑器中的 Go 代码做轻量静态扫描（非 AST、非严格证明），
 * 用于展示「时间/空间复杂度」与 for 嵌套、递归等启发式说明。
 */

export interface ForLoopInfo {
  line: number
  /** 进入该 for 行前，已打开的 { 层数（越大通常表示越深的块嵌套） */
  blockDepth: number
  /** 按顺序用栈估算的 for 嵌套层数（兄弟 for 会重置为 1） */
  forNestLevel: number
  snippet: string
  /** 对循环次数的口语化提示（无法可靠求出精确代数式） */
  iterationHint: string
}

export interface GoComplexityInsight {
  timeLabel: string
  spaceLabel: string
  reasons: string[]
  loops: ForLoopInfo[]
  maxForNestLevel: number
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

function iterationHintFromForLine(snippet: string): string {
  const s = snippet.replace(/\s+/g, ' ').trim()
  if (/\bfor\s+range\b/.test(s)) {
    return '遍历集合/切片/映射长度 · 单次迭代常为 O(1)'
  }
  if (/\bfor\s*\{/.test(s)) {
    return '条件/死循环骨架 · 次数取决于内部 break 与变量变化'
  }
  const classical = /\bfor\s+([^;{}]+);\s*([^;{}]+);\s*([^;{}]*)\)/.exec(s)
  if (classical) {
    const cond = classical[2].trim()
    if (/</.test(cond) || />/.test(cond) || /<=|>=|!=|==/.test(cond)) {
      return `C 风格 for · 中部条件形如「${cond.slice(0, 48)}${cond.length > 48 ? '…' : ''}」，次数由上界变量增长方式决定`
    }
  }
  return '次数由循环条件与递归外规模 n 的关系决定（以下为渐进阶的常识推断）'
}

function computeForNestLevels(loops: { line: number; blockDepth: number }[]): Map<number, number> {
  const sorted = [...loops].sort((a, b) => a.line - b.line)
  const stack: number[] = []
  const byLine = new Map<number, number>()
  for (const L of sorted) {
    const d = L.blockDepth
    while (stack.length > 0 && stack[stack.length - 1] >= d) {
      stack.pop()
    }
    stack.push(d)
    byLine.set(L.line, stack.length)
  }
  return byLine
}

export function analyzeGoComplexity(code: string): GoComplexityInsight {
  const lines = code.split('\n')
  let blockDepth = 0
  const rawLoops: { line: number; blockDepth: number; snippet: string }[] = []

  lines.forEach((line, idx) => {
    const logical = stripGoLineComment(line)
    const beforeDepth = blockDepth
    // 判断是否出现 for（排除 for 类型 switch 里没有 for 的假阳性已够用）
    if (/\bfor\b/.test(logical)) {
      rawLoops.push({
        line: idx + 1,
        blockDepth: beforeDepth,
        snippet: logical.trim().slice(0, 200),
      })
    }
    blockDepth += deltaBraces(logical)
    if (blockDepth < 0) blockDepth = 0
  })

  const nestByLine = computeForNestLevels(rawLoops.map(({ line, blockDepth }) => ({ line, blockDepth })))

  const loops: ForLoopInfo[] = rawLoops.map(l => ({
    ...l,
    forNestLevel: nestByLine.get(l.line) ?? 1,
    iterationHint: iterationHintFromForLine(l.snippet),
  }))

  const maxForNestLevel = loops.length ? Math.max(...loops.map(x => x.forNestLevel)) : 0

  const lower = code.toLowerCase()
  const funcNames = [...new Set([...code.matchAll(/\bfunc\s+([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]))]

  let recursive = false
  const recursiveFuncs: string[] = []
  for (const fn of funcNames) {
    const esc = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${esc}\\s*\\(`, 'g')
    const hits = code.match(re)
    if (hits && hits.length >= 2) {
      recursive = true
      recursiveFuncs.push(fn)
    }
  }

  const partitionLike = /\bpartition\b/.test(lower) || /\bpivot\b/.test(lower)

  const dfsLike = /\bdfs\b/.test(lower) || /\bbacktrack\b/.test(lower)

  let timeLabel = '结合循环上界与递归结构具体分析'
  let spaceLabel = '结合是否分配与输入同阶的辅助结构具体分析'

  const reasons: string[] = [
    '以下为基于代码文本的启发式扫描，不是形式化证明；精确「执行次数」需代入数据规模与循环不变式，一般无法仅靠正则可靠推出。',
  ]

  if (recursive && partitionLike) {
    timeLabel = '平均 O(n log n) · 最坏 O(n²)'
    spaceLabel = 'O(log n)～O(n)（递归栈 · 最坏链式划分）'
    reasons.push(
      '划分阶段：单层通常把区间扫一遍，记为 O(n)。递归：若每次大致二分规模，树深 O(log n)，总时间 O(n log n)；若划分总偏在一端，树深退化 O(n)，总时间 O(n²)。',
      '空间：调用栈深度与递归树高同阶；原地排序不另开与 n 成比例的切片时，辅助空间主要来自栈帧。',
    )
  } else if (recursive && dfsLike) {
    timeLabel = '依图规模或状态空间而定（常见 O(V+E) 或指数级）'
    spaceLabel = 'O(递归深度) + 访问标记等'
    reasons.push('深度优先/回溯：时间依赖分支与剪枝；若带备忘录需把表空间算入。')
  } else if (recursive) {
    timeLabel = '取决于递归子问题个数与每层工作量之积'
    spaceLabel = 'O(递归深度)（及每层局部变量）'
    reasons.push(
      `检测到函数体内多次出现同一函数名调用（可能自递归）：${recursiveFuncs.slice(0, 5).join('、') || '—'}。请对照是否每次规模严格减小。`,
    )
  }

  if (loops.length === 0) {
    if (!recursive) {
      timeLabel = '未检测到 for/range · 多为 O(1) 级常数工作'
      spaceLabel = 'O(1)'
      reasons.push('无显式循环且无递归时，通常与输入规模无关的常数次操作。')
    } else if (!partitionLike) {
      timeLabel = timeLabel.startsWith('平均') ? timeLabel : '主要由递归树决定（见上）'
    }
  } else {
    reasons.push(
      `共 ${loops.length} 处 for/range；按出现顺序估算的 for 嵌套深度最大为 ${maxForNestLevel}（兄弟循环会结束内层后再算新的一层）。`,
    )

    if (!recursive) {
      if (loops.length === 1) {
        timeLabel = '常见 O(n)（若单次循环上界与 n 同阶）'
        spaceLabel = 'O(1) 额外（原地、不复制整个输入时）'
      } else if (maxForNestLevel >= 2) {
        const k = Math.min(maxForNestLevel, 5)
        timeLabel = `嵌套循环常见 O(n^${k}) 量级（假设各层在 n 上皆线性）`
        spaceLabel = 'O(1)～O(n)（视是否额外开缓冲）'
        reasons.push(
          '多层嵌套且各层都跑满 O(n) 范围时，次数直观上为「各层长度相乘」；若内层随外层收缩总长仍为 O(n)（如双指针），实际可能更低——本工具不解析控制流，仅列常见上界直觉。',
        )
      }
    }

    loops.forEach((L, idx) => {
      reasons.push(`L${L.line}（嵌套 ${L.forNestLevel}）：${L.iterationHint}`)
    })
  }

  if (recursive && /\bappend\b|\bmake\s*\(\s*\[\]/i.test(code)) {
    reasons.push('若对每个元素都做 append/new 切片拷贝，峰值辅助空间可能与输出长度同阶。')
  }

  return {
    timeLabel,
    spaceLabel,
    reasons,
    loops,
    maxForNestLevel,
  }
}
