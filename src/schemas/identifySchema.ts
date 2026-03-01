import { z } from 'zod';

export const identifySchema = z
  .object({
    email: z
      .string()
      .email('Invalid email format')
      .optional()
      .nullable(),
    phoneNumber: z
      .union([z.string(), z.number()])
      .transform((val) => String(val))
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      const hasEmail = data.email != null && data.email !== '';
      const hasPhone = data.phoneNumber != null && data.phoneNumber !== '';
      return hasEmail || hasPhone;
    },
    {
      message: 'At least one of email or phoneNumber must be provided',
    }
  );