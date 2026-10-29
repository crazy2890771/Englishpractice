import { AuthForm } from "../auth-form";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
