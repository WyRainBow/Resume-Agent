/**
 * 背景装饰组件
 */
export function BackgroundDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 -left-20 w-60 h-60 bg-gradient-to-br from-blue-400/15 to-cyan-400/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 right-1/3 w-72 h-72 bg-gradient-to-br from-indigo-400/15 to-violet-400/15 rounded-full blur-3xl" />
    </div>
  )
}

