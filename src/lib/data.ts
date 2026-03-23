// In-memory data store (replace with a real database in production)

import { v4 as uuid } from "uuid";
import { hashPassword } from "./auth";

export type UserRole = "client" | "bookkeeper";

export type LegalForm = "eenmanszaak" | "vof" | "bv" | "other";
export type VatObligation = "yes" | "no" | "unknown";
export type TaxType = "inkomstenbelasting" | "vennootschapsbelasting";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
  vatNumber?: string;
  kvkNumber?: string; // Chamber of Commerce number
  username?: string;
  passwordHash?: string;
  isNew?: boolean; // Flag for accountant visibility
  emailVerified?: boolean;
}

export interface ClientRegistration {
  companyName: string;
  kvkNumber: string;
  legalForm: LegalForm;
  contactName: string;
  phone: string;
  email: string;
  vatNumber: string;
  vatId: string;
  vatObligation: VatObligation;
  iban: string;
  bankName: string;
  accountHolder: string;
}

export interface Administration {
  id: string;
  clientId: string;
  taxType: TaxType;
  createdAt: string;
}

const administrations: Administration[] = [];

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number; // e.g. 21, 9, 0
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  bookkeepingStatus: "pending" | "processing" | "processed";
  notes?: string;
  category?: string;
  createdAt: string;
}

export interface FiscalSummary {
  totalRevenue: number;
  totalVatCollected: number;
  totalVatDeductible: number;
  vatToPay: number;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
}

// Demo data
const users: User[] = [
  {
    id: "client-1",
    name: "Jan de Vries",
    email: "jan@devries.nl",
    role: "client",
    company: "De Vries Consulting BV",
    vatNumber: "NL123456789B01",
    kvkNumber: "12345678",
  },
  {
    id: "client-2",
    name: "Maria Bakker",
    email: "maria@bakker.nl",
    role: "client",
    company: "Bakker Design Studio",
    vatNumber: "NL987654321B01",
    kvkNumber: "87654321",
  },
  {
    id: "bookkeeper-1",
    name: "Pieter van den Berg",
    email: "pieter@boekhouder.nl",
    role: "bookkeeper",
  },
];

const invoices: Invoice[] = [
  {
    id: "inv-1",
    clientId: "client-1",
    invoiceNumber: "INV-2026-001",
    date: "2026-01-15",
    dueDate: "2026-02-15",
    customerName: "Acme Corp",
    customerAddress: "Herengracht 100, 1015 Amsterdam",
    items: [
      { description: "Consulting services - January", quantity: 40, unitPrice: 95, vatRate: 21 },
      { description: "Travel expenses", quantity: 1, unitPrice: 150, vatRate: 21 },
    ],
    subtotal: 3950,
    vatAmount: 829.5,
    total: 4779.5,
    status: "paid",
    bookkeepingStatus: "processed",
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "inv-2",
    clientId: "client-1",
    invoiceNumber: "INV-2026-002",
    date: "2026-02-01",
    dueDate: "2026-03-01",
    customerName: "TechStart BV",
    customerAddress: "Keizersgracht 200, 1015 Amsterdam",
    items: [
      { description: "Software development - February", quantity: 80, unitPrice: 110, vatRate: 21 },
    ],
    subtotal: 8800,
    vatAmount: 1848,
    total: 10648,
    status: "sent",
    bookkeepingStatus: "pending",
    createdAt: "2026-02-01T09:00:00Z",
  },
  {
    id: "inv-3",
    clientId: "client-1",
    invoiceNumber: "INV-2026-003",
    date: "2026-03-10",
    dueDate: "2026-04-10",
    customerName: "Global Solutions",
    customerAddress: "Prinsengracht 300, 1016 Amsterdam",
    items: [
      { description: "Project management Q1", quantity: 1, unitPrice: 5000, vatRate: 21 },
      { description: "Documentation", quantity: 20, unitPrice: 75, vatRate: 21 },
    ],
    subtotal: 6500,
    vatAmount: 1365,
    total: 7865,
    status: "draft",
    bookkeepingStatus: "pending",
    createdAt: "2026-03-10T14:00:00Z",
  },
  {
    id: "inv-4",
    clientId: "client-2",
    invoiceNumber: "BD-2026-001",
    date: "2026-01-20",
    dueDate: "2026-02-20",
    customerName: "Fashion House NL",
    customerAddress: "Damrak 50, 1012 Amsterdam",
    items: [
      { description: "Brand identity design", quantity: 1, unitPrice: 3500, vatRate: 21 },
      { description: "Logo variations", quantity: 5, unitPrice: 200, vatRate: 21 },
    ],
    subtotal: 4500,
    vatAmount: 945,
    total: 5445,
    status: "paid",
    bookkeepingStatus: "processed",
    createdAt: "2026-01-20T11:00:00Z",
  },
  {
    id: "inv-5",
    clientId: "client-2",
    invoiceNumber: "BD-2026-002",
    date: "2026-02-15",
    dueDate: "2026-03-15",
    customerName: "Restaurant De Gouden Lepel",
    customerAddress: "Leidseplein 10, 1017 Amsterdam",
    items: [
      { description: "Menu design", quantity: 1, unitPrice: 800, vatRate: 21 },
      { description: "Website mockups", quantity: 3, unitPrice: 600, vatRate: 21 },
    ],
    subtotal: 2600,
    vatAmount: 546,
    total: 3146,
    status: "overdue",
    bookkeepingStatus: "pending",
    createdAt: "2026-02-15T08:30:00Z",
  },
];

// Data access functions
export function getUsers(): User[] {
  return users;
}

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getClients(): User[] {
  return users.filter((u) => u.role === "client");
}

export function getInvoicesByClient(clientId: string): Invoice[] {
  return invoices.filter((i) => i.clientId === clientId);
}

export function getAllInvoices(): Invoice[] {
  return invoices;
}

export function getInvoice(id: string): Invoice | undefined {
  return invoices.find((i) => i.id === id);
}

export function addInvoice(invoice: Invoice): void {
  invoices.push(invoice);
}

export function updateInvoiceBookkeepingStatus(
  id: string,
  status: Invoice["bookkeepingStatus"],
  category?: string
): Invoice | undefined {
  const invoice = invoices.find((i) => i.id === id);
  if (invoice) {
    invoice.bookkeepingStatus = status;
    if (category) invoice.category = category;
  }
  return invoice;
}

export function updateInvoiceStatus(
  id: string,
  status: Invoice["status"]
): Invoice | undefined {
  const invoice = invoices.find((i) => i.id === id);
  if (invoice) {
    invoice.status = status;
  }
  return invoice;
}

export function getFiscalSummary(clientId: string): FiscalSummary {
  const clientInvoices = getInvoicesByClient(clientId);
  return {
    totalRevenue: clientInvoices.reduce((sum, i) => sum + i.subtotal, 0),
    totalVatCollected: clientInvoices.reduce((sum, i) => sum + i.vatAmount, 0),
    totalVatDeductible: 0, // Simplified - would come from expense invoices
    vatToPay: clientInvoices.reduce((sum, i) => sum + i.vatAmount, 0),
    invoiceCount: clientInvoices.length,
    paidCount: clientInvoices.filter((i) => i.status === "paid").length,
    overdueCount: clientInvoices.filter((i) => i.status === "overdue").length,
  };
}

// Auth & Registration functions

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export function getUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

function determineTaxType(legalForm: LegalForm): TaxType {
  if (legalForm === "bv") return "vennootschapsbelasting";
  return "inkomstenbelasting";
}

export function registerClient(
  data: ClientRegistration,
  username: string,
  passwordHash: string
): { user: User; administration: Administration } {
  const userId = `client-${uuid().slice(0, 8)}`;

  const user: User = {
    id: userId,
    name: data.contactName,
    email: data.email,
    role: "client",
    company: data.companyName,
    vatNumber: data.vatNumber,
    kvkNumber: data.kvkNumber,
    username,
    passwordHash,
    isNew: true,
  };
  users.push(user);

  const administration: Administration = {
    id: `admin-${uuid().slice(0, 8)}`,
    clientId: userId,
    taxType: determineTaxType(data.legalForm),
    createdAt: new Date().toISOString(),
  };
  administrations.push(administration);

  return { user, administration };
}

export function getAdministrationByClient(clientId: string): Administration | undefined {
  return administrations.find((a) => a.clientId === clientId);
}

export function verifyUserEmail(userId: string): boolean {
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.emailVerified = true;
    return true;
  }
  return false;
}

export function updateUserPassword(userId: string, passwordHash: string): boolean {
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.passwordHash = passwordHash;
    return true;
  }
  return false;
}
