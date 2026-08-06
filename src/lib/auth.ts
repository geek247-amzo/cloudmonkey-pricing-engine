import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, twoFactor } from "better-auth/plugins";
import { db } from "../db";
import * as schema from "../db/schema";

const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
			twoFactor: schema.twoFactor,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		microsoft: {
			clientId: process.env.MICROSOFT_CLIENT_ID!,
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
			tenantId: process.env.MICROSOFT_TENANT_ID ?? "common",
		},
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				defaultValue: "customer",
			},
		},
	},
	plugins: [
		twoFactor({
			issuer: "CloudMonkey",
			totpOptions: {
				issuer: "CloudMonkey",
			},
			twoFactorCookieMaxAge: 10 * 60,
			trustDeviceMaxAge: 30 * 24 * 60 * 60,
		}),
		...(recaptchaSecretKey
			? [
					captcha({
						provider: "google-recaptcha",
						secretKey: recaptchaSecretKey,
						// Sign-up remains protected by reCAPTCHA. Sign-in is protected by
						// Better Auth rate limiting and account-level MFA, while avoiding
						// false negatives from reCAPTCHA score/hostname validation.
						endpoints: ["/sign-up/email"],
						expectedAction: "auth_email",
						minScore: Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5),
						allowedHostnames: (process.env.RECAPTCHA_ALLOWED_HOSTNAMES ?? "cloudmonkey.co.za,www.cloudmonkey.co.za")
							.split(",")
							.map((hostname) => hostname.trim())
							.filter(Boolean),
					}),
				]
			: []),
	],
});
