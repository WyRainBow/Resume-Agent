

如何让 AI 返回标准化的 Json 格式 
如果有问题怎么办

我目前使用这个 python 的 instructor 库的 
但是还是有问题

AI 返回的 JSON 中，experience 和 projects 数组后面多了一个空格和逗号 ]} ,，导致 JSON 解析失败。这是 AI 生成的格式问题。

让我增强后端的 JSON 清理逻辑：

我看到了新的问题！AI 返回的 JSON 中缺少逗号，比如 ]}] ""projects" 应该是 ]}], "projects"。让我增强清理逻辑：
# AI 返回 JSON 格式标准化技术方案

## 问题背景

在开发 Resume-Agent 系统时，需要 AI 模型（智谱 GLM-4.5V）返回结构化的简历 JSON 数据。即使使用了 `instructor` 库进行结构化输出，仍然遇到了多种 JSON 格式错误。

## 遇到的具体问题

### 问题 1：数组后多余逗号和空格
```json
"experience": [{...}]} ,
"projects": [{...}]} ,
```
**错误原因**：AI 在数组结束后添加了多余的 `, `
**正确格式**：`]}}`

### 问题 2：缺少必要的逗号
```json
"experience": [{...}]} ""projects": [{...}]
```
**错误原因**：AI 在字段之间缺少逗号分隔符
**正确格式**：`]}}, "projects": [{...}]`

### 问题 3：双引号错误
```json
] ""projects": [
```
**错误原因**：AI 生成了双引号 `""`
**正确格式**：`], "projects": [`

## 当前解决方案：正则表达式清理

### 实现代码
```python
import re

# 移除智谱特殊标签
cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)

# 修复常见的 JSON 格式错误
cleaned = re.sub(r'\]\}\s*,\s*"', ']}}, "', cleaned)  # 修复 ]} ,
cleaned = re.sub(r'\]\}\s*,\s*(["\}])', r']} \1', cleaned)  # 修复 ]} ,
cleaned = re.sub(r'\]\s*,\s*(["\}])', r'] \1', cleaned)  # 修复 ] ,
cleaned = re.sub(r'\]\s+""([a-zA-Z_]+)"', r'], "\1"', cleaned)  # 修复 ] ""key"
cleaned = re.sub(r'\]\s+"([a-zA-Z_]+)"\s*:', r'], "\1":', cleaned)  # 修复 ] "key"
cleaned = re.sub(r'\]\}\s+"([a-zA-Z_]+)"\s*:', r']}, "\1":', cleaned)  # 修复 ]} "key"
```

### 局限性

1. **手动维护**：每遇到新的错误格式，就需要添加新的正则规则
2. **不够健壮**：正则表达式可能无法覆盖所有边缘情况
3. **性能开销**：多次正则替换会增加处理时间
4. **难以测试**：很难覆盖所有可能的错误组合

## 更优雅的解决方案

### 方案 1：使用 JSON 修复库

#### 1.1 json-repair (Python)
```python
from json_repair import repair_json

try:
    data = json.loads(raw)
except:
    # 自动修复 JSON 格式错误
    repaired = repair_json(raw)
    data = json.loads(repaired)
```

**优点**：
- 自动处理常见的 JSON 错误
- 无需手动编写正则
- 社区维护，持续更新

**安装**：
```bash
pip install json-repair
```

#### 1.2 jq (JSON 处理工具)
```python
import subprocess

def fix_json_with_jq(raw_json):
    try:
        result = subprocess.run(
            ['jq', '-c', '.'],
            input=raw_json,
            capture_output=True,
            text=True
        )
        return result.stdout
    except:
        return None
```

### 方案 2：增强 Prompt 工程

#### 2.1 使用 Few-Shot 示例
```python
prompt = f"""
请严格按照以下示例返回 JSON：

示例 1：
{{
  "name": "张三",
  "skills": ["Java", "Python"],
  "experience": [{{
    "company": "XX公司",
    "achievements": ["成果1", "成果2"]
  }}]
}}

现在根据用户需求生成：{instruction}

注意：
1. 不要在数组后添加多余逗号
2. 字段之间必须有逗号分隔
3. 不要使用双引号
"""
```

#### 2.2 使用 JSON Schema 验证
```python
from jsonschema import validate, ValidationError

schema = {
    "type": "object",
    "required": ["name", "experience", "projects", "skills"],
    "properties": {
        "name": {"type": "string"},
        "experience": {
            "type": "array",
            "items": {"type": "object"}
        },
        "skills": {
            "type": "array",
            "items": {"type": "string"}
        }
    }
}

try:
    validate(instance=data, schema=schema)
except ValidationError as e:
    # 重新调用 AI，并在 Prompt 中指出错误
    pass
```

### 方案 3：使用更强大的结构化输出库

#### 3.1 Instructor + Pydantic 增强
```python
from instructor import patch
from pydantic import BaseModel, Field, validator
from typing import List

class Experience(BaseModel):
    company: str = Field(..., description="公司名称")
    position: str = Field(..., description="职位")
    achievements: List[str] = Field(..., min_items=1)
    
    @validator('achievements')
    def validate_achievements(cls, v):
        if not v or len(v) == 0:
            raise ValueError('必须包含至少1条成果')
        return v

class Resume(BaseModel):
    name: str = Field(..., description="姓名")
    experience: List[Experience] = Field(..., min_items=1)
    skills: List[str] = Field(..., min_items=1)
    
    class Config:
        # 严格模式：不允许额外字段
        extra = 'forbid'

# 使用
client = patch(ZhipuAiClient(api_key=API_KEY))
result = client.chat.completions.create(
    model="glm-4.5v",
    response_model=Resume,  # 强制返回 Resume 类型
    messages=[{"role": "user", "content": prompt}],
    max_retries=3  # 失败自动重试
)
```

**优点**：
- Pydantic 自动验证数据类型
- 自定义 validator 增强校验
- 失败自动重试

#### 3.2 LangChain 结构化输出
```python
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import PromptTemplate

parser = PydanticOutputParser(pydantic_object=Resume)

prompt = PromptTemplate(
    template="生成简历\n{format_instructions}\n{query}",
    input_variables=["query"],
    partial_variables={"format_instructions": parser.get_format_instructions()}
)

# 自动处理格式错误
result = parser.parse(ai_output)
```

### 方案 4：多次重试 + 错误反馈

```python
def generate_resume_with_retry(instruction, max_retries=3):
    for attempt in range(max_retries):
        try:
            raw = call_llm(provider, prompt)
            # 尝试解析
            data = json.loads(raw)
            # 验证数据
            validate(instance=data, schema=schema)
            return data
        except (json.JSONDecodeError, ValidationError) as e:
            if attempt < max_retries - 1:
                # 在 Prompt 中指出错误
                error_feedback = f"""
                上次返回的 JSON 有错误：{str(e)}
                请修正并重新生成。
                """
                prompt = build_prompt_with_feedback(instruction, error_feedback)
            else:
                raise
```

## 推荐方案

### 短期方案（当前实现）
**正则表达式清理 + json-repair 库**

```python
from json_repair import repair_json
import json
import re

def parse_ai_json(raw):
    # 步骤 1：移除特殊标签
    cleaned = re.sub(r'<\|begin_of_box\|>', '', raw)
    cleaned = re.sub(r'<\|end_of_box\|>', '', cleaned)
    
    # 步骤 2：尝试直接解析
    try:
        return json.loads(cleaned)
    except:
        pass
    
    # 步骤 3：使用 json-repair 修复
    try:
        repaired = repair_json(cleaned)
        return json.loads(repaired)
    except:
        pass
    
    # 步骤 4：手动正则清理（备用）
    cleaned = re.sub(r'\]\}\s*,\s*"', ']}}, "', cleaned)
    # ... 其他正则规则
    
    return json.loads(cleaned)
```

### 长期方案
**Instructor + Pydantic + 多次重试**

1. 使用 Pydantic 定义严格的数据模型
2. 使用 Instructor 强制结构化输出
3. 失败时自动重试，并将错误信息反馈给 AI
4. 保留 json-repair 作为最后的备用方案

## 实施计划

### 第一阶段（已完成）
- [x] 基础正则表达式清理
- [x] 处理常见的 3-5 种错误格式

### 第二阶段（计划中）
- [ ] 集成 json-repair 库
- [ ] 添加到 requirements.txt
- [ ] 更新解析逻辑

### 第三阶段（未来）
- [ ] 升级到 Instructor + Pydantic 方案
- [ ] 实现多次重试机制
- [ ] 添加错误反馈机制

## 总结

当前的正则表达式方案是一个**快速修复**，能够解决大部分常见问题。但为了提高系统的健壮性和可维护性，建议：

1. **短期**：集成 `json-repair` 库，减少手动维护
2. **中期**：优化 Prompt 工程，减少 AI 生成错误的概率
3. **长期**：升级到 Instructor + Pydantic 方案，从源头解决问题


