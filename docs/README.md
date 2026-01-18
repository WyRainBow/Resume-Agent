# AI 简历项目文档

本文档目录包含 AI 简历项目的所有技术文档、设计文档和使用指南。

## 📂 目录结构

```
docs/
├── README.md                          # 本文档（文档导航）
│
├── AI 简历文档/                        # AI 简历项目文档（26 个文档）
│   ├── Agent相关文档/                 # Agent 架构、设计、测试等
│   ├── 部署文档/                      # Railway、腾讯云部署等
│   ├── 功能测试文档/                  # 功能测试报告
│   └── ...                            # 其他项目文档
│
├── images/                            # 图片资源
│   ├── AI对话生成简历.png
│   ├── 工作区.png
│   ├── 我的简历.png
│   └── 首页.png
│
├── openmanus/                         # OpenManus 合并文档
│   ├── Agent 架构/                    # Agent 架构文档
│   ├── CLTP/                          # CLTP 协议文档
│   ├── 上下文技术方案/                # 上下文工程文档
│   ├── 实现 Plan/                     # 实现计划文档
│   ├── 意图识别/                      # 意图识别机制
│   ├── 打字机效果/                    # 打字机效果实现
│   ├── 提示词技术文档/                # 提示词工程
│   └── ...                            # 其他 OpenManus 技术文档
│
└── research/                          # 研究文档
    └── ...
```

---

## 📖 文档导航

### 🎯 快速开始

**新手指南**：
- [AI 对话创建简历-参考分析.md](./AI%20简历文档/AI对话创建简历-参考分析.md) - 了解 AI 对话功能
- [双模板系统.md](./AI%20简历文档/双模板系统.md) - 了解 HTML 和 LaTeX 模板系统

### 🤖 Agent 相关文档

**架构设计**：
- [Agent架构设计文档.md](./Agent架构设计文档.md) - Agent 架构设计
- [Agent架构分析.md](./Agent架构分析.md) - 架构分析
- [Agent架构分析报告.md](./Agent架构分析报告.md) - 架构分析报告
- [Agent框架技术调研.md](./Agent框架技术调研.md) - 技术调研

**实现文档**：
- [Agent重构方案.md](./Agent重构方案.md) - 重构方案
- [Agent技术应用方案.md](./Agent技术应用方案.md) - 技术应用方案
- [对话式简历生成Agent实现文档.md](./对话式简历生成Agent实现文档.md) - 对话式简历生成实现

**测试报告**：
- [Agent功能测试报告.md](./Agent功能测试报告.md) - 功能测试报告
- [Agent 对话测试.md](./Agent 对话测试.md) - 对话测试
- [Agent 技术文档分析总结.md](./Agent 技术文档分析总结.md) - 技术文档分析

### 🚀 部署文档

- [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) - Railway 部署指南
- [RAILWAY_QUICK_START.md](./RAILWAY_QUICK_START.md) - Railway 快速开始
- [TENCENT_CLOUD_MIGRATION.md](./TENCENT_CLOUD_MIGRATION.md) - 腾讯云迁移指南

### 📊 功能测试文档

- [优化简历功能-测试报告.md](./优化简历功能-测试报告.md) - 简历优化功能测试
- [UP简历AI功能测试报告.md](./UP简历AI功能测试报告.md) - AI 功能测试
- [对话页面测试问题与改进方案.md](./对话页面测试问题与改进方案.md) - 对话页面测试

### 🔧 技术文档

- [AI工具封装.md](./AI工具封装.md) - AI 工具封装
- [打字机效果实现总结.md](./打字机效果实现总结.md) - 打字机效果实现
- [教育经历 AI 帮写按钮.md](./教育经历 AI 帮写按钮.md) - 教育经历 AI 帮写

### 📦 OpenManus 文档

所有 OpenManus 相关的技术文档位于 `openmanus/` 目录：

- **Agent 架构**：`openmanus/Agent 架构/`
- **CLTP 协议**：`openmanus/CLTP/`
- **上下文技术**：`openmanus/上下文技术方案/`
- **实现计划**：`openmanus/实现 Plan/`
- **意图识别**：`openmanus/意图识别/`
- **打字机效果**：`openmanus/打字机效果/`
- **提示词技术**：`openmanus/提示词技术文档/`

详见 [openmanus/README.md](./openmanus/README.md)（如有）

---

## 📝 文档维护

### 文档分类原则

1. **根目录文档**：项目级文档（架构、部署、测试等）
2. **openmanus/**：OpenManus 合并相关的技术文档
3. **images/**：图片资源
4. **research/**：研究文档

### 新增文档

添加新文档时，请遵循以下原则：
- 项目级文档放在 `docs/` 根目录
- OpenManus 相关文档放在 `docs/openmanus/`
- 图片资源放在 `docs/images/`
- 研究文档放在 `docs/research/`

---

## 🔗 相关链接

- **项目代码**：`backend/` 和 `frontend/`
- **OpenManus 文档**：`docs/openmanus/`
- **配置文件**：`config/`

---

**最后更新**：2026-01-18
