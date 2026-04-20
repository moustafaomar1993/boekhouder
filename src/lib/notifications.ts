// Helper to create notifications from server-side code
import { prisma } from "./prisma";

export type NotificationType =
  | "invoice_booked"
  | "invoice_sent"
  | "invoice_overdue"
  | "reminder_sent"
  | "payment_received"
  | "bank_import"
  | "bank_reconciled"
  | "purchase_booked"
  | "exception_created"
  | "exception_responded"
  | "task_assigned"
  | "task_completed"
  | "client_registered"
  | "system";

export type NotificationCategory =
  | "critical"
  | "warning"
  | "success"
  | "info"
  | "reminder"
  | "task"
  | "bookkeeping"
  | "payment"
  | "system";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  priority?: number; // 0=normal, 1=high, 2=critical
  actionUrl?: string;
  actionLabel?: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      priority: input.priority ?? 0,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

// Pre-built notification templates for common events
export const notificationTemplates = {
  invoiceBooked: (userId: string, invoiceNumber: string, customerName: string, invoiceId: string) =>
    createNotification({
      userId,
      type: "invoice_booked",
      category: "bookkeeping",
      title: "Factuur geboekt",
      message: `Factuur ${invoiceNumber} van ${customerName} is succesvol geboekt.`,
      actionUrl: `/bookkeeper/invoices/${invoiceId}`,
      actionLabel: "Bekijk factuur",
      sourceType: "invoice",
      sourceId: invoiceId,
    }),

  invoiceOverdue: (userId: string, invoiceNumber: string, customerName: string, amount: number, invoiceId: string) =>
    createNotification({
      userId,
      type: "invoice_overdue",
      category: "warning",
      title: "Factuur verlopen",
      message: `Factuur ${invoiceNumber} van ${customerName} (${formatEur(amount)}) is verlopen.`,
      priority: 1,
      actionUrl: `/bookkeeper?section=verkoop`,
      actionLabel: "Bekijk debiteurenbeheer",
      sourceType: "invoice",
      sourceId: invoiceId,
    }),

  reminderSent: (userId: string, invoiceNumber: string, customerName: string, invoiceId: string) =>
    createNotification({
      userId,
      type: "reminder_sent",
      category: "reminder",
      title: "Herinnering verstuurd",
      message: `Betalingsherinnering verstuurd naar ${customerName} voor factuur ${invoiceNumber}.`,
      actionUrl: `/bookkeeper/invoices/${invoiceId}`,
      actionLabel: "Bekijk factuur",
      sourceType: "invoice",
      sourceId: invoiceId,
    }),

  paymentReceived: (userId: string, invoiceNumber: string, customerName: string, amount: number, invoiceId: string) =>
    createNotification({
      userId,
      type: "payment_received",
      category: "payment",
      title: "Betaling ontvangen",
      message: `${formatEur(amount)} ontvangen van ${customerName} voor factuur ${invoiceNumber}.`,
      actionUrl: `/bookkeeper/invoices/${invoiceId}`,
      actionLabel: "Bekijk factuur",
      sourceType: "invoice",
      sourceId: invoiceId,
    }),

  bankImport: (userId: string, count: number, account: string) =>
    createNotification({
      userId,
      type: "bank_import",
      category: "info",
      title: "Banktransacties geimporteerd",
      message: `${count} transactie${count !== 1 ? "s" : ""} geimporteerd voor rekening ${account}.`,
      actionUrl: "/bookkeeper?section=bank",
      actionLabel: "Bekijk transacties",
      sourceType: "bank",
    }),

  bankReconciled: (userId: string, count: number) =>
    createNotification({
      userId,
      type: "bank_reconciled",
      category: "success",
      title: "Aflettering voltooid",
      message: `${count} transactie${count !== 1 ? "s" : ""} succesvol afgeletterd.`,
      actionUrl: "/bookkeeper?section=afletteren",
      actionLabel: "Bekijk aflettering",
      sourceType: "bank",
    }),

  purchaseBooked: (userId: string, supplierName: string, docId: string) =>
    createNotification({
      userId,
      type: "purchase_booked",
      category: "bookkeeping",
      title: "Inkoopfactuur geboekt",
      message: `Inkoopfactuur van ${supplierName} is geboekt.`,
      actionUrl: "/bookkeeper?section=inkoop",
      actionLabel: "Bekijk inkoop",
      sourceType: "purchase",
      sourceId: docId,
    }),

  exceptionCreated: (userId: string, title: string, clientName: string) =>
    createNotification({
      userId,
      type: "exception_created",
      category: "warning",
      title: "Uitzondering aangemaakt",
      message: `Nieuwe uitzondering "${title}" voor ${clientName}.`,
      priority: 1,
      actionUrl: "/bookkeeper?section=dashboard",
      actionLabel: "Bekijk uitzonderingen",
      sourceType: "exception",
    }),

  exceptionResponded: (userId: string, title: string, clientName: string) =>
    createNotification({
      userId,
      type: "exception_responded",
      category: "info",
      title: "Reactie op uitzondering",
      message: `${clientName} heeft gereageerd op "${title}".`,
      actionUrl: "/bookkeeper?section=dashboard",
      actionLabel: "Bekijk reactie",
      sourceType: "exception",
    }),

  taskAssigned: (userId: string, taskTitle: string) =>
    createNotification({
      userId,
      type: "task_assigned",
      category: "task",
      title: "Nieuwe taak",
      message: `Taak "${taskTitle}" is aan je toegewezen.`,
      actionUrl: "/bookkeeper?section=taken",
      actionLabel: "Bekijk taken",
      sourceType: "task",
    }),

  clientRegistered: (userId: string, clientName: string, companyName: string) =>
    createNotification({
      userId,
      type: "client_registered",
      category: "info",
      title: "Nieuwe klant geregistreerd",
      message: `${clientName} (${companyName}) heeft zich geregistreerd.`,
      actionUrl: "/bookkeeper?section=instellingen",
      actionLabel: "Bekijk klanten",
      sourceType: "system",
    }),
};

function formatEur(amount: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
}
