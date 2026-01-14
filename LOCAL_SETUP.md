# 本地开发环境配置

## 环境变量配置

本项目默认使用 **DeepSeek** AI 服务。本地开发时需要配置 API Key。

### 1. 创建 .env 文件

在项目根目录创建 `.env` 文件：

```bash
cp .env.example .env
```

### 2. 配置 API Key

编辑 `.env` 文件，填入你的 DeepSeek API Key：

```bash
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. 如何获取 DeepSeek API Key

1. 访问 [DeepSeek 官网](https://www.deepseek.com/)
2. 注册/登录账号
3. 进入 API 管理页面
4. 创建新的 API Key
5. 复制 API Key 并填入 `.env` 文件

### 4. 启动服务

**后端：**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

或者从项目根目录：
```bash
export PYTHONPATH="/Users/wy770/AI 简历:$PYTHONPATH"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**前端：**
```bash
cd frontend
npm run dev
```

### 5. 验证配置

访问 http://localhost:8000/api/health 检查后端是否正常运行。

尝试使用 AI 功能（如 AI 导入、AI 改写），如果功能正常，说明 API Key 配置成功。

### 注意事项

- ⚠️ `.env` 文件不会被推送到 Git（已在 .gitignore 中）
- ⚠️ 不要将 `.env` 文件提交到代码仓库
- ⚠️ API Key 安全：不要分享你的 API Key
