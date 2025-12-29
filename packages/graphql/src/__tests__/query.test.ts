import type { RequestContext, Response } from '@unireq/core';
import { describe, expect, it, vi } from 'vitest';
import { fragment, mutation, query, subscription, toRequest, variable } from '../query.js';

describe('@unireq/graphql - query builders', () => {
  describe('query()', () => {
    it('should create a simple query', () => {
      const op = query('user { id name }');

      expect(op.type).toBe('query');
      expect(op.query).toBe('user { id name }');
      expect(op.variables).toBeUndefined();
    });

    it('should create a query with operation name', () => {
      const op = query('user { id name }', {
        operationName: 'GetUser',
      });

      expect(op.name).toBe('GetUser');
    });

    it('should create a query with variables', () => {
      const op = query('user(id: $id) { id name }', {
        variables: [variable('id', 'ID!', '123')],
      });

      expect(op.variables).toHaveLength(1);
      expect(op.variables?.[0]?.name).toBe('id');
      expect(op.variables?.[0]?.type).toBe('ID!');
      expect(op.variables?.[0]?.value).toBe('123');
    });

    it('should create a query with fragments', () => {
      const userFragment = fragment('UserFields', 'User', 'id name email');

      const op = query('user(id: $id) { ...UserFields }', {
        variables: [variable('id', 'ID!', '123')],
        fragments: [userFragment],
      });

      expect(op.fragments).toHaveLength(1);
      expect(op.fragments?.[0]?.name).toBe('UserFields');
    });
  });

  describe('mutation()', () => {
    it('should create a simple mutation', () => {
      const op = mutation('createUser(input: $input) { id name }');

      expect(op.type).toBe('mutation');
      expect(op.query).toBe('createUser(input: $input) { id name }');
    });

    it('should create a mutation with variables', () => {
      const op = mutation('createUser(input: $input) { id name }', {
        operationName: 'CreateUser',
        variables: [variable('input', 'CreateUserInput!', { name: 'John', email: 'john@example.com' })],
      });

      expect(op.name).toBe('CreateUser');
      expect(op.variables).toHaveLength(1);
      expect(op.variables?.[0]?.value).toEqual({ name: 'John', email: 'john@example.com' });
    });
  });

  describe('subscription()', () => {
    it('should create a subscription', () => {
      const op = subscription('messageAdded(roomId: $roomId) { id content }', {
        variables: [variable('roomId', 'ID!', 'room-123')],
      });

      expect(op.type).toBe('subscription');
      expect(op.query).toBe('messageAdded(roomId: $roomId) { id content }');
      expect(op.variables?.[0]?.value).toBe('room-123');
    });
  });

  describe('fragment()', () => {
    it('should create a fragment', () => {
      const frag = fragment('UserFields', 'User', 'id name email');

      expect(frag.name).toBe('UserFields');
      expect(frag.on).toBe('User');
      expect(frag.fields).toBe('id name email');
    });

    it('should trim whitespace from fields', () => {
      const frag = fragment(
        'UserFields',
        'User',
        `
        id
        name
        email
      `,
      );

      expect(frag.fields).toContain('id');
      expect(frag.fields).toContain('name');
    });
  });

  describe('variable()', () => {
    it('should create a variable without default value', () => {
      const v = variable('id', 'ID!', '123');

      expect(v.name).toBe('id');
      expect(v.type).toBe('ID!');
      expect(v.value).toBe('123');
      expect(v.defaultValue).toBeUndefined();
    });

    it('should create a variable with default value', () => {
      const v = variable('limit', 'Int', 10, 20);

      expect(v.name).toBe('limit');
      expect(v.value).toBe(10);
      expect(v.defaultValue).toBe(20);
    });

    it('should handle complex object values', () => {
      const v = variable('input', 'CreateUserInput!', { name: 'John', email: 'john@example.com' });

      expect(v.value).toEqual({ name: 'John', email: 'john@example.com' });
    });
  });

  describe('toRequest()', () => {
    it('should convert simple query to request', () => {
      const op = query('user { id name }');
      const req = toRequest(op);

      expect(req.query).toContain('query');
      expect(req.query).toContain('user { id name }');
      expect(req.variables).toBeUndefined();
      expect(req.operationName).toBeUndefined();
    });

    it('should convert query with variables to request', () => {
      const op = query('user(id: $id) { id name }', {
        operationName: 'GetUser',
        variables: [variable('id', 'ID!', '123')],
      });
      const req = toRequest(op);

      expect(req.query).toContain('query GetUser');
      expect(req.query).toContain('$id: ID!');
      expect(req.variables).toEqual({ id: '123' });
      expect(req.operationName).toBe('GetUser');
    });

    it('should convert query with fragments to request', () => {
      const userFragment = fragment('UserFields', 'User', 'id name email');
      const op = query('user(id: $id) { ...UserFields }', {
        variables: [variable('id', 'ID!', '123')],
        fragments: [userFragment],
      });
      const req = toRequest(op);

      expect(req.query).toContain('fragment UserFields on User');
      expect(req.query).toContain('id name email');
    });

    it('should handle multiple variables', () => {
      const op = query('users(limit: $limit, offset: $offset) { id name }', {
        variables: [variable('limit', 'Int!', 10), variable('offset', 'Int', 0)],
      });
      const req = toRequest(op);

      expect(req.query).toContain('$limit: Int!');
      expect(req.query).toContain('$offset: Int');
      expect(req.variables).toEqual({ limit: 10, offset: 0 });
    });

    it('should handle variable with default value', () => {
      const op = query('users(limit: $limit) { id name }', {
        variables: [variable('limit', 'Int', 10, 20)],
      });
      const req = toRequest(op);

      expect(req.query).toContain('$limit: Int = 20');
      expect(req.variables).toEqual({ limit: 10 });
    });

    it('should handle mutation', () => {
      const op = mutation('createUser(input: $input) { id name }', {
        operationName: 'CreateUser',
        variables: [variable('input', 'CreateUserInput!', { name: 'John' })],
      });
      const req = toRequest(op);

      expect(req.query).toContain('mutation CreateUser');
      expect(req.query).toContain('$input: CreateUserInput!');
      expect(req.variables).toEqual({ input: { name: 'John' } });
    });
  });
});

describe('graphqlGet()', () => {
  it('should create a policy that sets method to GET', async () => {
    const { graphqlGet } = await import('../body.js');
    const op = query('user { id name }');
    const policy = graphqlGet(op);

    const mockNext = vi.fn(
      async (_ctx: RequestContext): Promise<Response> => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      }),
    );

    const ctx = {
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: {},
    };

    await policy(ctx, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
  });

  it('should append query to URL parameters', async () => {
    const { graphqlGet } = await import('../body.js');
    const op = query('user { id name }');
    const policy = graphqlGet(op);

    const mockNext = vi.fn(
      async (_ctx: RequestContext): Promise<Response> => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      }),
    );

    const ctx = {
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: {},
    };

    await policy(ctx, mockNext);

    const calledCtx = mockNext.mock.calls[0]?.[0];
    if (!calledCtx) throw new Error('Expected calledCtx to be defined');
    const url = new URL(calledCtx.url);

    expect(url.searchParams.has('query')).toBe(true);
    expect(url.searchParams.get('query')).toContain('query');
    expect(url.searchParams.get('query')).toContain('user { id name }');
  });

  it('should append variables to URL parameters', async () => {
    const { graphqlGet } = await import('../body.js');
    const op = query('user(id: $id) { id name }', {
      variables: [variable('id', 'ID!', '123')],
    });
    const policy = graphqlGet(op);

    const mockNext = vi.fn(
      async (_ctx: RequestContext): Promise<Response> => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      }),
    );

    const ctx = {
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: {},
    };

    await policy(ctx, mockNext);

    const calledCtx = mockNext.mock.calls[0]?.[0];
    if (!calledCtx) throw new Error('Expected calledCtx to be defined');
    const url = new URL(calledCtx.url);

    expect(url.searchParams.has('variables')).toBe(true);
    const variables = JSON.parse(url.searchParams.get('variables') || '{}');
    expect(variables).toEqual({ id: '123' });
  });

  it('should append operationName to URL parameters', async () => {
    const { graphqlGet } = await import('../body.js');
    const op = query('user { id name }', {
      operationName: 'GetUser',
    });
    const policy = graphqlGet(op);

    const mockNext = vi.fn(
      async (_ctx: RequestContext): Promise<Response> => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      }),
    );

    const ctx = {
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: {},
    };

    await policy(ctx, mockNext);

    const calledCtx = mockNext.mock.calls[0]?.[0];
    if (!calledCtx) throw new Error('Expected calledCtx to be defined');
    const url = new URL(calledCtx.url);

    expect(url.searchParams.has('operationName')).toBe(true);
    expect(url.searchParams.get('operationName')).toBe('GetUser');
  });

  it('should handle complex query with multiple variables', async () => {
    const { graphqlGet } = await import('../body.js');
    const op = query('users(limit: $limit, offset: $offset) { id name }', {
      operationName: 'GetUsers',
      variables: [variable('limit', 'Int!', 10), variable('offset', 'Int', 0)],
    });
    const policy = graphqlGet(op);

    const mockNext = vi.fn(
      async (_ctx: RequestContext): Promise<Response> => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
        ok: true,
      }),
    );

    const ctx = {
      url: 'https://api.example.com/graphql',
      method: 'POST',
      headers: {},
    };

    await policy(ctx, mockNext);

    const calledCtx = mockNext.mock.calls[0]?.[0];
    if (!calledCtx) throw new Error('Expected calledCtx to be defined');
    const url = new URL(calledCtx.url);

    expect(url.searchParams.has('query')).toBe(true);
    expect(url.searchParams.has('variables')).toBe(true);
    expect(url.searchParams.has('operationName')).toBe(true);

    const variables = JSON.parse(url.searchParams.get('variables') || '{}');
    expect(variables).toEqual({ limit: 10, offset: 0 });
    expect(url.searchParams.get('operationName')).toBe('GetUsers');
  });
});
