import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  // @entrolytics/shared is a declared runtime dependency, so it must stay external.
  // Bundling it froze a copy at build time: consumers installed shared but ran an
  // inlined snapshot, so fixes to shared never reached them without republishing.
  deps: { neverBundle: ['@entrolytics/shared'] },
});
