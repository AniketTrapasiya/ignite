import { prisma } from "./prisma";

type NotificationType = "info" | "success" | "warning" | "error";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  return prisma.notification.create({
    data: { userId, type, title, message, link },
  });
}
