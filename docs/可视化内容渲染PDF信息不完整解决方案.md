# 可视化内容渲染 PDF 信息不准确不完整的解决技术方案

## 1. 问题描述

用户在可视化编辑器中填写的内容，保存后渲染到 PDF 时会缺少各种信息。

## 2. 问题分析

### 2.1 数据流转流程

```
前端可视化编辑器 (sections)
    ↓ handleSave() 格式转换
Resume JSON 数据
    ↓ API 调用
后端 latex_generator.py
    ↓ 字段提取
LaTeX 代码
    ↓ xelatex 编译
PDF 文件
```

### 2.2 根因分析：字段映射不一致

#### 教育经历 (education)

| 前端字段 | 前端显示 | 后端期望字段 | 是否匹配 |
|---------|---------|-------------|---------|
| `title` | 学校/专业 | `title` 或 `school` | ⚠️ 部分匹配 |
| `subtitle` | 学位 | `degree` | ❌ 不匹配 |
| `date` | 时间 | `date` 或 `duration` | ⚠️ 部分匹配 |

**后端代码** (`latex_generator.py:305-330`)：
- 优先使用 `title` + `date`
- 备选使用 `school` + `degree` + `major` + `duration`
- 前端的 `subtitle` (学位) 完全丢失！

#### 工作经历 (experience/internships)

| 前端字段 | 前端显示 | 后端期望字段 | 是否匹配 |
|---------|---------|-------------|---------|
| `title` | 公司 | `title` | ✅ 匹配 |
| `subtitle` | 职位 | `subtitle` | ✅ 匹配 |
| `date` | 时间 | `date` | ✅ 匹配 |
| `details` | 描述 | `highlights` | ⚠️ 需转换 |

**handleSave 转换**：`details` → `highlights` ✅ 已处理

#### 项目经历 (projects)

| 前端字段 | 前端显示 | 后端期望字段 | 是否匹配 |
|---------|---------|-------------|---------|
| `title` | 项目名称 | `title` 或 `name` | ✅ 匹配 |
| `subtitle` | 角色 | `role` | ❌ 不匹配 |
| `date` | 时间 | 无 | ❌ 未使用 |
| `details` | 描述 | `highlights` | ⚠️ 需转换 |

**后端代码** (`latex_generator.py:244-280`)：
- 使用 `title` 或 `name` + `role`
- 前端的 `subtitle` 应该映射为 `role`

### 2.3 问题总结

1. **教育经历**：`subtitle` (学位) 丢失
2. **项目经历**：`subtitle` 应映射为 `role`，`date` 未使用
3. **格式转换**：`details` → `highlights` 已在 handleSave 中处理

## 3. 解决方案

### 方案一：修改前端数据转换 (推荐)

在 `handleSave()` 中增加字段映射转换：

```typescript
// ResumeEditor.tsx - handleSave()

// 转换教育经历格式
const convertEducationFormat = (items: any[]) => {
  return items.map(item => ({
    school: item.title || '',      // title → school
    degree: item.subtitle || '',   // subtitle → degree  
    major: '',                     // 可选
    duration: item.date || '',     // date → duration
  }))
}

// 转换项目经历格式
const convertProjectsFormat = (items: any[]) => {
  return items.map(item => ({
    title: item.title || '',
    role: item.subtitle || '',     // subtitle → role
    date: item.date || '',
    highlights: Array.isArray(item.details) ? item.details : [],
  }))
}

const newResumeData = {
  // ...
  education: convertEducationFormat(educationSection?.data || []),
  projects: convertProjectsFormat(projectsSection?.data || []),
  // ...
}
```

### 方案二：修改后端字段兼容 (备选)

在 `latex_generator.py` 中增加字段兼容：

```python
# 教育经历兼容
school = ed.get('school') or ed.get('title') or ''
degree = ed.get('degree') or ed.get('subtitle') or ''
duration = ed.get('duration') or ed.get('date') or ''

# 项目经历兼容
role = p.get('role') or p.get('subtitle') or ''
```

## 4. 实施计划

| 步骤 | 任务 | 文件 |
|------|------|------|
| 1 | 修改教育经历数据转换 | `ResumeEditor.tsx` |
| 2 | 修改项目经历数据转换 | `ResumeEditor.tsx` |
| 3 | 增加后端字段兼容 | `latex_generator.py` |
| 4 | 测试验证所有模块 | - |

## 5. 修改记录

### 2024-12-07

- [x] 问题分析完成
- [x] 前端数据转换修改 (`ResumeEditor.tsx`)
  - 新增 `convertEducationFormat()`: title→school, subtitle→degree, date→duration
  - 新增 `convertProjectsFormat()`: subtitle→role, details→highlights
  - 同步修改 `handleSave()` 和 `handleDragEnd()` 中的转换逻辑
- [x] 后端字段兼容修改 (`latex_generator.py`)
  - `generate_section_education()`: 兼容 title/school, subtitle/degree, date/duration
  - `generate_section_projects()`: 兼容 subtitle/role, 添加 date 支持
- [ ] 测试验证
