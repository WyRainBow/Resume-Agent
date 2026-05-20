# AI简历评分功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现简历与JD的AI多维度评分功能，嵌入简历详情页，上传后自动触发

**Architecture:** 后端新增 `/api/resume/score` 接口，复用 embedding_service 和 call_llm；前端在简历详情页嵌入评分卡片

**Tech Stack:** FastAPI, SQLAlchemy, OpenAI Embedding, DeepSeek LLM

---

## 文件变更映射

### 后端
| 文件 | 变更类型 |
|------|----------|
| `backend/models.py` | 新增 `ScoreResult` ORM 模型 + Pydantic 请求/响应模型 |
| `backend/routes/resume.py` | 新增 `POST /api/resume/score` 路由 |
| `backend/services/scoring_service.py` | 新建，评分核心逻辑（3维度评分算法） |
| `backend/prompts.py` | 新增 `build_scoring_prompt()` 提示词模板 |

### 前端
| 文件 | 变更类型 |
|------|----------|
| `frontend/src/pages/ResumeDetail.tsx` | 修改，上传后自动调用评分接口 |
| `frontend/src/components/ScoreCard.tsx` | 新建，评分卡片组件 |
| `frontend/src/services/api.ts` | 修改，添加 score 接口调用 |

---

## Task 1: 后端 - 新增数据模型

**Files:**
- Modify: `backend/models.py:304` (在文件末尾添加)

- [ ] **Step 1: 添加 Pydantic 请求/响应模型**

在 `models.py` 末尾添加：

```python
# ======================
# 简历评分模型
# ======================

class ScoreRequest(BaseModel):
    """简历评分请求"""
    resume_id: str = Field(..., description="简历ID")
    jd_text: str = Field(..., description="职位描述文本")


class DimensionScore(BaseModel):
    """单个维度评分"""
    name: str  # 维度名称
    score: float  # 分数 0-100
    reasons: List[str]  # 匹配/不匹配原因


class ScoreResponse(BaseModel):
    """简历评分响应"""
    resume_id: str
    overall_score: float  # 总体匹配度
    dimensions: List[DimensionScore]
    created_at: str
```

- [ ] **Step 2: 添加 SQLAlchemy ORM 模型**

在 `models.py` 末尾添加：

```python
class ScoreResult(Base):
    """简历评分结果"""
    __tablename__ = "score_results"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    resume_id = Column(String(255), ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_text = Column(Text, nullable=False)  # 原始JD文本
    overall_score = Column(Float, nullable=False)
    skill_experience_score = Column(Float, nullable=False)  # 技能与经验匹配
    education_score = Column(Float, nullable=False)  # 教育背景匹配
    project_overall_score = Column(Float, nullable=False)  # 项目与整体匹配
    dimension_reasons = Column(JSON, nullable=False)  # 各维度原因 {dimension_name: [reasons]}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

- [ ] **Step 3: 提交**

```bash
git add backend/models.py
git commit -m "feat: add ScoreResult model and Pydantic schemas for resume scoring"
```

---

## Task 2: 后端 - 新增评分服务

**Files:**
- Create: `backend/services/scoring_service.py`

- [ ] **Step 1: 编写评分服务核心逻辑**

创建 `backend/services/scoring_service.py`：

```python
"""
简历评分服务
计算简历与JD的多维度匹配分数
"""
import json
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from models import ScoreResult, Resume
from services.embedding_service import EmbeddingService
from llm import call_llm


class ScoringService:
    """简历评分服务"""

    def __init__(self, db: Session):
        self.db = db

    def score_resume(self, resume_id: str, user_id: int, jd_text: str) -> Dict[str, Any]:
        """
        对简历进行多维度评分

        Args:
            resume_id: 简历ID
            user_id: 用户ID
            jd_text: 职位描述文本

        Returns:
            评分结果字典
        """
        # 获取简历数据
        resume = self.db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == user_id
        ).first()

        if not resume:
            raise ValueError(f"Resume {resume_id} not found")

        resume_data = resume.data

        # 1. 技能与经验匹配评分
        skill_experience_result = self._score_skill_experience(resume_data, jd_text)

        # 2. 教育背景匹配评分
        education_result = self._score_education(resume_data, jd_text)

        # 3. 项目与整体匹配评分
        project_result = self._score_project_overall(resume, jd_text)

        # 计算总体匹配度
        overall_score = (
            skill_experience_result["score"] * 0.4 +
            education_result["score"] * 0.2 +
            project_result["score"] * 0.4
        )

        # 组装结果
        dimensions = [
            {
                "name": "技能与经验匹配",
                "score": skill_experience_result["score"],
                "reasons": skill_experience_result["reasons"]
            },
            {
                "name": "教育背景匹配",
                "score": education_result["score"],
                "reasons": education_result["reasons"]
            },
            {
                "name": "项目与整体匹配",
                "score": project_result["score"],
                "reasons": project_result["reasons"]
            }
        ]

        # 保存到数据库
        score_record = ScoreResult(
            resume_id=resume_id,
            user_id=user_id,
            jd_text=jd_text,
            overall_score=round(overall_score, 1),
            skill_experience_score=skill_experience_result["score"],
            education_score=education_result["score"],
            project_overall_score=project_result["score"],
            dimension_reasons={
                "技能与经验匹配": skill_experience_result["reasons"],
                "教育背景匹配": education_result["reasons"],
                "项目与整体匹配": project_result["reasons"]
            }
        )
        self.db.add(score_record)
        self.db.commit()

        return {
            "resume_id": resume_id,
            "overall_score": round(overall_score, 1),
            "dimensions": dimensions,
            "created_at": score_record.created_at.isoformat()
        }

    def _score_skill_experience(self, resume_data: Dict, jd_text: str) -> Dict[str, Any]:
        """技能与经验匹配评分"""
        skills = resume_data.get("skills", [])
        experience = resume_data.get("experience", [])

        prompt = f"""你是一个专业的简历评估专家。请分析以下简历的技能和经验与职位要求的匹配程度。

职位描述：
{jd_text}

简历技能：
{json.dumps(skills, ensure_ascii=False)}

简历经历：
{json.dumps(experience, ensure_ascii=False)}

请以JSON格式输出评估结果：
{{
    "score": 0-100的分数,
    "reasons": ["匹配点1", "不匹配点1", "改进建议1"]
}}

只输出JSON，不要其他内容。"""

        try:
            result = call_llm("deepseek", prompt)
            data = json.loads(result)
            return {
                "score": float(data.get("score", 0)),
                "reasons": data.get("reasons", [])
            }
        except Exception as e:
            print(f"[ERROR] Skill/experience scoring failed: {e}")
            return {"score": 0, "reasons": [f"评分失败: {str(e)}"]}

    def _score_education(self, resume_data: Dict, jd_text: str) -> Dict[str, Any]:
        """教育背景匹配评分"""
        education = resume_data.get("education", [])

        prompt = f"""你是一个专业的简历评估专家。请分析以下简历的教育背景与职位要求的匹配程度。

职位描述：
{jd_text}

简历教育背景：
{json.dumps(education, ensure_ascii=False)}

请以JSON格式输出评估结果：
{{
    "score": 0-100的分数,
    "reasons": ["匹配点1", "不匹配点1", "改进建议1"]
}}

只输出JSON，不要其他内容。"""

        try:
            result = call_llm("deepseek", prompt)
            data = json.loads(result)
            return {
                "score": float(data.get("score", 0)),
                "reasons": data.get("reasons", [])
            }
        except Exception as e:
            print(f"[ERROR] Education scoring failed: {e}")
            return {"score": 0, "reasons": [f"评分失败: {str(e)}"]}

    def _score_project_overall(self, resume: Resume, jd_text: str) -> Dict[str, Any]:
        """项目与整体匹配评分（Embedding + LLM）"""
        from .embedding_service import EmbeddingService

        # 1. 计算Embedding向量相似度
        embedding_service = EmbeddingService(self.db)

        # 简历全文
        resume_text = json.dumps(resume.data, ensure_ascii=False)

        resume_emb = embedding_service.generate_embedding(resume_text)
        jd_emb = embedding_service.generate_embedding(jd_text)

        embedding_score = 0.0
        if resume_emb and jd_emb:
            embedding_score = embedding_service._cosine_similarity(resume_emb, jd_emb) * 100

        # 2. LLM分析项目相关性
        projects = resume.data.get("projects", [])

        prompt = f"""你是一个专业的简历评估专家。请分析以下简历的项目经历与职位的相关性。

职位描述：
{jd_text}

简历项目经历：
{json.dumps(projects, ensure_ascii=False)}

请以JSON格式输出评估结果：
{{
    "score": 0-100的分数（综合项目相关性和整体匹配度）,
    "reasons": ["匹配点1", "不匹配点1", "改进建议1"]
}}

只输出JSON，不要其他内容。"""

        try:
            llm_result = call_llm("deepseek", prompt)
            data = json.loads(llm_result)
            llm_score = float(data.get("score", 0))

            # 最终分数 = Embedding * 0.4 + LLM * 0.6
            final_score = embedding_score * 0.4 + llm_score * 0.6

            return {
                "score": round(final_score, 1),
                "reasons": data.get("reasons", [])
            }
        except Exception as e:
            print(f"[ERROR] Project/overall scoring failed: {e}")
            # 降级为纯Embedding分数
            return {"score": round(embedding_score, 1), "reasons": [f"LLM评分失败，使用向量相似度: {round(embedding_score, 1)}"]}
```

- [ ] **Step 2: 提交**

```bash
git add backend/services/scoring_service.py
git commit -m "feat: add scoring service with 3-dimension evaluation"
```

---

## Task 3: 后端 - 新增评分路由

**Files:**
- Modify: `backend/routes/resume.py`

- [ ] **Step 1: 添加评分路由**

在 `resume.py` 中添加：

```python
from models import ScoreRequest, ScoreResponse, DimensionScore

@resume_router.post("/score", response_model=ScoreResponse)
async def score_resume(request: ScoreRequest, current_user: User = Depends(get_current_user)):
    """
    对简历进行JD匹配评分

    输入：简历ID + JD文本
    输出：3维度评分 + 总体匹配度
    """
    if not request.jd_text or not request.jd_text.strip():
        raise HTTPException(status_code=400, detail="JD文本不能为空")

    try:
        from services.scoring_service import ScoringService

        service = ScoringService(db)
        result = service.score_resume(
            resume_id=request.resume_id,
            user_id=current_user.id,
            jd_text=request.jd_text
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"评分失败: {str(e)}")
```

- [ ] **Step 2: 在main.py注册路由（如未注册）**

检查 `backend/main.py`，确保 `resume_router` 已注册。

- [ ] **Step 3: 提交**

```bash
git add backend/routes/resume.py
git commit -m "feat: add POST /api/resume/score endpoint"
```

---

## Task 4: 前端 - 新增评分卡片组件

**Files:**
- Create: `frontend/src/components/ScoreCard.tsx`

- [ ] **Step 1: 编写评分卡片组件**

创建 `frontend/src/components/ScoreCard.tsx`：

```tsx
import React from 'react';

interface DimensionScore {
  name: string;
  score: number;
  reasons: string[];
}

interface ScoreCardProps {
  overallScore: number;
  dimensions: DimensionScore[];
  jdText: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ overallScore, dimensions, jdText }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  return (
    <div className="score-card" style={{ padding: '16px', border: '1px solid #e8e8e8', borderRadius: '8px', marginTop: '16px' }}>
      <h3 style={{ marginBottom: '12px' }}>简历评分</h3>

      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(overallScore) }}>
          {overallScore}
        </span>
        <span style={{ color: '#666' }}> / 100 总体匹配度</span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {dimensions.map((dim) => (
          <div key={dim.name} style={{ flex: 1, padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{dim.name}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: getScoreColor(dim.score) }}>
              {dim.score}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>详细分析</h4>
        {dimensions.map((dim) => (
          <div key={dim.name} style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dim.name}</div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#666' }}>
              {dim.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/ScoreCard.tsx
git commit -m "feat: add ScoreCard component for resume evaluation"
```

---

## Task 5: 前端 - 集成评分功能

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/ResumeDetail.tsx`

- [ ] **Step 1: 添加API调用**

在 `frontend/src/services/api.ts` 中添加：

```typescript
export const scoreResume = async (resumeId: string, jdText: string) => {
  const response = await fetch('/api/resume/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resume_id: resumeId, jd_text: jdText }),
  });
  if (!response.ok) throw new Error('评分失败');
  return response.json();
};
```

- [ ] **Step 2: 在简历详情页集成评分卡片**

在 `ResumeDetail.tsx` 中：
1. 添加 JD 文本输入框
2. 上传简历后自动调用 `scoreResume`
3. 展示 `ScoreCard` 组件

示例代码结构：

```tsx
const [jdText, setJdText] = useState('');
const [scoreData, setScoreData] = useState(null);

// 上传后自动评分
useEffect(() => {
  if (resumeId && jdText && !scoreData) {
    scoreResume(resumeId, jdText).then(setScoreData).catch(console.error);
  }
}, [resumeId, jdText]);

return (
  <div>
    {/* 简历详情其他内容 */}

    <div style={{ marginTop: '24px' }}>
      <h4>粘贴职位描述 (JD)</h4>
      <textarea
        value={jdText}
        onChange={(e) => setJdText(e.target.value)}
        placeholder="粘贴职位描述..."
        style={{ width: '100%', minHeight: '100px', marginBottom: '12px' }}
      />
    </div>

    {scoreData && <ScoreCard {...scoreData} />}
  </div>
);
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/services/api.ts frontend/src/pages/ResumeDetail.tsx
git commit -m "feat: integrate scoring into resume detail page"
```

---

## Task 6: 验证与测试

- [ ] **Step 1: 后端接口测试**

```bash
# 启动后端
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000

# 测试评分接口（curl）
curl -X POST http://127.0.0.1:9000/api/resume/score \
  -H "Content-Type: application/json" \
  -d '{"resume_id": "测试简历ID", "jd_text": "要求：3年以上Python开发经验，本科以上学历"}'
```

预期：返回包含 `overall_score` 和 `dimensions` 的 JSON

- [ ] **Step 2: 前端构建测试**

```bash
cd frontend && npm run build
```

预期：构建成功，无错误

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: complete resume scoring feature"
```
