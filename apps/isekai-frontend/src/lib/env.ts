/*
 * Copyright (C) 2025 Isekai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { z } from "zod";

const envSchema = z.object({
  // Required
  VITE_API_URL: z.string().min(1, "VITE_API_URL is required"),
  VITE_DEVIANTART_CLIENT_ID: z
    .string()
    .min(1, "VITE_DEVIANTART_CLIENT_ID is required"),

  // Optional
  VITE_R2_PUBLIC_URL: z.string().url().default("https://storage.isekai.sh"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(import.meta.env);

  if (!result.success) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Environment Variable Validation Failed");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("\nMissing or invalid environment variables:\n");

    const errors = result.error.flatten();

    // Show field-specific errors
    for (const [field, messages] of Object.entries(errors.fieldErrors)) {
      if (messages && messages.length > 0) {
        console.error(`  ${field}:`);
        messages.forEach((msg) => console.error(`    - ${msg}`));
      }
    }

    // Show form-level errors if any
    if (errors.formErrors.length > 0) {
      console.error("\nGeneral errors:");
      errors.formErrors.forEach((msg) => console.error(`  - ${msg}`));
    }

    console.error("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Please check your .env file and ensure all required");
    console.error("environment variables are set correctly.");
    console.error("See apps/isekai-frontend/.env.example for reference.");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    throw new Error("Invalid environment variables - see console for details");
  }

  return result.data;
}

export const env = validateEnv();
