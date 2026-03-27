import { Router } from "express";
import { db, appStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/state/:key", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(appStateTable)
      .where(eq(appStateTable.key, req.params.key))
      .limit(1);

    if (rows.length === 0) {
      res.json({ ok: false, value: null });
    } else {
      res.json({ ok: true, value: rows[0].value, updatedAt: rows[0].updatedAt });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.put("/state/:key", async (req, res) => {
  try {
    const { value } = req.body as { value: unknown };
    if (value === undefined) {
      res.status(400).json({ ok: false, error: "Missing value" });
      return;
    }

    await db
      .insert(appStateTable)
      .values({ key: req.params.key, value: value as object, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appStateTable.key,
        set: { value: value as object, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
