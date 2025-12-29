import { describe, expect, it, vi } from 'vitest';
import { graphql, graphqlGet, graphqlRequest } from '../body.js';
import { mutation, query, variable } from '../query.js';

describe('@unireq/graphql - body serializers', () => {
  describe('graphql()', () => {
    it('should create BodyDescriptor from simple query', () => {
      const op = query('user { id name }');
      const descriptor = graphql(op);

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('application/json');
      expect(descriptor.data).toHaveProperty('query');
    });

    it('should serialize query to JSON', () => {
      const op = query('user { id name }');
      const descriptor = graphql(op);
      const serialized = descriptor.serialize();

      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized as string);
      expect(parsed).toHaveProperty('query');
      expect(parsed.query).toContain('user { id name }');
    });

    it('should include variables in serialized output', () => {
      const op = query('user(id: $id) { id name }', {
        variables: [variable('id', 'ID!', '123')],
      });
      const descriptor = graphql(op);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed.variables).toEqual({ id: '123' });
    });

    it('should include operationName in serialized output', () => {
      const op = query('user { id name }', {
        operationName: 'GetUser',
      });
      const descriptor = graphql(op);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed.operationName).toBe('GetUser');
    });

    it('should handle mutation operations', () => {
      const op = mutation('createUser(input: $input) { id name }', {
        operationName: 'CreateUser',
        variables: [variable('input', 'CreateUserInput!', { name: 'John', email: 'john@example.com' })],
      });
      const descriptor = graphql(op);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed.query).toContain('mutation CreateUser');
      expect(parsed.variables).toEqual({
        input: { name: 'John', email: 'john@example.com' },
      });
    });
  });

  describe('graphqlRequest()', () => {
    it('should create BodyDescriptor from raw request', () => {
      const request = {
        query: 'query { user { id name } }',
        variables: { id: '123' },
        operationName: 'GetUser',
      };
      const descriptor = graphqlRequest(request);

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('application/json');
      expect(descriptor.data).toBe(request);
    });

    it('should serialize request to JSON', () => {
      const request = {
        query: 'query { user { id name } }',
        variables: { id: '123' },
      };
      const descriptor = graphqlRequest(request);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed).toEqual(request);
    });

    it('should handle request without variables', () => {
      const request = {
        query: 'query { user { id name } }',
      };
      const descriptor = graphqlRequest(request);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed.query).toBe(request.query);
      expect(parsed.variables).toBeUndefined();
    });

    it('should handle request without operationName', () => {
      const request = {
        query: 'query { user { id name } }',
        variables: { id: '123' },
      };
      const descriptor = graphqlRequest(request);
      const serialized = descriptor.serialize();

      const parsed = JSON.parse(serialized as string);
      expect(parsed.operationName).toBeUndefined();
    });
  });

  describe('graphqlGet()', () => {
    it('should transform request to GET with query params for relative URL', async () => {
      const op = query('user { id }');
      const policy = graphqlGet(op);

      const next = vi.fn().mockResolvedValue({ status: 200 });
      const ctx = {
        url: '/graphql',
        method: 'POST',
        headers: new Headers(),
        options: {},
      };

      await policy(ctx as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('/graphql?query='),
          body: undefined,
        }),
      );

      const callArgs = next.mock.calls[0]?.[0];
      expect(callArgs?.url).not.toContain('http://dummy.base');
    });

    it('should transform request to GET with query params for absolute URL', async () => {
      const op = query('user { id }');
      const policy = graphqlGet(op);

      const next = vi.fn().mockResolvedValue({ status: 200 });
      const ctx = {
        url: 'https://api.example.com/graphql',
        method: 'POST',
        headers: new Headers(),
        options: {},
      };

      await policy(ctx as any, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('https://api.example.com/graphql?query='),
          body: undefined,
        }),
      );
    });

    it('should include variables and operationName in URL', async () => {
      const op = query('user(id: $id) { id }', {
        variables: [variable('id', 'ID!', '123')],
        operationName: 'GetUser',
      });
      const policy = graphqlGet(op);

      const next = vi.fn().mockResolvedValue({ status: 200 });
      const ctx = {
        url: '/graphql',
        method: 'POST',
        headers: new Headers(),
        options: {},
      };

      await policy(ctx as any, next);

      const callArgs = next.mock.calls[0]?.[0];
      if (!callArgs) throw new Error('Expected callArgs to be defined');
      const url = new URL(callArgs.url, 'http://localhost');

      expect(url.searchParams.get('query')).toContain('user(id: $id)');
      expect(url.searchParams.get('operationName')).toBe('GetUser');
      expect(JSON.parse(url.searchParams.get('variables') || '{}')).toEqual({ id: '123' });
    });
  });
});
