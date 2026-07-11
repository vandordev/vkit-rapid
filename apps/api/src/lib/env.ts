import { z } from "zod";

const rawEnv = process.env;

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
	PORT: z.coerce.number().default(4101),
	CORS_ORIGIN: z.string().default("http://localhost:4100"),
	LOG_LEVEL: z.string().optional(),
});

export const env = envSchema.parse(rawEnv);

export type Env = z.infer<typeof envSchema>;
