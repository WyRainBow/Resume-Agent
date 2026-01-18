"""Utility functions for message operations."""

from typing import Any


def merge_dicts(left: dict[str, Any], *others: dict[str, Any]) -> dict[str, Any]:
    """Merge dictionaries.

    Merge many dicts, handling specific scenarios where a key exists in both
    dictionaries but has a value of `None` in `'left'`. In such cases, the method uses
    the value from `'right'` for that key in the merged dictionary.
    """
    merged = left.copy()
    for right in others:
        for right_k, right_v in right.items():
            if right_k not in merged or (
                right_v is not None and merged[right_k] is None
            ):
                merged[right_k] = right_v
            elif right_v is None:
                continue
            elif type(merged[right_k]) is not type(right_v):
                msg = (
                    f'additional_kwargs["{right_k}"] already exists in this message,'
                    " but with a different type."
                )
                raise TypeError(msg)
            elif isinstance(merged[right_k], str):
                if (right_k == "index" and merged[right_k].startswith("lc_")) or (
                    right_k in {"id", "output_version", "model_provider"}
                    and merged[right_k] == right_v
                ):
                    continue
                merged[right_k] += right_v
            elif isinstance(merged[right_k], dict):
                merged[right_k] = merge_dicts(merged[right_k], right_v)
            elif isinstance(merged[right_k], list):
                merged[right_k] = merge_lists(merged[right_k], right_v)
            elif merged[right_k] == right_v:
                continue
            elif isinstance(merged[right_k], int):
                merged[right_k] += right_v
            else:
                msg = (
                    f"Additional kwargs key {right_k} already exists in left dict and "
                    f"value has unsupported type {type(merged[right_k])}."
                )
                raise TypeError(msg)
    return merged


def merge_lists(left: list | None, *others: list | None) -> list | None:
    """Add many lists, handling `None`."""
    merged = left.copy() if left is not None else None
    for other in others:
        if other is None:
            continue
        if merged is None:
            merged = other.copy()
        else:
            for e in other:
                if e not in merged:
                    merged.append(e)
    return merged


def merge_obj(left: Any, right: Any) -> Any:
    """Merge two objects, handling `None`."""
    if right is None:
        return left
    if left is None:
        return right
    if isinstance(left, dict) and isinstance(right, dict):
        return merge_dicts(left, right)
    if isinstance(left, list) and isinstance(right, list):
        return merge_lists(left, right)
    return right








