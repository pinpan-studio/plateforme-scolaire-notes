import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("journal Drizzle", () => {
  it("exige un when strictement croissant", () => {
    const journal = JSON.parse(
      readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
    ) as { entries: { tag: string; when: number }[] };
    const entries = journal.entries;
    assert.ok(entries.length >= 2);
    for (let index = 1; index < entries.length; index += 1) {
      const precedent = entries[index - 1];
      const courant = entries[index];
      assert.ok(
        typeof courant.when === "number" && courant.when > precedent.when,
        `${courant.tag} (${courant.when}) doit être postérieur à ${precedent.tag} (${precedent.when})`,
      );
    }
  });
});
