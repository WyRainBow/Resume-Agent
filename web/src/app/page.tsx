import { redirect } from "next/navigation";
import { getDefaultReturnTo } from "@/lib/return-to";

// web 层只作登录 / OAuth 桥，根路径不展示页面，直接跳回前端产品。
export default function Home() {
  redirect(getDefaultReturnTo());
}
