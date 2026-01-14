# Railway 部署指南

## 环境变量配置

本项目默认使用 **DeepSeek** AI 服务。在 Railway 上部署时，需要在环境变量中配置 API Key。

### 必需的环境变量

在 Railway 项目设置中添加以下环境变量：

```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 如何获取 DeepSeek API Key

1. 访问 [DeepSeek 官网](https://www.deepseek.com/)
2. 注册/登录账号
3. 进入 API 管理页面
4. 创建新的 API Key
5. 复制 API Key 并添加到 Railway 环境变量中

### 在 Railway 中配置环境变量

1. 登录 [Railway](https://railway.app/)
2. 选择你的项目
3. 点击项目设置（Settings）
4. 找到 "Variables" 部分
5. 点击 "New Variable"
6. 输入变量名：`DEEPSEEK_API_KEY`
7. 输入变量值：你的 DeepSeek API Key
8. 点击 "Add" 保存

### 其他可选环境变量

如果需要使用其他 AI 服务（不推荐，因为前端已移除 API 设置功能）：

```
ZHIPU_API_KEY=your_zhipu_api_key  # 智谱 AI
DOUBAO_API_KEY=your_doubao_api_key  # 豆包 AI
```

### 部署说明

1. 项目已配置 `nixpacks.toml`，Railway 会自动识别并构建
2. 后端服务会自动从环境变量读取 `DEEPSEEK_API_KEY`
3. 所有用户将使用你配置的 DeepSeek API Key，无需在前端设置

### 注意事项

- ⚠️ **API Key 安全**：不要在代码中硬编码 API Key
- ⚠️ **费用控制**：DeepSeek API 按使用量计费，建议设置使用限制
- ⚠️ **环境变量优先级**：Railway 环境变量会覆盖 `.env` 文件中的配置

### 验证部署

部署成功后，访问你的应用，尝试使用 AI 功能（如 AI 导入、AI 改写），如果功能正常，说明 API Key 配置成功。
