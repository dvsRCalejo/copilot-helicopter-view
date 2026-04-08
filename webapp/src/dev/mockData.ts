/**
 * DEV-ONLY mock data — a dummy agent with realistic transcripts for UI testing.
 * Gated behind import.meta.env.DEV so it's tree-shaken out of production builds.
 */
import type { CopilotAgent, ConversationTranscript } from '@/types';

const DUMMY_BOT_ID = '00000000-dead-beef-0000-000000000001';

function daysAgo(n: number, hourOffset = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

const MOCK_CHANNELS = ['msteams', 'msteams', 'msteams', 'directline', 'directline', 'webchat'];

function makeTranscript(
  id: string,
  createdDaysAgo: number,
  messages: Array<{ role: 'user' | 'bot'; text: string }>,
  durationMinutes = 2,
): ConversationTranscript {
  const created = daysAgo(createdDaysAgo, 8 + Math.floor(Math.random() * 10));
  const startTs = new Date(created);
  const channelId = MOCK_CHANNELS[Math.floor(Math.random() * MOCK_CHANNELS.length)];

  const activities = messages.map((m, i) => ({
    type: 'message' as const,
    id: `act-${id}-${i}`,
    channelId,
    timestamp: new Date(startTs.getTime() + i * (durationMinutes * 60_000) / messages.length).toISOString(),
    from: {
      id: m.role === 'user' ? 'user-001' : 'bot-001',
      name: m.role === 'user' ? 'Test User' : 'HR Assistant',
      role: m.role,
    },
    text: m.text,
  }));

  return {
    conversationtranscriptid: id,
    name: `Demo session ${id.slice(-4)}`,
    createdon: created,
    modifiedon: created,
    content: JSON.stringify({ activities }),
    schematype: 'powervirtualagents',
    conversationstarttime: created,
    _bot_conversationtranscriptid_value: DUMMY_BOT_ID,
  };
}

// ── Dummy agent ──────────────────────────────────────────────────────────────

export const MOCK_AGENT: CopilotAgent = {
  botid: DUMMY_BOT_ID,
  name: '🧪 Demo HR Assistant',
  iconbase64: null,
  statecode: 0,
  statuscode: 1,
  publishedon: daysAgo(14),
  createdon: daysAgo(60),
  modifiedon: daysAgo(0),
  _owninguser_value: null,
  _ownerid_value: null,
  description: 'Dummy agent with mock data for local testing. Only visible in dev mode.',
  language: 1033,
  runtimeprovider: 1,
  schemaname: 'cr_demohr',
  isOwner: true,
  environmentId: 'dev-mock',
  environmentDisplayName: 'Development (Mock)',
  instanceUrl: 'https://dev.crm.dynamics.com',
};

// ── Dummy transcripts — spread across the last 30 days ───────────────────────

const successfulConversations: Array<Array<{ role: 'user' | 'bot'; text: string }>> = [
  [
    { role: 'user', text: 'What is the PTO policy?' },
    { role: 'bot', text: 'Full-time employees accrue 20 days of PTO per year. You can carry over up to 5 unused days.' },
    { role: 'user', text: 'How do I request time off?' },
    { role: 'bot', text: 'You can submit a PTO request through the HR portal under "Time & Absence". Your manager will receive a notification to approve.' },
    { role: 'user', text: 'Thanks!' },
    { role: 'bot', text: 'You\'re welcome! Let me know if you need anything else.' },
  ],
  [
    { role: 'user', text: 'How do I enroll in benefits?' },
    { role: 'bot', text: 'Open enrollment runs from November 1–15 each year. You can access the benefits portal from the HR dashboard.' },
    { role: 'user', text: 'What plans are available?' },
    { role: 'bot', text: 'We offer three health plans: Basic, Standard, and Premium. Dental and vision are included in Standard and Premium.' },
  ],
  [
    { role: 'user', text: 'I need to update my emergency contact' },
    { role: 'bot', text: 'You can update your emergency contact information in the HR portal under "Personal Information". Would you like me to send you the direct link?' },
    { role: 'user', text: 'Yes please' },
    { role: 'bot', text: 'Here you go: https://hr.contoso.com/personal-info. The changes take effect immediately.' },
  ],
  [
    { role: 'user', text: 'What is the remote work policy?' },
    { role: 'bot', text: 'Employees can work remotely up to 3 days per week with manager approval. You need to submit a remote work agreement through the HR portal.' },
  ],
  [
    { role: 'user', text: 'How do I submit an expense report?' },
    { role: 'bot', text: 'Expense reports are submitted through Concur. Log in at expenses.contoso.com, create a new report, attach receipts, and submit for manager approval.' },
    { role: 'user', text: 'What is the approval timeline?' },
    { role: 'bot', text: 'Most expense reports are approved within 3 business days. Reimbursement is processed in the next payroll cycle after approval.' },
    { role: 'user', text: 'Great, thanks for the info' },
    { role: 'bot', text: 'Happy to help! Don\'t hesitate to reach out if you have more questions.' },
  ],
];

const failedConversations: Array<Array<{ role: 'user' | 'bot'; text: string }>> = [
  [
    { role: 'user', text: 'Can you book a flight for me?' },
  ],
  [
    { role: 'user', text: 'asdfghjkl' },
  ],
  [
    { role: 'user', text: 'What is the meaning of life?' },
  ],
];

function generateTranscripts(): ConversationTranscript[] {
  const transcripts: ConversationTranscript[] = [];
  let counter = 0;

  // Generate ~3-5 sessions per day for the last 30 days (mix of success/fail)
  for (let daysBack = 0; daysBack < 30; daysBack++) {
    const sessionsToday = 2 + Math.floor(Math.random() * 4); // 2–5 sessions

    for (let s = 0; s < sessionsToday; s++) {
      counter++;
      const id = `mock-${String(counter).padStart(4, '0')}`;
      const isFail = Math.random() < 0.15; // ~15% failure rate

      if (isFail) {
        const conv = failedConversations[counter % failedConversations.length];
        transcripts.push(makeTranscript(id, daysBack, conv, 0.5));
      } else {
        const conv = successfulConversations[counter % successfulConversations.length];
        transcripts.push(makeTranscript(id, daysBack, conv, 1 + Math.random() * 4));
      }
    }
  }

  // Sort newest first
  return transcripts.sort(
    (a, b) => new Date(b.createdon).getTime() - new Date(a.createdon).getTime()
  );
}

export const MOCK_TRANSCRIPTS = generateTranscripts();
