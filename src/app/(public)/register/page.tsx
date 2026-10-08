import { AuthForm } from "../auth-form";
export const metadata = { title: "Create account" };
export default function Register() {
  return <AuthForm mode="register" />;
}
