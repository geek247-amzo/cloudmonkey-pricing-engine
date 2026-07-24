import { db } from "./db";
import { eq, inArray } from "drizzle-orm";
import {
  user,
  affiliate,
  affiliateReferral,
  affiliateCommission,
  affiliatePayout,
  affiliateFraudFlag,
  supportTicket,
  supportTicketComment,
  website,
  websiteDomain,
  websiteDesignOption,
  websitePluginInstall,
  websiteReviewRequest,
  websiteApprovalToken,
  websiteStore,
  websiteStoreDatabase,
  storeOrder,
  storeOrderItem,
  storePayment,
  invoice,
  invoiceItem,
  invoicePayment,
  serverContainer,
  serverDatabase,
  serverSecurityFinding,
  serverTelemetrySnapshot,
  subscription,
  registeredDomain,
  domainOrder,
  vultrInstance,
  aiAgent,
  onboardingSubmission,
  signedAgreement,
  storeInventoryMovement,
  session as sessionTable,
  account,
  auditLog
} from "./db/schema";

async function main() {
  const userId = "cJEbt5jxutM2M3wTabIB7R45ELdPKwfC";
  console.log("Testing deletion for user:", userId);
  try {
    await db.transaction(async (tx) => {
      // 1. Delete affiliate relations
      const userAffiliates = await tx.select({ id: affiliate.id }).from(affiliate).where(eq(affiliate.userId, userId));
      const affiliateIds = userAffiliates.map((a) => a.id);
      if (affiliateIds.length > 0) {
        await tx.delete(affiliateReferral).where(inArray(affiliateReferral.affiliateId, affiliateIds));
        await tx.delete(affiliateCommission).where(inArray(affiliateCommission.affiliateId, affiliateIds));
        await tx.delete(affiliatePayout).where(inArray(affiliatePayout.affiliateId, affiliateIds));
        await tx.delete(affiliateFraudFlag).where(inArray(affiliateFraudFlag.affiliateId, affiliateIds));
        await tx.delete(affiliate).where(eq(affiliate.userId, userId));
      }
      await tx.delete(affiliateReferral).where(eq(affiliateReferral.referredUserId, userId));

      // 2. Delete support tickets & comments
      const userTickets = await tx.select({ id: supportTicket.id }).from(supportTicket).where(eq(supportTicket.userId, userId));
      const ticketIds = userTickets.map((t) => t.id);
      if (ticketIds.length > 0) {
        await tx.delete(supportTicketComment).where(inArray(supportTicketComment.ticketId, ticketIds));
        await tx.delete(supportTicket).where(eq(supportTicket.userId, userId));
      }

      // 3. Delete websites & e-commerce stores
      const userWebsites = await tx.select({ id: website.id }).from(website).where(eq(website.userId, userId));
      const websiteIds = userWebsites.map((w) => w.id);
      if (websiteIds.length > 0) {
        await tx.delete(websiteDomain).where(inArray(websiteDomain.websiteId, websiteIds));
        await tx.delete(websiteDesignOption).where(inArray(websiteDesignOption.websiteId, websiteIds));
        await tx.delete(websitePluginInstall).where(inArray(websitePluginInstall.websiteId, websiteIds));
        await tx.delete(websiteReviewRequest).where(inArray(websiteReviewRequest.websiteId, websiteIds));
        await tx.delete(websiteApprovalToken).where(inArray(websiteApprovalToken.websiteId, websiteIds));

        const userStores = await tx.select({ id: websiteStore.id }).from(websiteStore).where(inArray(websiteStore.websiteId, websiteIds));
        const storeIds = userStores.map((s) => s.id);
        if (storeIds.length > 0) {
          const userOrders = await tx.select({ id: storeOrder.id }).from(storeOrder).where(inArray(storeOrder.storeId, storeIds));
          const orderIds = userOrders.map((o) => o.id);
          if (orderIds.length > 0) {
            await tx.delete(storeOrderItem).where(inArray(storeOrderItem.orderId, orderIds));
            await tx.delete(storePayment).where(inArray(storePayment.orderId, orderIds));
            await tx.delete(storeOrder).where(inArray(storeOrder.storeId, storeIds));
          }
          await tx.delete(websiteStoreDatabase).where(inArray(websiteStoreDatabase.storeId, storeIds));
          await tx.delete(websiteStore).where(inArray(websiteStore.websiteId, websiteIds));
        }
        await tx.delete(website).where(eq(website.userId, userId));
      }

      // 4. Delete invoices & invoice items
      const userInvoices = await tx.select({ id: invoice.id }).from(invoice).where(eq(invoice.userId, userId));
      const invoiceIds = userInvoices.map((i) => i.id);
      if (invoiceIds.length > 0) {
        await tx.delete(invoiceItem).where(inArray(invoiceItem.invoiceId, invoiceIds));
        await tx.delete(invoicePayment).where(inArray(invoicePayment.invoiceId, invoiceIds));
        await tx.delete(invoice).where(eq(invoice.userId, userId));
      }

      // 5. Delete servers & containers
      await tx.delete(serverContainer).where(eq(serverContainer.userId, userId));
      await tx.delete(serverDatabase).where(eq(serverDatabase.userId, userId));
      await tx.delete(serverSecurityFinding).where(eq(serverSecurityFinding.userId, userId));
      await tx.delete(serverTelemetrySnapshot).where(eq(serverTelemetrySnapshot.userId, userId));

      // 6. Delete other user-owned records
      await tx.delete(subscription).where(eq(subscription.userId, userId));
      await tx.delete(registeredDomain).where(eq(registeredDomain.userId, userId));
      await tx.delete(domainOrder).where(eq(domainOrder.userId, userId));
      await tx.delete(vultrInstance).where(eq(vultrInstance.userId, userId));
      await tx.delete(aiAgent).where(eq(aiAgent.userId, userId));
      await tx.delete(onboardingSubmission).where(eq(onboardingSubmission.userId, userId));
      await tx.delete(signedAgreement).where(eq(signedAgreement.userId, userId));
      await tx.delete(storeInventoryMovement).where(eq(storeInventoryMovement.createdBy, userId));

      // 7. Delete auth sessions & accounts
      await tx.delete(sessionTable).where(eq(sessionTable.userId, userId));
      await tx.delete(account).where(eq(account.userId, userId));

      // 8. Nullify audit log associations
      await tx.update(auditLog).set({ actorUserId: null }).where(eq(auditLog.actorUserId, userId));

      // 9. Finally delete the user
      await tx.delete(user).where(eq(user.id, userId));
    });
    console.log("Success! Transaction completed successfully.");
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  }
}

main().then(() => process.exit(0));
