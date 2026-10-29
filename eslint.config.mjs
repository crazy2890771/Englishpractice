import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { files: ["scripts/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "next-env.d.ts", "playwright-report/**", "test-results/**", "supabase/**"] },
];

export default config;
