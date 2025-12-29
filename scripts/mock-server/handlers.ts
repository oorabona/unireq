import { HttpResponse, http } from 'msw';
import {
  createDelayResponse,
  createMultipartSuccessResponse,
  createStatusResponse,
  extractMultipartData,
  HTML_RESPONSE,
  MOCK_ENDPOINTS,
  PATHS,
  parseFormUrlEncoded,
} from '../shared-mocks.js';

/**
 * HTTP handlers for mock server
 * Simulates httpbin.org endpoints for examples
 */

/**
 * Helper to parse multipart form data
 */
async function parseMultipartFormData(request: Request): Promise<FormData> {
  return await request.formData();
}

export const handlers = [
  // POST /post - Multipart upload endpoint
  http.post(`${MOCK_ENDPOINTS.LOCAL}${PATHS.POST}`, async ({ request }) => {
    const contentType = request.headers.get('content-type');

    // Handle multipart/form-data
    if (contentType?.startsWith('multipart/form-data')) {
      const formData = await parseMultipartFormData(request);
      const { files, fields } = extractMultipartData(formData);

      const response = createMultipartSuccessResponse(files, fields, false);

      return HttpResponse.json({
        ...response,
        headers: Object.fromEntries(request.headers.entries()),
      });
    }

    // Handle application/x-www-form-urlencoded
    if (contentType === 'application/x-www-form-urlencoded') {
      const text = await request.text();
      const form = parseFormUrlEncoded(text);

      return HttpResponse.json({
        success: true,
        form,
        headers: Object.fromEntries(request.headers.entries()),
      });
    }

    // Handle JSON
    if (contentType === 'application/json') {
      const json = await request.json();
      return HttpResponse.json({
        success: true,
        json,
        headers: Object.fromEntries(request.headers.entries()),
      });
    }

    // Fallback
    return HttpResponse.json({
      success: true,
      headers: Object.fromEntries(request.headers.entries()),
    });
  }),

  // POST /anything - Universal endpoint (like httpbin.org/anything)
  http.post(`${MOCK_ENDPOINTS.LOCAL}${PATHS.ANYTHING}`, async ({ request }) => {
    const contentType = request.headers.get('content-type');
    let data: unknown;

    if (contentType?.startsWith('multipart/form-data')) {
      const formData = await parseMultipartFormData(request);
      const { files, fields } = extractMultipartData(formData);
      data = { files, form: fields };
    } else if (contentType === 'application/json') {
      data = await request.json();
    } else if (contentType === 'application/x-www-form-urlencoded') {
      const text = await request.text();
      const form = parseFormUrlEncoded(text);
      data = { form };
    } else {
      data = await request.text();
    }

    return HttpResponse.json({
      success: true,
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      data,
    });
  }),

  // GET /status/:code - Returns requested status code
  http.get(`${MOCK_ENDPOINTS.LOCAL}${PATHS.STATUS}/:code`, ({ params }) => {
    const code = Number.parseInt(params['code'] as string, 10);
    const responseData = createStatusResponse(code);

    return HttpResponse.json(responseData, { status: code });
  }),

  // GET /html - Returns HTML (for testing parse errors)
  http.get(`${MOCK_ENDPOINTS.LOCAL}${PATHS.HTML}`, () => {
    return HttpResponse.html(HTML_RESPONSE);
  }),

  // GET /delay/:seconds - Adds delay
  http.get(`${MOCK_ENDPOINTS.LOCAL}${PATHS.DELAY}/:seconds`, async ({ params }) => {
    const seconds = Number.parseInt(params['seconds'] as string, 10);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return HttpResponse.json(createDelayResponse(seconds));
  }),
];
