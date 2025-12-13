import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 创建日志目录和文件
const logsDir = path.resolve(__dirname, '../logs/frontend')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const today = new Date().toISOString().split('T')[0]
const logFile = path.join(logsDir, `${today}.log`)

// 自定义 logger，同时输出到控制台和文件
const customLogger = createLogger()
const originalInfo = customLogger.info
const originalWarn = customLogger.warn
const originalError = customLogger.error

const writeToLog = (level: string, msg: string) => {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0]
  const logLine = `[${timestamp}] [${level}] ${msg}\n`
  fs.appendFileSync(logFile, logLine)
}

customLogger.info = (msg, options) => {
  writeToLog('INFO', msg)
  originalInfo(msg, options)
}

customLogger.warn = (msg, options) => {
  writeToLog('WARN', msg)
  originalWarn(msg, options)
}

customLogger.error = (msg, options) => {
  writeToLog('ERROR', msg)
  originalError(msg, options)
}

// 启动时记录日志
writeToLog('INFO', '========== 前端服务启动 ==========')
writeToLog('INFO', `日志文件: ${logFile}`)

export default defineConfig({
  plugins: [react()],
  customLogger,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  }
})

