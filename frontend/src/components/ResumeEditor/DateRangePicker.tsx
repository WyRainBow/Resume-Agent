/**
 * 时间范围选择器（开始 - 结束）
 */
import React from 'react'
import type { DateRangePickerProps } from './types'
import { YearMonthPicker } from './YearMonthPicker'

export function DateRangePicker({
  value,
  onChange,
}: DateRangePickerProps) {
  // 解析时间范围（格式如 "2022-05-2023-10" 或 "2022.05 - 2023.10" 或 "2022-05-至今"）
  const parseRange = (val: string) => {
    if (!val) return { start: '', end: '' }
    
    // 尝试匹配各种格式
    const patterns = [
      /(\d{4}[-./]\d{1,2})[\s]*[-–~至]+[\s]*(\d{4}[-./]\d{1,2}|至今|现在|present)/i,
      /(\d{4}[-./]\d{1,2})[\s]*[-–~至]+[\s]*/,
      /(\d{4})[\s]*[-–~至]+[\s]*(\d{4}|至今|现在|present)/i,
    ]
    
    for (const pattern of patterns) {
      const match = val.match(pattern)
      if (match) {
        return { 
          start: match[1]?.replace(/[./]/g, '-') || '', 
          end: match[2]?.replace(/[./]/g, '-') || '' 
        }
      }
    }
    
    // 如果只有一个日期
    const singleMatch = val.match(/(\d{4}[-./]?\d{0,2})/)
    if (singleMatch) {
      return { start: singleMatch[1].replace(/[./]/g, '-'), end: '' }
    }
    
    return { start: '', end: '' }
  }

  const { start, end } = parseRange(value)
  
  const handleStartChange = (newStart: string) => {
    if (newStart && end) {
      onChange(`${newStart}-${end}`)
    } else if (newStart) {
      onChange(newStart)
    } else {
      onChange(end || '')
    }
  }
  
  const handleEndChange = (newEnd: string) => {
    if (start && newEnd) {
      onChange(`${start}-${newEnd}`)
    } else if (start) {
      onChange(`${start}-${newEnd || ''}`)
    } else {
      onChange('')
    }
  }

  const checkboxStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>开始</div>
          <YearMonthPicker value={start} onChange={handleStartChange} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', paddingTop: '18px' }}>→</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>结束</span>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={end === '至今'}
                onChange={(e) => handleEndChange(e.target.checked ? '至今' : '')}
                style={{ width: '14px', height: '14px', accentColor: '#a78bfa' }}
              />
              至今
            </label>
          </div>
          <YearMonthPicker 
            value={end === '至今' ? '' : end} 
            onChange={handleEndChange}
            style={{ opacity: end === '至今' ? 0.5 : 1 }}
          />
        </div>
      </div>
    </div>
  )
}
