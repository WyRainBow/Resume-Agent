"""
Agent Tools 模块

提供 CVReader、CVEditor 和 CVBatchEditor 工具，基于 LangChain BaseTool 实现。
"""

from .cv_reader import (
    CVReaderTool,
    CVReaderInput,
    create_cv_reader,
    CV_READER_FUNCTION_DEF
)

from .cv_editor import (
    CVEditorTool,
    CVEditorInput,
    create_cv_editor,
    CV_EDITOR_FUNCTION_DEF
)

from .cv_batch_editor import (
    CVBatchEditorTool,
    CVBatchEditorInput,
    create_cv_batch_editor,
    CV_BATCH_EDITOR_FUNCTION_DEF
)

# 所有工具的 Function 定义列表
ALL_TOOLS_FUNCTION_DEFS = [
    CV_READER_FUNCTION_DEF,
    CV_EDITOR_FUNCTION_DEF,
    CV_BATCH_EDITOR_FUNCTION_DEF
]

__all__ = [
    # CVReader
    "CVReaderTool",
    "CVReaderInput",
    "create_cv_reader",
    "CV_READER_FUNCTION_DEF",
    # CVEditor
    "CVEditorTool",
    "CVEditorInput",
    "create_cv_editor",
    "CV_EDITOR_FUNCTION_DEF",
    # CVBatchEditor
    "CVBatchEditorTool",
    "CVBatchEditorInput",
    "create_cv_batch_editor",
    "CV_BATCH_EDITOR_FUNCTION_DEF",
    # 集合
    "ALL_TOOLS_FUNCTION_DEFS",
]


