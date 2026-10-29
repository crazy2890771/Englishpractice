import { AuthForm } from "../auth-form";

export const metadata = { title: "สร้างบัญชี" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
