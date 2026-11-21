import { z } from "zod";

export const AVATAR_MODELS = ["sakura", "ren", "hana", "kai"] as const;
export type AvatarModel = (typeof AVATAR_MODELS)[number];

/** A signed-in player's look. `hue` rotates the model's colours; leave it out for the default palette. */
export const AvatarSchema = z.object({
  model: z.enum(AVATAR_MODELS),
  hue: z.number().min(0).max(360).optional(),
});
export type UserAvatar = z.infer<typeof AvatarSchema>;

export const DEFAULT_USER_AVATAR: UserAvatar = { model: "sakura" };

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export const UsernameSchema = z
  .string()
  .min(USERNAME_MIN, `Use at least ${USERNAME_MIN} characters.`)
  .max(USERNAME_MAX, `Use at most ${USERNAME_MAX} characters.`)
  .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only.");

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`);

const AnonIdSchema = z.string().regex(/^[a-z0-9-]{8,64}$/);

export const RegisterInputSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
  /** The browser's anonymous id: its attempts move to the new account. */
  anonId: AnonIdSchema.optional(),
  avatar: AvatarSchema.optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/** Login does not re-check the username's shape or the password's length: a bad pair is just a bad pair. */
export const LoginInputSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  anonId: AnonIdSchema.optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AvatarUpdateSchema = z.object({ avatar: AvatarSchema });
export type AvatarUpdate = z.infer<typeof AvatarUpdateSchema>;

/** What the server ever says about an account. No hash, no salt, no identity. */
export const PublicUserSchema = z.object({ id: z.string(), username: z.string(), avatar: AvatarSchema });
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const MeSchema = z.object({ user: PublicUserSchema.nullable() });
export type Me = z.infer<typeof MeSchema>;

export const MyAttemptSchema = z.object({ questionId: z.string(), score: z.number().int().min(0).max(100), day: z.string() });
export type MyAttempt = z.infer<typeof MyAttemptSchema>;
