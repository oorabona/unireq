/**
 * @unireq/core - Error classes tests
 */

import { describe, expect, it } from 'vitest';
import {
  DuplicatePolicyError,
  HttpError,
  InvalidSlotError,
  MissingCapabilityError,
  NetworkError,
  NotAcceptableError,
  SerializationError,
  TimeoutError,
  UnireqError,
  UnsupportedAuthForTransport,
  UnsupportedMediaTypeError,
  URLNormalizationError,
} from '../errors.js';

describe('@unireq/core - UnireqError', () => {
  it('should create base error with code', () => {
    const error = new UnireqError('Test error', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('UnireqError');
  });

  it('should support cause', () => {
    const cause = new Error('Original error');
    const error = new UnireqError('Test error', 'TEST_CODE', cause);
    expect(error.cause).toBe(cause);
  });
});

describe('@unireq/core - NetworkError', () => {
  it('should create network error', () => {
    const cause = new Error('Connection refused');
    const error = new NetworkError('Network failed', cause);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Network failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.name).toBe('NetworkError');
    expect(error.cause).toBe(cause);
  });
});

describe('@unireq/core - TimeoutError', () => {
  it('should create timeout error', () => {
    const error = new TimeoutError(5000);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Request timed out after 5000ms');
    expect(error.code).toBe('TIMEOUT');
    expect(error.name).toBe('TimeoutError');
    expect(error.timeoutMs).toBe(5000);
  });
});

describe('@unireq/core - HttpError', () => {
  it('should create http error from response', () => {
    const response = {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'application/json' },
      data: { error: 'Not found' },
      ok: false,
    };
    const error = new HttpError(response);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('HTTP Error 404: Not Found');
    expect(error.code).toBe('HTTP_ERROR');
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.headers).toEqual(response.headers);
    expect(error.data).toEqual(response.data);
  });
});

describe('@unireq/core - SerializationError', () => {
  it('should create serialization error', () => {
    const cause = new Error('Invalid JSON');
    const error = new SerializationError('Parse failed', cause);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Parse failed');
    expect(error.code).toBe('SERIALIZATION_ERROR');
    expect(error.name).toBe('SerializationError');
    expect(error.cause).toBe(cause);
  });
});

describe('@unireq/core - DuplicatePolicyError', () => {
  it('should create error with policy name', () => {
    const error = new DuplicatePolicyError('TestPolicy');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe(
      'Duplicate policy detected: TestPolicy. Each policy can only be registered once in the chain.',
    );
    expect(error.code).toBe('DUPLICATE_POLICY');
    expect(error.name).toBe('DuplicatePolicyError');
    expect(error.policyName).toBe('TestPolicy');
  });
});

describe('@unireq/core - UnsupportedAuthForTransport', () => {
  it('should create error with auth and transport types', () => {
    const error = new UnsupportedAuthForTransport('Bearer', 'FTP');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Authentication type "Bearer" is not supported by transport "FTP".');
    expect(error.code).toBe('UNSUPPORTED_AUTH');
    expect(error.name).toBe('UnsupportedAuthForTransport');
    expect(error.authType).toBe('Bearer');
    expect(error.transportType).toBe('FTP');
  });
});

describe('@unireq/core - NotAcceptableError', () => {
  it('should create error with accepted types only', () => {
    const error = new NotAcceptableError(['application/json', 'application/xml']);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe(
      'Server cannot produce a response matching the Accept header. Accepted types: application/json, application/xml',
    );
    expect(error.code).toBe('NOT_ACCEPTABLE');
    expect(error.name).toBe('NotAcceptableError');
    expect(error.acceptedTypes).toEqual(['application/json', 'application/xml']);
    expect(error.receivedType).toBeUndefined();
  });

  it('should create error with accepted and received types', () => {
    const error = new NotAcceptableError(['application/json'], 'text/html');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe(
      'Server cannot produce a response matching the Accept header. Accepted types: application/json (received: text/html)',
    );
    expect(error.receivedType).toBe('text/html');
  });
});

describe('@unireq/core - UnsupportedMediaTypeError', () => {
  it('should create error with supported types only', () => {
    const error = new UnsupportedMediaTypeError(['application/json', 'application/xml']);

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe(
      'Server cannot process the request payload media type. Supported types: application/json, application/xml',
    );
    expect(error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(error.name).toBe('UnsupportedMediaTypeError');
    expect(error.supportedTypes).toEqual(['application/json', 'application/xml']);
    expect(error.sentType).toBeUndefined();
  });

  it('should create error with supported and sent types', () => {
    const error = new UnsupportedMediaTypeError(['application/json'], 'text/plain');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe(
      'Server cannot process the request payload media type. Supported types: application/json (sent: text/plain)',
    );
    expect(error.sentType).toBe('text/plain');
  });
});

describe('@unireq/core - MissingCapabilityError', () => {
  it('should create error with capability and transport type', () => {
    const error = new MissingCapabilityError('streaming', 'HTTP/1.1');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Transport "HTTP/1.1" does not support required capability: streaming');
    expect(error.code).toBe('MISSING_CAPABILITY');
    expect(error.name).toBe('MissingCapabilityError');
    expect(error.capability).toBe('streaming');
    expect(error.transportType).toBe('HTTP/1.1');
  });
});

describe('@unireq/core - InvalidSlotError', () => {
  it('should create error with slot type and message', () => {
    const error = new InvalidSlotError('authentication', 'Must be placed after retry');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Invalid slot configuration for authentication: Must be placed after retry');
    expect(error.code).toBe('INVALID_SLOT');
    expect(error.name).toBe('InvalidSlotError');
    expect(error.slotType).toBe('authentication');
  });
});

describe('@unireq/core - URLNormalizationError', () => {
  it('should create error with URL and reason', () => {
    const error = new URLNormalizationError('//invalid', 'Missing protocol');

    expect(error).toBeInstanceOf(UnireqError);
    expect(error.message).toBe('Failed to normalize URL "//invalid": Missing protocol');
    expect(error.code).toBe('URL_NORMALIZATION_FAILED');
    expect(error.name).toBe('URLNormalizationError');
    expect(error.url).toBe('//invalid');
    expect(error.reason).toBe('Missing protocol');
  });
});
