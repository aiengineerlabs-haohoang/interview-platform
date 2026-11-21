import { z } from "zod";

export const ROOM_IDS = ["llm-inference", "agents", "ml-fundamentals", "language-models", "reinforcement-learning"] as const;
export type RoomId = (typeof ROOM_IDS)[number];
export const RoomIdSchema = z.enum(ROOM_IDS);

export const LEVELS = ["mid", "senior", "staff"] as const;
export type Level = (typeof LEVELS)[number];

export const EXPRESSIONS = ["neutral", "thinking", "confident", "confused", "shocked", "smug", "warm"] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const AVATARS = ["owl", "fox", "cat", "rabbit"] as const;
export type Avatar = (typeof AVATARS)[number];

/** One thing a strong answer has to say. `patterns` are case-insensitive regexes run over the normalised answer. */
export const PointSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(8),
  weight: z.number().int().min(1).max(3),
  patterns: z.array(z.string().min(2)).min(1),
});
export type Point = z.infer<typeof PointSchema>;

export const QuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  room: RoomIdSchema,
  level: z.enum(LEVELS),
  title: z.string().min(6),
  /** What the interviewer says. */
  prompt: z.string().min(40),
  /** The confident wrong answer, in the candidate's voice, and why it fails. */
  trap: z.object({
    saying: z.string().min(10),
    whyWrong: z.string().min(30),
    /** If the answer matches one of these and misses most points, the interviewer calls the trap. */
    patterns: z.array(z.string().min(2)).default([]),
  }),
  points: z.array(PointSchema).min(3).max(7),
  /** The mechanism, one short paragraph. */
  mechanism: z.string().min(60),
  /** The sayable answer. */
  clincher: z.string().min(40),
  seconds: z.number().int().min(60).max(600).default(180),
});
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionInput = z.input<typeof QuestionSchema>;

export interface Room {
  id: RoomId;
  floor: number;
  name: string;
  tagline: string;
  /** Door and wall accent. */
  color: string;
}

export const AttemptInputSchema = z.object({
  anonId: z.string().regex(/^[a-z0-9-]{8,64}$/),
  questionId: z.string().regex(/^[a-z0-9-]{3,80}$/),
  score: z.number().int().min(0).max(100),
  seconds: z.number().int().min(0).max(3600),
});
export type AttemptInput = z.infer<typeof AttemptInputSchema>;

export const PresenceInputSchema = z.object({
  anonId: z.string().regex(/^[a-z0-9-]{8,64}$/),
  room: RoomIdSchema.nullable().default(null),
  avatar: z.enum(AVATARS).default("owl"),
});
export type PresenceInput = z.infer<typeof PresenceInputSchema>;
