/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";
import plugin from "tailwindcss/plugin";

/** Workspace 换肤变体:data-skin="fresh" 子树内 fresh: 类生效(与 dark: 同构) */
const skinVariant = plugin(({ addVariant }) => {
  addVariant("fresh", '[data-skin="fresh"] &');
});

export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        hero: [
          '"Noto Sans SC"',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei UI',
          'Microsoft YaHei',
          'sans-serif',
        ],
        chat: [
          '"Noto Sans SC"',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei UI',
          'sans-serif',
        ],
        // 优雅中文衬线（标题用，参考 Manus）：Mac 优先 Songti SC
        serifcn: [
          '"Songti SC"',
          '"STSong"',
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          'SimSun',
          'serif',
        ],
      },
      colors: {
        // chat-* 语义 token 变量化（2026-07-16 皮肤覆盖 AI 助手/我的简历页）：
        // 默认值 = NEO 皮肤原值；[data-skin="fresh"] 在 tailwind.css 里改写
        // 变量即可让 275+ 处 chat-* 类一次换肤，无需逐组件写 fresh: 变体
        chat: {
          canvas: 'var(--chat-canvas, #F0F0E8)',
          ink: 'var(--chat-ink, #0A0A0A)',
          'ink-muted': 'var(--chat-ink-muted, #5C6368)',
          accent: 'var(--chat-accent, #4285F4)',
          'accent-deep': 'var(--chat-accent-deep, #3367D6)',
          'user-bubble': 'var(--chat-user-bubble, #D7E7FF)',
          surface: 'var(--chat-surface, #FFFFFF)',
          border: 'var(--chat-border, #000000)',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      typography: {
        DEFAULT: {
          css: {
            'ul::marker': {
              color: '#000000',
            },
            'ol::marker': {
              color: '#000000',
            },
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [typography, skinVariant],
}

