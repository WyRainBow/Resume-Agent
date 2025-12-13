# PDF 编辑器文本框宽度优化方案

## 问题描述

当用户点击 PDF 中的文字（如"西安电子科技大学"）进行编辑时：
1. 编辑框的宽度比实际文字宽，遮住了后面的文字（如"-本科-计算机科学与技术"）
2. 即使用户没有修改内容，白色遮盖层也会遮住相邻文字

## 问题根因

当前 `EditableText.tsx` 的宽度计算：

```typescript
// 问题代码
const padding = 2
const baseStyle = {
  left: edit.position.left - padding,      // 向左偏移
  minWidth: edit.position.width + padding * 2,  // 宽度增加 4px
}
```

- `padding` 用于扩展覆盖区域，但会导致遮盖范围过大
- `minWidth` 设置导致框始终比原文字宽

## 解决方案

### 核心思路

**精确宽度 + 动态扩展**：
1. 初始状态：编辑框宽度 = 原文字宽度（精确匹配，不多不少）
2. 编辑状态：根据用户输入的新文字宽度**动态调整**
3. 只有当新文字比原文字长时，才扩展宽度

### 技术实现

#### 1. 文字宽度测量函数

使用 Canvas 精确测量文字渲染宽度：

```typescript
// utils/measureText.ts
export const measureTextWidth = (
  text: string,
  fontSize: number,
  fontFamily: string = 'inherit'
): number => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return text.length * fontSize * 0.6  // fallback
  
  ctx.font = `${fontSize}px ${fontFamily}`
  return ctx.measureText(text).width
}
```

#### 2. 动态宽度计算逻辑

```typescript
// EditableText.tsx
const EditableText = ({ edit, ... }) => {
  const [dynamicWidth, setDynamicWidth] = useState(edit.position.width)
  
  // 计算当前文字需要的宽度
  const calculateWidth = useCallback((text: string) => {
    const measuredWidth = measureTextWidth(text, edit.position.fontSize)
    // 取 原始宽度 和 新文字宽度 的较大值
    return Math.max(edit.position.width, measuredWidth + 4)  // +4 是输入框内边距
  }, [edit.position.width, edit.position.fontSize])
  
  // 文字变化时更新宽度
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value
    setLocalValue(newText)
    setDynamicWidth(calculateWidth(newText))
    onUpdate(newText)
  }
  
  // 样式使用动态宽度
  const style = {
    left: edit.position.left,      // 不再偏移
    width: dynamicWidth,           // 使用动态宽度
    // ...
  }
}
```

#### 3. 非编辑状态的精确遮盖

```typescript
// 非编辑状态：只遮盖新文字实际占用的区域
if (!edit.isEditing) {
  const actualWidth = measureTextWidth(edit.newText, edit.position.fontSize)
  
  return (
    <div style={{
      position: 'absolute',
      left: edit.position.left,
      top: edit.position.top,
      width: Math.max(edit.position.width, actualWidth),  // 精确宽度
      height: edit.position.height * 1.2,
      backgroundColor: 'white',
      // ...
    }}>
      {edit.newText}
    </div>
  )
}
```

### 状态流转图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户点击文字                            │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  初始状态                                             │  │
│  │  width = originalWidth (PDF 返回的精确宽度)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  用户输入新文字                                        │  │
│  │  newWidth = measureText(newText)                      │  │
│  │  displayWidth = max(originalWidth, newWidth)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  编辑完成                                             │  │
│  │  遮盖层宽度 = max(originalWidth, 新文字实际宽度)       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 新文字比原文字短 | 宽度保持原始宽度（保证覆盖原文字） |
| 新文字比原文字长 | 宽度动态扩展到新文字宽度 |
| 文字为空 | 保持最小宽度（如 20px）|
| 中英文混合 | 使用 Canvas measureText 精确测量 |

### 实现步骤

1. **创建文字测量工具** `utils/measureText.ts`
2. **修改 EditableText 组件**：
   - 移除固定的 `padding` 偏移
   - 添加动态宽度状态 `dynamicWidth`
   - 输入时实时计算并更新宽度
3. **优化非编辑状态遮盖**：
   - 根据新文字实际宽度计算遮盖范围
4. **测试验证**：
   - 测试中文、英文、数字的宽度计算
   - 测试编辑前后的遮盖效果

### 预期效果

- ✅ 点击"西安电子科技大学"时，编辑框精确覆盖这 6 个字
- ✅ 后面的"-本科-计算机科学与技术"不会被遮挡
- ✅ 用户输入更长的文字时，框自动扩展
- ✅ 用户输入更短的文字时，框保持原始宽度（避免露出原文字）
