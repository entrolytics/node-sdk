import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    fixedExtension: false,
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node24',
    deps: {
      resolveDepSubpath: true,
      // @entrolytics/shared is a declared runtime dependency, so it must stay
      // external. Bundling it froze a copy at build time: consumers installed
      // shared but ran an inlined snapshot, so fixes to shared never reached
      // them without republishing this package.
      neverBundle: ['@entrolytics/shared'],
    },
  },
  fmt: {
    printWidth: 100,
    useTabs: false,
    singleQuote: true,
    jsxSingleQuote: false,
    quoteProps: 'as-needed',
    trailingComma: 'all',
    semi: true,
    arrowParens: 'avoid',
    objectWrap: 'preserve',
    insertFinalNewline: true,
    embeddedLanguageFormatting: 'auto',
    htmlWhitespaceSensitivity: 'css',
    proseWrap: 'preserve',
    sortPackageJson: {
      sortScripts: true,
    },
  },
  run: {
    cache: {
      scripts: true,
      tasks: true,
    },
  },
  staged: {
    '*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml}': 'vp check --fix',
  },
  lint: {
    categories: {
      correctness: 'warn',
      suspicious: 'warn',
    },
    rules: {
      'react/exhaustive-deps': 'off',
      'typescript/no-explicit-any': 'off',
    },
    plugins: ['oxc', 'typescript', 'unicorn', 'react'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
