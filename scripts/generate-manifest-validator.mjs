import { readFileSync, writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";

const schema = JSON.parse(readFileSync(new URL("../jev-interface-manifest.schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } });
const output = standaloneCode(ajv, ajv.compile(schema));
writeFileSync(new URL("../src/lib/manifest/schema.generated.js", import.meta.url), output);
