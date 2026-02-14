import React, { ReactNode, forwardRef } from 'react';

interface CustomScrollbarProps {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: React.ElementType;
  style?: React.CSSProperties;
}

/**
 * 统一的滚动条容器组件
 * 使用了 tailwind.css 中定义的 .custom-scrollbar 样式
 */
export const CustomScrollbar = forwardRef<HTMLElement, CustomScrollbarProps>(({ 
  children, 
  className = "", 
  id,
  as: Component = "div",
  style
}, ref) => {
  return (
    <Component 
      ref={ref}
      id={id}
      style={style}
      className={`custom-scrollbar overflow-auto ${className}`}
    >
      {children}
    </Component>
  );
});

CustomScrollbar.displayName = 'CustomScrollbar';

export default CustomScrollbar;
