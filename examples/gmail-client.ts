/**
 * Gmail Client Example - Complete Email Operations
 *
 * This example demonstrates how to use IMAP (reading) and SMTP (sending)
 * together for a complete email client experience with Gmail.
 *
 * ## Gmail Authentication Methods
 *
 * ### Option 1: App Password (Recommended for development)
 * 1. Enable 2-Step Verification on your Google Account
 * 2. Go to https://myaccount.google.com/apppasswords
 * 3. Create an App Password for "Mail"
 * 4. Use this 16-character password in the URI
 *
 * ### Option 2: OAuth2 (Recommended for production)
 * 1. Create a project in Google Cloud Console
 * 2. Enable Gmail API
 * 3. Create OAuth2 credentials (Desktop app type)
 * 4. Get refresh token using OAuth flow
 *
 * ## Server Configuration
 * - IMAP: imap.gmail.com:993 (SSL)
 * - SMTP: smtp.gmail.com:587 (STARTTLS) or smtp.gmail.com:465 (SSL)
 *
 * Usage:
 *   # With environment variables (real Gmail)
 *   GMAIL_USER=your@gmail.com GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx pnpm tsx examples/gmail-client.ts
 *
 *   # Demo mode (mock connectors)
 *   pnpm tsx examples/gmail-client.ts
 */

import type { IMAPConnector, IMAPMessage, IMAPSession } from '@unireq/imap';
import { imapOperation } from '@unireq/imap';
import { preset } from '@unireq/presets';
import type { SendResult, SMTPConnector, SMTPSession } from '@unireq/smtp';

// ============================================================================
// Configuration
// ============================================================================

const GMAIL_USER = process.env['GMAIL_USER'];
const GMAIL_APP_PASSWORD = process.env['GMAIL_APP_PASSWORD'];
const USE_REAL_GMAIL = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

// ============================================================================
// Mock Connectors (for demonstration without real Gmail credentials)
// ============================================================================

function createMockImapConnector(): IMAPConnector {
  const mockSession: IMAPSession = {
    connected: true,
    host: 'imap.gmail.com',
    user: 'demo@gmail.com',
    usable: true,
    secure: true,
  };

  // Simulated inbox messages
  const mockMessages: IMAPMessage[] = [
    {
      seq: 1,
      uid: 101,
      envelope: {
        from: [{ name: 'GitHub', address: 'noreply@github.com' }],
        subject: '[unireq] New pull request #42: Add BYOC support',
        date: new Date('2025-01-15T10:30:00Z'),
      },
    },
    {
      seq: 2,
      uid: 102,
      envelope: {
        from: [{ name: 'Alice Developer', address: 'alice@company.com' }],
        subject: 'Re: Code review feedback',
        date: new Date('2025-01-15T09:15:00Z'),
      },
    },
    {
      seq: 3,
      uid: 103,
      envelope: {
        from: [{ name: 'Newsletter', address: 'news@techweekly.com' }],
        subject: 'This Week in TypeScript',
        date: new Date('2025-01-14T08:00:00Z'),
      },
    },
    {
      seq: 4,
      uid: 104,
      envelope: {
        from: [{ name: 'Cloud Platform', address: 'alerts@cloud.google.com' }],
        subject: 'Your monthly usage summary',
        date: new Date('2025-01-13T12:00:00Z'),
      },
    },
    {
      seq: 5,
      uid: 105,
      envelope: {
        from: [{ name: 'Bob Manager', address: 'bob@company.com' }],
        subject: 'Team standup notes',
        date: new Date('2025-01-12T15:30:00Z'),
      },
    },
  ];

  // Simulated folders
  const mockFolders = [
    { name: 'INBOX', type: 1 },
    { name: '[Gmail]/All Mail', type: 1 },
    { name: '[Gmail]/Drafts', type: 1 },
    { name: '[Gmail]/Sent Mail', type: 1 },
    { name: '[Gmail]/Spam', type: 1 },
    { name: '[Gmail]/Trash', type: 1 },
    { name: '[Gmail]/Starred', type: 1 },
    { name: 'Work', type: 1 },
    { name: 'Personal', type: 1 },
  ];

  return {
    capabilities: {
      imap: true,
      xoauth2: true,
      idle: true,
      append: true,
      search: true,
      move: true,
      flags: true,
      expunge: true,
    },

    connect: async (uri) => {
      console.log(`[IMAP] Connected to: ${new URL(uri).host}`);
      return mockSession;
    },

    request: async (_session, context) => {
      const operation = context['operation'] as string;
      const mailbox = context['mailbox'] as string | undefined;
      const range = context['range'] as string | undefined;

      switch (operation) {
        case 'list':
          console.log('[IMAP] Listing mailboxes...');
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: mockFolders,
            ok: true,
          };

        case 'fetch': {
          const limit = range ? Number.parseInt(range.split(':')[1] ?? '10', 10) || 10 : 10;
          const messages = mockMessages.slice(0, limit);
          console.log(`[IMAP] Fetching ${messages.length} messages from ${mailbox}...`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: messages,
            ok: true,
          };
        }

        case 'search': {
          const criteria = context['criteria'] as Record<string, unknown> | undefined;
          console.log(`[IMAP] Searching in ${mailbox}:`, JSON.stringify(criteria));
          // Return all UIDs for demo
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: mockMessages.map((m) => m.uid),
            ok: true,
          };
        }

        default:
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { success: true },
            ok: true,
          };
      }
    },

    disconnect: () => {
      console.log('[IMAP] Disconnected');
    },
  };
}

function createMockSmtpConnector(): SMTPConnector {
  const mockSession: SMTPSession = {
    connected: true,
    host: 'smtp.gmail.com',
    user: 'demo@gmail.com',
    secure: true,
  };

  return {
    capabilities: {
      smtp: true,
      smtps: true,
      starttls: true,
      oauth2: true,
      html: true,
      attachments: true,
    },

    connect: async (uri) => {
      console.log(`[SMTP] Connected to: ${new URL(uri).host}`);
      return mockSession;
    },

    request: async (_session, context) => {
      const message = context.body as {
        from: string;
        to: string;
        subject: string;
        text?: string;
        html?: string;
      };

      console.log(`[SMTP] Sending email...`);
      console.log(`  From: ${message.from}`);
      console.log(`  To: ${message.to}`);
      console.log(`  Subject: ${message.subject}`);

      const result: SendResult = {
        accepted: [typeof message.to === 'string' ? message.to : 'recipient@example.com'],
        rejected: [],
        messageId: `<${Date.now()}.mock@gmail.com>`,
        response: '250 2.0.0 OK Mock SMTP',
      };

      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: result,
        ok: true,
      };
    },

    disconnect: () => {
      console.log('[SMTP] Disconnected');
    },
  };
}

// ============================================================================
// Main Application
// ============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Gmail Client Example - Unireq');
  console.log('='.repeat(60));
  console.log('');

  if (USE_REAL_GMAIL) {
    console.log('Mode: REAL GMAIL (using environment credentials)');
    console.log(`User: ${GMAIL_USER}`);
  } else {
    console.log('Mode: DEMO (using mock connectors)');
    console.log('');
    console.log('To use real Gmail, set environment variables:');
    console.log('  GMAIL_USER=your@gmail.com');
    console.log('  GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx');
  }
  console.log('');
  console.log('-'.repeat(60));

  // ============================================================================
  // Create clients
  // ============================================================================

  // Extract credentials (validated above when USE_REAL_GMAIL is true)
  // biome-ignore lint/style/noNonNullAssertion: validated when USE_REAL_GMAIL is true
  const gmailUser = USE_REAL_GMAIL ? encodeURIComponent(GMAIL_USER!) : 'demo';
  // biome-ignore lint/style/noNonNullAssertion: validated when USE_REAL_GMAIL is true
  const gmailPassword = USE_REAL_GMAIL ? encodeURIComponent(GMAIL_APP_PASSWORD!) : 'password';

  // IMAP client for reading emails
  const imapUri = `imaps://${gmailUser}:${gmailPassword}@imap.gmail.com:993`;

  const mail = USE_REAL_GMAIL
    ? preset.imap.uri(imapUri).retry.build()
    : preset.imap.uri(imapUri).connector(createMockImapConnector()).retry.build();

  // SMTP client for sending emails
  const smtpUri = `smtp://${gmailUser}:${gmailPassword}@smtp.gmail.com:587`;

  const sender = USE_REAL_GMAIL
    ? preset.smtp.uri(smtpUri).retry.build()
    : preset.smtp.uri(smtpUri).connector(createMockSmtpConnector()).retry.build();

  // ============================================================================
  // 1. List mailboxes/folders
  // ============================================================================

  console.log('');
  console.log('1. LISTING MAILBOXES');
  console.log('-'.repeat(40));

  try {
    // Use the raw client for list operation since it's not in the facade
    // biome-ignore lint/suspicious/noExplicitAny: 'list' operation is handled by mock connector but not yet in IMAPOperation type
    const response = await mail.raw.get<{ name: string }[]>('/', imapOperation('list' as any, {}));
    const folders = response.data ?? [];

    console.log(`Found ${folders.length} mailboxes:`);
    for (const folder of folders) {
      console.log(`  - ${folder.name}`);
    }
  } catch (error) {
    console.error('Failed to list mailboxes:', error);
  }

  // ============================================================================
  // 2. Read last 10 emails from INBOX
  // ============================================================================

  console.log('');
  console.log('2. READING LAST 10 EMAILS FROM INBOX');
  console.log('-'.repeat(40));

  try {
    const messages = await mail.fetch('INBOX', '1:10');

    console.log(`Found ${messages.length} emails:`);
    console.log('');

    for (const msg of messages) {
      const from = msg.envelope?.from?.[0];
      const date = msg.envelope?.date ? new Date(msg.envelope.date).toLocaleDateString() : 'Unknown date';

      console.log(`[UID: ${msg.uid}] ${date}`);
      console.log(`  From: ${from?.name ?? from?.address ?? 'Unknown'}`);
      console.log(`  Subject: ${msg.envelope?.subject ?? '(no subject)'}`);
      console.log('');
    }
  } catch (error) {
    console.error('Failed to fetch emails:', error);
  }

  // ============================================================================
  // 3. Search for unread emails
  // ============================================================================

  console.log('');
  console.log('3. SEARCHING FOR UNREAD EMAILS');
  console.log('-'.repeat(40));

  try {
    const unreadUids = await mail.search('INBOX', { seen: false });
    console.log(
      `Found ${unreadUids.length} unread emails: [${unreadUids.slice(0, 5).join(', ')}${unreadUids.length > 5 ? '...' : ''}]`,
    );
  } catch (error) {
    console.error('Failed to search:', error);
  }

  // ============================================================================
  // 4. Send a test email to yourself
  // ============================================================================

  console.log('');
  console.log('4. SENDING TEST EMAIL');
  console.log('-'.repeat(40));

  try {
    // biome-ignore lint/style/noNonNullAssertion: GMAIL_USER is validated when USE_REAL_GMAIL is true
    const fromEmail = USE_REAL_GMAIL ? GMAIL_USER! : 'demo@gmail.com';
    // biome-ignore lint/style/noNonNullAssertion: GMAIL_USER is validated when USE_REAL_GMAIL is true
    const toEmail = USE_REAL_GMAIL ? GMAIL_USER! : 'demo@gmail.com';

    const result = await sender.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Test email from Unireq Gmail Client',
      text: `Hello!

This is a test email sent using Unireq's SMTP transport.

Time: ${new Date().toISOString()}

Best regards,
Unireq Gmail Client`,
      html: `
<h1>Hello!</h1>
<p>This is a test email sent using <strong>Unireq's SMTP transport</strong>.</p>
<p><em>Time: ${new Date().toISOString()}</em></p>
<hr>
<p>Best regards,<br>Unireq Gmail Client</p>
`,
    });

    console.log('Email sent successfully!');
    console.log(`  Message ID: ${result.messageId}`);
    console.log(`  Accepted: ${result.accepted.join(', ')}`);
    if (result.rejected.length > 0) {
      console.log(`  Rejected: ${result.rejected.join(', ')}`);
    }
  } catch (error) {
    console.error('Failed to send email:', error);
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('');
  console.log('Operations performed:');
  console.log('  1. Listed mailboxes (IMAP)');
  console.log('  2. Read last 10 emails (IMAP)');
  console.log('  3. Searched for unread emails (IMAP)');
  console.log('  4. Sent test email (SMTP)');
  console.log('');
  console.log('Gmail Client Example completed!');
}

main().catch(console.error);
