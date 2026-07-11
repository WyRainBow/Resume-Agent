"""通用邮箱格式校验正则（从已下线的「AI 发简历邮件」功能抽出保留）。

原属两处邮件专属代码：
- ``EMAIL_RE``：宽松通用邮箱格式（原 send_resume_email_tool.py 收件人校验）。
- ``QQ_EMAIL_RE``：QQ / Foxmail 邮箱格式（原 email_credential.py 凭证校验）。

抽成公共 util 供未来「QQ 邮箱登录」校验用户输入的邮箱格式复用；当前无调用方。
"""
import re

# 宽松通用邮箱格式（整串匹配）。
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

# QQ / Foxmail 邮箱格式。
QQ_EMAIL_RE = re.compile(r"^[A-Za-z0-9._-]+@(qq\.com|foxmail\.com)$")
