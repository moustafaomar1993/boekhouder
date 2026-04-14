import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data (order matters for FK constraints)
  await prisma.vatCode.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.exceptionItem.deleteMany();
  await prisma.task.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.purchaseDocument.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceNote.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quotationNote.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.lineTemplate.deleteMany();
  await prisma.recurringInvoice.deleteMany();
  await prisma.customer.deleteMany();
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

  const bookHash = await bcrypt.hash("BoekPass1", 12);
  await prisma.user.create({
    data: {
      id: "bookkeeper-1",
      name: "Pieter van den Berg",
      email: "pieter@boekhouder.nl",
      role: "bookkeeper",
      username: "pieter@boekhouder.nl",
      passwordHash: bookHash,
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

  // ═══ CHART OF ACCOUNTS (Grootboekschema) ═══
  const ledgerAccounts = [
    // 0xxx - Vaste activa (Fixed assets)
    { accountNumber: "0100", name: "Inventaris en inrichting", accountType: "asset", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 100 },
    { accountNumber: "0110", name: "Computers en hardware", accountType: "asset", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 110 },
    { accountNumber: "0120", name: "Vervoermiddelen", accountType: "asset", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 120 },
    { accountNumber: "0130", name: "Machines en apparatuur", accountType: "asset", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 130 },
    { accountNumber: "0150", name: "Goodwill", accountType: "asset", category: "Vaste activa", statementSection: "Immateriele vaste activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 150 },
    { accountNumber: "0190", name: "Afschrijving inventaris", accountType: "contra", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "credit", isBalanceSheet: true, sortOrder: 190 },
    { accountNumber: "0191", name: "Afschrijving computers", accountType: "contra", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "credit", isBalanceSheet: true, sortOrder: 191 },
    { accountNumber: "0192", name: "Afschrijving vervoermiddelen", accountType: "contra", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "credit", isBalanceSheet: true, sortOrder: 192 },
    { accountNumber: "0193", name: "Afschrijving machines", accountType: "contra", category: "Vaste activa", statementSection: "Materiele vaste activa", normalBalance: "credit", isBalanceSheet: true, sortOrder: 193 },

    // 1xxx - Vlottende activa (Current assets)
    { accountNumber: "1100", name: "Debiteuren", accountType: "asset", category: "Vlottende activa", statementSection: "Vorderingen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 1100 },
    { accountNumber: "1200", name: "Overige vorderingen", accountType: "asset", category: "Vlottende activa", statementSection: "Vorderingen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 1200 },
    { accountNumber: "1300", name: "Vooruitbetaalde bedragen", accountType: "asset", category: "Vlottende activa", statementSection: "Overlopende activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 1300 },
    { accountNumber: "1400", name: "Nog te ontvangen bedragen", accountType: "asset", category: "Vlottende activa", statementSection: "Overlopende activa", normalBalance: "debit", isBalanceSheet: true, sortOrder: 1400 },
    { accountNumber: "1500", name: "Voorraad handelsgoederen", accountType: "asset", category: "Vlottende activa", statementSection: "Voorraden", normalBalance: "debit", isBalanceSheet: true, sortOrder: 1500 },

    // 2xxx - Liquide middelen (Cash & bank)
    { accountNumber: "2000", name: "Bankrekening", accountType: "asset", category: "Liquide middelen", statementSection: "Liquide middelen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 2000 },
    { accountNumber: "2010", name: "Spaarrekening", accountType: "asset", category: "Liquide middelen", statementSection: "Liquide middelen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 2010 },
    { accountNumber: "2100", name: "Kas", accountType: "asset", category: "Liquide middelen", statementSection: "Liquide middelen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 2100 },
    { accountNumber: "2900", name: "Kruisposten", accountType: "asset", category: "Liquide middelen", statementSection: "Liquide middelen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 2900 },

    // 3xxx - Eigen vermogen & voorzieningen (Equity)
    { accountNumber: "3000", name: "Eigen vermogen / kapitaal", accountType: "equity", category: "Eigen vermogen", statementSection: "Eigen vermogen", normalBalance: "credit", isBalanceSheet: true, sortOrder: 3000 },
    { accountNumber: "3100", name: "Winstreserve", accountType: "equity", category: "Eigen vermogen", statementSection: "Eigen vermogen", normalBalance: "credit", isBalanceSheet: true, sortOrder: 3100 },
    { accountNumber: "3200", name: "Resultaat lopend boekjaar", accountType: "equity", category: "Eigen vermogen", statementSection: "Eigen vermogen", normalBalance: "credit", isBalanceSheet: true, sortOrder: 3200 },
    { accountNumber: "3300", name: "Prive-opname", accountType: "equity", category: "Eigen vermogen", statementSection: "Eigen vermogen", normalBalance: "debit", isBalanceSheet: true, sortOrder: 3300 },
    { accountNumber: "3400", name: "Prive-storting", accountType: "equity", category: "Eigen vermogen", statementSection: "Eigen vermogen", normalBalance: "credit", isBalanceSheet: true, sortOrder: 3400 },
    { accountNumber: "3500", name: "Voorzieningen", accountType: "liability", category: "Eigen vermogen", statementSection: "Voorzieningen", normalBalance: "credit", isBalanceSheet: true, sortOrder: 3500 },

    // 4xxx - Algemene bedrijfskosten (Operating expenses)
    { accountNumber: "4000", name: "Huur bedrijfsruimte", accountType: "expense", category: "Huisvestingskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4000 },
    { accountNumber: "4010", name: "Servicekosten", accountType: "expense", category: "Huisvestingskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4010 },
    { accountNumber: "4020", name: "Energiekosten", accountType: "expense", category: "Huisvestingskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4020 },
    { accountNumber: "4030", name: "Schoonmaakkosten", accountType: "expense", category: "Huisvestingskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4030 },
    { accountNumber: "4040", name: "Kantoorbenodigdheden", accountType: "expense", category: "Huisvestingskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4040 },
    { accountNumber: "4100", name: "Software en licenties", accountType: "expense", category: "Automatiseringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4100 },
    { accountNumber: "4110", name: "Hosting en cloud", accountType: "expense", category: "Automatiseringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4110 },
    { accountNumber: "4120", name: "Domeinnamen en certificaten", accountType: "expense", category: "Automatiseringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4120 },
    { accountNumber: "4130", name: "Abonnementen en SaaS", accountType: "expense", category: "Automatiseringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4130 },
    { accountNumber: "4200", name: "Telefoonkosten", accountType: "expense", category: "Communicatiekosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4200 },
    { accountNumber: "4210", name: "Internetkosten", accountType: "expense", category: "Communicatiekosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4210 },
    { accountNumber: "4220", name: "Porti en verzendkosten", accountType: "expense", category: "Communicatiekosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4220 },
    { accountNumber: "4300", name: "Bedrijfsverzekeringen", accountType: "expense", category: "Verzekeringen", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4300 },
    { accountNumber: "4310", name: "Arbeidsongeschiktheidsverzekering", accountType: "expense", category: "Verzekeringen", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4310 },
    { accountNumber: "4320", name: "Aansprakelijkheidsverzekering", accountType: "expense", category: "Verzekeringen", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4320 },
    { accountNumber: "4400", name: "Advieskosten", accountType: "expense", category: "Advies en administratie", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4400 },
    { accountNumber: "4410", name: "Accountantskosten", accountType: "expense", category: "Advies en administratie", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4410 },
    { accountNumber: "4420", name: "Juridische kosten", accountType: "expense", category: "Advies en administratie", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4420 },
    { accountNumber: "4430", name: "Notariskosten", accountType: "expense", category: "Advies en administratie", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4430 },
    { accountNumber: "4500", name: "Bankkosten", accountType: "expense", category: "Financieringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4500 },
    { accountNumber: "4510", name: "Rentelasten", accountType: "expense", category: "Financieringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4510 },
    { accountNumber: "4520", name: "Betalingskosten (iDEAL/PIN)", accountType: "expense", category: "Financieringskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4520 },
    { accountNumber: "4600", name: "Reiskosten", accountType: "expense", category: "Reis- en vervoerskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4600 },
    { accountNumber: "4610", name: "Autokosten", accountType: "expense", category: "Reis- en vervoerskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4610 },
    { accountNumber: "4620", name: "Brandstofkosten", accountType: "expense", category: "Reis- en vervoerskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4620 },
    { accountNumber: "4630", name: "Parkeerkosten", accountType: "expense", category: "Reis- en vervoerskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4630 },
    { accountNumber: "4640", name: "OV-kosten", accountType: "expense", category: "Reis- en vervoerskosten", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4640 },
    { accountNumber: "4700", name: "Marketingkosten", accountType: "expense", category: "Verkoop en marketing", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4700 },
    { accountNumber: "4710", name: "Advertentiekosten", accountType: "expense", category: "Verkoop en marketing", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4710 },
    { accountNumber: "4720", name: "Website en SEO", accountType: "expense", category: "Verkoop en marketing", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4720 },
    { accountNumber: "4730", name: "Acquisitiekosten", accountType: "expense", category: "Verkoop en marketing", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4730 },
    { accountNumber: "4800", name: "Representatiekosten", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4800 },
    { accountNumber: "4810", name: "Relatiegeschenken", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4810 },
    { accountNumber: "4820", name: "Kantinekosten", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4820 },
    { accountNumber: "4900", name: "Overige bedrijfskosten", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4900 },
    { accountNumber: "4910", name: "Kleine aanschaffingen", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4910 },
    { accountNumber: "4920", name: "Opleidingskosten", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4920 },
    { accountNumber: "4930", name: "Contributies en lidmaatschappen", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4930 },
    { accountNumber: "4940", name: "Boetes en aanmaningskosten", accountType: "expense", category: "Representatie en overig", statementSection: "Bedrijfskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 4940 },

    // 5xxx - Afschrijvingen / financieel / bijzonder
    { accountNumber: "5000", name: "Afschrijvingskosten inventaris", accountType: "expense", category: "Afschrijvingen", statementSection: "Afschrijvingen", normalBalance: "debit", isBalanceSheet: false, sortOrder: 5000 },
    { accountNumber: "5010", name: "Afschrijvingskosten computers", accountType: "expense", category: "Afschrijvingen", statementSection: "Afschrijvingen", normalBalance: "debit", isBalanceSheet: false, sortOrder: 5010 },
    { accountNumber: "5020", name: "Afschrijvingskosten vervoermiddelen", accountType: "expense", category: "Afschrijvingen", statementSection: "Afschrijvingen", normalBalance: "debit", isBalanceSheet: false, sortOrder: 5020 },
    { accountNumber: "5030", name: "Afschrijvingskosten machines", accountType: "expense", category: "Afschrijvingen", statementSection: "Afschrijvingen", normalBalance: "debit", isBalanceSheet: false, sortOrder: 5030 },
    { accountNumber: "5100", name: "Rentebaten", accountType: "revenue", category: "Financiele baten en lasten", statementSection: "Financiele baten en lasten", normalBalance: "credit", isBalanceSheet: false, sortOrder: 5100 },
    { accountNumber: "5200", name: "Buitengewone baten", accountType: "revenue", category: "Financiele baten en lasten", statementSection: "Buitengewone baten en lasten", normalBalance: "credit", isBalanceSheet: false, sortOrder: 5200 },
    { accountNumber: "5300", name: "Buitengewone lasten", accountType: "expense", category: "Financiele baten en lasten", statementSection: "Buitengewone baten en lasten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 5300 },

    // 6xxx - Personeelskosten (Personnel)
    { accountNumber: "6000", name: "Brutolonen", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6000 },
    { accountNumber: "6100", name: "Sociale lasten", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6100 },
    { accountNumber: "6200", name: "Pensioenlasten", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6200 },
    { accountNumber: "6300", name: "Overige personeelskosten", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6300 },
    { accountNumber: "6400", name: "Ingehuurde krachten / ZZP", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6400 },
    { accountNumber: "6500", name: "Uitzendkrachten", accountType: "expense", category: "Personeelskosten", statementSection: "Personeelskosten", normalBalance: "debit", isBalanceSheet: false, sortOrder: 6500 },

    // 7xxx - Inkoopkosten / kostprijs omzet (Cost of sales)
    { accountNumber: "7000", name: "Inkoop handelsgoederen", accountType: "expense", category: "Inkoopkosten", statementSection: "Kostprijs omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 7000 },
    { accountNumber: "7010", name: "Inkoop grondstoffen", accountType: "expense", category: "Inkoopkosten", statementSection: "Kostprijs omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 7010 },
    { accountNumber: "7100", name: "Uitbesteed werk / onderaanneming", accountType: "expense", category: "Inkoopkosten", statementSection: "Kostprijs omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 7100 },
    { accountNumber: "7200", name: "Overige directe kosten", accountType: "expense", category: "Inkoopkosten", statementSection: "Kostprijs omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 7200 },
    { accountNumber: "7300", name: "Voorraadmutaties", accountType: "expense", category: "Inkoopkosten", statementSection: "Kostprijs omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 7300 },

    // 8xxx - Omzet (Revenue)
    { accountNumber: "8000", name: "Omzet dienstverlening", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8000 },
    { accountNumber: "8010", name: "Omzet producten", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8010 },
    { accountNumber: "8020", name: "Omzet overig", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8020 },
    { accountNumber: "8100", name: "Omzet EU (intracommunautair)", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8100 },
    { accountNumber: "8200", name: "Omzet buiten EU (export)", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8200 },
    { accountNumber: "8300", name: "Omzet verlegd", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8300 },
    { accountNumber: "8400", name: "Omzet vrijgesteld", accountType: "revenue", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "credit", isBalanceSheet: false, sortOrder: 8400 },
    { accountNumber: "8500", name: "Kortingen en bonussen", accountType: "contra", category: "Omzet", statementSection: "Netto-omzet", normalBalance: "debit", isBalanceSheet: false, sortOrder: 8500 },

    // 9xxx - Kortlopende schulden / BTW
    { accountNumber: "9000", name: "Crediteuren", accountType: "liability", category: "Kortlopende schulden", statementSection: "Kortlopende schulden", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9000 },
    { accountNumber: "9100", name: "Af te dragen BTW", accountType: "liability", category: "Kortlopende schulden", statementSection: "Belastingen en premies", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9100 },
    { accountNumber: "9110", name: "Te vorderen BTW (voorbelasting)", accountType: "asset", category: "Kortlopende schulden", statementSection: "Belastingen en premies", normalBalance: "debit", isBalanceSheet: true, sortOrder: 9110 },
    { accountNumber: "9120", name: "BTW afdracht", accountType: "liability", category: "Kortlopende schulden", statementSection: "Belastingen en premies", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9120 },
    { accountNumber: "9200", name: "Loonheffingen", accountType: "liability", category: "Kortlopende schulden", statementSection: "Belastingen en premies", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9200 },
    { accountNumber: "9300", name: "Overige schulden", accountType: "liability", category: "Kortlopende schulden", statementSection: "Kortlopende schulden", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9300 },
    { accountNumber: "9400", name: "Nog te betalen bedragen", accountType: "liability", category: "Kortlopende schulden", statementSection: "Overlopende passiva", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9400 },
    { accountNumber: "9500", name: "Langlopende leningen", accountType: "liability", category: "Langlopende schulden", statementSection: "Langlopende schulden", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9500 },
    { accountNumber: "9510", name: "Rekening-courant DGA", accountType: "liability", category: "Langlopende schulden", statementSection: "Langlopende schulden", normalBalance: "credit", isBalanceSheet: true, sortOrder: 9510 },
  ];

  for (const account of ledgerAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { accountNumber: account.accountNumber },
      update: {},
      create: { ...account, isSystem: true },
    });
  }
  console.log(`Created ${ledgerAccounts.length} ledger accounts`);

  // ═══ VAT CODES (BTW-codes) ═══
  const btwAf = await prisma.ledgerAccount.findUnique({ where: { accountNumber: "9100" } });
  const btwVoor = await prisma.ledgerAccount.findUnique({ where: { accountNumber: "9110" } });

  const vatCodes = [
    // Sales VAT codes
    { code: "VH21", name: "Verkoop hoog tarief", description: "BTW 21% op verkopen binnen Nederland", percentage: 21.0, type: "sales", rubricCode: "1a", ledgerAccountId: btwAf?.id || null },
    { code: "VL9", name: "Verkoop laag tarief", description: "BTW 9% op verkopen binnen Nederland", percentage: 9.0, type: "sales", rubricCode: "1b", ledgerAccountId: btwAf?.id || null },
    { code: "V0", name: "Verkoop nultarief", description: "Leveringen met 0% BTW (bijv. bepaalde voedingsmiddelen)", percentage: 0.0, type: "sales", rubricCode: "1c", ledgerAccountId: null },
    { code: "VVRL", name: "Verkoop vrijgesteld", description: "Vrijgestelde prestaties zonder BTW-aftrekrecht", percentage: 0.0, type: "sales", rubricCode: null, ledgerAccountId: null },
    { code: "VRL", name: "Verkoop verlegd", description: "BTW verlegd naar afnemer (reverse charge binnenland)", percentage: 0.0, type: "sales", rubricCode: "2a", ledgerAccountId: null },
    { code: "VICP", name: "Intracommunautaire levering", description: "Levering aan BTW-ondernemer binnen EU (ICP)", percentage: 0.0, type: "sales", rubricCode: "3b", ledgerAccountId: null },
    { code: "VEXP", name: "Export buiten EU", description: "Uitvoer naar landen buiten de Europese Unie", percentage: 0.0, type: "sales", rubricCode: "3a", ledgerAccountId: null },

    // Purchase VAT codes
    { code: "IH21", name: "Inkoop hoog tarief", description: "BTW 21% op inkopen binnen Nederland", percentage: 21.0, type: "purchase", rubricCode: "5b", ledgerAccountId: btwVoor?.id || null },
    { code: "IL9", name: "Inkoop laag tarief", description: "BTW 9% op inkopen binnen Nederland", percentage: 9.0, type: "purchase", rubricCode: "5b", ledgerAccountId: btwVoor?.id || null },
    { code: "I0", name: "Inkoop geen BTW", description: "Inkoop zonder BTW (vrijgesteld of geen BTW-factuur)", percentage: 0.0, type: "purchase", rubricCode: null, ledgerAccountId: null },
    { code: "IICP", name: "Intracommunautaire verwerving", description: "Verwerving van BTW-ondernemer binnen EU", percentage: 21.0, type: "purchase", rubricCode: "4b", ledgerAccountId: btwVoor?.id || null },
    { code: "IIMP", name: "Invoer buiten EU", description: "Invoer uit landen buiten de Europese Unie", percentage: 21.0, type: "purchase", rubricCode: "4a", ledgerAccountId: btwVoor?.id || null },
  ];

  for (const vc of vatCodes) {
    await prisma.vatCode.upsert({
      where: { code: vc.code },
      update: {},
      create: { ...vc, isSystem: true },
    });
  }
  console.log(`Created ${vatCodes.length} VAT codes`);

  console.log("Seed data created successfully!");
  console.log("Demo login: demo@boekhouder.nl / DemoPass1");
  console.log("Boekhouder login: pieter@boekhouder.nl / BoekPass1");
  console.log("Admin login: moustafa@digitalmountains.nl / AdminPass1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
