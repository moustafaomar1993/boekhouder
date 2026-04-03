import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD
  const includeOverdue = url.searchParams.get("includeOverdue") === "true";

  const where: Record<string, unknown> = { userId: session.userId };

  if (date) {
    if (includeOverdue) {
      // Get tasks for the selected date + all uncompleted past tasks (carry-forward)
      where.OR = [
        { date },
        { date: { lt: date }, completed: false },
      ];
      delete where.userId;
      // Restructure for Prisma
      const tasks = await prisma.task.findMany({
        where: {
          userId: session.userId,
          OR: [
            { date },
            { date: { lt: date }, completed: false },
          ],
        },
        orderBy: [{ date: "asc" }, { time: "asc" }],
      });
      return Response.json(tasks);
    } else {
      where.date = date;
    }
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });

  return Response.json(tasks);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await request.json();
  const { title, description, date, time, category } = body;

  if (!title?.trim() || !date) {
    return Response.json({ error: "Titel en datum zijn verplicht" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId: session.userId,
      title: title.trim(),
      description: description?.trim() || null,
      date,
      time: time || null,
      category: category || null,
      sourceType: "manual",
    },
  });

  return Response.json(task);
}
