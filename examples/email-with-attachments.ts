/**
 * Email with attachments example (SendGrid/Mailgun style API)
 * Demonstrates sending email with JSON metadata, HTML body, and file attachments
 * Usage: pnpm example:email
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create client for email API
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('📧 Sending email with attachments...\n');

try {
  // Email metadata
  const emailMetadata = {
    from: 'noreply@example.com',
    to: ['customer@acme.com'],
    cc: ['accounting@acme.com'],
    subject: 'Invoice #INV-2025-001',
    priority: 'high',
    tags: ['invoice', 'billing'],
  };

  // HTML email body
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .header { background: #007bff; color: white; padding: 20px; }
    .content { padding: 20px; }
    .footer { background: #f8f9fa; padding: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice #INV-2025-001</h1>
  </div>
  <div class="content">
    <p>Dear Customer,</p>
    <p>Please find attached your invoice for January 2025.</p>
    <p>Amount due: <strong>$1,500.00</strong></p>
    <p>Due date: January 31, 2025</p>
  </div>
  <div class="footer">
    <p>Thank you for your business!</p>
  </div>
</body>
</html>`;

  // Simulated invoice PDF
  const invoicePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer; // "%PDF" header

  // Company logo (PNG)
  const logoImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer; // PNG header

  // Send email with attachments
  await api.post<{
    files: Record<string, string>;
    form: Record<string, string>;
  }>(
    '/post',
    body.multipart(
      // Email metadata (JSON)
      {
        name: 'message',
        part: body.json(emailMetadata),
      },
      // HTML email body
      {
        name: 'html',
        part: body.text(htmlBody),
        filename: 'email.html',
      },
      // Invoice PDF attachment
      {
        name: 'attachment',
        part: body.binary(invoicePdf, 'application/pdf'),
        filename: 'invoice-INV-2025-001.pdf',
      },
      // Inline logo image
      {
        name: 'inline',
        part: body.binary(logoImage, 'image/png'),
        filename: 'logo.png',
      },
    ),
    parse.json(),
  );

  console.log('✅ Email sent successfully!');
  console.log(`\n📨 From: ${emailMetadata.from}`);
  console.log(`📬 To: ${emailMetadata.to.join(', ')}`);
  console.log(`📋 Subject: ${emailMetadata.subject}`);
  console.log('\n📎 Attachments:');
  console.log('  - Invoice PDF (application/pdf)');
  console.log('  - Company logo (image/png)');
  console.log('\n✨ Email with attachments sent in a single request!');
} catch (error) {
  console.error('❌ Email sending failed:', error);
}
