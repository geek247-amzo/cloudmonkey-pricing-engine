import { db } from "./index";
import { invoice, invoiceItem, user } from "./schema";
import { eq } from "drizzle-orm";
import { initializePayment } from "../lib/paystack";

async function seed() {
  console.log("Creating invoice...");
  try {
    const adminUser = await db.query.user.findFirst({
      where: eq(user.email, "amrish@cloudmonkey.co.za"),
    });

    if (!adminUser) {
      console.log("Admin user not found. Run seed-admin.ts first.");
      process.exit(1);
    }

    const newInvoice = await db.insert(invoice).values({
      id: "inv_" + Date.now(),
      userId: adminUser.id,
      amount: 499900, // R 4999.00 in cents
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    }).returning();

    const createdInvoice = newInvoice[0];

    await db.insert(invoiceItem).values({
      id: "item_" + Date.now(),
      invoiceId: createdInvoice.id,
      description: "Complete Bundle - Monthly Subscription",
      quantity: 1,
      unitPrice: 499900,
      amount: 499900,
    });

    // Initialize Paystack payment
    const payment = await initializePayment({
      email: adminUser.email,
      amountCents: 499900,
      invoiceId: createdInvoice.id,
      subscriptionId: createdInvoice.id,
      userId: adminUser.id,
    });

    await db.update(invoice).set({
      paystackReference: payment.data.reference,
      paystackUrl: payment.data.authorization_url,
    }).where(eq(invoice.id, createdInvoice.id));

    console.log(`Invoice created! Pay at: ${payment.data.authorization_url}`);
  } catch (error) {
    console.error("Error creating invoice:", error);
  }
  process.exit(0);
}

seed();
