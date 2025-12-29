# Data Validation

This example shows how to validate API responses using schemas (Zod, Valibot) via adapters.

## Unireq Code

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { z } from 'zod';

// 1. Define a Zod schema
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

// 2. Create an adapter (or import from a lib)
const zodAdapter = () => (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
};

// 3. Use the validate() policy
const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserSchema, zodAdapter())
);

try {
  // response.data is now typed as z.infer<typeof UserSchema>
  const response = await api.get('/users/1');
  console.log(response.data.email);
} catch (error) {
  console.error('Validation failed:', error);
}
```

## Comparison with Axios

### Axios

Axios does not validate data. You must do it manually after the request.

```javascript
const response = await axios.get('https://jsonplaceholder.typicode.com/users/1');

try {
  const user = UserSchema.parse(response.data);
  console.log(user.email);
} catch (error) {
  console.error('Validation failed:', error);
}
```

### Differences

1.  **Integration**: With Unireq, validation is part of the request pipeline. If validation fails, the request is considered failed (and can be intercepted or logged as such).
2.  **Automatic Typing**: The `validate` policy automatically infers the return type of `api.get()` based on the schema. No need to pass generics manually.
3.  **Agnostic**: Unireq uses an adapter pattern, so you can use Zod, Valibot, ArkType, or any other validation library.

---

<p align="center">
  <a href="#/examples/retry">← Retry</a> · <a href="#/examples/sse">SSE →</a>
</p>
