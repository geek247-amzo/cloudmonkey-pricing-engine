import { db } from "./index";
import { serviceCategory, service, servicePlan, serviceFeature, bundle, bundleFeature } from "./schema";
import { CATEGORIES, BUNDLES } from "../lib/pricing";

async function seedProducts() {
  console.log("Seeding full product catalog...");
  try {
    for (const category of CATEGORIES) {
      // 1. Insert Category
      await db.insert(serviceCategory).values({
        id: category.id,
        name: category.name,
        tagline: category.tagline,
        accent: category.accent,
      }).onConflictDoUpdate({
        target: serviceCategory.id,
        set: { name: category.name, tagline: category.tagline, accent: category.accent }
      });

      // 2. Insert Services
      for (const srv of category.services) {
        await db.insert(service).values({
          id: srv.id,
          categoryId: category.id,
          name: srv.name,
          description: srv.description || null,
          note: srv.note || null,
        }).onConflictDoUpdate({
          target: service.id,
          set: { name: srv.name, description: srv.description || null, note: srv.note || null }
        });

        // 3. Insert Plans
        for (const plan of srv.plans) {
          await db.insert(servicePlan).values({
            id: plan.id,
            serviceId: srv.id,
            name: plan.name,
            tagline: plan.tagline || null,
            priceZar: plan.priceZar !== null ? (plan.priceZar * 100).toString() : null, // Store in cents as string
            unit: plan.unit || null,
            trialDays: plan.trialDays ?? null,
            highlighted: plan.highlighted || false,
            badge: plan.badge || null,
          }).onConflictDoUpdate({
            target: servicePlan.id,
            set: { 
              name: plan.name, 
              priceZar: plan.priceZar !== null ? (plan.priceZar * 100).toString() : null,
              unit: plan.unit || null,
              trialDays: plan.trialDays ?? null,
              highlighted: plan.highlighted || false,
              badge: plan.badge || null,
              tagline: plan.tagline || null
            }
          });

          // 4. Insert Features
          for (let i = 0; i < plan.features.length; i++) {
             const featId = `${plan.id}_feat_${i}`;
             try {
                await db.insert(serviceFeature).values({
                  id: featId,
                  planId: plan.id,
                  content: plan.features[i]
                }).onConflictDoNothing();
             } catch(e) {}
          }
        }
      }
    }

    console.log("Seeding bundles...");
    for (const b of BUNDLES) {
      await db.insert(bundle).values({
        id: b.id,
        name: b.name,
        priceZar: (b.priceZar * 100).toString(),
        highlighted: b.highlighted || false,
        badge: b.badge || null,
      }).onConflictDoUpdate({
        target: bundle.id,
        set: { name: b.name, priceZar: (b.priceZar * 100).toString(), highlighted: b.highlighted || false, badge: b.badge || null }
      });

      for (let i = 0; i < b.features.length; i++) {
        const featId = `${b.id}_feat_${i}`;
        try {
          await db.insert(bundleFeature).values({
            id: featId,
            bundleId: b.id,
            content: b.features[i]
          }).onConflictDoNothing();
        } catch(e) {}
      }
    }

    console.log("Full product catalog and bundles seeded successfully!");
  } catch (err) {
    console.error("Failed to seed products:", err);
  }
  process.exit(0);
}

seedProducts();
