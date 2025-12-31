"""
RAG 知识库模块

基于 Milvus 实现的向量知识库，支持：
1. 简历写作最佳实践
2. STAR 法则模板
3. 行业术语库
4. 职位描述参考
"""
import json
import os
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from pathlib import Path

# LangChain 组件（可选依赖）
try:
    from langchain_core.documents import Document
    from langchain_core.vectorstores import VectorStore
    from langchain_core.embeddings import Embeddings
    from langchain_community.vectorstores import Milvus
    from langchain_community.document_loaders import TextLoader, JSONLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    LANGCHAIN_AVAILABLE = True
except ImportError:
    Document = None
    VectorStore = None
    Embeddings = None
    Milvus = None
    TextLoader = None
    JSONLoader = None
    RecursiveCharacterTextSplitter = None
    LANGCHAIN_AVAILABLE = False

# Embedding 模型（优先使用 OpenAI，降级到 HuggingFace）
HUGGINGFACE_AVAILABLE = False
try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    HUGGINGFACE_AVAILABLE = True
except ImportError:
    HuggingFaceEmbeddings = None

OPENAI_EMBEDDINGS_AVAILABLE = False
try:
    from langchain_openai import OpenAIEmbeddings
    OPENAI_EMBEDDINGS_AVAILABLE = True
except ImportError:
    try:
        from langchain_community.embeddings import OpenAIEmbeddings
        OPENAI_EMBEDDINGS_AVAILABLE = True
    except ImportError:
        OpenAIEmbeddings = None


@dataclass
class SearchConfig:
    """检索配置"""
    collection_name: str = "resume_knowledge"
    embedding_model: str = "shibing624/text2vec-base-chinese"
    top_k: int = 5
    score_threshold: float = 0.6
    search_type: str = "similarity"  # similarity, mmr, similarity_score_threshold


class ResumeKnowledgeBase:
    """
    简历知识库

    功能：
    1. 加载并索引知识文档
    2. 语义检索相关内容
    3. 为 LLM 提供上下文增强
    """

    # 默认知识库路径
    KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge" / "resume"

    def __init__(
        self,
        config: Optional[SearchConfig] = None,
        milvus_uri: str = "http://localhost:19530",
        embeddings: Optional[Embeddings] = None
    ):
        """
        初始化知识库

        Args:
            config: 检索配置
            milvus_uri: Milvus 服务地址
            embeddings: 自定义 Embeddings（可选）
        """
        if not LANGCHAIN_AVAILABLE:
            raise ImportError(
                "LangChain community 组件未安装。请安装: pip install langchain-community langchain-text-splitters"
            )

        self.config = config or SearchConfig()
        self.milvus_uri = milvus_uri

        # 初始化 Embeddings
        if embeddings is None:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=self.config.embedding_model,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
        else:
            self.embeddings = embeddings

        # 向量存储（懒加载）
        self._vectorstore: Optional[VectorStore] = None

    @property
    def vectorstore(self) -> VectorStore:
        """懒加载向量存储"""
        if self._vectorstore is None:
            self._vectorstore = Milvus(
                embedding_function=self.embeddings,
                collection_name=self.config.collection_name,
                connection_args={"uri": self.milvus_uri},
                index_params={"index_type": "IVF_FLAT", "metric_type": "IP", "params": {"nlist": 128}}
            )
        return self._vectorstore

    def search(
        self,
        query: str,
        top_k: Optional[int] = None,
        filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """
        语义检索

        Args:
            query: 查询文本
            top_k: 返回结果数量
            filter_dict: 元数据过滤条件

        Returns:
            相关文档列表
        """
        k = top_k or self.config.top_k

        try:
            if self.config.search_type == "mmr":
                results = self.vectorstore.max_marginal_relevance_search(
                    query, k=k, fetch_k=k * 2, filter=filter_dict
                )
            elif self.config.search_type == "similarity_score_threshold":
                results = self.vectorstore.similarity_search_with_relevance_scores(
                    query, k=k, score_threshold=self.config.score_threshold, filter=filter_dict
                )
                results = [doc for doc, score in results if score >= self.config.score_threshold]
            else:
                results = self.vectorstore.similarity_search(
                    query, k=k, filter=filter_dict
                )
            return results
        except Exception as e:
            # 如果 collection 不存在，返回空列表
            if "collection not found" in str(e).lower():
                return []
            raise

    def get_context_for_query(
        self,
        query: str,
        max_tokens: int = 1000
    ) -> str:
        """
        为查询获取增强上下文

        Args:
            query: 用户查询
            max_tokens: 最大 token 数（估算）

        Returns:
            格式化的上下文字符串
        """
        docs = self.search(query, top_k=3)

        if not docs:
            return ""

        # 构建上下文
        context_parts = []
        total_chars = 0
        max_chars = max_tokens * 4  # 粗略估算 1 token ≈ 4 字符

        for doc in docs:
            content = doc.page_content.strip()
            if total_chars + len(content) > max_chars:
                # 截断
                remaining = max_chars - total_chars
                if remaining > 50:  # 至少保留 50 字符
                    context_parts.append(content[:remaining] + "...")
                break
            context_parts.append(content)
            total_chars += len(content)

        return "\n\n".join(context_parts) if context_parts else ""

    def initialize_from_docs(self, force_rebuild: bool = False) -> bool:
        """
        从文档初始化知识库

        Args:
            force_rebuild: 是否强制重建索引

        Returns:
            是否成功初始化
        """
        docs_dir = self.KNOWLEDGE_DIR
        if not docs_dir.exists():
            # 创建默认知识库
            docs_dir.mkdir(parents=True, exist_ok=True)
            self._create_default_knowledge(docs_dir)

        # 加载所有文档
        documents = self._load_documents(docs_dir)

        if not documents:
            return False

        # 分割文档
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
        )
        splits = text_splitter.split_documents(documents)

        # 添加元数据标签
        for split in splits:
            if not split.metadata.get("category"):
                split.metadata["category"] = self._infer_category(split.page_content)

        # 创建向量索引
        try:
            # 检查是否已存在
            if not force_rebuild:
                existing = self.search("test", top_k=1)
                if existing:
                    return True  # 已存在

            # 重建索引
            Milvus.from_documents(
                documents=splits,
                embedding=self.embeddings,
                collection_name=self.config.collection_name,
                connection_args={"uri": self.milvus_uri},
                index_params={"index_type": "IVF_FLAT", "metric_type": "IP", "params": {"nlist": 128}},
                drop_old=force_rebuild
            )
            self._vectorstore = None  # 重置缓存
            return True
        except Exception as e:
            print(f"初始化知识库失败: {e}")
            return False

    def _load_documents(self, docs_dir: Path) -> List[Document]:
        """加载知识文档"""
        documents = []

        for file_path in docs_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix in [".txt", ".md", ".json"]:
                try:
                    if file_path.suffix == ".json":
                        loader = JSONLoader(
                            str(file_path),
                            jq_schema=".[]",
                            text_content=False
                        )
                    else:
                        loader = TextLoader(str(file_path), encoding="utf-8")

                    docs = loader.load()
                    # 添加文件元数据
                    for doc in docs:
                        doc.metadata["source"] = file_path.name
                        doc.metadata["category"] = self._infer_category(file_path.stem)

                    documents.extend(docs)
                except Exception as e:
                    print(f"加载文件失败 {file_path}: {e}")

        return documents

    def _infer_category(self, content: str) -> str:
        """推断内容分类"""
        content_lower = content.lower()

        category_keywords = {
            "star": ["star", "situation", "task", "action", "result", "法则"],
            "template": ["模板", "template", "示例"],
            "best_practice": ["最佳实践", "建议", "注意", "tips", "best practice"],
            "industry": ["行业", "互联网", "金融", "制造", "零售"],
            "position": ["前端", "后端", "产品经理", "设计师", "工程师", "开发"],
        }

        scores = {
            category: sum(1 for kw in keywords if kw in content_lower)
            for category, keywords in category_keywords.items()
        }

        best = max(scores.items(), key=lambda x: x[1])
        return best[0] if best[1] > 0 else "general"

    def _create_default_knowledge(self, docs_dir: Path):
        """创建默认知识库文件"""

        # STAR 法则
        star_content = """# STAR 法则指南

## 什么是 STAR 法则

STAR 法则是一种结构化表达方法，用于描述工作经历和项目经验。

## 四个要素

- **S (Situation)**: 情境 - 描述背景和问题
- **T (Task)**: 任务 - 明确目标和挑战
- **A (Action)**: 行动 - 采取的具体措施
- **R (Result)**: 结果 - 量化成果和价值

## 示例

### 好的描述
"在公司面临高并发流量挑战时（S），我负责优化核心接口性能（T）。通过引入 Redis 缓存和数据库索引优化（A），将接口响应时间从 500ms 降至 50ms，QPS 提升 10 倍（R）。"

### 需改进的描述
"负责后端开发工作，提升了系统性能。"
"""
        (docs_dir / "star_method.md").write_text(star_content, encoding="utf-8")

        # 简历模板
        template_content = """# 简历写作模板

## 工作经历模板

```json
{
  "company": "公司名称",
  "position": "职位名称",
  "startDate": "YYYY-MM",
  "endDate": "YYYY-MM 或 至今",
  "description": "使用 STAR 法则描述：\n1. 承担的核心职责\n2. 解决的关键问题\n3. 使用的具体技术\n4. 取得的量化成果"
}
```

## 项目经历模板

```json
{
  "name": "项目名称",
  "role": "担任角色",
  "startDate": "YYYY-MM",
  "endDate": "YYYY-MM",
  "description": "描述项目背景 + 个人贡献 + 项目成果"
}
```

## 技能描述模板

- 前端：熟练掌握 Vue/React，有大型单页应用开发经验
- 后端：熟悉 Python/Go，掌握微服务架构设计
- 数据库：精通 MySQL，有亿级数据表优化经验
"""
        (docs_dir / "templates.md").write_text(template_content, encoding="utf-8")

        # 最佳实践
        best_practice_content = """# 简历写作最佳实践

## 通用原则

1. **量化成果**：用数据说话，如"提升 30%"而非"显著提升"
2. **动词开头**：负责、主导、设计、实现、优化、推动
3. **突出亮点**：把最突出的成就放在前面
4. **针对性**：根据应聘岗位调整内容重点

## 常见错误

- ❌ "负责公司官网开发"
- ✅ "主导官网 2.0 重构，将页面加载速度提升 60%"

- ❌ "熟悉前端技术"
- ✅ "精通 Vue/React，有 3 年大型项目经验"

## 行为动词推荐

**初级**：参与、协助、学习、使用
**中级**：负责、开发、维护、优化
**高级**：主导、设计、架构、推动、指导
"""
        (docs_dir / "best_practices.md").write_text(best_practice_content, encoding="utf-8")

        # 职位描述
        position_content = """# 常见职位描述参考

## 前端工程师

核心技能：HTML/CSS/JavaScript, Vue/React, TypeScript
加分项：性能优化、工程化、小程序、Node.js

## 后端工程师

核心技能：Python/Go/Java, MySQL/Redis, 微服务
加分项：分布式系统、高并发、云原生

## 产品经理

核心技能：需求分析、原型设计、数据分析、项目管理
加分项：B 端产品、增长策略、AI 产品

## UI/UX 设计师

核心技能：Figma/Sketch, 设计规范, 交互设计
加分项：动效设计、用户研究、设计系统

## 数据分析师

核心技能：SQL, Python/R, 数据可视化
加分项：机器学习、A/B 测试、业务建模
"""
        (docs_dir / "positions.md").write_text(position_content, encoding="utf-8")


class STARGuidancer:
    """
    STAR 法则追问引导器

    功能：
    1. 检测描述缺失的信息
    2. 生成渐进式追问
    3. 引导用户完善经历描述
    """

    # STAR 要素检查关键词
    STAR_KEYWORDS = {
        "situation": ["背景", "场景", "面对", "当时", "由于", "因为"],
        "task": ["负责", "任务", "目标是", "需要", "承担"],
        "action": ["采用", "使用", "通过", "实现", "开发", "设计", "优化"],
        "result": ["提升", "降低", "节省", "增长", "%", "倍", "完成", "达成"]
    }

    def analyze_description(self, description: str) -> Dict[str, Any]:
        """
        分析描述完整性

        Returns:
            {
                "missing": ["situation", "task", ...],
                "completeness": 0.75,
                "suggestions": ["建议补充背景信息"]
            }
        """
        if not description or len(description) < 20:
            return {
                "missing": ["situation", "task", "action", "result"],
                "completeness": 0.0,
                "suggestions": ["请详细描述这段经历，包括背景、任务、行动和结果"]
            }

        description_lower = description.lower()

        detected = {}
        for element, keywords in self.STAR_KEYWORDS.items():
            detected[element] = any(kw in description_lower for kw in keywords)

        missing = [k for k, v in detected.items() if not v]
        completeness = sum(detected.values()) / len(detected)

        # 生成建议
        suggestions = []
        if "situation" in missing:
            suggestions.append("说明当时面临的背景或挑战")
        if "task" in missing:
            suggestions.append("明确你的职责和目标")
        if "action" in missing:
            suggestions.append("详细描述采取的具体措施和使用的工具")
        if "result" in missing:
            suggestions.append("补充量化成果（如提升 X%、节省 Y 小时）")

        return {
            "missing": missing,
            "detected": list(detected.keys()),
            "completeness": completeness,
            "suggestions": suggestions
        }

    def generate_followup_questions(
        self,
        context: Dict[str, Any],
        max_questions: int = 3
    ) -> List[str]:
        """
        生成渐进式追问

        Args:
            context: {current_description, position, company, ...}
            max_questions: 最大问题数

        Returns:
            追问列表
        """
        current_desc = context.get("current_description", "")
        analysis = self.analyze_description(current_desc)
        questions = []

        # 根据缺失要素生成问题
        if "situation" in analysis["missing"]:
            questions.append("当时是什么场景或背景？你遇到了什么挑战？")

        if "task" in analysis["missing"]:
            position = context.get("position", "这个职位")
            questions.append(f"作为{position}，你的核心职责和目标是什么？")

        if "action" in analysis["missing"]:
            questions.append("你具体采取了哪些措施？使用了什么工具或技术？")

        if "result" in analysis["missing"]:
            questions.append("最终取得了什么成果？能用数据量化吗（如提升 X%、节省 Y 时间）？")

        # 如果描述过短，补充通用问题
        if len(current_desc) < 50:
            questions.extend([
                "这段经历中最值得分享的亮点是什么？",
                "你在这段经历中解决了什么关键问题？"
            ])

        return questions[:max_questions]

    def improve_description(
        self,
        description: str,
        position: Optional[str] = None
    ) -> str:
        """
        生成改进建议

        Returns:
            改进后的描述示例
        """
        analysis = self.analyze_description(description)

        if analysis["completeness"] >= 0.75:
            return description  # 已经比较完整

        # 根据职位添加建议
        position_hints = {
            "前端": ["性能优化", "用户体验", "组件化", "工程化"],
            "后端": ["高并发", "系统稳定性", "数据库优化", "微服务"],
            "产品": ["用户增长", "需求分析", "数据驱动", "上线效果"],
        }

        hints = []
        if position:
            for key, vals in position_hints.items():
                if key in position:
                    hints.extend(vals)

        improvement = description
        if "result" in analysis["missing"]:
            improvement += " 建议补充：通过XX措施，实现了XX指标的提升（具体数据）。"
        if "action" in analysis["missing"]:
            improvement += " 建议补充：具体采用了XX技术/方法，解决了XX问题。"

        return improvement


# 全局实例
_knowledge_base_instance: Optional[ResumeKnowledgeBase] = None
_star_guidancer_instance: Optional[STARGuidancer] = None


def get_knowledge_base(
    milvus_uri: str = "http://localhost:19530"
) -> Optional[ResumeKnowledgeBase]:
    """
    获取知识库单例

    Returns:
        ResumeKnowledgeBase 实例，如果依赖未安装则返回 None
    """
    global _knowledge_base_instance
    if not LANGCHAIN_AVAILABLE:
        return None
    if _knowledge_base_instance is None:
        try:
            _knowledge_base_instance = ResumeKnowledgeBase(milvus_uri=milvus_uri)
        except ImportError:
            return None
    return _knowledge_base_instance


def get_star_guidancer() -> STARGuidancer:
    """获取 STAR 追问器单例"""
    global _star_guidancer_instance
    if _star_guidancer_instance is None:
        _star_guidancer_instance = STARGuidancer()
    return _star_guidancer_instance
