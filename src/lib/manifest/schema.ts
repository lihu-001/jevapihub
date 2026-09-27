import Ajv2020 from "ajv/dist/2020.js";
import manifestSchema from "../../../jev-interface-manifest.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: false });
export const validateManifestSchema = ajv.compile(manifestSchema);
