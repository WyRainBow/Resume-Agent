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
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use('/api/test', (req, res, next) => {
          if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'ok', 
              message: 'API测试成功',
              timestamp: new Date().toISOString()
            }));
            return;
          }
          next();
        });
        
        server.middlewares.use('/switch-main', (req, res, next) => {
          if (req.method === 'GET') {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const entry = url.searchParams.get('entry');
            
            // 读取index.html
            const fs = require('fs');
            const path = require('path');
            const indexPath = path.resolve(__dirname, 'index.html');
            let indexContent = fs.readFileSync(indexPath, 'utf8');
            
            // 根据entry参数修改script标签
            if (entry === 'simple') {
              indexContent = indexContent.replace('src="/src/main.tsx"', 'src="/src/main-simple.tsx"');
            } else {
              indexContent = indexContent.replace('src="/src/main-simple.tsx"', 'src="/src/main.tsx"');
            }
            
            // 写回index.html
            fs.writeFileSync(indexPath, indexContent);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'ok', 
              message: entry === 'simple' ? '已切换到简化版主入口' : '已切换到原始主入口',
              entry
            }));
            return;
          }
          next();
        });
        
        server.middlewares.use('/restart-frontend', (req, res, next) => {
          if (req.method === 'GET') {
            // 这里只是返回成功，实际重启需要外部操作
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'ok', 
              message: '重启请求已发送，请手动重启前端服务'
            }));
            return;
          }
          next();
        });
      }
    }
  ],
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
        target: 'http://localhost:9000',
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

