import { sleep } from "./_util";

const emailTemplates: Record<string, { label: string; body: string; updatedAt: string }> = {};

export async function saveEmailTemplate(
  key: string,
  label: string,
  body: string,
): Promise<{ savedAt: string }> {
  await sleep(120);
  const savedAt = new Date().toISOString();
  emailTemplates[key] = { label, body, updatedAt: savedAt };
  return { savedAt };
}

export async function getEmailTemplate(key: string) {
  await sleep(40);
  return emailTemplates[key] ?? null;
}

export async function listEmailTemplates() {
  await sleep(40);
  return { ...emailTemplates };
}
