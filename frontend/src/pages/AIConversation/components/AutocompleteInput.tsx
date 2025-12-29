import { ChevronRight } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  suggestions?: string[]
  label?: string
  required?: boolean
  className?: string
}

/**
 * 带自动补全的输入框组件
 * 支持 Tab 键快速补全建议
 */
export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  suggestions = [],
  label,
  required = false,
  className = ''
}) => {
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // 根据当前输入值过滤建议
  const filteredSuggestions = suggestions.filter(s => 
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  ).slice(0, 5)

  // 获取第一个匹配的建议
  const nextSuggestion = filteredSuggestions[activeSuggestionIndex] || filteredSuggestions[0]

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && nextSuggestion) {
      e.preventDefault()
      onChange(nextSuggestion)
      setShowSuggestion(false)
      setActiveSuggestionIndex(0)
    } else if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestion(true)
      setActiveSuggestionIndex((prev) => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestion(true)
      setActiveSuggestionIndex((prev) => 
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      )
    } else if (e.key === 'Enter') {
      if (nextSuggestion) {
        e.preventDefault()
        onChange(nextSuggestion)
        setShowSuggestion(false)
        setActiveSuggestionIndex(0)
      }
    }
  }

  const handleChange = (newValue: string) => {
    onChange(newValue)
    setShowSuggestion(newValue.length > 0 && filteredSuggestions.length > 0)
    setActiveSuggestionIndex(0)
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestion(false)
    setActiveSuggestionIndex(0)
  }

  // 当 suggestions 变化时重置建议
  useEffect(() => {
    setActiveSuggestionIndex(0)
  }, [suggestions])

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestion(value.length > 0 && filteredSuggestions.length > 0)}
          onBlur={() => {
            setShowSuggestion(false)
            onBlur?.()
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-gray-50/50 ${className}`}
        />

        {/* Tab 补全提示 */}
        {nextSuggestion && value && !showSuggestion && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center px-4 pointer-events-none">
            <span className="text-transparent bg-clip-text">{value}</span>
            <span className="text-gray-400 ml-0">{nextSuggestion.slice(value.length)}</span>
          </div>
        )}

        {/* 建议下拉框 */}
        {showSuggestion && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20 py-1">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={`w-full px-4 py-2 text-left flex items-center justify-between group transition-colors ${
                  index === activeSuggestionIndex
                    ? 'bg-blue-50 text-blue-600'
                    : 'hover:bg-gray-50 text-gray-700 hover:text-blue-600'
                }`}
              >
                <span>{suggestion}</span>
                {index === activeSuggestionIndex && (
                  <ChevronRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            ))}
            <div className="px-4 py-1.5 text-xs text-gray-500 border-t border-gray-100">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-mono">Tab</kbd>
              <span className="ml-2">快速补全</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

