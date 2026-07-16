/**
 * AskQuestion 提交回调的注入通道。
 *
 * StructuredCardRegistry 的卡片是按 type 注册的纯展示组件,只能拿到 data props,
 * 但 AskQuestionCard 需要"提交时发消息"的能力。这里用一个 React Context 把
 * CocoChat 里的 handleAskQuestionSubmit 注入进来,卡片内 useContext 拿回调,
 * 不污染 StructuredCardRegistry 的纯展示 API。
 */
import { createContext, useContext } from "react";

export interface AskQuestionAnswer {
  question: string;
  header: string;
  /** 用户的选择:"fill"=直接填写(带 value),"skip"=直接跳过 */
  choice: "fill" | "skip";
  /** choice="fill" 时用户填的文本;"skip" 时为空 */
  value?: string;
}

export interface AskQuestionContextValue {
  /** 用户点完所有问题、按提交时触发。返回值可选,用于禁用后续重复提交。 */
  onSubmit: (answers: AskQuestionAnswer[]) => void;
  /** 是否已提交过(防止重复提交,卡片提交后置灰) */
  submitted?: boolean;
}

export const AskQuestionContext = createContext<AskQuestionContextValue | null>(null);

export function useAskQuestion(): AskQuestionContextValue {
  const ctx = useContext(AskQuestionContext);
  if (!ctx) {
    throw new Error("AskQuestionCard 必须在 AskQuestionContext.Provider 内使用");
  }
  return ctx;
}
