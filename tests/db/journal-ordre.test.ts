import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("journal Drizzle", () => {
  it("ordonne les migrations par un when strictement croissant", () => {
    const journal = JSON.parse(
      readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
    ) as { entries: { tag: string; when: number; idx: number }[] };
    const entries = journal.entries;
    assert.ok(entries.length >= 2);
    const tags = new Set<string>();
    for (let index = 0; index < entries.length; index += 1) {
      const courant = entries[index];
      assert.equal(courant.idx, index);
      assert.equal(tags.has(courant.tag), false);
      tags.add(courant.tag);
      if (index === 0) continue;
      const precedent = entries[index - 1];
      assert.ok(
        typeof courant.when === "number" && courant.when > precedent.when,
        `${courant.tag} (${courant.when}) doit être postérieur à ${precedent.tag} (${precedent.when})`,
      );
    }
    assert.equal(tags.has("0004_audit_referentiel"), true);
  });
});
