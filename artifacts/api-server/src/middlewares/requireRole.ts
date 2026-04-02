import { Request, Response, NextFunction } from "express";

export const ALL_ROLES = [
  "SALES REP",
  "REGION HEAD",
  "SALES HEAD",
  "CRO",
  "SALES STRATEGY",
  "DIGI OPS",
  "ADMIN",
] as const;

export type Role = (typeof ALL_ROLES)[number];

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({
        ok: false,
        error: `Role '${req.user.role}' is not permitted for this action`,
      });
      return;
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole("ADMIN")(req, res, next);
}
