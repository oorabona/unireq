/**
 * Bulk document upload example
 * Demonstrates multipart upload with mixed content types (JSON + XML + PDF)
 * Usage: pnpm example:bulk-upload
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create client for document management API
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('📤 Uploading multiple documents with mixed content types...\n');

try {
  // Simulated document data
  const invoiceData = {
    type: 'invoice',
    number: 'INV-2025-001',
    amount: 1500.0,
    customer: 'ACME Corporation',
    date: '2025-01-17',
  };

  const purchaseOrderXml = `<?xml version="1.0"?>
<purchase-order>
  <order-id>PO-12345</order-id>
  <vendor>Tech Supplies Inc</vendor>
  <items>
    <item>
      <name>Laptop</name>
      <quantity>5</quantity>
      <price>1200.00</price>
    </item>
  </items>
</purchase-order>`;

  // Simulated PDF contract (just a header for demo)
  const contractPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer; // "%PDF" header

  const metadata = {
    batch: 'BATCH-2025-001',
    timestamp: new Date().toISOString(),
    uploader: 'automated-system',
  };

  // Upload all documents in a single request using body.multipart()
  const response = await api.post<{
    files: Record<string, string>;
    form: Record<string, string>;
  }>(
    '/post',
    body.multipart(
      // Invoice as JSON
      {
        name: 'invoice',
        part: body.json(invoiceData),
        filename: 'invoice-001.json',
      },
      // Purchase order as XML (Note: XML serialization would need @unireq/xml)
      {
        name: 'purchase_order',
        part: body.text(purchaseOrderXml),
        filename: 'purchase-order.xml',
      },
      // Contract as PDF binary
      {
        name: 'contract',
        part: body.binary(contractPdf, 'application/pdf'),
        filename: 'contract.pdf',
      },
      // Batch metadata as JSON
      {
        name: 'metadata',
        part: body.json(metadata),
      },
    ),
    parse.json(),
  );

  console.log('✅ Bulk upload successful!');
  console.log('\n📋 Uploaded files:');
  console.log(Object.keys(response.data.files || {}));
  console.log('\n📋 Form fields:');
  console.log(Object.keys(response.data.form || {}));
  console.log('\n✨ All documents uploaded in a single HTTP request!');
} catch (error) {
  console.error('❌ Bulk upload failed:', error);
}
