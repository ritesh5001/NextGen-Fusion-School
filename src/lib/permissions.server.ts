/**
 * Compute the effective permission set for a user by unioning all role
 * permissions and applying per-user grants/denies on top.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client.server";
import {
  permissions,
  rolePermissions,
  userPermissionOverrides,
  userRoles,
} from "@/db/schema";

export async function loadEffectivePermissions(
  userId: string,
): Promise<string[]> {
  const db = getDb();

  const roleIds = (
    await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
  ).map((r) => r.roleId);

  const rolePermRows = roleIds.length
    ? await db
        .select({ key: permissions.key })
        .from(rolePermissions)
        .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
        .where(inArray(rolePermissions.roleId, roleIds))
    : [];

  const overrideRows = await db
    .select({ key: permissions.key, allow: userPermissionOverrides.allow })
    .from(userPermissionOverrides)
    .innerJoin(
      permissions,
      eq(permissions.id, userPermissionOverrides.permissionId),
    )
    .where(eq(userPermissionOverrides.userId, userId));

  const set = new Set<string>(rolePermRows.map((r) => r.key));
  for (const o of overrideRows) {
    if (o.allow) set.add(o.key);
    else set.delete(o.key);
  }
  return [...set];
}

export function hasPerm(perms: string[], key: string): boolean {
  // Support wildcards: 'students.*' grants 'students.read', 'students.write', ...
  if (perms.includes(key)) return true;
  const [module] = key.split(".");
  if (perms.includes(`${module}.*`)) return true;
  if (perms.includes("*")) return true;
  return false;
}
