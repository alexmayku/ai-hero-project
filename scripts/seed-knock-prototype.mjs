// Throwaway: isolated Development in-app fixtures. Run with node scripts/seed-knock-prototype.mjs.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const env = parseEnv(readFileSync('.env', 'utf8'));
if (env.KNOCK_ENVIRONMENT !== 'development' || !env.KNOCK_PROTOTYPE_WORKFLOW_KEY || !env.KNOCK_API_KEY) throw new Error('Development workflow configuration required');
const examples = [
  [5, 'reply', 'Your instructor replied', 'Test notification: there is a reply to your TypeScript lesson question.', '/courses/introduction-to-typescript/lessons/1'],
  [5, 'lesson', 'A new lesson is ready', 'Test notification: your instructor announced a TypeScript lesson.', '/courses/introduction-to-typescript/lessons/1'],
  [5, 'purchase', 'Your course purchase is confirmed', 'Test notification: Introduction to TypeScript is ready to start.', '/courses/introduction-to-typescript'],
  [6, 'purchase', 'Your course purchase is confirmed', 'Test notification for the second recipient only.', '/courses/introduction-to-typescript'],
];
for (const [user, kind, title, body, url] of examples) {
  const response = await fetch(`https://api.knock.app/v1/workflows/${encodeURIComponent(env.KNOCK_PROTOTYPE_WORKFLOW_KEY)}/trigger`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.KNOCK_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `cadence-feed-prototype-v1-${user}-${kind}` },
    body: JSON.stringify({ recipients: [{ id: `cadence-prototype-${user}`, name: `Prototype recipient ${user}`, preferences: { default: { channel_types: { in_app_feed: true, email: false, sms: false, push: false, chat: false, http: false } } } }], data: { title, body, url, prototype: true, kind } }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Trigger failed: ${response.status} ${result.code ?? ''}`);
  console.log(JSON.stringify({ user, kind, status: response.status, workflow_run_id: result.workflow_run_id }));
}
