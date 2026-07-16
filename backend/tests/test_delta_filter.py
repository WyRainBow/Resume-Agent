"""Wave A-4(P0-2)delta 滤波器:跨 chunk 切开 + 流尾截断双测试(方案规格)。"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.core.logger import setup_logging
setup_logging(False, "INFO", "logs/test")

from backend.agent.web.streaming.delta_filter import filter_streaming_markers  # noqa: E402


def test_complete_module_done_removed():
    assert (
        filter_streaming_markers("正文结束。\n\n[[MODULE_DONE:basic:skip]]")
        == "正文结束。\n\n"
    )


def test_lowercase_marker_removed():
    assert filter_streaming_markers("x[[module_done:experience]]y") == "xy"


def test_complete_suggestions_removed():
    text = '收尾。%%SUGGESTIONS%%[{"text":"a","msg":"b"}]%%END%%'
    assert filter_streaming_markers(text) == "收尾。"


def test_cross_chunk_prefix_held_back_then_released():
    """标记被 chunk 切开:每个累积前缀都不泄漏残片;闭合后正文干净。"""
    full = "改好了。[[MODULE_DONE:experience]]"
    for cut in range(len("改好了。"), len(full)):
        out = filter_streaming_markers(full[:cut])
        assert "[[" not in out and "MODULE" not in out, f"cut={cut}: {out!r}"
        assert out.startswith("改好了。"[: min(cut, 4)])
    assert filter_streaming_markers(full) == "改好了。"


def test_suggestions_cross_chunk_held():
    partial = '好的~\n%%SUGGESTIONS%%[{"text":"继'
    assert filter_streaming_markers(partial) == "好的~\n"


def test_stream_tail_truncated_marker_not_leaked():
    """流尾截断:半截标记不放出(complete 兜底,残片不显示)。"""
    assert filter_streaming_markers("完成。[[MODULE_DO") == "完成。"


def test_plain_text_untouched():
    text = "腾讯实习:缓存命中率 97%,QPS 3000。Response: 200 的接口设计。"
    assert filter_streaming_markers(text) == text


def test_percent_tail_held_then_released():
    """正文以 % 结尾(锚 %% 的 1 字符前缀)——暂扣,补全后放出,无丢失。"""
    held = filter_streaming_markers("覆盖率提升 30%")
    assert held == "覆盖率提升 30"  # 尾部 % 暂扣
    assert filter_streaming_markers("覆盖率提升 30%,效果显著") == "覆盖率提升 30%,效果显著"


def test_idempotent():
    text = "正文[[MODULE_DONE:basic]]尾巴[[MODU"
    once = filter_streaming_markers(text)
    assert filter_streaming_markers(once) == once


def test_monotonic_prefix_extension_across_all_cuts():
    """单调性契约(Codex 终轮 P1):任意逐字符累积流,每次输出必须是上次
    输出的前缀扩展——前端 appendChunk 无法撤回已显示文本。"""
    samples = [
        "改好了。[[MODULE_DONE:experience]]接着看下一段。",
        "正文[[ module_done:basic:skip]]尾巴",
        '好的~%%SUGGESTIONS%%[{"t":"x"}]%%END%%完',
        "正文[[MODULE_DONE:" + "a" * 80 + "]]后续",  # 超长模块名闭合
        "普通[链接](url) 与 30% 数据",
    ]
    for full in samples:
        prev = ""
        for cut in range(1, len(full) + 1):
            out = filter_streaming_markers(full[:cut])
            assert out.startswith(prev), (
                f"回缩! sample={full!r} cut={cut}: {prev!r} -> {out!r}"
            )
            prev = out


def test_oversized_open_marker_held_not_leaked_then_removed_on_close():
    """超长未闭合标记:一律扣住(不再超限放行——放行后闭合会回缩,残片
    留在前端直到 complete);闭合后完整删除。"""
    body = "[[MODULE_DONE:" + "x" * 100
    assert filter_streaming_markers("完成。" + body) == "完成。"
    assert filter_streaming_markers("完成。" + body + "]]后续") == "完成。后续"


def test_whitespace_lowercase_anchor_prefix_held():
    """带空白/小写的合法锚变体在前缀阶段也不闪现(Codex 终轮 P1-2)。"""
    for partial in ["文a[[ MODU", "文b[[ module_don", "文c[[\tMODULE_DONE"]:
        out = filter_streaming_markers(partial)
        assert "[[" not in out, f"{partial!r} -> {out!r}"


def test_reviewing_checklist_char_budget():
    """单项超长 fact 不渲染、计入其余,由代码全量核验(Codex 终轮 P2)。"""
    from backend.agent.utils.optimize_progress import render_progress_checklist

    progress = {
        "status": "reviewing",
        "pending": [],
        "done": ["experience"],
        "facts": {"experience": ["巨" * 200, "正常项97%"]},
    }
    text = render_progress_checklist(progress)
    assert "巨" * 50 not in text
    assert "正常项97%" in text
    assert "其余 1 项" in text


def test_verify_facts_no_json_escape_false_missing():
    """含引号/反斜杠的 fact 迁移后不因 JSON 转义误报(叶子拼接检索)。"""
    from backend.agent.utils.optimize_progress import verify_facts_coverage

    progress = {"facts": {"projects": ['系统"Alpha"', "路径C\\D"]}}
    resume = {
        "projects": [],
        "experience": [{"details": '负责系统"Alpha"与路径C\\D的维护'}],
    }
    assert verify_facts_coverage(progress, resume) == {}
