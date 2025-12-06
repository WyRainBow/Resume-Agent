"""
直接测试 PDF 生成，不调用 AI
"""
import json
from backend.latex_generator import render_pdf_from_resume_latex

# 读取固定的简历模板
with open('test_resume_demo.json', 'r', encoding='utf-8') as f:
    resume_data = json.load(f)

print("开始生成 PDF...")
try:
    pdf_io = render_pdf_from_resume_latex(resume_data)
    pdf_size = len(pdf_io.getvalue())
    print(f"PDF 生成成功！大小: {pdf_size} bytes")
    
    # 保存 PDF
    with open('/tmp/demo_resume.pdf', 'wb') as f:
        f.write(pdf_io.getvalue())
    print("PDF 已保存到 /tmp/demo_resume.pdf")
    
    # 检查字体
    import subprocess
    result = subprocess.run(['pdffonts', '/tmp/demo_resume.pdf'], capture_output=True, text=True)
    print("\n字体信息:")
    print(result.stdout)
    
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()

