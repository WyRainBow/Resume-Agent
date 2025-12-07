# PDF 生成性能优化方案

## 1. 问题描述

用户在拖拽调整简历模块顺序或编辑内容后，PDF 预览更新速度过慢，严重影响用户体验。

## 2. 性能分析

### 2.1 当前流程

```
前端编辑 → API 请求 → JSON 转 LaTeX → xelatex 编译 → 返回 PDF → PDF.js 渲染
```

### 2.2 性能测量结果

| 步骤 | 耗时 | 占比 |
|------|------|------|
| JSON → LaTeX | 2-5ms | 0.1% |
| **xelatex 编译** | **6752-7203ms** | **99.9%** |
| 总耗时 | ~7 秒 | 100% |

### 2.3 瓶颈分析

**主要瓶颈：xelatex 编译过程**

原因：
1. **xelatex 启动开销大**：每次编译都需要启动 xelatex 进程
2. **字体加载慢**：中文字体（Adobe 字体包）加载耗时
3. **无编译缓存**：每次都是全新编译，无法复用中间结果
4. **单线程编译**：无法并行处理

## 3. 解决方案

### 方案一：LaTeX 编译优化（推荐，短期）

#### 3.1.1 使用 xelatex 预编译格式（format）

```bash
# 预编译字体和宏包
xelatex -ini -jobname=resume "&xelatex resume.cls\dump"
```

预期效果：减少 50% 编译时间

#### 3.1.2 启用 xelatex 缓存

```python
# 设置环境变量启用缓存
os.environ['TEXMFVAR'] = '/tmp/texmf-cache'
```

#### 3.1.3 使用 latexmk 增量编译

```python
subprocess.run(['latexmk', '-xelatex', '-interaction=nonstopmode', 'resume.tex'])
```

### 方案二：PDF 缓存机制（推荐，中期）

#### 3.2.1 内容哈希缓存

```python
import hashlib

def get_pdf_cache_key(resume_data, section_order):
    content = json.dumps(resume_data, sort_keys=True) + str(section_order)
    return hashlib.md5(content.encode()).hexdigest()

# 缓存检查
cache_key = get_pdf_cache_key(resume_data, section_order)
if cache_key in pdf_cache:
    return pdf_cache[cache_key]
```

预期效果：相同内容秒返回

#### 3.2.2 Redis 分布式缓存

```python
import redis
r = redis.Redis()

def get_cached_pdf(cache_key):
    return r.get(f"pdf:{cache_key}")

def set_cached_pdf(cache_key, pdf_bytes, ttl=3600):
    r.setex(f"pdf:{cache_key}", ttl, pdf_bytes)
```

### 方案三：替换渲染引擎（长期）

#### 3.3.1 使用 Typst 替代 LaTeX

[Typst](https://typst.app/) 是现代排版系统，编译速度比 LaTeX 快 10-100 倍。

```typst
#set page(paper: "a4")
#set text(font: "Noto Sans CJK SC")

= #resume.name
#resume.contact.phone · #resume.contact.email
```

预期效果：编译时间 < 100ms

#### 3.3.2 使用 WeasyPrint（HTML → PDF）

```python
from weasyprint import HTML

def render_pdf_weasyprint(resume_data):
    html = render_resume_html(resume_data)
    return HTML(string=html).write_pdf()
```

预期效果：编译时间 200-500ms

#### 3.3.3 使用 Puppeteer/Playwright（浏览器渲染）

```python
from playwright.sync_api import sync_playwright

def render_pdf_playwright(html_content):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(html_content)
        pdf = page.pdf(format='A4')
        browser.close()
        return pdf
```

### 方案四：前端优化（辅助）

#### 3.4.1 防抖处理

```typescript
// 拖拽结束后延迟 500ms 再渲染
const debouncedRenderPDF = useMemo(
  () => debounce(renderPDF, 500),
  []
);
```

#### 3.4.2 乐观更新 + 后台渲染

```typescript
// 立即显示 loading 状态
setLoading(true);
// 后台异步渲染
renderPDF(data).then(blob => {
  setPdfBlob(blob);
  setLoading(false);
});
```

#### 3.4.3 增量预览（仅显示变更部分）

使用 Canvas 直接绘制简历预览，无需等待后端。

## 4. 实施计划

### 第一阶段：快速优化（1-2天）

| 任务 | 预期效果 | 优先级 |
|------|----------|--------|
| 添加 PDF 内容哈希缓存 | 相同内容秒返回 | P0 |
| 前端添加防抖 500ms | 减少无效请求 | P0 |
| xelatex 启用缓存 | 减少 20% 时间 | P1 |

### 第二阶段：架构优化（1周）

| 任务 | 预期效果 | 优先级 |
|------|----------|--------|
| 集成 Typst 渲染引擎 | 编译 < 100ms | P0 |
| 或集成 WeasyPrint | 编译 < 500ms | P1 |
| Redis 分布式缓存 | 支持多实例 | P2 |

### 第三阶段：高级优化（2周）

| 任务 | 预期效果 | 优先级 |
|------|----------|--------|
| 前端 Canvas 实时预览 | 即时反馈 | P1 |
| WebSocket 推送 PDF | 减少轮询 | P2 |
| PDF 差量更新 | 仅更新变更页 | P3 |

## 5. 推荐方案

### 短期（立即实施）

1. **添加内存缓存**：相同内容直接返回缓存的 PDF
2. **前端防抖 500ms**：避免频繁触发渲染

### 中期（1周内）

3. **集成 Typst**：替换 xelatex，编译速度提升 50-100 倍

### 预期效果

| 场景 | 当前耗时 | 优化后 |
|------|----------|--------|
| 首次渲染 | 7000ms | < 500ms (Typst) |
| 重复内容 | 7000ms | < 10ms (缓存) |
| 拖拽调整 | 7000ms | < 500ms |

## 6. 测试验证

### 6.1 性能测试脚本

```python
import time
import requests

def benchmark_pdf_render(n=10):
    url = "http://localhost:8000/api/pdf/render"
    data = {"resume": {...}, "section_order": [...]}
    
    times = []
    for i in range(n):
        start = time.time()
        resp = requests.post(url, json=data)
        elapsed = time.time() - start
        times.append(elapsed)
        print(f"请求 {i+1}: {elapsed*1000:.0f}ms")
    
    print(f"平均耗时: {sum(times)/len(times)*1000:.0f}ms")
    print(f"最小耗时: {min(times)*1000:.0f}ms")
    print(f"最大耗时: {max(times)*1000:.0f}ms")
```

### 6.2 验收标准

- [ ] 首次 PDF 渲染 < 1 秒
- [ ] 缓存命中时 < 100ms
- [ ] 拖拽调整后 PDF 更新 < 1 秒
- [ ] 用户无明显等待感

## 7. 参考资料

- [Typst 官网](https://typst.app/)
- [WeasyPrint 文档](https://weasyprint.org/)
- [xelatex 性能优化](https://tex.stackexchange.com/questions/8791/speeding-up-latex-compilation)
