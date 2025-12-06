# Resume-Agent - AI 简历生成系统

> 一句话描述，AI 自动生成专业 PDF 简历

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## ✨ 核心功能

本系统实现了从一句话描述到专业 PDF 简历的完整自动化流程：

```
用户输入一句话 → AI 生成简历 JSON → LaTeX 代码生成 → PDF 编译 → 用户预览
```

### 工作流程

1. **用户输入**：在左侧面板输入一句话描述（岗位/年限/技术栈/亮点）
2. **AI 生成**：调用大语言模型（智谱 GLM-4.5V / Google Gemini）生成结构化简历 JSON
3. **LaTeX 转换**：将 JSON 数据转换为专业的 LaTeX 代码
4. **PDF 编译**：使用 XeLaTeX 编译生成高质量 PDF
5. **实时预览**：前端即时显示生成的 PDF，支持翻页和缩放

## 🚀 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+
- XeLaTeX（用于 PDF 编译）

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/WyRainBow/Resume-Agent.git
cd Resume-Agent
```

2. **配置环境变量**
```bash
ZHIPU_API_KEY=your_zhipu_api_key
GEMINI_API_KEY=your_gemini_api_key
ZHIPU_MODEL=glm-4.5v
```

3. **安装后端依赖**
```bash
pip install -r backend/requirements.txt

uv pip install -r backend/requirements.txt
```

4. **安装前端依赖**
```bash
cd frontend
npm install
```

5. **启动服务**

**后端（FastAPI）**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**前端（Vite）**
```bash
cd frontend
npm run dev
```

6. **访问应用**
- 前端：http://localhost:5173
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

## 📖 使用说明

### 方式一：AI 生成简历

1. 在左侧输入框输入一句话描述，例如：
   ```
   3年后端，Java/Go，投递后端工程师，擅长高并发与微服务
   ```
2. 选择 AI 模型（智谱或 Gemini）
3. 点击"生成简历"按钮
4. 等待 AI 生成和 PDF 编译完成
5. 在右侧查看生成的简历 PDF

### 方式二：加载 Demo 模板

1. 直接点击"加载 Demo 模板"按钮
2. 系统会使用预设的简历模板快速生成 PDF
3. 无需等待 AI 调用，适合快速测试

## 🛠️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **PDF 渲染**：PDF.js
- **UI 风格**：紫色渐变主题，玻璃态设计

### 后端
- **框架**：FastAPI
- **AI 模型**：
  - 智谱 GLM-4.5V
  - Google Gemini
- **PDF 生成**：XeLaTeX + LaTeX 模板
- **字体支持**：PingFang SC（中文）+ TeXGyreTermes（英文）

## 🎯 核心特性

- ✅ **AI 驱动**：使用大语言模型理解用户意图、自动生成结构化内容
- ✅ **LaTeX 排版**：专业级 PDF 生成、确保排版质量
- ✅ **字体支持**：完整支持中文字体渲染、解决 PDF.js 字体显示问题
- ✅ **实时预览**：前端即时显示生成的 PDF
- ✅ **Demo 模式**：快速加载预设模板、无需 AI 调用

## 📸 功能截图

### 1. 初始界面

用户在左侧面板输入一句话描述：包含岗位/职位、工作年限、技术栈、个人亮点等信息。

![初始界面](Latex%20%E7%AE%80%E5%8E%86%E6%BC%94%E7%A4%BA/1-初始界面.png)

### 2. PDF 预览

系统生成简历后：在右侧面板实时预览 PDF、支持翻页和缩放、字体完整渲染。

![PDF预览](Latex%20%E7%AE%80%E5%8E%86%E6%BC%94%E7%A4%BA/2-PDF预览完整.png)

### 3. AI 生成简历

点击"生成简历"按钮后：AI 模型将自然语言描述转换为结构化简历数据、并自动生成 PDF。

![AI生成简历](Latex%20%E7%AE%80%E5%8E%86%E6%BC%94%E7%A4%BA/3-AI生成简历.png)

## 🔧 开发

### 后端开发

```bash
cd backend
uvicorn main:app --reload
```

### 前端开发

```bash
cd frontend
npm run dev
```

### 测试 PDF 生成

```bash
python test_pdf_direct.py
```

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📮 联系方式

- GitHub: [@WyRainBow](https://github.com/WyRainBow)
- 仓库地址: https://github.com/WyRainBow/Resume-Agent

---

**注意**：使用前请确保已配置正确的 API 密钥。`.env` 文件不会被推送到仓库、请自行创建并配置。

