import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.session.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.resetToken.deleteMany();
  await prisma.administration.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const client1 = await prisma.user.create({
    data: {
      id: "client-1",
      name: "Jan de Vries",
      email: "jan@devries.nl",
      role: "client",
      company: "De Vries Consulting BV",
      vatNumber: "NL123456789B01",
      kvkNumber: "12345678",
      emailVerified: true,
      isNew: false,
    },
  });

  const client2 = await prisma.user.create({
    data: {
      id: "client-2",
      name: "Maria Bakker",
      email: "maria@bakker.nl",
      role: "client",
      company: "Bakker Design Studio",
      vatNumber: "NL987654321B01",
      kvkNumber: "87654321",
      emailVerified: true,
      isNew: false,
    },
  });

  // Create a demo user with login credentials
  const demoHash = await bcrypt.hash("DemoPass1", 12);
  await prisma.user.create({
    data: {
      id: "demo-user",
      name: "Demo Gebruiker",
      email: "demo@boekhouder.nl",
      role: "client",
      company: "Demo BV",
      username: "demo@boekhouder.nl",
      passwordHash: demoHash,
      emailVerified: true,
      isNew: false,
      kvkNumber: "99887766",
      legalForm: "bv",
    },
  });

  await prisma.user.create({
    data: {
      id: "bookkeeper-1",
      name: "Pieter van den Berg",
      email: "pieter@boekhouder.nl",
      role: "bookkeeper",
      emailVerified: true,
      isNew: false,
    },
  });

  // Create admin user
  const adminHash = await bcrypt.hash("AdminPass1", 12);
  await prisma.user.create({
    data: {
      id: "admin-1",
      name: "Moustafa Omar",
      email: "moustafa@digitalmountains.nl",
      role: "admin",
      username: "moustafa@digitalmountains.nl",
      passwordHash: adminHash,
      emailVerified: true,
      isNew: false,
    },
  });

  // Create administrations
  await prisma.administration.create({
    data: { clientId: client1.id, taxType: "vennootschapsbelasting" },
  });
  await prisma.administration.create({
    data: { clientId: client2.id, taxType: "inkomstenbelasting" },
  });

  // Create invoices with items
  await prisma.invoice.create({
    data: {
      id: "inv-1",
      clientId: client1.id,
      invoiceNumber: "INV-2026-001",
      date: "2026-01-15",
      dueDate: "2026-02-15",
      customerName: "Acme Corp",
      customerAddress: "Herengracht 100, 1015 Amsterdam",
      subtotal: 3950,
      vatAmount: 829.5,
      total: 4779.5,
      status: "paid",
      bookkeepingStatus: "processed",
      items: {
        create: [
          { description: "Consulting services - January", quantity: 40, unitPrice: 95, vatRate: 21 },
          { description: "Travel expenses", quantity: 1, unitPrice: 150, vatRate: 21 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      id: "inv-2",
      clientId: client1.id,
      invoiceNumber: "INV-2026-002",
      date: "2026-02-01",
      dueDate: "2026-03-01",
      customerName: "TechStart BV",
      customerAddress: "Keizersgracht 200, 1015 Amsterdam",
      subtotal: 8800,
      vatAmount: 1848,
      total: 10648,
      status: "sent",
      bookkeepingStatus: "pending",
      items: {
        create: [
          { description: "Software development - February", quantity: 80, unitPrice: 110, vatRate: 21 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      id: "inv-3",
      clientId: client1.id,
      invoiceNumber: "INV-2026-003",
      date: "2026-03-10",
      dueDate: "2026-04-10",
      customerName: "Global Solutions",
      customerAddress: "Prinsengracht 300, 1016 Amsterdam",
      subtotal: 6500,
      vatAmount: 1365,
      total: 7865,
      status: "draft",
      bookkeepingStatus: "pending",
      items: {
        create: [
          { description: "Project management Q1", quantity: 1, unitPrice: 5000, vatRate: 21 },
          { description: "Documentation", quantity: 20, unitPrice: 75, vatRate: 21 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      id: "inv-4",
      clientId: client2.id,
      invoiceNumber: "BD-2026-001",
      date: "2026-01-20",
      dueDate: "2026-02-20",
      customerName: "Fashion House NL",
      customerAddress: "Damrak 50, 1012 Amsterdam",
      subtotal: 4500,
      vatAmount: 945,
      total: 5445,
      status: "paid",
      bookkeepingStatus: "processed",
      items: {
        create: [
          { description: "Brand identity design", quantity: 1, unitPrice: 3500, vatRate: 21 },
          { description: "Logo variations", quantity: 5, unitPrice: 200, vatRate: 21 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      id: "inv-5",
      clientId: client2.id,
      invoiceNumber: "BD-2026-002",
      date: "2026-02-15",
      dueDate: "2026-03-15",
      customerName: "Restaurant De Gouden Lepel",
      customerAddress: "Leidseplein 10, 1017 Amsterdam",
      subtotal: 2600,
      vatAmount: 546,
      total: 3146,
      status: "overdue",
      bookkeepingStatus: "pending",
      items: {
        create: [
          { description: "Menu design", quantity: 1, unitPrice: 800, vatRate: 21 },
          { description: "Website mockups", quantity: 3, unitPrice: 600, vatRate: 21 },
        ],
      },
    },
  });

  console.log("Seed data created successfully!");
  console.log("Demo login: demo@boekhouder.nl / DemoPass1");
  console.log("Admin login: moustafa@digitalmountains.nl / AdminPass1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
