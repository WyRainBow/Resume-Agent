"""
HTML to LaTeX 转换模块

将 TipTap 富文本编辑器输出的 HTML 转换为 LaTeX 代码
支持的格式：
- 加粗 <strong>/<b> -> textbf
- 斜体 <em>/<i> -> textit
- 下划线 <u> -> underline
- 无序列表 <ul><li> -> itemize
- 有序列表 <ol><li> -> enumerate
- 段落 <p> -> 换行
- 换行 <br> -> newline
"""

import re
from html.parser import HTMLParser
from typing import List, Tuple


class HTMLToLatexConverter(HTMLParser):
    """HTML 到 LaTeX 转换器"""
    
    def __init__(self):
        super().__init__()
        self.result: List[str] = []
        self.tag_stack: List[str] = []
        self.in_list = False
        self.list_type = None  # 'ul' or 'ol'
        
    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str]]):
        tag = tag.lower()
        self.tag_stack.append(tag)
        
        if tag in ('strong', 'b'):
            self.result.append(r'\textbf{')
        elif tag in ('em', 'i'):
            self.result.append(r'\textit{')
        elif tag == 'u':
            self.result.append(r'\underline{')
        elif tag == 'ul':
            self.in_list = True
            self.list_type = 'ul'
            # 使用圆点符号，并设置对齐参数：leftmargin=* 自动计算，labelsep 控制标签和文本间距
            self.result.append(r'\begin{itemize}[label=$\bullet$,parsep=0.2ex,leftmargin=*,labelsep=0.5em,itemindent=0em]' + '\n')
        elif tag == 'ol':
            self.in_list = True
            self.list_type = 'ol'
            self.result.append(r'\begin{enumerate}' + '\n')
        elif tag == 'li':
            self.result.append(r'  \item ')
        elif tag == 'br':
            self.result.append(r' \\' + '\n')
        elif tag == 'p':
            # 段落开始，不需要特殊处理
            pass
        elif tag == 'h1':
            self.result.append(r'\section*{')
        elif tag == 'h2':
            self.result.append(r'\subsection*{')
        elif tag == 'h3':
            self.result.append(r'\subsubsection*{')
            
    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if self.tag_stack and self.tag_stack[-1] == tag:
            self.tag_stack.pop()
            
        if tag in ('strong', 'b', 'em', 'i', 'u'):
            self.result.append('}')
        elif tag == 'ul':
            self.result.append(r'\end{itemize}' + '\n')
            self.in_list = False
            self.list_type = None
        elif tag == 'ol':
            self.result.append(r'\end{enumerate}' + '\n')
            self.in_list = False
            self.list_type = None
        elif tag == 'li':
            self.result.append('\n')
        elif tag == 'p':
            # 段落结束，添加换行
            self.result.append('\n\n')
        elif tag in ('h1', 'h2', 'h3'):
            self.result.append('}\n')
            
    def handle_data(self, data: str):
        # 转义 LaTeX 特殊字符
        escaped = escape_latex(data)
        self.result.append(escaped)
        
    def get_latex(self) -> str:
        return ''.join(self.result).strip()


def escape_latex(text: str) -> str:
    """转义 LaTeX 特殊字符"""
    if not text:
        return ''
    
    # LaTeX 特殊字符转义映射
    replacements = [
        ('\\', r'\textbackslash{}'),
        ('&', r'\&'),
        ('%', r'\%'),
        ('$', r'\$'),
        ('#', r'\#'),
        ('_', r'\_'),
        ('{', r'\{'),
        ('}', r'\}'),
        ('~', r'\textasciitilde{}'),
        ('^', r'\textasciicircum{}'),
    ]
    
    result = text
    for old, new in replacements:
        # 避免重复转义
        if old == '\\':
            result = result.replace(old, new)
        else:
            result = result.replace(old, new)
    
    return result


def html_to_latex(html: str) -> str:
    """
    将 HTML 转换为 LaTeX
    
    Args:
        html: TipTap 输出的 HTML 字符串
        
    Returns:
        LaTeX 格式的字符串
    """
    if not html or not html.strip():
        return ''
    
    # 预处理：移除多余空白
    html = html.strip()
    
    # 处理空段落（包括带属性的空段落）
    html = re.sub(r'<p[^>]*>\s*</p>', '', html)
    
    # 使用解析器转换
    converter = HTMLToLatexConverter()
    try:
        converter.feed(html)
        result = converter.get_latex()
    except Exception as e:
        # 解析失败时返回纯文本
        result = re.sub(r'<[^>]+>', '', html)
        result = escape_latex(result)
    
    # 后处理：清理多余换行
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    return result


def html_to_latex_items(html: str) -> List[str]:
    """
    将 HTML 转换为 LaTeX 列表项
    用于简历中的项目描述等
    
    Args:
        html: TipTap 输出的 HTML 字符串
        
    Returns:
        LaTeX 列表项数组
    """
    if not html or not html.strip():
        return []
    
    # 提取列表项
    items = []
    
    # 匹配 <li> 标签内容
    li_pattern = r'<li[^>]*>(.*?)</li>'
    matches = re.findall(li_pattern, html, re.DOTALL | re.IGNORECASE)
    
    if matches:
        for match in matches:
            # 转换每个列表项内容
            item_html = match.strip()
            # 移除内部标签，保留格式
            item_latex = html_to_latex(f'<p>{item_html}</p>')
            item_latex = item_latex.strip()
            if item_latex:
                items.append(item_latex)
    else:
        # 如果没有列表，按段落分割
        p_pattern = r'<p[^>]*>(.*?)</p>'
        p_matches = re.findall(p_pattern, html, re.DOTALL | re.IGNORECASE)
        
        for match in p_matches:
            item_html = match.strip()
            if item_html:
                item_latex = html_to_latex(f'<p>{item_html}</p>')
                item_latex = item_latex.strip()
                if item_latex:
                    items.append(item_latex)
    
    return items


# 测试
if __name__ == '__main__':
    test_cases = [
        '<p>这是一段<strong>加粗</strong>文字</p>',
        '<p>支持<em>斜体</em>和<u>下划线</u></p>',
        '<ul><li>第一项</li><li>第二项</li></ul>',
        '<p>特殊字符：& % $ # _ { } ~ ^</p>',
        '<p>设计实现<strong>多维度</strong>权限管理系统</p>',
    ]
    
    for html in test_cases:
        latex = html_to_latex(html)
        print(f'HTML: {html}')
        print(f'LaTeX: {latex}')
        print('---')

