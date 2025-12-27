import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, Copy, Eye, Calendar } from 'lucide-react'
import { PDFViewer } from '../../components/PDFEditor/PDFViewer'

interface SharedResume {
  success: boolean
  data: Record<string, any>
  name: string
  expires_at: string
  views: number
}

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>()
  const navigate = useNavigate()
  const [resume, setResume] = useState<SharedResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchSharedResume = async () => {
      try {
        const response = await fetch(`/api/resume/share/${shareId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('分享链接不存在或已过期')
          } else {
            setError('获取简历失败')
          }
          return
        }

        const data = await response.json()
        setResume(data)
      } catch (err) {
        console.error('获取分享简历失败:', err)
        setError('获取简历失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    if (shareId) {
      fetchSharedResume()
    }
  }, [shareId])

  const handleDownloadPDF = () => {
    if (resume) {
      // 调用 PDF 生成函数
      const element = document.getElementById('resume-preview')
      if (element) {
        const html2pdf = window.html2pdf
        html2pdf.set({
          margin: 10,
          filename: `${resume.name}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        }).from(element).save()
      }
    }
  }

  const handleCopyLink = async () => {
    const currentUrl = window.location.href
    await navigator.clipboard.writeText(currentUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载简历...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">出错了</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (!resume) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{resume.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{resume.views} 次查看</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>到期时间: {new Date(resume.expires_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {/* 复制链接按钮 */}
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {copied ? '已复制' : '复制链接'}
              </button>

              {/* 下载 PDF 按钮 */}
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                下载 PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 简历内容 */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div id="resume-preview" className="bg-white rounded-lg shadow-lg p-10">
          {/* 简历渲染组件 */}
          <ResumePreview data={resume.data} />
        </div>
      </div>

      {/* 底部提示 */}
      <div className="bg-blue-50 border-t border-blue-200 py-6 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-600">
            这是一份通过分享链接查看的简历。
            <br />
            链接将在 {new Date(resume.expires_at).toLocaleDateString()} 后失效。
          </p>
        </div>
      </div>
    </div>
  )
}

// 简历预览组件
function ResumePreview({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-8">
      {/* 姓名和联系方式 */}
      {data.name && (
        <div className="text-center pb-6 border-b-2 border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{data.name}</h1>
          {data.contact && (
            <div className="flex items-center justify-center gap-6 text-gray-600">
              {data.contact.phone && <span>📞 {data.contact.phone}</span>}
              {data.contact.email && <span>📧 {data.contact.email}</span>}
            </div>
          )}
        </div>
      )}

      {/* 求职意向 */}
      {data.summary && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">求职意向</h2>
          <p className="text-gray-700">{data.summary}</p>
        </div>
      )}

      {/* 教育经历 */}
      {data.education && data.education.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">教育经历</h2>
          <div className="space-y-3">
            {data.education.map((edu: any, idx: number) => (
              <div key={idx}>
                <div className="font-bold text-gray-900">
                  {edu.title}
                  {edu.subtitle && ` - ${edu.subtitle}`}
                </div>
                <div className="text-sm text-gray-600">{edu.date}</div>
                {edu.details && (
                  <ul className="list-disc list-inside text-gray-700 mt-1">
                    {edu.details.map((detail: string, i: number) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 工作经历 */}
      {data.experience && data.experience.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">工作经历</h2>
          <div className="space-y-4">
            {data.experience.map((exp: any, idx: number) => (
              <div key={idx}>
                <div className="font-bold text-gray-900">
                  {exp.title}
                  {exp.subtitle && ` - ${exp.subtitle}`}
                </div>
                <div className="text-sm text-gray-600">{exp.date}</div>
                {exp.highlights && (
                  <ul className="list-disc list-inside text-gray-700 mt-2">
                    {exp.highlights.map((highlight: string, i: number) => (
                      <li key={i}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 项目经历 */}
      {data.projects && data.projects.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">项目经历</h2>
          <div className="space-y-4">
            {data.projects.map((proj: any, idx: number) => (
              <div key={idx}>
                <div className="font-bold text-gray-900">
                  {proj.title}
                  {proj.subtitle && ` - ${proj.subtitle}`}
                </div>
                <div className="text-sm text-gray-600">{proj.date}</div>
                {proj.description && (
                  <p className="text-gray-700 mt-2">{proj.description}</p>
                )}
                {proj.highlights && (
                  <ul className="list-disc list-inside text-gray-700 mt-2">
                    {proj.highlights.map((highlight: string, i: number) => (
                      <li key={i}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 技能 */}
      {data.skills && data.skills.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">技能</h2>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((skill: any, idx: number) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {typeof skill === 'string' ? skill : `${skill.category}: ${skill.details}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 奖项 */}
      {data.awards && data.awards.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3">奖项</h2>
          <ul className="list-disc list-inside space-y-1">
            {data.awards.map((award: any, idx: number) => (
              <li key={idx} className="text-gray-700">
                {typeof award === 'string' ? award : award.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

