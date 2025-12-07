import React, { useState, useCallback } from 'react';
import ChatPanel from './components/ChatPanel';
import PDFPane from './components/PDFPane';
import type { Resume } from './types/resume';
import { renderPDF } from './services/api';

function App() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleResumeChange = useCallback(async (newResume: Resume) => {
    setResume(newResume);
    setLoadingPdf(true);
    try {
      /* AI 生成的简历，使用 demo=false，确保使用 AI 返回的数据 */
      const blob = await renderPDF(newResume, false);
      setPdfBlob(blob);
    } catch (error) {
      console.error('Failed to render PDF:', error);
      alert('PDF 渲染失败，请检查后端服务是否正常。');
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  /* 加载 demo 模板，使用 demo=true，使用固定的 test_resume_demo.json */
  const handleLoadDemo = useCallback(async () => {
    setLoadingPdf(true);
    try {
      const blob = await renderPDF({} as Resume, true);
      setPdfBlob(blob);
    } catch (error) {
      console.error('Failed to load demo PDF:', error);
      alert('Demo PDF 加载失败，请检查后端服务是否正常。');
    } finally {
      setLoadingPdf(false);
    }
  }, []);

  return (
    <div 
      className="main-container"
      style={{ 
        display: 'flex', 
        height: '100vh',
        width: '100vw',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 紫色渐变背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 20s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        animation: 'float 15s ease-in-out infinite reverse'
      }} />
      
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(30px, -30px) rotate(5deg); }
        }
        @media (max-width: 768px) {
          .main-container {
            flex-direction: column !important;
          }
          .left-panel {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            max-height: 50vh;
          }
          .right-panel {
            width: 100% !important;
            flex: 1 !important;
          }
        }
        @media (max-width: 480px) {
          .left-panel {
            max-height: 40vh;
          }
        }
      `}</style>

      <div 
        className="left-panel"
        style={{ 
          width: '35%', 
          minWidth: '320px',
          maxWidth: '500px',
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <ChatPanel onResume={handleResumeChange} onLoadDemo={handleLoadDemo} />
      </div>
      <div 
        className="right-panel"
        style={{ 
          flex: 1, 
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}
      >
        {loadingPdf && (
          <div style={{
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(102, 126, 234, 0.8)', 
            backdropFilter: 'blur(5px)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 10,
            color: 'white',
            fontSize: '18px',
            fontWeight: 600
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderTop: '4px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              正在生成 PDF...
            </div>
          </div>
        )}
        <PDFPane pdfBlob={pdfBlob} />
      </div>
    </div>
  );
}

export default App;
