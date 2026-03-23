import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

const RO_SYSTEM_PROMPT = `You are an expert Release Order (RO) parser for an Indian TV broadcast company. Parse the given RO text/data and extract all structured information.

Return a JSON array of deal records. Each deal = one channel. If multiple channels appear, split into separate records.

For each deal, extract:
- client_name (advertiser company name)
- brand_name (specific brand/product if mentioned)
- agency_name (media agency if present)
- ro_number (release order reference number)
- ro_date (date of RO issuance, YYYY-MM-DD)
- channel (TV channel name as-is from document)
- start_date, end_date (campaign dates, YYYY-MM-DD)
- gross_amount (total gross amount as number, no currency symbols)
- discount_amount (discount as number)
- agency_commission_amount (agency commission as number)
- payment_terms (e.g. "30 days", "advance")
- special_instructions (any special notes or instructions)
- campaign_name (campaign name if mentioned)
- activity_month (e.g. "Apr 2025")
- spot_items: array of {
    program_or_timeband: string,
    caption: string (creative/copy caption),
    time_band: string (e.g. "19:00-23:00"),
    spot_duration_sec: number,
    no_of_spots: number,
    total_fct: number (total seconds),
    net_rate_per_10sec: number,
    days: string (e.g. "Mon-Fri", "Daily", "Sun"),
    payment_type: "Paid" | "Bonus" | "Barter"
  }
- components: array for sponsorship entitlements {
    component_type: "SPONSORSHIP_ENTITLEMENT" | "EVENT_FCT" | string,
    component_label: string,
    quantity: number,
    amount: number,
    is_fct: boolean
  }

IMPORTANT:
- Strip Total/Subtotal/Grand Total rows from spot_items
- For PT/NPT time splitting, include the full timeband as-is (the system will split it)
- Return ONLY a valid JSON array, no markdown, no explanation
- If no data found, return []`;

router.post("/parse-ro", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text required" });
    return;
  }
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        { role: "user", content: `Parse this Release Order:\n\n${text}` }
      ],
      system: RO_SYSTEM_PROMPT,
    });
    const block = message.content[0];
    const rawText = block.type === "text" ? block.text : "[]";
    let parsed: any;
    try {
      const cleaned = rawText.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [parsed];
    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "RO parse error");
    res.status(500).json({ error: String(err?.message || err) });
  }
});

export default router;
