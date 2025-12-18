# 后端服务启动问题分析与解决指南

## 问题总结

### 1. 问题现象
- 使用 `curl -X POST http://localhost:8000/api/resume/parse -d @payload.json` 调用 API 成功
- 但预期的日志输出没有显示（如 `========== 收到解析请求 ==========`, `========== 并行处理开始 ==========` 等）

### 2. 根本原因分析

#### 2.1 日志文件双重输出问题 ⚠️ **关键发现**
- **问题现象**：存在两个日志文件，内容不完全一致
  - `logs/backend/backend.log`：包含所有输出（uvicorn stdout/stderr + print 语句）
  - `logs/backend/YYYY-MM-DD.log`：只包含格式化的 logger 输出（backend_logger.info()）
- **根本原因**：
  - `start.sh` 脚本使用 `nohup ... > logs/backend/backend.log 2>&1 &` 重定向所有输出
  - `backend_logger` 使用 `TimedRotatingFileHandler` 写入按日期命名的文件
  - **print 语句输出到 stderr，会被重定向到 `backend.log`，但不会进入 `YYYY-MM-DD.log`**
- **影响**：
  - 如果查看 `YYYY-MM-DD.log`，看不到 print 调试输出
  - 如果查看 `backend.log`，可以看到所有输出，但格式可能不统一

#### 2.2 服务启动方式问题
- **原始问题**：使用 `nohup` 后台运行，导致日志输出被重定向到文件
- **影响**：控制台无法直接看到实时日志输出

#### 2.2 虚拟环境依赖冲突
- **现象**：多次出现 `ModuleNotFoundError` 错误
  ```
  ModuleNotFoundError: No module named 'annotated_doc'
  ModuleNotFoundError: No module named 'fastapi._compat'
  ImportError: cannot import name 'validate_core_schema' from 'pydantic_core._pydantic_core'
  ```
- **原因**：不同Python环境（系统Python、conda、项目虚拟环境）之间的依赖版本冲突

#### 2.3 端口占用问题
- **现象**：`ERROR: [Errno 48] Address already in use`
- **原因**：多次启动服务导致进程没有正确清理

#### 2.4 PYTHONPATH 配置问题
- **问题**：相对导入失败（`from .logger import ...`）
- **原因**：Python无法找到项目根目录，导致模块导入失败

### 3. 解决过程

#### 3.1 第一阶段：诊断问题
1. 检查服务状态：`lsof -i :8000` 发现端口被占用
2. 查看日志文件：`tail -f logs/backend/backend.log` 发现启动错误
3. 识别依赖问题：缺少 `annotated_doc`、`aiohttp` 等模块

#### 3.2 第二阶段：解决依赖
1. 安装缺失依赖：
   ```bash
   pip install annotated-doc
   pip install aiohttp sse-starlette fastapi uvicorn pydantic python-dotenv requests
   ```

2. 重新安装正确版本的依赖：
   ```bash
   pip install "fastapi>=0.104.1,<0.110.0"
   pip install -r backend/requirements.txt --upgrade
   ```

#### 3.3 第三阶段：修复启动配置
1. 设置 PYTHONPATH：
   ```bash
   export PYTHONPATH=/Users/wy770/AI\ 简历:$PYTHONPATH
   ```

2. 使用正确的启动命令：
   ```bash
   python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug
   ```

#### 3.4 第四阶段：进程管理
1. 强制清理所有相关进程：
   ```bash
   pkill -f "uvicorn\|npm run dev"
   kill -9 $(lsof -i :8000 | grep LISTEN | awk '{print $2}')
   ```

2. 重新启动服务：
   ```bash
   export PYTHONPATH=/Users/wy770/AI\ 简历:$PYTHONPATH
   python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload > logs/backend/backend.log 2>&1 &
   ```

### 4. 最终解决方案

#### 4.1 成功的启动配置
- 使用系统Python（miniconda）
- 正确设置 PYTHONPATH
- 安装所有必需依赖
- 使用相对导入（`from .logger import`）

#### 4.2 关键配置点
1. **PYTHONPATH 设置**：确保 Python 能找到项目根目录
2. **依赖版本一致性**：使用 requirements.txt 指定确切版本
3. **进程清理**：启动前清理所有相关进程
4. **日志查看**：
   - **查看所有输出（推荐）**：`tail -f logs/backend/backend.log`（包含 print 和 logger 输出）
   - **查看格式化日志**：`tail -f logs/backend/2025-12-18.log`（只包含 logger 输出）
   - **查看并行处理日志**：`grep "并行处理" logs/backend/backend.log`

### 5. 最佳实践建议

#### 5.1 启动服务
```bash
# 1. 清理旧进程
./stop.sh

# 2. 启动服务
./start.sh

# 3. 查看日志（推荐查看 backend.log，包含所有输出）
tail -f logs/backend/backend.log

# 或者查看格式化的日志（只包含 logger 输出）
tail -f logs/backend/$(date +%Y-%m-%d).log
```

#### 5.2 调试模式
```bash
# 前台运行查看实时日志
export PYTHONPATH=/Users/wy770/AI\ 简历:$PYTHONPATH
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug
```

#### 5.3 依赖管理
- 定期更新虚拟环境依赖
- 使用 pip freeze 记录实际安装的版本
- 避免混用不同Python环境的包

### 6. 故障排查清单

- [ ] 检查端口是否被占用：`lsof -i :8000`
- [ ] 检查Python环境：`which python3`
- [ ] 检查PYTHONPATH：`echo $PYTHONPATH`
- [ ] 检查关键依赖：`pip list | grep fastapi`
- [ ] 查看启动日志：`tail -50 logs/backend/backend.log`
- [ ] 测试健康检查：`curl http://localhost:8000/api/health`

### 7. 性能监控

成功启动后，可以通过以下日志监控并行处理性能：

```bash
# 查看并行处理日志（推荐：backend.log 包含 print 输出）
grep -E "(并行处理|分块优化)" logs/backend/backend.log

# 实时监控所有输出
tail -f logs/backend/backend.log | grep -E "(并行处理|解析)"

# 或者查看格式化的日志（只包含 logger 输出）
grep -E "(并行处理|分块优化)" logs/backend/$(date +%Y-%m-%d).log
```

### 8. 日志文件说明 ⚠️ **重要**

项目中有两个日志文件，用途不同：

1. **`logs/backend/backend.log`**（推荐查看）
   - 来源：`start.sh` 脚本重定向的所有输出
   - 内容：包含 uvicorn stdout/stderr + print 语句 + logger 输出
   - 用途：**调试时查看所有输出，包括 print 调试信息**
   - 查看方式：`tail -f logs/backend/backend.log`

2. **`logs/backend/YYYY-MM-DD.log`**（按日期命名）
   - 来源：`backend_logger` 的 `TimedRotatingFileHandler`
   - 内容：只包含格式化的 logger 输出（`backend_logger.info()` 等）
   - 用途：**查看格式化的业务日志**
   - 查看方式：`tail -f logs/backend/$(date +%Y-%m-%d).log`

**为什么看不到 print 输出？**
- 如果查看 `YYYY-MM-DD.log`，看不到 `print()` 语句的输出
- `print()` 输出被重定向到 `backend.log`
- **建议：调试时查看 `backend.log`，查看业务日志时查看 `YYYY-MM-DD.log`**

典型日志输出：
```
[分块优化] 原始分块数: 10, 优化后: 6
========== [并行处理] 开始并行处理 ==========
[并行处理] 第 1/6 块完成，耗时: 2.16秒
========== [并行处理] 并行处理完成 ==========
总耗时: 5.13秒，并行效率提升: 4.6x
```