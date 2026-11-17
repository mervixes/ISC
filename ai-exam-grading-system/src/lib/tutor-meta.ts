/**
 * Small client-safe pieces of the tutor's data model. Kept out of lib/tutor.ts so the chat
 * component never pulls server-only database code into the browser bundle.
 */
export const MEMORY_KINDS = ["fact", "preference", "target", "observation", "plan"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_LABEL: Record<MemoryKind, string> = {
  fact: "About you",
  preference: "How you like to work",
  target: "Your targets",
  observation: "What the tutor has noticed",
  plan: "Your plan",
};

export interface MemoryRow {
  id: number;
  kind: MemoryKind;
  content: string;
  createdAt: string;
}
