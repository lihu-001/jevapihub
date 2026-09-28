import { randomBytes } from "node:crypto";
import { open, readFile } from "node:fs/promises";

const passwordFile = process.env.DB_CREDENTIALS_FILE || "/run/jev-hub-db/password";
const mode = process.argv[2];

if (mode === "init") {
  const supplied = process.env.POSTGRES_PASSWORD;
  try {
    const file = await open(passwordFile, "wx", 0o444);
    try {
      await file.writeFile(supplied || randomBytes(32).toString("hex"));
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (supplied && (await readFile(passwordFile, "utf8")) !== supplied) {
      throw new Error("POSTGRES_PASSWORD differs from the stored database password");
    }
  }
} else if (mode === "url") {
  const url = new URL("postgresql://db:5432");
  url.username = process.env.POSTGRES_USER || "jev_hub";
  url.password = await readFile(passwordFile, "utf8");
  url.pathname = `/${process.env.POSTGRES_DB || "jev_hub"}`;
  process.stdout.write(url.toString());
} else {
  throw new Error("Expected init or url");
}
