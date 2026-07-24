import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/**
 * Delad ESLint-flat-config för hela Roots-monorepot.
 *
 * Medvetet lågljudd: den fångar riktiga fel (js.recommended) och flaggar
 * oanvänd kod / `any` som *varningar* så att `eslint` går grönt men ändå
 * ger signal. TypeScript-kompilatorn (tsc) är den hårda grinden för typer;
 * ESLint kompletterar med stil/hygien.
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/out/**",
      "**/coverage/**",
      "**/*.config.*",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        React: "readonly",
        JSX: "readonly",
        NodeJS: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // TypeScript hanterar odefinierade namn/typer — no-undef ger bara
      // falska positiva (t.ex. på typer och DOM-lib) i .ts/.tsx.
      "no-undef": "off",
      // TS-funktionsöverlagringar (samma namn, flera signaturer) triggar
      // annars no-redeclare felaktigt. TypeScript fångar riktiga
      // dubbeldeklarationer.
      "no-redeclare": "off",
      // Tomma catch är ett legitimt best-effort-mönster (t.ex. clipboard,
      // navigator.share). Övriga tomma block är fortfarande ett fel.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Testdubblar och mock-builders formar medvetet partiella objekt som inte
    // uppfyller de riktiga typerna (halva Drizzle-kedjor, trunkerade rader).
    // Att kräva exakta typer där ger ceremoni utan att fånga buggar — tsc
    // typkontrollerar fortfarande testerna.
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "**/test-utils/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
