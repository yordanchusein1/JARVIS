import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one database, so test files must not run concurrently.
    fileParallelism: false,
  },
});
