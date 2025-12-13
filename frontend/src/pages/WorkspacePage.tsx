/**
 * WorkspacePage - 简历编辑工作区
 * 
 * 此文件已重构为模块化结构
 * 代码已拆分到 ./Workspace 目录
 * 
 * 目录结构:
 * - ./Workspace/index.tsx - 主组件
 * - ./Workspace/hooks/ - 状态和逻辑 hooks
 *   - useWorkspaceState.ts - 状态管理
 *   - useResumeOperations.ts - 简历操作
 *   - usePDFOperations.ts - PDF 操作
 *   - usePanelResize.ts - 面板拖拽
 * - ./Workspace/components/ - UI 组件
 *   - Toolbar.tsx - 工具栏
 *   - PreviewToolbar.tsx - 预览工具栏
 *   - ZoomControl.tsx - 缩放控制
 *   - NavHeader.tsx - 导航头部
 *   - Divider.tsx - 分割条
 *   - LoadingOverlay.tsx - 加载遮罩
 *   - BackgroundDecoration.tsx - 背景装饰
 */

export { default } from './Workspace'
