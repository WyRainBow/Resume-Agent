"""
轻量级提示词模板系统

支持输入验证、部分填充、模板组合等功能，无外部依赖。
"""

from string import Formatter
from typing import Any, Union


class PromptTemplate:
    """轻量级字符串提示词模板

    特性：
    - 自动从模板中提取变量名
    - format() 时验证必需变量
    - partial() 预填充部分变量
    - 支持 + 操作符拼接模板

    示例：
        template = PromptTemplate("Hello {name}, you are {age} years old.")
        template.format(name="Alice", age=25)
        # => "Hello Alice, you are 25 years old."

        base = template.partial(age=30)
        base.format(name="Bob")
        # => "Hello Bob, you are 30 years old."

        combined = PromptTemplate("Hello ") + template
        combined.format(name="Carol", age=28)
        # => "Hello Hello Carol, you are 28 years old."
    """

    def __init__(self, template: str, partial_variables: dict[str, Any] | None = None):
        """初始化提示词模板

        Args:
            template: 模板字符串，支持 {var} 格式的变量
            partial_variables: 预填充的变量（用于 partial() 后的实例）
        """
        self.template = template
        self._partial_vars = partial_variables or {}
        # 自动从模板中提取变量名
        self._inferred_vars = self._extract_variables()

    def _extract_variables(self) -> set[str]:
        """从模板中提取所有变量名

        使用 string.Formatter 解析 {var} 格式的变量
        """
        variables = set()
        for _, field_name, _, _ in Formatter().parse(self.template):
            if field_name is not None:
                # 处理带属性的变量，如 {user.name}
                # 只取主变量名
                var_name = field_name.split('.')[0].split('[')[0]
                variables.add(var_name)
        return variables

    @property
    def variables(self) -> list[str]:
        """获取模板中所有需要的变量名（排除已 partial 填充的）"""
        return list(self._inferred_vars - self._partial_vars.keys())

    def format(self, **kwargs: Any) -> str:
        """格式化模板

        Args:
            **kwargs: 变量值

        Returns:
            格式化后的字符串

        Raises:
            ValueError: 当缺少必需变量时
        """
        # 合并 partial 变量和 format 参数
        all_kwargs = {**self._partial_vars, **kwargs}

        # 验证必需变量
        missing = set(self.variables) - all_kwargs.keys()
        if missing:
            # 只显示本次调用 format() 时提供的变量（不包括 partial 预填充的）
            newly_provided = list(kwargs.keys())
            raise ValueError(
                f"Missing required variables: {', '.join(sorted(missing))}. "
                f"Expected: {', '.join(sorted(self.variables))}, "
                f"Provided: {', '.join(sorted(newly_provided)) if newly_provided else '(none)'}"
            )

        return self.template.format(**all_kwargs)

    def partial(self, **kwargs: Any) -> "PromptTemplate":
        """返回预填充部分变量的新模板

        预填充的变量在后续 format() 时不需要再提供。

        Args:
            **kwargs: 要预填充的变量

        Returns:
            新的 PromptTemplate 实例
        """
        new_partial = {**self._partial_vars, **kwargs}
        return PromptTemplate(
            template=self.template,
            partial_variables=new_partial
        )

    def __add__(self, other: Union["PromptTemplate", str]) -> "PromptTemplate":
        """拼接模板

        支持：
        - PromptTemplate + PromptTemplate
        - PromptTemplate + str
        - str + PromptTemplate (通过 __radd__)

        Args:
            other: 另一个模板或字符串

        Returns:
            拼接后的新模板
        """
        if isinstance(other, str):
            other_template = PromptTemplate(other)
        elif isinstance(other, PromptTemplate):
            other_template = other
        else:
            return NotImplemented

        # 合并模板和变量
        combined_vars = self._inferred_vars | other_template._inferred_vars
        combined_partial = {**self._partial_vars, **other_template._partial_vars}

        # 创建新的合并模板
        return PromptTemplate(
            template=self.template + other_template.template,
            partial_variables=combined_partial if combined_partial else None
        )

    def __radd__(self, other: str) -> "PromptTemplate":
        """支持 str + PromptTemplate"""
        if isinstance(other, str):
            return PromptTemplate(other).__add__(self)
        return NotImplemented

    def __repr__(self) -> str:
        vars_str = ', '.join(sorted(self.variables)) if self.variables else '(none)'
        return f"PromptTemplate(variables=[{vars_str}])"

    @classmethod
    def from_template(cls, template: str) -> "PromptTemplate":
        """从模板字符串创建实例的工厂方法

        这是创建 PromptTemplate 的推荐方式。

        Args:
            template: 模板字符串

        Returns:
            PromptTemplate 实例
        """
        return cls(template)
