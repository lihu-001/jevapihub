import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const OWNER_ID = "ad915bb3-8772-4a5d-b520-62b72fb99981";
const OWNER_EMAIL = "official@jev-interface.invalid";
const FILES = ["zh-article-template-tone.jev-interface.json", "creator-headline-score.jev-interface.json"];

export async function seedCatalog(client, root = process.cwd()) {
  const schema = JSON.parse(await readFile(join(root, "jev-interface-manifest.schema.json"), "utf8"));
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const manifests = [];
  for (const name of FILES) {
    const manifest = JSON.parse(await readFile(join(root, "seeds", name), "utf8"));
    if (!validate(manifest)) throw new Error(`Invalid seed Manifest ${name}: ${JSON.stringify(validate.errors)}`);
    manifests.push(manifest);
  }
  await client.query("BEGIN");
  try {
    await client.query("INSERT INTO users(id, name, email, role) VALUES ($1, $2, $3, 'user') ON CONFLICT (id) DO NOTHING",
      [OWNER_ID, "Jev Official", OWNER_EMAIL]);
    const owner = await client.query("SELECT name, email FROM users WHERE id = $1", [OWNER_ID]);
    if (owner.rows[0]?.email !== OWNER_EMAIL || owner.rows[0]?.name !== "Jev Official") {
      throw new Error("Official seed owner ID is occupied by another user");
    }
    const created = [];
    for (const manifest of manifests) {
      const existing = await client.query("SELECT id FROM interfaces WHERE owner_id = $1 AND slug = $2", [OWNER_ID, manifest.metadata.slug]);
      if (existing.rows.length) continue;
      const project = await client.query(`INSERT INTO interfaces(owner_id, name, slug, description, category, language, visibility, status, featured)
        VALUES ($1, $2, $3, $4, $5, $6, 'public', 'draft', true) RETURNING id`,
      [OWNER_ID, manifest.metadata.name, manifest.metadata.slug, manifest.metadata.description, manifest.metadata.category, manifest.metadata.language]);
      const id = project.rows[0].id;
      await client.query("INSERT INTO interface_drafts(interface_id, manifest_json) VALUES ($1, $2)", [id, JSON.stringify(manifest)]);
      const version = await client.query(`INSERT INTO interface_versions(interface_id, version_number, manifest_json, created_by)
        VALUES ($1, 1, $2, $3) RETURNING id`, [id, JSON.stringify({ ...manifest, version: 1 }), OWNER_ID]);
      await client.query("UPDATE interfaces SET status = 'published', published_version_id = $2 WHERE id = $1", [id, version.rows[0].id]);
      created.push(manifest.metadata.slug);
    }
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
