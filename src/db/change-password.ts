import { db } from "./index";
import { user, account } from "./schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

async function changePassword() {
  const targetEmail = process.argv[2] ?? process.env.CLOUDMONKEY_TARGET_EMAIL;
  const newPassword = process.env.CLOUDMONKEY_NEW_PASSWORD;

  if (!targetEmail || !newPassword) {
    console.error(
      "Usage: CLOUDMONKEY_NEW_PASSWORD='...' bun run src/db/change-password.ts <email>",
    );
    process.exit(1);
  }

  console.log(`Changing password for ${targetEmail}...`);

  try {
    const targetUser = await db.query.user.findFirst({
      where: eq(user.email, targetEmail),
    });

    if (!targetUser) {
      console.log("User not found!");
      process.exit(1);
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(account)
      .set({ password: hashedPassword })
      .where(
        and(
          eq(account.userId, targetUser.id),
          eq(account.providerId, "credential") // Better Auth usually uses 'credential' for email/password
        )
      );

    console.log("Password updated successfully!");
  } catch (err) {
    console.error("Failed to update password:", err);
  }
  process.exit(0);
}

changePassword();
