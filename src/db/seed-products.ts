import { db } from "./index";
import {
  agreementTemplate,
  agreementTemplateSku,
  bundle,
  bundleFeature,
  service,
  serviceCategory,
  serviceFeature,
  servicePlan,
} from "./schema";
import { eq, inArray, notInArray, sql } from "drizzle-orm";
import { createHash } from "crypto";
import {
  AGREEMENT_SKU_MAPPINGS,
  AGREEMENT_TEMPLATES,
  BUNDLES,
  CATEGORIES,
  LEGACY_CATEGORY_IDS,
  agreementTemplateForBundle,
  agreementTemplateForService,
  serviceDefinitionForBundle,
  serviceDefinitionForPlan,
  type BillingFrequency,
  type BillingType,
} from "../lib/pricing";

function cents(value: number | null | undefined) {
  return value == null ? null : Math.round(value * 100).toString();
}

function billingType(value: BillingType | undefined) {
  return value ?? "recurring";
}

function billingFrequency(input: {
  billingFrequency?: BillingFrequency;
  billingType?: BillingType;
  unit?: string;
}) {
  if (input.billingFrequency) return input.billingFrequency;
  if (input.billingType === "once_off") return "once_off";
  if ((input.unit ?? "").toLowerCase().includes("year")) return "year";
  return "month";
}

function minimumTermMonths(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "monthly" || normalized === "month") return 1;
  const parsed = Number.parseInt(normalized.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return normalized.includes("year") ? parsed * 12 : parsed;
}

function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function seedProducts() {
  console.log("Seeding full product catalog...");
  try {
    const columnStatements = [
      sql`ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "note" text`,
      sql`ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL`,
      sql`ALTER TABLE "service_category" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL`,
      sql`ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL`,
      sql`ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "setupPriceZar" text`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "billingFrequency" text DEFAULT 'month' NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "minimumTerm" text`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "billingType" text DEFAULT 'recurring' NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "priceLabel" text`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "isBundle" boolean DEFAULT false NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "serviceNote" text`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "serviceDefinition" text`,
      sql`ALTER TABLE "service_plan" ADD COLUMN IF NOT EXISTS "agreementTemplateId" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "setupPriceZar" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "unit" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "billingFrequency" text DEFAULT 'month' NOT NULL`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "minimumTerm" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "billingType" text DEFAULT 'recurring' NOT NULL`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "priceLabel" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "isBundle" boolean DEFAULT true NOT NULL`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "sortOrder" integer DEFAULT 0 NOT NULL`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "categoryNote" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "serviceNote" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "serviceDefinition" text`,
      sql`ALTER TABLE "bundle" ADD COLUMN IF NOT EXISTS "agreementTemplateId" text`,
      sql`ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "agreementSigned" boolean DEFAULT false NOT NULL`,
      sql`ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "agreementSignedAt" timestamp`,
      sql`ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "requiredAgreementTemplateId" text`,
      sql`ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "minimumTermMonths" integer`,
      sql`ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "minimumTermEndsAt" timestamp`,
    ];
    for (const statement of columnStatements) {
      await db.execute(statement);
    }
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "agreement_template" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "documentType" text DEFAULT 'sla' NOT NULL,
        "version" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "contentHash" text NOT NULL,
        "effectiveFrom" timestamp DEFAULT now() NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "agreement_template_sku" (
        "id" text PRIMARY KEY NOT NULL,
        "templateId" text NOT NULL,
        "productType" text NOT NULL,
        "productId" text NOT NULL,
        "required" boolean DEFAULT true NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "signed_agreement" (
        "id" text PRIMARY KEY NOT NULL,
        "userId" text NOT NULL,
        "subscriptionId" text,
        "templateId" text NOT NULL,
        "templateVersion" text NOT NULL,
        "productType" text NOT NULL,
        "productId" text NOT NULL,
        "documentHash" text NOT NULL,
        "consentText" text NOT NULL,
        "documentSnapshot" text NOT NULL,
        "ipAddress" text,
        "userAgent" text,
        "signedAt" timestamp DEFAULT now() NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log("Seeding agreement templates...");
    for (const template of AGREEMENT_TEMPLATES) {
      await db
        .insert(agreementTemplate)
        .values({
          id: template.id,
          name: template.name,
          documentType: template.documentType,
          version: template.version,
          status: "active",
          title: template.title,
          body: template.body,
          contentHash: contentHash(`${template.id}:${template.version}:${template.body}`),
          effectiveFrom: new Date("2026-07-05T00:00:00.000Z"),
        })
        .onConflictDoUpdate({
          target: agreementTemplate.id,
          set: {
            name: template.name,
            documentType: template.documentType,
            version: template.version,
            status: "active",
            title: template.title,
            body: template.body,
            contentHash: contentHash(`${template.id}:${template.version}:${template.body}`),
            updatedAt: new Date(),
          },
        });
    }

    for (const category of CATEGORIES) {
      // 1. Insert Category
      await db
        .insert(serviceCategory)
        .values({
          id: category.id,
          name: category.name,
          tagline: category.tagline,
          accent: category.accent,
          note: category.note || null,
          sortOrder: category.sortOrder ?? 0,
          active: category.active ?? true,
        })
        .onConflictDoUpdate({
          target: serviceCategory.id,
          set: {
            name: category.name,
            tagline: category.tagline,
            accent: category.accent,
            note: category.note || null,
            sortOrder: category.sortOrder ?? 0,
            active: category.active ?? true,
          },
        });

      // 2. Insert Services
      for (const srv of category.services) {
        await db
          .insert(service)
          .values({
            id: srv.id,
            categoryId: category.id,
            name: srv.name,
            description: srv.description || null,
            note: srv.note || null,
            sortOrder: srv.sortOrder ?? 0,
            active: srv.active ?? true,
          })
          .onConflictDoUpdate({
            target: service.id,
            set: {
              categoryId: category.id,
              name: srv.name,
              description: srv.description || null,
              note: srv.note || null,
              sortOrder: srv.sortOrder ?? 0,
              active: srv.active ?? true,
            },
          });

        // 3. Insert Plans
        for (const plan of srv.plans) {
          const planAgreementTemplateId =
            plan.agreementTemplateId ?? agreementTemplateForService(srv.id, plan.id);
          const planServiceDefinition =
            plan.serviceDefinition ?? serviceDefinitionForPlan(category, srv, plan);
          await db
            .insert(servicePlan)
            .values({
              id: plan.id,
              serviceId: srv.id,
              name: plan.name,
              tagline: plan.tagline || null,
              priceZar: cents(plan.priceZar),
              setupPriceZar: cents(plan.setupPriceZar),
              unit: plan.unit || null,
              billingFrequency: billingFrequency(plan),
              minimumTerm: plan.minimumTerm || null,
              minimumTermMonths: minimumTermMonths(plan.minimumTerm),
              billingType: billingType(plan.billingType),
              priceLabel: plan.priceLabel || null,
              isBundle: plan.isBundle || false,
              sortOrder: plan.sortOrder ?? 0,
              serviceNote: plan.serviceNote || null,
              active: plan.active ?? true,
              trialDays: plan.trialDays ?? null,
              highlighted: plan.highlighted || false,
              badge: plan.badge || null,
              serviceDefinition: JSON.stringify(planServiceDefinition),
              agreementTemplateId: planAgreementTemplateId,
            })
            .onConflictDoUpdate({
              target: servicePlan.id,
              set: {
                serviceId: srv.id,
                name: plan.name,
                priceZar: cents(plan.priceZar),
                setupPriceZar: cents(plan.setupPriceZar),
                unit: plan.unit || null,
                billingFrequency: billingFrequency(plan),
                minimumTerm: plan.minimumTerm || null,
                minimumTermMonths: minimumTermMonths(plan.minimumTerm),
                billingType: billingType(plan.billingType),
                priceLabel: plan.priceLabel || null,
                isBundle: plan.isBundle || false,
                sortOrder: plan.sortOrder ?? 0,
                serviceNote: plan.serviceNote || null,
                active: plan.active ?? true,
                trialDays: plan.trialDays ?? null,
                highlighted: plan.highlighted || false,
                badge: plan.badge || null,
                tagline: plan.tagline || null,
                serviceDefinition: JSON.stringify(planServiceDefinition),
                agreementTemplateId: planAgreementTemplateId,
              },
            });

          // 4. Insert Features
          await db.delete(serviceFeature).where(eq(serviceFeature.planId, plan.id));
          for (let i = 0; i < plan.features.length; i++) {
            const featId = `${plan.id}_feat_${i}`;
            await db
              .insert(serviceFeature)
              .values({
                id: featId,
                planId: plan.id,
                content: plan.features[i],
              })
              .onConflictDoUpdate({
                target: serviceFeature.id,
                set: { content: plan.features[i], planId: plan.id },
              });
          }
        }
      }
    }

    const activeCategoryIds = CATEGORIES.map((item) => item.id);
    const activeServiceIds = CATEGORIES.flatMap((category) =>
      category.services.map((item) => item.id),
    );
    const activePlanIds = CATEGORIES.flatMap((category) =>
      category.services.flatMap((srv) => srv.plans.map((item) => item.id)),
    );
    await db
      .update(serviceCategory)
      .set({ active: false })
      .where(inArray(serviceCategory.id, [...LEGACY_CATEGORY_IDS]));
    await db.update(service).set({ active: false }).where(notInArray(service.id, activeServiceIds));
    await db
      .update(servicePlan)
      .set({ active: false })
      .where(notInArray(servicePlan.id, activePlanIds));

    console.log("Seeding bundles...");
    for (const b of BUNDLES) {
      const bundleAgreementTemplateId = b.agreementTemplateId ?? agreementTemplateForBundle(b.id);
      const bundleServiceDefinition = b.serviceDefinition ?? serviceDefinitionForBundle(b);
      await db
        .insert(bundle)
        .values({
          id: b.id,
          name: b.name,
          priceZar: cents(b.priceZar) ?? "0",
          setupPriceZar: cents(b.setupPriceZar),
          unit: b.unit || null,
          billingFrequency: billingFrequency(b),
          minimumTerm: b.minimumTerm || null,
          minimumTermMonths: minimumTermMonths(b.minimumTerm),
          billingType: billingType(b.billingType),
          priceLabel: b.priceLabel || null,
          isBundle: b.isBundle ?? true,
          sortOrder: b.sortOrder ?? 0,
          categoryNote: b.categoryNote || null,
          serviceNote: b.serviceNote || null,
          active: b.active ?? true,
          highlighted: b.highlighted || false,
          badge: b.badge || null,
          serviceDefinition: JSON.stringify(bundleServiceDefinition),
          agreementTemplateId: bundleAgreementTemplateId,
        })
        .onConflictDoUpdate({
          target: bundle.id,
          set: {
            name: b.name,
            priceZar: cents(b.priceZar) ?? "0",
            setupPriceZar: cents(b.setupPriceZar),
            unit: b.unit || null,
            billingFrequency: billingFrequency(b),
            minimumTerm: b.minimumTerm || null,
            minimumTermMonths: minimumTermMonths(b.minimumTerm),
            billingType: billingType(b.billingType),
            priceLabel: b.priceLabel || null,
            isBundle: b.isBundle ?? true,
            sortOrder: b.sortOrder ?? 0,
            categoryNote: b.categoryNote || null,
            serviceNote: b.serviceNote || null,
            active: b.active ?? true,
            highlighted: b.highlighted || false,
            badge: b.badge || null,
            serviceDefinition: JSON.stringify(bundleServiceDefinition),
            agreementTemplateId: bundleAgreementTemplateId,
          },
        });

      await db.delete(bundleFeature).where(eq(bundleFeature.bundleId, b.id));
      for (let i = 0; i < b.features.length; i++) {
        const featId = `${b.id}_feat_${i}`;
        await db
          .insert(bundleFeature)
          .values({
            id: featId,
            bundleId: b.id,
            content: b.features[i],
          })
          .onConflictDoUpdate({
            target: bundleFeature.id,
            set: { content: b.features[i], bundleId: b.id },
          });
      }
    }

    await db
      .update(bundle)
      .set({ active: false })
      .where(
        notInArray(
          bundle.id,
          BUNDLES.map((item) => item.id),
        ),
      );

    console.log("Seeding agreement SKU mappings...");
    for (const mapping of AGREEMENT_SKU_MAPPINGS) {
      await db
        .insert(agreementTemplateSku)
        .values({
          id: mapping.id,
          templateId: mapping.templateId,
          productType: mapping.productType,
          productId: mapping.productId,
          required: mapping.required,
        })
        .onConflictDoUpdate({
          target: agreementTemplateSku.id,
          set: {
            templateId: mapping.templateId,
            productType: mapping.productType,
            productId: mapping.productId,
            required: mapping.required,
          },
        });
    }

    console.log("Full product catalog and bundles seeded successfully!");
  } catch (err) {
    console.error("Failed to seed products:", err);
  }
  process.exit(0);
}

seedProducts();
