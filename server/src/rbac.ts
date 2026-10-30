import type { Request, Response, NextFunction } from "express";
import { config } from "./config";

export type Role = "public" | "admin";

/**
 * Role is derived from a shared admin key (header `x-admin-key` or `?key=`).
 * No accounts, no login/register — just two roles gated by middleware:
 *   - public : the landing / invitation endpoints
 *   - admin  : the dashboard endpoints
 */
export function roleOf(req: Request): Role {
  const provided =
    req.get("x-admin-key") ??
    (typeof req.query.key === "string" ? req.query.key : undefined);
  return provided && provided === config.adminKey ? "admin" : "public";
}

export function requireRole(required: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const current = roleOf(req);
    if (required === "admin" && current !== "admin") {
      res.status(401).json({ error: "admin role required", role: current });
      return;
    }
    next();
  };
}




