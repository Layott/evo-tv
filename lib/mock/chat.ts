import type { ChatMessage } from "@/lib/types";
import { sleep, minutesAgo, now } from "./_util";
import { chatAvatar } from "./_media";

const mockBodies = [
  "LET'S GO ALPHA 🔥",
  "that rotation was insane",
  "nova getting cooked rn",
  "who's casting tonight?",
  "Viper popping off again",
  "first time watching, how does the bracket work?",
  "chat too fast",
  "stream quality 10/10",
  "bro the commentary is elite",
  "10 more minutes of hype",
  "DID YOU SEE THAT 1v3?!",
  "💀💀💀",
  "pog",
  "this is why I sub",
  "new meta confirmed",
  "caster needs a raise",
  "imagine playing without comms",
  "anyone else on mobile?",
  "Lagos represent 🇳🇬",
  "gg wp",
];

const mockSenders = [
  { id: "user_10", handle: "viewer10", avatar: "V10" },
  { id: "user_11", handle: "viewer11", avatar: "V11" },
  { id: "user_12", handle: "viewer12", avatar: "V12" },
  { id: "user_premium", handle: "pro_watcher", avatar: "PR" },
  { id: "user_admin", handle: "evo_admin", avatar: "AD" },
];

export function seedMessages(streamId: string, count = 30): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const sender = mockSenders[i % mockSenders.length]!;
    return {
      id: `msg_${streamId}_${i}`,
      streamId,
      userId: sender.id,
      userHandle: sender.handle,
      userAvatarUrl: chatAvatar(sender.handle),
      userRole: sender.handle === "evo_admin" ? "admin" : sender.handle === "pro_watcher" ? "premium" : "user",
      body: mockBodies[i % mockBodies.length]!,
      createdAt: minutesAgo(count - i),
      isDeleted: false,
      isPinned: false,
    };
  });
}

export async function listInitialMessages(streamId: string): Promise<ChatMessage[]> {
  await sleep(100);
  return seedMessages(streamId);
}

// In-memory moderation log (mock only — Phase 1+ replaces with chat_messages table writes).
const moderationLog: Array<{ action: "pin" | "delete" | "ban"; messageId: string; userHandle: string; at: string }> = [];
const bannedUsers = new Set<string>();

export async function pinMessage(messageId: string, userHandle: string): Promise<void> {
  await sleep(80);
  moderationLog.push({ action: "pin", messageId, userHandle, at: now() });
}

export async function deleteMessage(messageId: string, userHandle: string): Promise<void> {
  await sleep(80);
  moderationLog.push({ action: "delete", messageId, userHandle, at: now() });
}

export async function banUser(userHandle: string, durationHours = 24): Promise<void> {
  await sleep(120);
  bannedUsers.add(userHandle);
  moderationLog.push({ action: "ban", messageId: "", userHandle, at: now() });
  // duration intentionally unused — server-side enforcement comes in Phase 2.
  void durationHours;
}

export function isUserBanned(userHandle: string): boolean {
  return bannedUsers.has(userHandle);
}

export function getModerationLog() {
  return moderationLog.slice();
}

export function makeIncomingMessage(streamId: string): ChatMessage {
  const sender = mockSenders[Math.floor(Math.random() * mockSenders.length)]!;
  return {
    id: `msg_${streamId}_${Date.now()}_${Math.random()}`,
    streamId,
    userId: sender.id,
    userHandle: sender.handle,
    userAvatarUrl: chatAvatar(sender.handle),
    userRole: "user",
    body: mockBodies[Math.floor(Math.random() * mockBodies.length)]!,
    createdAt: now(),
    isDeleted: false,
    isPinned: false,
  };
}
