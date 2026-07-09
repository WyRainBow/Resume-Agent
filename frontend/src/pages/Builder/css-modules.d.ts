/**
 * CSS Modules 类型声明(项目缺 vite-env.d.ts,此处只补 Builder 用到的 *.module.css)。
 * 声明为全局模块通配,与 Vite 内置的 vite/client 中同名声明一致,不影响运行时。
 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
