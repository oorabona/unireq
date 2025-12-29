import { graphql, HttpResponse } from 'msw';

/**
 * GraphQL handlers pour mock server
 * Note: On garde les vraies APIs GraphQL (Countries, GraphQLZero) car elles fonctionnent déjà parfaitement.
 * Ces handlers sont ici en backup si besoin de tester offline ou de simuler des erreurs.
 */

// Mock data
const mockCountries = [
  { code: 'FR', name: 'France', emoji: '🇫🇷', capital: 'Paris' },
  { code: 'DE', name: 'Germany', emoji: '🇩🇪', capital: 'Berlin' },
  { code: 'ES', name: 'Spain', emoji: '🇪🇸', capital: 'Madrid' },
  { code: 'IT', name: 'Italy', emoji: '🇮🇹', capital: 'Rome' },
  { code: 'GB', name: 'United Kingdom', emoji: '🇬🇧', capital: 'London' },
];

const mockCountryDetails: Record<
  string,
  {
    code: string;
    name: string;
    native: string;
    capital: string;
    emoji: string;
    currency: string;
    languages: Array<{ code: string; name: string }>;
  }
> = {
  FR: {
    code: 'FR',
    name: 'France',
    native: 'France',
    capital: 'Paris',
    emoji: '🇫🇷',
    currency: 'EUR',
    languages: [{ code: 'fr', name: 'French' }],
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    native: 'Deutschland',
    capital: 'Berlin',
    emoji: '🇩🇪',
    currency: 'EUR',
    languages: [{ code: 'de', name: 'German' }],
  },
};

const mockContinents: Record<string, { name: string; countries: Array<(typeof mockCountries)[0]> }> = {
  EU: {
    name: 'Europe',
    countries: mockCountries,
  },
};

let mockPostId = 1000;
const mockPosts: Record<string, { id: string; title: string; body: string }> = {};

export const graphqlHandlers = [
  // Query: GetCountries
  graphql.query('GetCountries', () => {
    return HttpResponse.json({
      data: {
        countries: mockCountries,
      },
    });
  }),

  // Query: GetCountry
  graphql.query('GetCountry', ({ variables }) => {
    const code = variables.code as string;
    const country = mockCountryDetails[code];

    if (!country) {
      return HttpResponse.json({
        errors: [
          {
            message: `Country with code "${code}" not found`,
            path: ['country'],
          },
        ],
        data: null,
      });
    }

    return HttpResponse.json({
      data: {
        country,
      },
    });
  }),

  // Query: GetContinent
  graphql.query('GetContinent', ({ variables }) => {
    const code = variables.code as string;
    const continent = mockContinents[code];

    if (!continent) {
      return HttpResponse.json({
        errors: [
          {
            message: `Continent with code "${code}" not found`,
            path: ['continent'],
          },
        ],
        data: null,
      });
    }

    return HttpResponse.json({
      data: {
        continent,
      },
    });
  }),

  // Mutation: CreatePost
  graphql.mutation('CreatePost', ({ variables }) => {
    const input = variables.input as { title: string; body: string };
    const id = (++mockPostId).toString();

    mockPosts[id] = {
      id,
      title: input.title,
      body: input.body,
    };

    return HttpResponse.json({
      data: {
        createPost: mockPosts[id],
      },
    });
  }),

  // Mutation: UpdatePost
  graphql.mutation('UpdatePost', ({ variables }) => {
    const id = variables.id as string;
    const input = variables.input as { title?: string; body?: string };

    if (!mockPosts[id]) {
      return HttpResponse.json({
        errors: [
          {
            message: `Post with id "${id}" not found`,
            path: ['updatePost'],
          },
        ],
        data: null,
      });
    }

    mockPosts[id] = {
      ...mockPosts[id],
      ...input,
    };

    return HttpResponse.json({
      data: {
        updatePost: mockPosts[id],
      },
    });
  }),

  // Mutation: DeletePost
  graphql.mutation('DeletePost', ({ variables }) => {
    const id = variables.id as string;

    if (!mockPosts[id]) {
      return HttpResponse.json({
        errors: [
          {
            message: `Post with id "${id}" not found`,
            path: ['deletePost'],
          },
        ],
        data: null,
      });
    }

    const deleted = mockPosts[id];
    delete mockPosts[id];

    return HttpResponse.json({
      data: {
        deletePost: deleted,
      },
    });
  }),
];
