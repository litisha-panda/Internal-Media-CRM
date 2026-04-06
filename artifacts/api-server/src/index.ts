import app from "./app";
import { logger } from "./lib/logger";
import bcrypt from "bcryptjs";
import { db, users } from "@workspace/db";
import { startGovernanceScheduler } from "./governance";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── AUTO-SEED DEMO USERS ────────────────────────────────────────────────────
// Runs once on startup. If the users table is empty, seeds all demo accounts
// so the app is immediately usable after any fresh deployment.
async function seedDemoIfEmpty() {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return; // already seeded

    logger.info("Users table is empty — seeding demo accounts…");

    const hash = await bcrypt.hash("demo123", 10);

    const demoUsers = [
      { name: "Admin",                   email: "admin@odishatv.com",       role: "ADMIN",          region: null,       repId: null },
      { name: "Darpan (CRO)",            email: "darpan@odishatv.com",      role: "CRO",            region: null,       repId: null },
      { name: "Sales Head (NSH)",        email: "saleshead@odishatv.com",   role: "SALES HEAD",     region: null,       repId: null },
      { name: "Sachin (Sales Strategy)", email: "sachin@odishatv.com",      role: "SALES STRATEGY", region: null,       repId: null },
      { name: "Digi Ops Team",           email: "digiops@odishatv.com",     role: "DIGI OPS",       region: null,       repId: null },
      { name: "Region Head – North",     email: "rh.north@odishatv.com",    role: "REGION HEAD",    region: "North",    repId: null },
      { name: "Region Head – South",     email: "rh.south@odishatv.com",    role: "REGION HEAD",    region: "South",    repId: null },
      { name: "Region Head – East",      email: "rh.east@odishatv.com",     role: "REGION HEAD",    region: "East",     repId: null },
      { name: "Region Head – West",      email: "rh.west@odishatv.com",     role: "REGION HEAD",    region: "West",     repId: null },
      { name: "Region Head – National",  email: "rh.national@odishatv.com", role: "REGION HEAD",    region: "National", repId: null },
      { name: "Region Head – Central",   email: "rh.central@odishatv.com",  role: "REGION HEAD",    region: "Central",  repId: null },
      { name: "Arjun Mishra",            email: "arjun@odishatv.com",       role: "SALES REP",      region: "North",    repId: 1   },
      { name: "Priya Dash",              email: "priya@odishatv.com",       role: "SALES REP",      region: "South",    repId: 2   },
      { name: "Rohit Nanda",             email: "rohit@odishatv.com",       role: "SALES REP",      region: "East",     repId: 3   },
      { name: "Sneha Patel",             email: "sneha@odishatv.com",       role: "SALES REP",      region: "West",     repId: 4   },
      { name: "Vikram Sen",              email: "vikram@odishatv.com",      role: "SALES REP",      region: "National", repId: 5   },
      { name: "Meera Rao",               email: "meera@odishatv.com",       role: "SALES REP",      region: "South",    repId: 6   },
      { name: "Rahul Sharma",            email: "rahul@odishatv.com",       role: "SALES REP",      region: "North",    repId: 7   },
      { name: "Kavya Singh",             email: "kavya@odishatv.com",       role: "SALES REP",      region: "North",    repId: 8   },
      { name: "Manish Tiwari",           email: "manish@odishatv.com",      role: "SALES REP",      region: "North",    repId: 9   },
      { name: "Pooja Agarwal",           email: "pooja@odishatv.com",       role: "SALES REP",      region: "North",    repId: 10  },
    ];

    for (const u of demoUsers) {
      await db
        .insert(users)
        .values({
          name:         u.name,
          email:        u.email,
          passwordHash: hash,
          role:         u.role,
          region:       u.region,
          repId:        u.repId,
          status:       "active",
          needsPwReset: false,
        })
        .onConflictDoNothing();
    }

    logger.info({ count: demoUsers.length }, "Demo accounts seeded successfully");
  } catch (err) {
    logger.error({ err }, "Failed to auto-seed demo accounts — continuing anyway");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed demo users if the DB is fresh (non-blocking failure)
  await seedDemoIfEmpty();

  // Start backend governance scheduler (escalations, attendance, stalled deals)
  startGovernanceScheduler();
});
