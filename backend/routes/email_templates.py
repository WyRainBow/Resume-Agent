"""
邮件正文模板路由(仅管理员)
- GET    /api/email/templates        列出我的模板
- POST   /api/email/templates        新建(name + content;正文可用 {name} 占位,套用时替换为简历主人姓名)
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

# 内置岗位模板(不入库、不占用户名额):按用户真实发送过的邮件风格提炼
# (2026-07-10 从 QQ 邮箱已发送的 10 封简历优化邮件总结:开场交代来源 → 先扬
# 且具体 → 一个核心诊断 → 结合 AI 趋势的可执行建议 → 网站推广 → 引流收尾)
PRESET_TEMPLATES = [
    {
        "id": "preset-ops",
        "name": "运营岗",
        "content": """同学你好~

我在小红书上刷到你的简历,简单帮你看了一下,也顺手整理了一些优化建议,供你参考~

整体来说,你这份简历完成度已经挺高了,活动、用户和数据这几块都有覆盖,能看出来你不是只做执行,对用户和数据是有思考的,这一点其实挺难得的👍

如果说一个比较直观的感受:你现在的简历偏"经历描述",还可以再往"项目化"走一步——比如把一次活动从目标、策略、执行到结果完整讲清楚,整理成一个案例,这种对运营岗位来说会很有说服力。

结合现在这一波 AI 的趋势,其实可以往「运营 + AI 提效」这个方向再靠一靠:

1. 把日常运营分析(周报、活动效果、用户反馈)做成半自动化的流程,能更快识别活跃、转化、留存的波动;
2. 尝试做一些轻量的运营提效小工具(比如报表自动解读、活动复盘辅助),哪怕只是 demo,也比纯描述经历更有区分度;
3. 本质上是从"做运营执行"往"用工具提升运营效率、辅助决策"去升级,这类能力现在很受欢迎。

最后简单说下我这边的情况~我也是 26 届,目前在做开发方向,最近自己做了一个「简历生成 + 作品展示」的小网站:
👉 resumegenkk.xyz

可以把简历或者截图粘进去,用 AI 帮你一键优化和生成,目前服务器和模型都是免费开放的,可以随便用用看~如果你觉得有帮助的话,也欢迎帮我点个 star 支持一下哈哈,主要也是想把这个产品慢慢打磨好~

如果你愿意的话,也可以把你的简历或者项目发我,我可以帮你再细一点看看~

祝你早日拿到心仪 offer!有需要也可以一起交流~

我的 wx:Woyuyuoo""",
    },
    {
        "id": "preset-product",
        "name": "产品岗",
        "content": """同学你好~

我在小红书上刷到你的简历,认真帮你看了一下,给你一些偏实战的建议,供你参考~

先说结论:你这份简历是有基础的,思考也在,但在当前产品岗(尤其偏 AI 的)竞争环境里,还差一点差异化。

现在很多 JD 表面写的是产品经理,本质在找的是:能把想法快速用 AI 搓成 Demo 的人(而不是只写 PRD)、能把流程用工具自动化的人、能自己上手调 prompt、搭 workflow 的人。好的产品经理已经有点"半个工程师 + 半个运营"的感觉了。

你现在最关键的缺口:面试官看完之后,不知道你"能不能把想法变成一个可用的东西"。

给你几个方向:

1. 一定要补一个「能打开的东西」——个人主页或 Demo 集合页,核心不是好看,而是面试官点进去能看到你真的做过东西,产品嘛,多 vibe coding 一下;
2. 做 1~2 个"AI + 产品"的小项目,别做泛泛的聊天机器人,做能解决具体问题的:用 AI 优化某个流程、一个实际能用的小工具、一条「输入 → 分析 → 结构化输出」的 workflow;
3. 补一点工具经验:是否用过 Codex / Claude Code / 工作流工具,是否写过 prompt、用过 API——这类能力现在非常加分,而且很多人没有。

最后简单说下我这边的情况~我也是 26 届,目前在做开发方向,最近自己做了一个「简历生成 + 作品展示」的小网站:
👉 resumegenkk.xyz

可以把简历或者截图粘进去,用 AI 帮你一键优化和生成,免费开放,可以随便用~觉得有帮助的话,欢迎帮我点个 star 支持一下哈哈~

如果你愿意的话,也可以把你的简历或项目发我,我可以帮你更"对点"地看看~

祝你早日拿到心仪的 offer 🚀

我的 wx:Woyuyuoo""",
    },
    {
        "id": "preset-accounting",
        "name": "会计岗",
        "content": """同学你好~

我在小红书上刷到你的简历,简单看了一下,想着给你发一封邮件交流一下~

先说一个直观感受:你这份简历在会计方向里,属于底子比较扎实的类型,主线是清晰的,能看出来你对财务工作的流程是有理解的,这一点在校招里是加分项。

我看下来一个比较关键的感受是:企业看简历时会下意识判断"你能不能直接上手"。如果内容偏"比赛和学习过程",就会显得有点"远"——把重点往"你具体做了什么"上靠:用了什么数据、怎么分析的、得出了什么结论,整份简历会更像真实工作内容。

结合现在这一波 AI 的趋势,你这个方向其实有优势——财务本身就是强规则 + 强数据的领域:

1. 你的能力结构其实已经有"数据 + 财务"的雏形了,有意识地放大它:往"数据分析辅助财务决策"靠,而不是停在记账、对账、整理材料这一层;
2. 可以自己拿一份上市公司年报做一版财务分析,把收入、成本、利润拆一拆,用 Excel 做点图表——这已经很接近企业里在做的事,写进简历比单纯写竞赛更"像能用的人";
3. 把 AI 当工具用起来:自动化整理、辅助分析、简单的报告生成,不用很复杂,只要是你主动做的优化,就已经比大多数人强了。

最后简单说下我这边的情况~我也是 26 届,目前在做开发方向,最近自己做了一个「简历生成 + 作品展示」的小网站:
👉 resumegenkk.xyz

可以把简历或者截图粘进去,用 AI 帮你一键优化和生成,免费开放,可以随便用用看~觉得有帮助的话,欢迎帮我点个 star 支持一下哈哈~

如果你愿意的话,也可以把你的简历发我,我可以帮你再细一点看看~

祝你早日拿到心仪 offer!有需要也可以一起交流~

我的 wx:Woyuyuoo

PS:本人非财务专业,建议仅供参考~""",
    },
    {
        "id": "preset-dev",
        "name": "开发岗",
        "content": """同学你好~

我在小红书上刷到你的简历,简单帮你看了一下,也顺手整理了一些优化建议,供你参考~

整体来说,你这份简历完成度已经挺高了,基础、项目经验这些核心点都有覆盖,能看出来你不只是写业务代码,对底层机制是有一定理解的,这一点在后端方向其实挺加分的👍

从现在的招聘趋势来看,可以考虑往「后端开发 + 工程化能力」再靠一靠:不仅是实现功能,还能思考服务在高并发下的表现、稳定性保障和架构扩展性——从"能写服务"往"能设计和优化系统"去升级。

结合现在这一波 AI 的趋势,给你几个比较实用的提升方向:

1️⃣ 多参与开源项目:提 PR、修 issue,不管对成长还是简历都很加分;
2️⃣ 自己做一个完整项目(vibe coding):借助 Codex / Claude Code 这类工具,从 0 到 1 搭一个完整闭环的小项目,不需要很复杂;
3️⃣ 尝试部署上线:项目能部署到线上(Vercel 或自己的服务器),比单纯写项目更有说服力;
4️⃣ 做一个个人主页 / 作品站:相当于你的个人品牌展示页,比一份 PDF 简历更直观,更容易让人留下印象。

最后简单说下我这边的情况~我也是 26 届,目前在做开发方向,最近自己做了一个「简历生成 + 作品展示」的小网站:
👉 resumegenkk.xyz

可以把简历或者截图粘进去,用 AI 帮你一键优化和生成,目前服务器和模型都是免费开放的,可以随便用~觉得还不错的话,欢迎帮我点个 star 支持一下哈哈(不是机构,也不收费,主要是想把产品做好)~

如果你愿意的话,也可以把你的简历或者项目发我,我可以帮你更细致地看一下~

祝你早日拿到心仪的 offer!也可以一起交流下~

我的 wx:Woyuyuoo""",
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


@router.get("/email/sent")
async def list_sent_emails(
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """读取 QQ 邮箱「已发送」最近邮件(只读),供挑选导入为模板。"""
    _require_admin(current_user)
    from models import EmailCredential

    credential = (
        db.query(EmailCredential)
        .filter(EmailCredential.user_id == current_user.id)
        .first()
    )
    if not credential:
        raise HTTPException(status_code=400, detail="请先在对话输入框旁连接 QQ 邮箱")

    try:
        from backend.utils.crypto import decrypt_secret
    except ImportError:
        from utils.crypto import decrypt_secret
    try:
        from backend.services.email_reader import fetch_sent_emails
    except ImportError:
        from services.email_reader import fetch_sent_emails

    import imaplib

    try:
        emails = fetch_sent_emails(
            from_email=credential.email_address,
            auth_code=decrypt_secret(credential.encrypted_auth_code),
            limit=max(1, min(limit, 50)),
        )
    except imaplib.IMAP4.error:
        raise HTTPException(status_code=502, detail="QQ 邮箱登录失败,授权码可能已失效,请重新连接邮箱")
    except OSError:
        raise HTTPException(status_code=502, detail="连接 QQ 邮箱超时,请稍后再试")
    return {"emails": emails}


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
