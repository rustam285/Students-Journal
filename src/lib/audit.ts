import { prisma } from "@/lib/prisma";

export async function logAudit(
  userId: string,
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: string,
  entityId: string,
  changes?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
