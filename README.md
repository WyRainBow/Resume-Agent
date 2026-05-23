# Resume-Agent

一句话输入、生成可编辑、可导出的专业简历。

**在线体验：[https://resumegenkk.xyz](https://resumegenkk.xyz/)**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 项目介绍

Resume-Agent 是一个面向中文求职场景的 AI 简历系统、提供从内容生成、结构化编辑到 PDF 导出的完整流程。

## 核心能力

- AI 一键生成：根据一句话描述或原始文本快速生成结构化简历
- AI 对话式修改：通过自然语言对话修改简历内容、支持增量编辑、润色、翻译等操作
- AI 智能上传：上传 PDF / 图片简历、AI 自动解析为结构化数据并导入编辑
- AI 简历诊断：围绕 JD 匹配、内容完整性、表达质量输出可解释评分和改进建议
- AI 划词润色：选中任意文本、一键润色、翻译、扩写或缩写
- 可视化编辑：左侧编辑、右侧实时预览、支持点击编辑和滚动编辑两种模式
- 模板系统：内置多套 LaTeX / HTML 模板、支持模板切换和方向模板快速创建
- 高质量导出：基于 LaTeX 生成专业 PDF、支持中英文渲染和浏览器端 PDF 导出

## 页面截图

### 首页
![首页](https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/readme/2026-03-27-home.png)

### Dashboard 简历管理
![我的简历](https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/readme/2026-03-27-dashboard.png)

### 工作区
![工作区](https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/readme/2026-03-27-workspace.png)

### AI 对话
![AI 对话](https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com/readme/2026-05-23-agent-chat.png)

## 技术架构

### 前端

- React 18
- TypeScript
- Vite

### 后端

- FastAPI
- Python
- LaTeX PDF 渲染

## 快速开始

### 环境要求

- Python 3.12+
- Node.js 16+
- XeLaTeX
- 中文字体（Linux 建议安装 Noto CJK）

### 安装

```bash
git clone https://github.com/WyRainBow/Resume-Agent.git
cd Resume-Agent
uv pip install -r requirements.txt
cd frontend && npm install
```

### 配置环境变量

在项目根目录创建 `.env`、至少配置 AI Key。若需要上传资源、还需配置 COS 参数。

```bash
DASHSCOPE_API_KEY=your_api_key
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_REGION=ap-guangzhou
COS_BUCKET=resumecos-1327706280
```

### 启动服务

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

```bash
cd frontend && npm run dev
```

### 访问地址

- 前端: http://localhost:5173
- 后端 API: http://127.0.0.1:9000
- OpenAPI 文档: http://127.0.0.1:9000/docs

## 开发验证

```bash
cd frontend && npm run build
```

后端建议先跑目标模块测试、再按需执行 `pytest`。

## 许可证

MIT License

## 贡献

欢迎通过 Issue 和 Pull Request 参与改进。

## 仓库地址

https://github.com/WyRainBow/Resume-Agent
