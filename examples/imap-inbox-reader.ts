/**
 * IMAP Inbox Reader Example using preset.imap facade
 *
 * This example demonstrates how to use the IMAP facade for common email operations:
 * - Connecting to an IMAP server with OAuth2 authentication
 * - Reading inbox messages
 * - Searching for specific emails
 * - Managing flags and moving messages
 *
 * Usage: pnpm example:imap
 *
 * Note: This example uses mock implementations for demonstration.
 * In production, the default ImapFlowConnector will be used automatically.
 */

import type { IMAPConnector, IMAPMessage, IMAPSession } from '@unireq/imap';
import { preset } from '@unireq/presets';

// Create a mock IMAP connector for demonstration
// In production, simply omit the .connector() call to use the default ImapFlowConnector
function createMockConnector(): IMAPConnector {
  const mockSession: IMAPSession = {
    connected: true,
    host: 'imap.example.com',
    user: 'demo@example.com',
    usable: true,
    secure: true,
  };

  // Simulated messages
  const mockMessages: IMAPMessage[] = [
    {
      seq: 1,
      uid: 1,
      envelope: {
        from: [{ name: 'Alice', address: 'alice@example.com' }],
        subject: 'Hello from Unireq!',
        date: new Date(),
      },
    },
    {
      seq: 2,
      uid: 2,
      envelope: {
        from: [{ name: 'Bob', address: 'bob@example.com' }],
        subject: 'Re: Hello from Unireq!',
        date: new Date(),
      },
    },
    {
      seq: 3,
      uid: 3,
      envelope: {
        from: [{ name: 'Newsletter', address: 'news@example.com' }],
        subject: 'Weekly Newsletter',
        date: new Date(),
      },
    },
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
      console.log(`🔌 Connected to IMAP server: ${uri}`);
      return mockSession;
    },

    request: async (_session, context) => {
      const operation = context['operation'] as string;
      const mailbox = context['mailbox'] as string | undefined;
      const range = context['range'] as string | number[] | undefined;
      const criteria = context['criteria'] as Record<string, unknown> | undefined;
      const flags = context['flags'] as string[] | undefined;
      const destination = context['destination'] as string | undefined;

      switch (operation) {
        case 'fetch':
          console.log(`📧 Fetching messages from ${mailbox}: ${range || '1:*'}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: mockMessages,
            ok: true,
          };

        case 'select':
          console.log(`📬 Selected mailbox: ${mailbox}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: mockMessages,
            ok: true,
          };

        case 'search':
          console.log(`🔍 Searching in ${mailbox}:`, JSON.stringify(criteria));
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: [1, 2, 3], // UIDs
            ok: true,
          };

        case 'addFlags':
          console.log(`🏷️  Adding flags ${flags} to messages ${range}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { flagsAdded: flags || [] },
            ok: true,
          };

        case 'removeFlags':
          console.log(`🏷️  Removing flags ${flags} from messages ${range}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { flagsRemoved: flags || [] },
            ok: true,
          };

        case 'move':
          console.log(`📦 Moving messages ${range} to ${destination}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { moved: true, destination: destination },
            ok: true,
          };

        case 'expunge':
          console.log(`🗑️  Expunging messages from ${mailbox}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { expunged: true },
            ok: true,
          };

        case 'append':
          console.log(`📝 Appending message to ${mailbox}`);
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { uid: 100 },
            ok: true,
          };

        case 'idle':
          console.log('⏳ Entering IDLE mode...');
          return {
            status: 200,
            statusText: 'OK',
            headers: {},
            data: { status: 'idle' },
            ok: true,
          };

        default:
          return {
            status: 400,
            statusText: 'Bad Request',
            headers: {},
            data: { error: `Unknown operation: ${operation}` },
            ok: false,
          };
      }
    },

    disconnect: () => {
      console.log('🔌 Disconnected from IMAP server');
    },
  };
}

async function main() {
  console.log('📬 IMAP Inbox Reader Example\n');
  console.log('='.repeat(50));

  // Create mock connector for demonstration
  const mockConnector = createMockConnector();

  // Build IMAP client using the fluent facade API
  // In production, omit .connector() to use the default ImapFlowConnector:
  //   const mail = preset.imap
  //     .uri('imap://user:pass@imap.gmail.com')
  //     .auth({ tokenSupplier: () => getOAuthToken() })
  //     .retry
  //     .build();
  const mail = preset.imap
    .uri('imap://demo:password@imap.example.com')
    .connector(mockConnector)
    .auth({ tokenSupplier: () => 'mock-oauth-token' })
    .retry.build();

  console.log('\n📖 Reading inbox messages...\n');

  // Fetch all messages from INBOX
  const messages = await mail.fetch('INBOX', '1:*');

  console.log(`\n📨 Found ${messages.length} messages:\n`);

  for (const msg of messages) {
    const from = msg.envelope?.from?.[0];
    console.log(`  [UID: ${msg.uid}] From: ${from?.name || from?.address || 'Unknown'}`);
    console.log(`           Subject: ${msg.envelope?.subject || '(no subject)'}`);
    console.log('');
  }

  console.log('='.repeat(50));
  console.log('\n🔍 Searching for unread messages...\n');

  // Search for unread emails
  const unreadUids = await mail.search('INBOX', { seen: false });
  console.log(`Found ${unreadUids.length} unread messages: [${unreadUids.join(', ')}]`);

  console.log('\n🏷️  Managing flags...\n');

  // Mark messages as read
  const flagResult = await mail.addFlags('INBOX', [2], ['\\Seen']);
  console.log(`Flags added: ${flagResult.flagsAdded.join(', ')}`);

  console.log('\n📦 Moving messages...\n');

  // Move newsletter to a folder
  const moveResult = await mail.move('INBOX', 'Archive', [3]);
  console.log(`Moved to: ${moveResult.destination}`);

  console.log('\n🗑️  Expunging deleted messages...\n');

  // Expunge deleted messages
  const expungeResult = await mail.expunge('INBOX');
  console.log(`Expunged: ${expungeResult.expunged}`);

  console.log('\n📝 Saving draft...\n');

  // Append a draft message
  const draft = `From: user@example.com
To: recipient@example.com
Subject: Test Draft

This is a test draft message.`;

  const appendResult = await mail.append('Drafts', draft);
  console.log(`Draft saved with UID: ${appendResult.uid}`);

  console.log(`\n${'='.repeat(50)}`);
  console.log('✨ IMAP example completed!\n');

  // Access raw client for advanced operations
  console.log('💡 Raw client also available via: mail.raw.get(), mail.raw.post(), etc.');
}

main().catch(console.error);
