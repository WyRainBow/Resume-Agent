/**
 * 布局设置组件
 * 管理模块列表的拖拽排序
 */
import { Reorder } from 'framer-motion'
import type { MenuSection } from '../types'
import LayoutItem from './LayoutItem'

interface LayoutSettingProps {
  menuSections: MenuSection[]
  activeSection: string
  setActiveSection: (id: string) => void
  toggleSectionVisibility: (id: string) => void
  updateMenuSections: (sections: MenuSection[]) => void
  reorderSections: (sections: MenuSection[]) => void
}

const LayoutSetting = ({
  menuSections,
  activeSection,
  setActiveSection,
  toggleSectionVisibility,
  updateMenuSections,
  reorderSections,
}: LayoutSettingProps) => {
  const sortedSections = [...menuSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  // 基本信息模块（固定在最上面，不可拖拽）
  const basicSection = sortedSections.find((item) => item.id === 'basic')
  // 可拖拽的模块
  const draggableSections = sortedSections.filter((item) => item.id !== 'basic')

  return (
    <div className="space-y-4 rounded-none bg-white dark:bg-neutral-900/30">
      {/* 基本信息（固定） */}
      {basicSection && (
        <LayoutItem
          item={basicSection}
          isBasic={true}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          toggleSectionVisibility={toggleSectionVisibility}
          updateMenuSections={updateMenuSections}
          menuSections={sortedSections}
        />
      )}

      {/* 可拖拽排序的模块列表 */}
      <Reorder.Group
        axis="y"
        values={draggableSections}
        onReorder={(newOrder) => {
          // 保持基本信息在最前面
          const updatedSections = [
            ...sortedSections.filter((item) => item.id === 'basic'),
            ...newOrder,
          ]
          reorderSections(updatedSections)
        }}
        className="space-y-2"
      >
        {draggableSections.map((item) => (
          <LayoutItem
            key={item.id}
            item={item}
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            toggleSectionVisibility={toggleSectionVisibility}
            updateMenuSections={updateMenuSections}
            menuSections={sortedSections}
          />
        ))}
      </Reorder.Group>
    </div>
  )
}

export default LayoutSetting

