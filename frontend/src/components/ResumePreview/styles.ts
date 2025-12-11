/**
 * ResumePreview 样式定义
 */
import type { ToolbarButton } from './types'

export const toolbarButtons: ToolbarButton[] = [
  { command: 'bold', icon: 'B', title: '加粗', style: { fontWeight: 'bold' } },
  { command: 'italic', icon: 'I', title: '斜体', style: { fontStyle: 'italic' } },
  { command: 'underline', icon: 'U', title: '下划线', style: { textDecoration: 'underline' } },
  { type: 'divider', icon: '', title: '' },
  { command: 'formatBlock', arg: 'h1', icon: 'H1', title: '一级标题' },
  { command: 'formatBlock', arg: 'h2', icon: 'H2', title: '二级标题' },
  { command: 'formatBlock', arg: 'h3', icon: 'H3', title: '三级标题' },
  { command: 'formatBlock', arg: 'p', icon: 'P', title: '正文' },
  { type: 'divider', icon: '', title: '' },
  { command: 'insertUnorderedList', icon: '•', title: '无序列表' },
  { command: 'insertOrderedList', icon: '1.', title: '有序列表' },
  { type: 'divider', icon: '', title: '' },
  { command: 'justifyLeft', icon: '☰', title: '左对齐' },
  { command: 'justifyCenter', icon: '☰', title: '居中', style: { transform: 'scaleX(0.8)' } },
  { command: 'justifyRight', icon: '☰', title: '右对齐' },
]

export const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.95)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
  },
  toolbarButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#333',
    transition: 'all 0.15s',
  },
  toolbarDivider: {
    width: '1px',
    height: '20px',
    background: 'rgba(0, 0, 0, 0.15)',
    margin: '0 4px',
  },
  scrollArea: {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    position: 'relative',
  },
  paper: {
    width: '210mm',
    minHeight: '297mm',
    height: 'auto',
    backgroundColor: 'white',
    padding: '40px 50px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 0 1px rgba(0, 0, 0, 0.1)',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontSize: '10pt',
    lineHeight: 1.4,
    color: '#333',
    boxSizing: 'border-box',
    wordBreak: 'break-word',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#525659',
  },
  placeholderText: {
    color: '#888',
    fontSize: '16px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '16px',
    borderBottom: '2px solid #333',
    paddingBottom: '12px',
  },
  name: {
    fontSize: '22pt',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  contact: {
    fontSize: '10pt',
    color: '#555',
  },
  section: {
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '12pt',
    fontWeight: 'bold',
    color: '#000',
    borderBottom: '1px solid #ccc',
    paddingBottom: '4px',
    marginBottom: '8px',
  },
  entry: {
    marginBottom: '10px',
  },
  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '4px',
  },
  entryTitle: {
    fontWeight: 'bold',
    fontSize: '10.5pt',
  },
  entrySubtitle: {
    color: '#555',
    fontSize: '10pt',
  },
  entryDate: {
    color: '#666',
    fontSize: '9pt',
    whiteSpace: 'nowrap' as const,
  },
  highlights: {
    paddingLeft: '18px',
    marginTop: '4px',
    marginBottom: 0,
  },
  highlightItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  skillsList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px 12px',
  },
  skillItem: {
    background: '#f0f0f0',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '9.5pt',
  },
  awardsList: {
    paddingLeft: '18px',
    marginTop: 0,
    marginBottom: 0,
  },
  awardItem: {
    marginBottom: '2px',
    fontSize: '9.5pt',
  },
  summaryText: {
    fontSize: '9.5pt',
    textAlign: 'justify' as const,
    margin: 0,
  },
}
