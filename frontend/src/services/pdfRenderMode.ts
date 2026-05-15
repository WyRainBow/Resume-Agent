export type PDFRenderMode = 'local' | 'remote'

const STORAGE_KEY = 'pdf-render-mode-v1'

export function getStoredPDFRenderMode(): PDFRenderMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'remote' ? 'remote' : 'local'
  } catch {
    return 'local'
  }
}

export function setStoredPDFRenderMode(mode: PDFRenderMode): void {
  localStorage.setItem(STORAGE_KEY, mode)
}
