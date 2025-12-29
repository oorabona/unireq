/**
 * Form submission example (application/x-www-form-urlencoded)
 * Demonstrates classic HTML form submission
 * Usage: pnpm example:form
 */

import { client } from '@unireq/core';
import { body, http, parse } from '@unireq/http';

// Create client for form API
// Using localhost:3001 with MSW mock server
const api = client(http('http://localhost:3001'));

console.log('📝 Submitting HTML form data...\n');

try {
  // Login form submission
  console.log('🔐 Login form submission...');
  const loginResponse = await api.post<{
    form: Record<string, string>;
    headers: Record<string, string>;
  }>(
    '/post',
    body.form({
      username: 'johndoe',
      password: 'secret123',
      remember: 'true',
    }),
    parse.json(),
  );

  console.log('✅ Login form submitted!');
  console.log('📋 Form data received:', loginResponse.data.form);
  console.log('📋 Content-Type:', loginResponse.data.headers['Content-Type']);

  // Search form submission
  console.log('\n🔍 Search form submission...');
  const searchResponse = await api.post<{
    form: Record<string, string>;
  }>(
    '/post',
    body.form({
      q: 'typescript http client',
      category: 'libraries',
      sort: 'relevance',
      page: '1',
    }),
    parse.json(),
  );

  console.log('✅ Search form submitted!');
  console.log('📋 Search params:', searchResponse.data.form);

  // Contact form submission with special characters
  console.log('\n📧 Contact form with special characters...');
  const contactResponse = await api.post<{
    form: Record<string, string>;
  }>(
    '/post',
    body.form({
      name: 'Jean Dupont',
      email: 'jean.dupont@example.com',
      subject: 'Question concernant votre API',
      message: "Bonjour,\n\nJ'ai une question sur l'utilisation de l'API.\n\nMerci & cordialement,\nJean",
    }),
    parse.json(),
  );

  console.log('✅ Contact form submitted!');
  console.log('📋 Contact data:', contactResponse.data.form);
  console.log('\n✨ All forms submitted successfully!');
} catch (error) {
  console.error('❌ Form submission failed:', error);
}
