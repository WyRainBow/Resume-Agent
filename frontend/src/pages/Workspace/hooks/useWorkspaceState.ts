/**
 * Workspace 状态管理 Hook
 * 集中管理所有工作区状态
 */
import { useState, useRef } from 'react'
import type { Resume } from '../../../types/resume'

export interface WorkspaceState {
  // 简历数据
  resume: Resume | null
  setResume: React.Dispatch<React.SetStateAction<Resume | null>>
  currentResumeId: string | null
  setCurrentResumeId: React.Dispatch<React.SetStateAction<string | null>>
  lastImportedText: string
  setLastImportedText: React.Dispatch<React.SetStateAction<string>>
  
  // PDF 状态
  pdfBlob: Blob | null
  setPdfBlob: React.Dispatch<React.SetStateAction<Blob | null>>
  loadingPdf: boolean
  setLoadingPdf: React.Dispatch<React.SetStateAction<boolean>>
  pdfDirty: boolean
  setPdfDirty: React.Dispatch<React.SetStateAction<boolean>>
  
  // UI 状态
  showEditor: boolean
  setShowEditor: React.Dispatch<React.SetStateAction<boolean>>
  showGuide: boolean
  setShowGuide: React.Dispatch<React.SetStateAction<boolean>>
  showResumeList: boolean
  setShowResumeList: React.Dispatch<React.SetStateAction<boolean>>
  showAIImport: boolean
  setShowAIImport: React.Dispatch<React.SetStateAction<boolean>>
  optimizing: boolean
  setOptimizing: React.Dispatch<React.SetStateAction<boolean>>
  previewMode: 'live' | 'pdf'
  setPreviewMode: React.Dispatch<React.SetStateAction<'live' | 'pdf'>>
  previewScale: number
  setPreviewScale: React.Dispatch<React.SetStateAction<number>>
  
  // 右侧面板状态 - AI 流式输出
  rightView: 'pdf' | 'ai-output'
  setRightView: React.Dispatch<React.SetStateAction<'pdf' | 'ai-output'>>
  aiOutput: string
  setAiOutput: React.Dispatch<React.SetStateAction<string>>
  aiGenerating: boolean
  setAiGenerating: React.Dispatch<React.SetStateAction<boolean>>
  aiGeneratingStatus: 'idle' | 'streaming' | 'parsing' | 'done' | 'error'
  setAiGeneratingStatus: React.Dispatch<React.SetStateAction<'idle' | 'streaming' | 'parsing' | 'done' | 'error'>>
  pendingResumeJson: Resume | null
  setPendingResumeJson: React.Dispatch<React.SetStateAction<Resume | null>>
  
  // 布局状态
  leftPanelWidth: number | null
  setLeftPanelWidth: React.Dispatch<React.SetStateAction<number | null>>
  isDragging: boolean
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>
  currentSectionOrder: string[]
  setCurrentSectionOrder: React.Dispatch<React.SetStateAction<string[]>>
  
  // 其他
  initialInstruction: string | null
  setInitialInstruction: React.Dispatch<React.SetStateAction<string | null>>
  
  // Refs
  previewRef: React.RefObject<HTMLDivElement>
  containerRef: React.RefObject<HTMLDivElement>
  autoSaveTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  previewDebounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

export const DEFAULT_SECTION_ORDER = ['education', 'experience', 'projects', 'opensource', 'skills', 'awards', 'summary']

export function useWorkspaceState(): WorkspaceState {
  // 简历数据
  const [resume, setResume] = useState<Resume | null>(null)
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null)
  const [lastImportedText, setLastImportedText] = useState('')
  
  // PDF 状态
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [pdfDirty, setPdfDirty] = useState(false)
  
  // UI 状态
  const [showEditor, setShowEditor] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [showResumeList, setShowResumeList] = useState(false)
  const [showAIImport, setShowAIImport] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [previewMode, setPreviewMode] = useState<'live' | 'pdf'>('pdf')
  const [previewScale, setPreviewScale] = useState(1.0)
  
  // 右侧面板状态 - AI 流式输出
  const [rightView, setRightView] = useState<'pdf' | 'ai-output'>('pdf')
  const [aiOutput, setAiOutput] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiGeneratingStatus, setAiGeneratingStatus] = useState<'idle' | 'streaming' | 'parsing' | 'done' | 'error'>('idle')
  const [pendingResumeJson, setPendingResumeJson] = useState<Resume | null>(null)
  
  // 布局状态
  const [leftPanelWidth, setLeftPanelWidth] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentSectionOrder, setCurrentSectionOrder] = useState<string[]>([])
  
  // 其他
  const [initialInstruction, setInitialInstruction] = useState<string | null>(null)
  
  // Refs
  const previewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  return {
    resume, setResume,
    currentResumeId, setCurrentResumeId,
    lastImportedText, setLastImportedText,
    pdfBlob, setPdfBlob,
    loadingPdf, setLoadingPdf,
    pdfDirty, setPdfDirty,
    showEditor, setShowEditor,
    showGuide, setShowGuide,
    showResumeList, setShowResumeList,
    showAIImport, setShowAIImport,
    optimizing, setOptimizing,
    previewMode, setPreviewMode,
    previewScale, setPreviewScale,
    rightView, setRightView,
    aiOutput, setAiOutput,
    aiGenerating, setAiGenerating,
    aiGeneratingStatus, setAiGeneratingStatus,
    pendingResumeJson, setPendingResumeJson,
    leftPanelWidth, setLeftPanelWidth,
    isDragging, setIsDragging,
    currentSectionOrder, setCurrentSectionOrder,
    initialInstruction, setInitialInstruction,
    previewRef,
    containerRef,
    autoSaveTimer,
    previewDebounceRef,
  }
}
