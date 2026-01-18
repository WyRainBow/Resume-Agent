// 尝试通过 Pages 项目获取 Account ID 的辅助脚本
const fetch = require('node-fetch')

const CF_API_TOKEN = process.env.CF_API_TOKEN
const CF_PAGES_PROJECT_NAME = process.env.CF_PAGES_PROJECT_NAME || 'resume-agent-staging'

// 常见的 Account ID 位置（需要替换）
// 你可以尝试在 Cloudflare 控制面板中查找
async function tryFindAccountId() {
  console.log('正在尝试查找 Account ID...')
  console.log('')
  console.log('提示：Account ID 通常在以下位置：')
  console.log('1. Workers & Pages 项目的 URL 中（/accounts/{account_id}/pages）')
  console.log('2. 域名概览页面的右侧边栏')
  console.log('3. 浏览器开发者工具的 Network 请求中')
  console.log('')
  console.log('如果你能访问项目设置页面，请查看浏览器地址栏的 URL')
}

tryFindAccountId()
