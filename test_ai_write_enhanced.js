/**
 * 测试优化后的 AI 帮写功能
 * 验证生成内容是否符合新的格式要求
 */

const API_BASE = 'http://localhost:8000'

// 测试用例
const testCases = [
  {
    name: '计算机专业（本科）',
    educationData: {
      school: '清华大学',
      major: '计算机科学与技术',
      degree: '本科',
      gpa: '3.8',
      startDate: '2020.09',
      endDate: '2024.06'
    }
  },
  {
    name: '金融专业（本科）',
    educationData: {
      school: '北京大学',
      major: '金融学',
      degree: '本科',
      gpa: '3.6',
      startDate: '2020.09',
      endDate: '2024.06'
    }
  },
  {
    name: '软件工程（本科）',
    educationData: {
      school: '华南理工大学',
      major: '软件工程',
      degree: '本科',
      gpa: '3.5',
      startDate: '2021.09',
      endDate: '2025.06'
    }
  }
]

// 构建提示词（复制自 AIWriteDialog.tsx 的逻辑）
function getDegreeStrategy(degree) {
  const lowerDegree = degree?.toLowerCase() || ''
  
  if (lowerDegree.includes('博士') || lowerDegree.includes('phd')) {
    return {
      focus: '研究方向、学术贡献、发表论文',
      prompt: `请侧重描述研究方向和学术成果。必须包括：
        1. 主修课程（6-8门核心课程，用顿号分隔）
        2. 研究领域和主要研究课题
        3. 学术发表或科研项目参与（如有）
        4. 研究方法或专业工具掌握情况`
    }
  }
  
  if (lowerDegree.includes('硕士') || lowerDegree.includes('master')) {
    return {
      focus: '研究方向、项目经验、专业深度',
      prompt: `请侧重描述专业深度和研究能力。必须包括：
        1. 主修课程（6-8门核心研究生课程，用顿号分隔）
        2. 研究方向或专业领域
        3. 项目或研究经历（具体描述项目内容和成果）
        4. 学术成果或论文（如有）`
    }
  }
  
  if (lowerDegree.includes('专科') || lowerDegree.includes('大专')) {
    return {
      focus: '实践技能、职业资格、实训经历',
      prompt: `请侧重描述实践技能和职业能力。必须包括：
        1. 主修课程（5-7门专业技能课程，用顿号分隔）
        2. 实训或实习经历（具体项目和实践内容）
        3. 职业资格证书（如有）
        4. 动手能力和项目经验（具体成果）`
    }
  }
  
  // 默认本科
  return {
    focus: '核心课程、实践经历、综合能力',
    prompt: `请侧重描述专业基础和综合能力。必须包括：
      1. 主修课程（6-8门核心专业课程，用顿号分隔）
      2. 课程设计或项目经验（具体描述项目内容、使用的技术、实现的功能）
      3. 竞赛、实习或社团经历（如有，描述具体成果或成就）
      4. 额外能力（如英语能力、辅修课程、技能证书等）`
  }
}

function buildPrompt(data, regenerateCount = 0) {
  const { school, major, degree, gpa, startDate, endDate } = data
  const strategy = getDegreeStrategy(degree || '')
  
  // 判断 GPA 是否较高
  let gpaHighlight = ''
  if (gpa) {
    const gpaNum = parseFloat(gpa.replace(/[^0-9.]/g, ''))
    if (gpaNum >= 3.5 || gpaNum >= 85) {
      gpaHighlight = `（GPA ${gpa} 表现优异，请特别强调）`
    }
  }
  
  return `你是一个专业的简历顾问，请为以下教育经历生成一段丰富、具体、有说服力的补充说明。

用户教育信息：
- 学校：${school || '未填写'}
- 专业：${major || '未填写'}
- 学位：${degree || '本科'}
- GPA：${gpa || '未填写'}${gpaHighlight}
- 在校时间：${startDate || '未填写'} - ${endDate || '未填写'}

${strategy.prompt}

**严格要求：**
1. 使用 HTML 格式输出，必须使用无序列表 <ul><li> 格式，共三行
2. **格式要求**：
   - 第一行：主修课程（用"主修课程："开头，后面用顿号分隔6-8门核心课程）
   - 第二行：实践经历或项目经验（具体描述项目、使用的技术、实现的功能）
   - 第三行：额外能力或成就（如英语能力、辅修课程、竞赛获奖、证书等）
3. **内容要求**：
   - 实践经历要具体，包括项目名称、使用的技术栈、实现的功能（可以用推演数据，但要标注"推演"）
   - 内容要真实可信，基于专业领域的真实常见课程和项目类型
   - 不要编造具体的奖项名称，但可以描述奖项类型和级别
4. **字数要求**：总字数严格控制在 140-160 字，每行约 45-55 字
5. **语言风格**：简洁专业，突出核心竞争力，每句话都要有价值

**输出格式示例（计算机专业）：**
<ul>
<li>主修课程：数据结构、算法设计、操作系统、计算机网络、数据库系统、软件工程、人工智能基础</li>
<li>参与计算机专业课程设计，完成基于Java的图书管理系统开发，实现用户管理、图书检索等核心功能</li>
<li>通过大学英语四级考试，具备良好的英文文献阅读能力，可独立查阅计算机领域专业资料</li>
</ul>

**输出格式示例（金融专业）：**
<ul>
<li>主修课程：货币银行学、国际金融、投资学、公司金融、金融市场学、金融工程、计量经济学、金融风险管理</li>
<li>系统学习金融理论与实务知识，参与模拟炒股大赛获校级三等奖，累计收益率达18%（推演）</li>
<li>辅修数据分析课程，掌握Python金融数据分析工具，完成3份行业研究报告（如：2023年消费金融趋势分析）</li>
</ul>

请直接输出 HTML 内容，不要添加任何解释或 markdown 代码块标记。确保严格按照格式要求，总字数控制在 140-160 字。`
}

// 测试函数
async function testAIWrite(testCase) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`测试用例：${testCase.name}`)
  console.log(`教育信息：${testCase.educationData.school} - ${testCase.educationData.major} (${testCase.educationData.degree})`)
  console.log(`${'='.repeat(60)}\n`)

  const prompt = buildPrompt(testCase.educationData)
  
  // 构造 mock resume 对象
  const mockResume = {
    basic: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      blog: '',
      avatar: '',
      employementStatus: '',
      personalSummary: ''
    },
    education: [{
      id: 'test-edu-id',
      school: testCase.educationData.school || '',
      major: testCase.educationData.major || '',
      degree: testCase.educationData.degree || '',
      startDate: testCase.educationData.startDate || '',
      endDate: testCase.educationData.endDate || '',
      gpa: testCase.educationData.gpa || '',
      description: '',
    }],
    experience: [],
    projects: [],
    openSource: [],
    awards: [],
    skillContent: '',
    menuSections: [],
    customData: {}
  }

  try {
    console.log('📤 发送请求到后端...')
    const startTime = Date.now()
    
    const response = await fetch(`${API_BASE}/api/resume/rewrite/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'deepseek',
        resume: mockResume,
        path: 'education[0].description',
        instruction: prompt
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let chunkCount = 0

    console.log('📥 接收流式响应...\n')
    console.log('生成内容：')
    console.log('-'.repeat(60))

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              fullContent += parsed.content
              process.stdout.write(parsed.content)
              chunkCount++
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n' + '-'.repeat(60))
    console.log(`\n✅ 生成完成！`)
    console.log(`⏱️  耗时：${duration} 秒`)
    console.log(`📊 内容长度：${fullContent.length} 字符`)
    console.log(`📦 接收块数：${chunkCount}`)

    // 验证内容格式
    console.log('\n📋 格式验证：')
    const hasMainCourses = fullContent.includes('主修课程')
    const hasProjectExperience = /项目|设计|开发|实现|完成/.test(fullContent)
    const hasExtraAbility = /英语|辅修|证书|竞赛|能力/.test(fullContent)
    const hasCommaSeparated = /主修课程：.*、.*、/.test(fullContent)
    const hasUnorderedList = /<ul>.*<li>.*<\/li>.*<\/ul>/s.test(fullContent)
    const liCount = (fullContent.match(/<li>/g) || []).length
    const wordCount = fullContent.replace(/<[^>]*>/g, '').length

    console.log(`  ✓ 包含"主修课程"：${hasMainCourses ? '✅' : '❌'}`)
    console.log(`  ✓ 包含项目经验：${hasProjectExperience ? '✅' : '❌'}`)
    console.log(`  ✓ 包含额外能力：${hasExtraAbility ? '✅' : '❌'}`)
    console.log(`  ✓ 课程用顿号分隔：${hasCommaSeparated ? '✅' : '❌'}`)
    console.log(`  ✓ 使用无序列表格式：${hasUnorderedList ? '✅' : '❌'}`)
    console.log(`  ✓ 列表项数量（应为3）：${liCount === 3 ? '✅' : `❌ (实际: ${liCount}项)`}`)
    console.log(`  ✓ 字数范围（140-160字）：${wordCount >= 140 && wordCount <= 160 ? '✅' : `❌ (实际: ${wordCount}字)`}`)

  } catch (error) {
    console.error(`\n❌ 测试失败：`, error.message)
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('\n🚀 开始测试优化后的 AI 帮写功能\n')
  console.log('提示：确保后端服务正在运行 (http://localhost:8000)\n')

  for (const testCase of testCases) {
    await testAIWrite(testCase)
    // 等待一下再测试下一个
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  console.log('\n' + '='.repeat(60))
  console.log('✨ 所有测试完成！')
  console.log('='.repeat(60) + '\n')
}

// 执行测试
runAllTests().catch(console.error)

