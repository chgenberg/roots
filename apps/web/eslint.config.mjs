import base from "../../packages/config/eslint.config.mjs";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/**
 * Web-appen (Next.js). Delad TS-config + React-hooks/Next-regler så att
 * inline `eslint-disable`-direktiv för dessa regler känns igen och att
 * hook-fel fångas. Next-specifika råd hålls som varningar (går grönt).
 */
export default [
  ...base,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
