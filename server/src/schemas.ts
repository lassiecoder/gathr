import { z } from 'zod';

export const CATEGORIES = ['social', 'tech', 'music', 'food', 'sports', 'arts', 'outdoors', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100, 'Title is too long'),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description is too long'),
    startsAt: z.iso.datetime({ offset: true, message: 'Start must be a valid date and time' }),
    endsAt: z.iso.datetime({ offset: true, message: 'End must be a valid date and time' }).nullable().default(null),
    location: z.object({
      name: z.string().trim().min(2, 'Location is required').max(120, 'Location is too long'),
      address: z.string().trim().max(200, 'Address is too long').default(''),
    }),
    category: z.enum(CATEGORIES, { message: 'Pick a category' }),
    capacity: z.number().int('Capacity must be a whole number').min(1, 'Capacity must be at least 1').max(100_000).nullable().default(null),
  })
  .refine((e) => !e.endsAt || Date.parse(e.endsAt) > Date.parse(e.startsAt), {
    path: ['endsAt'],
    message: 'End time must be after the start time',
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export const rsvpSchema = z.object({
  status: z.enum(['going', 'interested', 'waitlist']),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  mine: z.enum(['going', 'hosting']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
