"""
知识库初始化和管理脚本

功能：
1. 初始化 RAG 知识库
2. 添加/删除知识文档
3. 重建向量索引
4. 查询知识库状态
"""
import argparse
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

from .knowledge_base import (
    ResumeKnowledgeBase,
    SearchConfig,
    get_knowledge_base,
    LANGCHAIN_AVAILABLE
)


def init_knowledge_base(
    milvus_uri: str = "http://localhost:19530",
    force_rebuild: bool = False
) -> bool:
    """
    初始化知识库

    Args:
        milvus_uri: Milvus 服务地址
        force_rebuild: 是否强制重建

    Returns:
        是否成功
    """
    if not LANGCHAIN_AVAILABLE:
        print("❌ LangChain 依赖未安装，请运行: pip install langchain-community langchain-text-splitters pymilvus")
        return False

    print(f"🔧 初始化知识库...")
    print(f"   Milvus 地址: {milvus_uri}")

    try:
        kb = ResumeKnowledgeBase(milvus_uri=milvus_uri)
        success = kb.initialize_from_docs(force_rebuild=force_rebuild)

        if success:
            print(f"✅ 知识库初始化成功")
            print(f"   Collection: {SearchConfig().collection_name}")
        else:
            print(f"⚠️  知识库初始化失败")

        return success
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        return False


def add_document(
    file_path: str,
    milvus_uri: str = "http://localhost:19530",
    category: Optional[str] = None
) -> bool:
    """
    添加文档到知识库

    Args:
        file_path: 文档路径
        milvus_uri: Milvus 服务地址
        category: 文档分类

    Returns:
        是否成功
    """
    if not LANGCHAIN_AVAILABLE:
        print("❌ LangChain 依赖未安装")
        return False

    path = Path(file_path)
    if not path.exists():
        print(f"❌ 文件不存在: {file_path}")
        return False

    print(f"📄 添加文档: {path.name}")

    try:
        from langchain_community.document_loaders import TextLoader
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        from langchain_community.embeddings import HuggingFaceEmbeddings
        from langchain_community.vectorstores import Milvus

        # 加载文档
        loader = TextLoader(str(path), encoding="utf-8")
        documents = loader.load()

        # 添加元数据
        for doc in documents:
            doc.metadata["source"] = path.name
            if category:
                doc.metadata["category"] = category

        # 分割
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""]
        )
        splits = splitter.split_documents(documents)

        # 创建 embeddings
        embeddings = HuggingFaceEmbeddings(
            model_name="shibing624/text2vec-base-chinese",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

        # 添加到向量库
        Milvus.from_documents(
            documents=splits,
            embedding=embeddings,
            collection_name=SearchConfig().collection_name,
            connection_args={"uri": milvus_uri},
            index_params={"index_type": "IVF_FLAT", "metric_type": "IP", "params": {"nlist": 128}},
            drop_old=False  # 追加模式
        )

        print(f"✅ 添加成功，共 {len(splits)} 个片段")
        return True

    except Exception as e:
        print(f"❌ 添加失败: {e}")
        return False


def search_knowledge(
    query: str,
    milvus_uri: str = "http://localhost:19530",
    top_k: int = 3
) -> List[Dict[str, Any]]:
    """
    搜索知识库

    Args:
        query: 查询文本
        milvus_uri: Milvus 服务地址
        top_k: 返回结果数

    Returns:
        搜索结果列表
    """
    if not LANGCHAIN_AVAILABLE:
        print("❌ LangChain 依赖未安装")
        return []

    print(f"🔍 搜索: {query}")

    try:
        kb = get_knowledge_base(milvus_uri)
        if not kb:
            print("❌ 知识库未初始化")
            return []

        docs = kb.search(query, top_k=top_k)

        results = []
        for i, doc in enumerate(docs, 1):
            results.append({
                "rank": i,
                "content": doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "category": doc.metadata.get("category", "general")
            })

        print(f"✅ 找到 {len(results)} 条结果:")
        for r in results:
            print(f"   [{r['rank']}] {r['source']} ({r['category']})")
            print(f"       {r['content']}")

        return results

    except Exception as e:
        print(f"❌ 搜索失败: {e}")
        return []


def check_status(milvus_uri: str = "http://localhost:19530") -> Dict[str, Any]:
    """
    检查知识库状态

    Returns:
        状态字典
    """
    status = {
        "langchain_available": LANGCHAIN_AVAILABLE,
        "milvus_connected": False,
        "collection_exists": False,
        "document_count": 0
    }

    if not LANGCHAIN_AVAILABLE:
        return status

    try:
        from pymilvus import connections, utility

        # 连接 Milvus
        connections.connect("default", uri=milvus_uri)
        status["milvus_connected"] = True

        # 检查 collection
        collection_name = SearchConfig().collection_name
        status["collection_exists"] = utility.has_collection(collection_name)

        if status["collection_exists"]:
            from pymilvus import Collection
            collection = Collection(collection_name)
            collection.load()
            status["document_count"] = collection.num_entities

        connections.disconnect("default")

    except Exception as e:
        status["error"] = str(e)

    return status


def print_status(status: Dict[str, Any]):
    """打印状态信息"""
    print("📊 知识库状态")
    print(f"   LangChain: {'✅' if status['langchain_available'] else '❌'}")

    if not status["langchain_available"]:
        print("   请安装依赖: pip install langchain-community pymilvus")
        return

    print(f"   Milvus: {'✅ 已连接' if status.get('milvus_connected') else '❌ 未连接'}")

    if status.get("milvus_connected"):
        print(f"   Collection: {'✅ 存在' if status.get('collection_exists') else '❌ 不存在'}")
        if status.get("collection_exists"):
            print(f"   文档数: {status.get('document_count', 0)}")
        else:
            print("   提示: 运行 'python -m agents.knowledge_init --init' 初始化知识库")

    if "error" in status:
        print(f"   错误: {status['error']}")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description="简历知识库管理工具")
    parser.add_argument("--init", action="store_true", help="初始化知识库")
    parser.add_argument("--rebuild", action="store_true", help="重建知识库")
    parser.add_argument("--add", type=str, metavar="FILE", help="添加文档")
    parser.add_argument("--category", type=str, help="文档分类")
    parser.add_argument("--search", type=str, metavar="QUERY", help="搜索知识库")
    parser.add_argument("--status", action="store_true", help="查看状态")
    parser.add_argument("--milvus", type=str, default="http://localhost:19530", help="Milvus 地址")

    args = parser.parse_args()

    if args.init or args.rebuild:
        init_knowledge_base(args.milvus, force_rebuild=args.rebuild)

    elif args.add:
        add_document(args.add, args.milvus, args.category)

    elif args.search:
        search_knowledge(args.search, args.milvus)

    elif args.status:
        status = check_status(args.milvus)
        print_status(status)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
