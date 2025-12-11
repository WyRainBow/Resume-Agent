# Resume-Agent - AI 简历生成系统

> 一句话描述、AI 自动生成专业 PDF 简历

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 核心功能

### 🤖 AI 智能生成
- 支持一句话描述快速生成完整简历
- 支持粘贴完整简历文本、智能解析为结构化数据
- 多模型支持、智谱 GLM、Google Gemini、豆包(火山引擎)

### ✏️ 可视化编辑
- 左侧编辑器、右侧实时预览、所见即所得
- 支持拖拽排序模块顺序
- 每个模块支持独立 AI 导入和 AI 改写功能
- 富文本编辑、支持加粗、斜体、列表等格式

### 📄 PDF 导出
- 专业 LaTeX 排版、生成高质量 PDF
- 支持中英文字体完美渲染
- 实时预览、支持翻页和缩放

### 🔄 AI 辅助功能
- **AI 导入**、将文本智能解析为对应模块数据
- **AI 改写**、根据指令优化现有内容、如量化数据、突出成果
- **Reflection Agent**、视觉分析预览截图、自动修正排版问题

## 📸 功能截图

### 初始界面
首页欢迎页面、输入一句话描述即可生成简历

![初始界面](Latex%20简历演示/screenshots/1-初始界面.png)

### 工作区界面
左侧可视化编辑器、右侧实时预览、支持拖拽排序模块

![工作区界面](Latex%20简历演示/screenshots/2-工作区界面.png)

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- XeLaTeX、用于 PDF 编译
- 中文字体、macOS 自带、Linux 需安装 Noto CJK

### 安装步骤

**1、克隆仓库**
```bash
git clone https://github.com/WyRainBow/Resume-Agent.git
cd Resume-Agent
```

**2、配置环境变量**
创建 `.env` 文件、填入 API 密钥
```bash
ZHIPU_API_KEY=your_zhipu_api_key
GEMINI_API_KEY=your_gemini_api_key
DOUBAO_API_KEY=your_doubao_api_key
```

**3、安装依赖**
```bash
pip install -r backend/requirements.txt
cd frontend && npm install
```

**4、启动服务**
```bash
# 后端
cd backend && uvicorn main:app --reload --port 8000

# 前端
cd frontend && npm run dev
```

**5、访问应用**
- 前端、http://localhost:5173
- 后端 API、http://localhost:8000
- API 文档、http://localhost:8000/docs

## 🛠️ 技术栈

### 前端
- React 18 + TypeScript + Vite
- PDF.js 渲染
- 紫色渐变主题、玻璃态设计

### 后端
- FastAPI + Python
- 多 AI 模型支持、智谱、Gemini、豆包
- XeLaTeX PDF 生成
- Reflection Agent 自动优化

### AI 模型配置
| 功能 | 模型 | 说明 |
|------|------|------|
| 简历生成 | Gemini 2.5 Pro | 文本到 JSON |
| AI 改写 | 智谱/Gemini/豆包 | 内容优化 |
| 视觉分析 | GLM-4V-Flash | 截图分析排版 |

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request

## 📮 联系方式

- GitHub、[@WyRainBow](https://github.com/WyRainBow)
- 仓库地址、https://github.com/WyRainBow/Resume-Agent

---

**注意**、使用前请确保已配置正确的 API 密钥、`.env` 文件不会被推送到仓库、请自行创建并配置
