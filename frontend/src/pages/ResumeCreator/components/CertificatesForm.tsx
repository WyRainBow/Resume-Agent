import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, Send, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AwardItem {
  title: string
  date: string
  awarder: string
  summary: string
}

export interface CertificateItem {
  name: string
  date: string
  issuer: string
  url: string
}

interface CertificatesFormProps {
  onSkip: () => void
  onSubmit: (awards: string[], certificates: string[]) => void
}

export const CertificatesForm: React.FC<CertificatesFormProps> = ({ onSkip, onSubmit }) => {
  const [awardInput, setAwardInput] = useState('')
  const [certInput, setCertInput] = useState('')
  const [selectedAwards, setSelectedAwards] = useState<string[]>([])
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])

  const recommendedAwards = [
    "清华大学优秀学生奖学金",
    "国家奖学金",
    "ACM程序设计竞赛奖项",
    "全国大学生数学建模竞赛奖项",
    "中国大学生计算机设计大赛奖项"
  ]

  const recommendedCerts = [
    "OCP Oracle Certified Professional Java SE Programmer",
    "CKA Certified Kubernetes Administrator",
    "AWS Certified Developer - Associate",
    "Microsoft Certified: Azure Developer Associate",
    "阿里巴巴认证: Java高级工程师",
    "Spring Cloud Alibaba高级开发者认证",
    "腾讯云TCA云原生高级工程师认证"
  ]

  const toggleItem = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item))
    } else {
      setList([...list, item])
    }
  }

  const handleAddAward = (e?: React.KeyboardEvent) => {
    if ((!e || e.key === 'Enter') && awardInput.trim()) {
      if (!selectedAwards.includes(awardInput.trim())) {
        setSelectedAwards([...selectedAwards, awardInput.trim()])
      }
      setAwardInput('')
    }
  }

  const handleAddCert = (e?: React.KeyboardEvent) => {
    if ((!e || e.key === 'Enter') && certInput.trim()) {
      if (!selectedCerts.includes(certInput.trim())) {
        setSelectedCerts([...selectedCerts, certInput.trim()])
      }
      setCertInput('')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 w-full max-w-xl"
    >
      {/* 头部引导 */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Award className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h3 className="text-[19px] font-bold text-gray-900 mb-2">展示你的资格证书和荣誉奖项</h3>
          <p className="text-gray-500 text-[15px] leading-relaxed">每一份证书和奖项都是你专业能力的证明，让我们一起为你的简历增添亮点</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* 奖项部分 */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl border border-gray-100 bg-gray-50/30 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <AnimatePresence>
              {selectedAwards.map((award) => (
                <motion.div
                  key={award}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-medium"
                >
                  {award}
                  <button onClick={() => toggleItem(award, selectedAwards, setSelectedAwards)} className="hover:bg-blue-700 rounded-full p-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <input
              type="text"
              value={awardInput}
              onChange={(e) => setAwardInput(e.target.value)}
              onKeyDown={handleAddAward}
              placeholder="请选择或输入奖项名称"
              className="flex-1 min-w-[150px] bg-transparent outline-none text-gray-700 py-1"
            />
          </div>
          
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-500">推荐奖项:</p>
            <div className="flex flex-wrap gap-2">
              {recommendedAwards.map((award) => {
                const isSelected = selectedAwards.includes(award)
                return (
                  <button
                    key={award}
                    onClick={() => toggleItem(award, selectedAwards, setSelectedAwards)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border transition-all text-xs font-medium",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:bg-gray-50"
                    )}
                  >
                    {award}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 证书部分 */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl border border-gray-100 bg-gray-50/30 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <AnimatePresence>
              {selectedCerts.map((cert) => (
                <motion.div
                  key={cert}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-medium"
                >
                  {cert}
                  <button onClick={() => toggleItem(cert, selectedCerts, setSelectedCerts)} className="hover:bg-blue-700 rounded-full p-0.5 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            <input
              type="text"
              value={certInput}
              onChange={(e) => setCertInput(e.target.value)}
              onKeyDown={handleAddCert}
              placeholder="请选择或输入证书名称"
              className="flex-1 min-w-[150px] bg-transparent outline-none text-gray-700 py-1"
            />
          </div>
          
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-500">推荐证书:</p>
            <div className="flex flex-wrap gap-2">
              {recommendedCerts.map((cert) => {
                const isSelected = selectedCerts.includes(cert)
                return (
                  <button
                    key={cert}
                    onClick={() => toggleItem(cert, selectedCerts, setSelectedCerts)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border transition-all text-xs font-medium",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:bg-gray-50"
                    )}
                  >
                    {cert}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={onSkip}
            className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold text-[16px] transition-all"
          >
            暂时跳过
          </button>
          <button
            onClick={() => (selectedAwards.length > 0 || selectedCerts.length > 0) && onSubmit(selectedAwards, selectedCerts)}
            disabled={selectedAwards.length === 0 && selectedCerts.length === 0}
            className={cn(
              "flex-[2] py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all shadow-lg",
              (selectedAwards.length > 0 || selectedCerts.length > 0)
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
            )}
          >
            <Send className="w-4 h-4 transform rotate-45" />
            提交
          </button>
        </div>
      </div>
    </motion.div>
  )
}

