/**
 * E-commerce product creation example
 * Demonstrates creating a product with multiple images and specifications
 * Usage: pnpm example:ecommerce
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create client for e-commerce API
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('🛍️  Creating product with images and specifications...\n');

try {
  // Product metadata
  const productData = {
    name: 'Premium Cotton T-Shirt',
    price: 29.99,
    currency: 'USD',
    category: 'clothing',
    sku: 'TSHIRT-COTTON-001',
    stock: 150,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['black', 'white', 'navy', 'gray'],
  };

  // Simulated image data (PNG header bytes)
  const mainImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer; // PNG header
  const backImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;

  // Technical specifications (could be XML from supplier)
  const specsXml = `<?xml version="1.0"?>
<specifications>
  <material>
    <cotton>95%</cotton>
    <spandex>5%</spandex>
  </material>
  <care>
    <wash>machine-cold</wash>
    <dry>tumble-low</dry>
    <bleach>no</bleach>
  </care>
  <dimensions>
    <length unit="cm">70</length>
    <chest unit="cm">50</chest>
  </dimensions>
</specifications>`;

  // Care instructions PDF (simulated)
  const careGuidePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer; // "%PDF" header

  // Create product with all assets in one request
  const response = await api.post<{
    files: Record<string, string>;
    form: Record<string, string>;
  }>(
    '/post',
    body.multipart(
      // Product metadata
      {
        name: 'product',
        part: body.json(productData),
      },
      // Main product image
      {
        name: 'image_main',
        part: body.binary(mainImage, 'image/png'),
        filename: 'tshirt-main.png',
      },
      // Back view image
      {
        name: 'image_back',
        part: body.binary(backImage, 'image/png'),
        filename: 'tshirt-back.png',
      },
      // Technical specifications (XML)
      {
        name: 'specifications',
        part: body.text(specsXml),
        filename: 'specs.xml',
      },
      // Care instructions (PDF)
      {
        name: 'care_guide',
        part: body.binary(careGuidePdf, 'application/pdf'),
        filename: 'care-instructions.pdf',
      },
    ),
    parse.json(),
  );

  console.log('✅ Product created successfully!');
  console.log('\n📦 Product:', productData.name);
  console.log('💰 Price:', `$${productData.price}`);
  console.log('\n📋 Uploaded assets:');
  console.log('  - Product metadata (JSON)');
  console.log('  - Main image (PNG)');
  console.log('  - Back image (PNG)');
  console.log('  - Specifications (XML)');
  console.log('  - Care guide (PDF)');
  console.log('\n✨ All assets uploaded in a single request!');
  console.log('📋 Response data:', response.data);
} catch (error) {
  console.error('❌ Product creation failed:', error);
}
