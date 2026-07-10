"""
邮件正文模板路由(仅管理员)
- GET    /api/email/templates        列出我的模板
- POST   /api/email/templates        新建(name + content,{name} 为收件人姓名占位)
- DELETE /api/email/templates/{id}   删除
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import EmailTemplate, User
from middleware.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Email"])

MAX_TEMPLATES_PER_USER = 20

# 内置岗位模板(不入库、不占用户名额):{name} 为收件人姓名占位,套用后可手改或 AI 润色
PRESET_TEMPLATES = [
    {
        "id": "preset-ops",
        "name": "运营岗",
        "content": """{name}你好,

我是 coco,你的 AI 简历助手。这封邮件把优化后的简历 PDF 发给你留存。

本次主要调整:把运营动作改写成「策略 → 执行 → 数据结果」的表达,突出增长与转化的量化成果,弱化纯执行描述。

给你的进一步建议:
1. 每个活动/项目补齐核心数据:曝光、参与、转化、ROI,能对比更好(提升了 x%);
2. 突出你主导的部分,和"参与"类工作区分开;
3. 内容/社群/投放等方向若有代表案例,挑 1-2 个讲深,好过罗列十个。

如有需要,随时找我继续优化!

祝好
coco""",
    },
    {
        "id": "preset-product",
        "name": "产品岗",
        "content": """{name}你好,

我是 coco,你的 AI 简历助手。这封邮件把优化后的简历 PDF 发给你留存。

本次主要调整:把项目经历改写成「需求洞察 → 方案设计 → 落地结果」的闭环叙事,突出你在需求定义与跨团队协作中的主导作用。

给你的进一步建议:
1. 每个产品动作尽量挂上业务指标变化(转化率、留存、DAU 等);
2. 补充 1-2 个"关键决策"细节:为什么这么设计、放弃了什么方案;
3. 竞品分析、用户调研这类过程性工作,合并进成果表达,避免流水账。

如有需要,随时找我继续优化!

祝好
coco""",
    },
    {
        "id": "preset-accounting",
        "name": "会计岗",
        "content": """{name}你好,

我是 coco,你的 AI 简历助手。这封邮件把优化后的简历 PDF 发给你留存。

本次主要调整:突出证书资质与实务经验的匹配度,把日常工作改写成「职责范围 + 规范依据 + 结果」的表达,体现严谨与合规意识。

给你的进一步建议:
1. 证书(初级/中级/CPA 进度)放到显眼位置,注明通过科目;
2. 实务经验量化:经手凭证量、对账规模、报税主体数量、差错率;
3. 熟悉的工具与制度(用友/金蝶、增值税、新收入准则等)按岗位 JD 做呼应。

如有需要,随时找我继续优化!

祝好
coco""",
    },
    {
        "id": "preset-dev",
        "name": "开发岗",
        "content": """{name}你好,

我是 coco,你的 AI 简历助手。这封邮件把优化后的简历 PDF 发给你留存。

本次主要调整:把项目与实习经历改写成「动作 + 技术方案 + 量化结果」的表达,突出核心技术栈与性能/稳定性指标,让技术深度一眼可见。

给你的进一步建议:
1. 每段经历尽量补一个可量化的成果(QPS、耗时下降、覆盖率等),数字比形容词有说服力;
2. 针对目标岗位 JD 中高频出现的技术栈,在技能与项目里做显性呼应;
3. 开源/个人项目如有 star、PR 被合并等信号,放到显眼位置。

如有需要,随时找我继续优化!

祝好
coco""",
    },
]


def _require_admin(user: User) -> None:
    if getattr(user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可使用邮件模板功能")


def _serialize(t: EmailTemplate) -> dict:
    return {"id": t.id, "name": t.name, "content": t.content}


class CreateTemplateRequest(BaseModel):
    name: str
    content: str


@router.get("/email/templates")
async def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    rows = (
        db.query(EmailTemplate)
        .filter(EmailTemplate.user_id == current_user.id)
        .order_by(EmailTemplate.updated_at.desc())
        .all()
    )
    return {"presets": PRESET_TEMPLATES, "templates": [_serialize(t) for t in rows]}


@router.post("/email/templates")
async def create_template(
    payload: CreateTemplateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    name = payload.name.strip()
    content = payload.content.strip()
    if not name or len(name) > 64:
        raise HTTPException(status_code=400, detail="模板名不能为空且不超过 64 字")
    if not content or len(content) > 8000:
        raise HTTPException(status_code=400, detail="模板内容不能为空且不超过 8000 字")
    count = db.query(EmailTemplate).filter(EmailTemplate.user_id == current_user.id).count()
    if count >= MAX_TEMPLATES_PER_USER:
        raise HTTPException(status_code=400, detail=f"模板数量已达上限({MAX_TEMPLATES_PER_USER}),请先删除不用的")

    row = EmailTemplate(user_id=current_user.id, name=name, content=content)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"template": _serialize(row)}


@router.delete("/email/templates/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    deleted = (
        db.query(EmailTemplate)
        .filter(EmailTemplate.id == template_id, EmailTemplate.user_id == current_user.id)
        .delete()
    )
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"ok": True}
