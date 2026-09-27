import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"], maxWorkers: 2, testTimeout: 15_000 } });
