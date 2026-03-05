import { TonePreset } from './types';

export const TONE_PRESETS: TonePreset[] = [
  {
    id: 'executive-direct',
    label: 'Executive Direct',
    generate: (context: string) =>
      `Thanks for flagging this. ${context} I'll handle it — expect an update by end of day.`,
  },
  {
    id: 'warm-collaborative',
    label: 'Warm Collaborative',
    generate: (context: string) =>
      `Hi! Thanks so much for reaching out about this. ${context} Let's find a time to connect and figure out the best path forward together.`,
  },
  {
    id: 'brief-acknowledge',
    label: 'Brief Acknowledge',
    generate: (context: string) =>
      `Got it — ${context} Will circle back shortly.`,
  },
  {
    id: 'decline-gracefully',
    label: 'Decline Gracefully',
    generate: (context: string) =>
      `I appreciate you thinking of me for this. ${context} Unfortunately, I'm not able to take this on right now given current priorities. Happy to revisit next quarter if timing works better.`,
  },
];

export const WRITING_STYLE = `You are drafting a professional reply. Match this writing style:
- Direct and decisive, but warm when appropriate
- Short paragraphs, no filler words
- Confident tone, clear next steps when applicable
- Uses first person naturally ("I'll handle it", "Let's connect")
- Professional but not stiff — conversational
- Signs off simply or not at all depending on context`;

export function outlookEmailUrl(messageId: string): string {
  return `https://outlook.office365.com/mail/id/${encodeURIComponent(messageId)}`;
}

export function teamsChannelUrl(teamId: string, channelId: string): string {
  return `https://teams.microsoft.com/l/channel/${encodeURIComponent(channelId)}/?groupId=${encodeURIComponent(teamId)}`;
}

export function asanaTaskUrl(taskGid: string): string {
  return `https://app.asana.com/0/0/${encodeURIComponent(taskGid)}/f`;
}

export function salesforceOpportunityUrl(sfId: string, instanceUrl?: string): string {
  const base = instanceUrl || 'https://login.salesforce.com';
  return `${base}/lightning/r/Opportunity/${encodeURIComponent(sfId)}/view`;
}
