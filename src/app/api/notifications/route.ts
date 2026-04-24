import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Previously this route read the wrong cookie name ("session" instead of
// "boekhouder_session"), which silently returned 401 for every logged-in
// user. It now uses the shared getSession() so cookie handling matches the
// rest of the app.
//
// Scoping: when the caller is a bookkeeper/admin, an optional ?clientId=
// narrows the feed to notifications FOR that administration. That's the
// filter the accountant portal uses when the active administration changes.
// Customer-portal users always see only their own notifications.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isStaff = me.role === "bookkeeper" || me.role === "admin";

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const clientIdFilter = searchParams.get("clientId");

  // Base user scope: the recipient is always the session user. Notifications
  // are addressed to a specific person (customer or bookkeeper), not a
  // company, so we filter on userId.
  //
  // Administration scoping (staff only): each notification row stores the
  // source administration via its `sourceId` / `metadata` when relevant.
  // We currently don't have a dedicated adminId column, so for staff
  // callers we narrow by matching the source invoice/doc to the
  // requested clientId when clientIdFilter is set. For non-staff this
  // parameter is ignored — customers only see their own notifications.
  const where: Record<string, unknown> = { userId: me.id };
  if (unreadOnly) where.isRead = false;

  if (isStaff && clientIdFilter) {
    // Limit to notifications whose source entity belongs to that client.
    // This intentionally uses metadata + sourceType so we don't need a
    // schema migration just for admin-scoping.
    where.OR = [
      { metadata: { contains: `"clientId":"${clientIdFilter}"` } },
      { sourceId: clientIdFilter },
    ];
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);

  return NextResponse.json({ notifications, total, unreadCount });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json();
  const { type, category, title, message, priority, actionUrl, actionLabel, sourceType, sourceId, metadata, targetUserId } = body;

  if (!type || !category || !title || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId: targetUserId || userId,
      type,
      category,
      title,
      message,
      priority: priority || 0,
      actionUrl: actionUrl || null,
      actionLabel: actionLabel || null,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return NextResponse.json(notification);
}
