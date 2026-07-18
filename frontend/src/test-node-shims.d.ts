/**
 * 测试用 Node 类型垫片:vitest 跑在 Node 环境可用 node:fs/path,
 * 但项目未装 @types/node——此处提供测试所需的最小声明,
 * 不引入新依赖、不动 tsconfig。仅供 *.test.tsx 使用。
 */
declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
}
declare module "node:path" {
  export function resolve(...parts: string[]): string;
}
declare const __dirname: string;
