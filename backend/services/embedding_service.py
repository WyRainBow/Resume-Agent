"""
向量嵌入服务 - 用于简历语义搜索

支持使用 OpenAI 或其他兼容 API 生成向量
"""
import os
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from models import Resume, ResumeEmbedding, User


class EmbeddingService:
    """向量嵌入服务"""

    def __init__(self, db: Session):
        self.db = db
        self.client = None
        self._init_client()

    def _init_client(self):
        """初始化 OpenAI 客户端（或其他兼容 API）"""
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        if api_key:
            self.client = OpenAI(
                api_key=api_key,
                base_url=base_url,
            )
        else:
            print("[WARNING] OPENAI_API_KEY not set, embedding service disabled")

    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """生成单个文本的向量嵌入

        Args:
            text: 输入文本

        Returns:
            向量列表（1536 维），失败返回 None
        """
        if not self.client:
            print("[ERROR] Embedding client not initialized")
            return None

        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",  # 或 text-embedding-ada-002
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"[ERROR] Failed to generate embedding: {e}")
            return None

    def create_resume_embeddings(self, resume: Resume) -> bool:
        """为简历创建向量嵌入

        Args:
            resume: Resume ORM 对象

        Returns:
            是否成功
        """
        if not self.client:
            return False

        resume_data = resume.data
        user_id = resume.user_id
        resume_id = resume.id

        # 删除旧的嵌入（如果有）
        self.db.query(ResumeEmbedding).filter(
            ResumeEmbedding.resume_id == resume_id
        ).delete()

        # 为不同部分生成嵌入
        embeddings_to_create = []

        # 1. Summary 摘要
        summary = resume_data.get("summary", "")
        if summary:
            embedding = self.generate_embedding(summary)
            if embedding:
                embeddings_to_create.append({
                    "content_type": "summary",
                    "content": summary,
                    "embedding": embedding,
                    "metadata": {
                        "resume_name": resume.name,
                        "alias": resume.alias,
                    }
                })

        # 2. Experience 工作经历
        experiences = resume_data.get("experience", [])
        for idx, exp in enumerate(experiences):
            exp_text = f"{exp.get('company', '')} {exp.get('position', '')} {exp.get('description', '')}"
            achievements = exp.get("achievements", [])
            if achievements:
                exp_text += " " + " ".join(achievements)

            embedding = self.generate_embedding(exp_text)
            if embedding:
                embeddings_to_create.append({
                    "content_type": "experience",
                    "content": exp_text,
                    "embedding": embedding,
                    "metadata": {
                        "resume_name": resume.name,
                        "company": exp.get("company"),
                        "position": exp.get("position"),
                        "index": idx,
                    }
                })

        # 3. Projects 项目经历
        projects = resume_data.get("projects", [])
        for idx, proj in enumerate(projects):
            proj_text = f"{proj.get('name', '')} {proj.get('description', '')}"
            highlights = proj.get("highlights", [])
            if highlights:
                proj_text += " " + " ".join(highlights)

            embedding = self.generate_embedding(proj_text)
            if embedding:
                embeddings_to_create.append({
                    "content_type": "project",
                    "content": proj_text,
                    "embedding": embedding,
                    "metadata": {
                        "resume_name": resume.name,
                        "project_name": proj.get("name"),
                        "index": idx,
                    }
                })

        # 4. Skills 技能
        skills = resume_data.get("skills", [])
        if skills:
            skills_text = " ".join(skills)
            embedding = self.generate_embedding(skills_text)
            if embedding:
                embeddings_to_create.append({
                    "content_type": "skills",
                    "content": skills_text,
                    "embedding": embedding,
                    "metadata": {
                        "resume_name": resume.name,
                        "skills_count": len(skills),
                    }
                })

        # 5. Education 教育经历
        education = resume_data.get("education", [])
        for idx, edu in enumerate(education):
            edu_text = f"{edu.get('school', '')} {edu.get('degree', '')} {edu.get('major', '')}"
            embedding = self.generate_embedding(edu_text)
            if embedding:
                embeddings_to_create.append({
                    "content_type": "education",
                    "content": edu_text,
                    "embedding": embedding,
                    "metadata": {
                        "resume_name": resume.name,
                        "school": edu.get("school"),
                        "degree": edu.get("degree"),
                        "index": idx,
                    }
                })

        # 批量插入到数据库
        for emb_data in embeddings_to_create:
            embedding_obj = ResumeEmbedding(
                resume_id=resume_id,
                user_id=user_id,
                embedding=emb_data["embedding"],  # JSON 格式存储
                content_type=emb_data["content_type"],
                content=emb_data["content"],
                extra_metadata=emb_data.get("metadata"),
            )
            self.db.add(embedding_obj)

        try:
            self.db.commit()
            print(f"[OK] Created {len(embeddings_to_create)} embeddings for resume {resume_id}")
            return True
        except Exception as e:
            self.db.rollback()
            print(f"[ERROR] Failed to save embeddings: {e}")
            return False

    def search_similar(
        self,
        query: str,
        user_id: int,
        limit: int = 10,
        content_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """语义搜索相似的简历内容

        Args:
            query: 搜索查询文本
            user_id: 用户 ID
            limit: 返回结果数量
            content_type: 可选，限制搜索的内容类型

        Returns:
            匹配结果列表，每个结果包含 resume_id, content_type, content, score 等
        """
        if not self.client:
            return []

        # 生成查询向量
        query_embedding = self.generate_embedding(query)
        if not query_embedding:
            return []

        # TODO: 使用 pgvector 的余弦相似度搜索
        # 这里需要原生 SQL 或使用 pgvector-sqlalchemy
        # 示例（需要数据库支持向量类型）：
        # SELECT * FROM resume_embeddings
        # WHERE user_id = :user_id
        # ORDER BY embedding <=> :query_vector
        # LIMIT :limit

        # 临时实现：使用 Python 计算相似度
        query_emb_str = json.dumps(query_embedding)

        sql = text("""
            SELECT
                id, resume_id, user_id, content_type, content, metadata,
                embedding
            FROM resume_embeddings
            WHERE user_id = :user_id
            AND (:content_type IS NULL OR content_type = :content_type)
        """)

        result = self.db.execute(sql, {
            "user_id": user_id,
            "content_type": content_type
        })

        # 计算余弦相似度
        import numpy as np

        scores = []
        for row in result:
            emb = json.loads(row[5])  # embedding 列
            # 余弦相似度
            similarity = self._cosine_similarity(query_embedding, emb)
            scores.append({
                "id": row[0],
                "resume_id": row[1],
                "user_id": row[2],
                "content_type": row[3],
                "content": row[4],
                "metadata": json.loads(row[6]) if row[6] else {},
                "similarity": similarity,
            })

        # 按相似度排序
        scores.sort(key=lambda x: x["similarity"], reverse=True)
        return scores[:limit]

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        """计算余弦相似度"""
        import numpy as np
        try:
            a_arr = np.array(a)
            b_arr = np.array(b)
            return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))
        except:
            return 0.0


def create_embeddings_for_user_resume(db: Session, user_id: int, resume_id: str) -> bool:
    """为指定简历创建嵌入的便捷函数"""
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()

    if not resume:
        print(f"[ERROR] Resume {resume_id} not found for user {user_id}")
        return False

    service = EmbeddingService(db)
    return service.create_resume_embeddings(resume)
