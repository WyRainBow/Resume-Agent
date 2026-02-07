/**
 * 预设公司 Logo 常量
 * Logo 图片托管在腾讯云 COS
 */

const COS_BASE_URL = 'https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com'

export interface PresetCompanyLogo {
  key: string
  name: string
  file: string       // COS 上的文件名
  keywords: string[] // 用于模糊匹配公司名称的关键词
}

export const PRESET_COMPANY_LOGOS: PresetCompanyLogo[] = [
  { key: 'bytedance', name: '字节跳动', file: '字节跳动.png', keywords: ['字节', '跳动', 'bytedance', 'tiktok', '抖音', '飞书', '头条'] },
  { key: 'tencent', name: '腾讯', file: '腾讯.png', keywords: ['腾讯', 'tencent', '微信', 'wechat', 'qq'] },
  { key: 'alibaba', name: '阿里巴巴', file: '阿里巴巴.png', keywords: ['阿里', 'alibaba', '淘宝', '天猫', '蚂蚁', '支付宝', '达摩院', '钉钉'] },
  { key: 'meituan', name: '美团', file: '美团.png', keywords: ['美团', 'meituan'] },
  { key: 'kuaishou', name: '快手', file: '快手.png', keywords: ['快手', 'kuaishou'] },
  { key: 'baidu', name: '百度', file: '百度.png', keywords: ['百度', 'baidu'] },
  { key: 'jd', name: '京东', file: '京东.png', keywords: ['京东', 'jd', 'jingdong'] },
  { key: 'huawei', name: '华为', file: '华为.png', keywords: ['华为', 'huawei'] },
  { key: 'xiaohongshu', name: '小红书', file: '小红书.png', keywords: ['小红书', 'xiaohongshu', 'red'] },
  { key: 'netease', name: '网易', file: '网易.png', keywords: ['网易', 'netease'] },
  { key: 'xiaomi', name: '小米', file: '小米.png', keywords: ['小米', 'xiaomi', 'mi'] },
  { key: 'didi', name: '滴滴', file: '滴滴.png', keywords: ['滴滴', 'didi'] },
  { key: 'pinduoduo', name: '拼多多', file: '拼多多.png', keywords: ['拼多多', 'pinduoduo', 'pdd'] },
  { key: 'bilibili', name: 'bilibili', file: 'bilibili.png', keywords: ['bilibili', 'b站', '哔哩'] },
  { key: 'antgroup', name: '蚂蚁集团', file: '蚂蚁集团.png', keywords: ['蚂蚁集团', '蚂蚁金服', 'ant'] },
  { key: 'microsoft', name: '微软', file: '微软.png', keywords: ['微软', 'microsoft', 'msft'] },
  { key: 'google', name: '谷歌', file: '谷歌.png', keywords: ['谷歌', 'google'] },
  { key: 'apple', name: '苹果', file: '苹果.png', keywords: ['苹果', 'apple'] },
]

/**
 * 根据 key 获取 Logo 的 COS URL
 */
export function getLogoUrl(key: string): string | null {
  const logo = PRESET_COMPANY_LOGOS.find(l => l.key === key)
  if (!logo) return null
  return `${COS_BASE_URL}/${encodeURIComponent(logo.file)}`
}

/**
 * 根据公司名称模糊匹配预设 Logo
 * 返回匹配到的 Logo key，未匹配返回 null
 */
export function matchCompanyLogo(companyName: string): string | null {
  if (!companyName) return null
  const lowerName = companyName.toLowerCase().replace(/\*\*/g, '') // 去除 markdown 加粗
  for (const logo of PRESET_COMPANY_LOGOS) {
    for (const keyword of logo.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return logo.key
      }
    }
  }
  return null
}

/**
 * 根据 key 获取 Logo 配置
 */
export function getLogoByKey(key: string): PresetCompanyLogo | null {
  return PRESET_COMPANY_LOGOS.find(l => l.key === key) || null
}
