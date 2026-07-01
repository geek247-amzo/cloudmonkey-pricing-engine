import { db } from "./index";
import { user, account } from "./schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

async function changePassword() {
  const newPassword = "amrish1327";
  const targetEmail = "amrish@cloudmonkey.co.za";

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
