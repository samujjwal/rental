/* ── global fetch mock ── */
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

/* ── authStore mock ── */
const mockGetToken = jest.fn();
const mockGetRefreshToken = jest.fn();
const mockSetTokens = jest.fn();
const mockClearTokens = jest.fn();

jest.mock('../../api/authStore', () => ({
  authStore: {
    getToken: (...a: any[]) => mockGetToken(...a),
    getRefreshToken: (...a: any[]) => mockGetRefreshToken(...a),
    setTokens: (...a: any[]) => mockSetTokens(...a),
    clearTokens: (...a: any[]) => mockClearTokens(...a),
  },
}));

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:3400/api',
}));

import {
  mobileClient,
  initializeAuth,
  setCachedToken,
  setOnForceLogout,
  authenticatedFetch,
} from '../../api/client';

/* ── helpers ── */

function jsonResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function textResponse(text: string, status: number) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.reject(new Error('not json')),
  });
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('no content')),
    text: () => Promise.resolve(''),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setCachedToken(null);
  setOnForceLogout(null);
});

/* ═══════════════════════════════════════════════════════════════════════ */

describe('createMobileClient (mobileClient)', () => {
  /* ── Auth methods ── */
  describe('auth', () => {
    it('login sends POST /auth/login', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ accessToken: 'tok', user: { id: 'u1' } }));

      const result = await mobileClient.login({ email: 'a@b.com', password: '123' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual({ accessToken: 'tok', user: { id: 'u1' } });
    });

    it('register sends POST /auth/register', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ accessToken: 'tok' }));

      await mobileClient.register({
        email: 'a@b.com',
        password: '123',
        firstName: 'A',
      } as any);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('requestPasswordReset sends POST', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());

      await mobileClient.requestPasswordReset('a@b.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/password/reset-request'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('resetPassword sends POST with token', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());

      await mobileClient.resetPassword('tk', 'newP4ss!');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/password/reset'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('logout sends POST with refreshToken', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());

      await mobileClient.logout('refresh-tok');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.refreshToken).toBe('refresh-tok');
    });

    it('googleLogin sends POST /auth/google', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ accessToken: 'tok' }));

      await mobileClient.googleLogin('google-id-token');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.idToken).toBe('google-id-token');
    });

    it('appleLogin sends POST /auth/apple', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ accessToken: 'tok' }));

      await mobileClient.appleLogin('identity', 'code', 'First', 'Last');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.identityToken).toBe('identity');
      expect(body.firstName).toBe('First');
    });

    it('requestOtp sends POST /auth/otp/request', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ message: 'sent' }));

      await mobileClient.requestOtp('a@b.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/otp/request'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('verifyOtp sends POST /auth/otp/verify', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ accessToken: 'tok' }));

      await mobileClient.verifyOtp('a@b.com', '123456');

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.email).toBe('a@b.com');
      expect(body.code).toBe('123456');
    });
  });

  /* ── Listing methods ── */
  describe('listings', () => {
    it('getListing fetches GET /listings/:id', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'l1', title: 'Camera' }));

      const result = await mobileClient.getListing('l1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listings/l1'),
        expect.any(Object),
      );
      expect(result.id).toBe('l1');
    });

    it('getMyListings fetches GET /listings/my-listings', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse([{ id: 'l1' }]));

      const result = await mobileClient.getMyListings();

      expect(result).toEqual([{ id: 'l1' }]);
    });

    it('createListing sends POST /listings', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'new1' }));

      await mobileClient.createListing({ title: 'New', basePrice: 100 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listings'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('updateListing sends PATCH /listings/:id', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'l1' }));

      await mobileClient.updateListing('l1', { title: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listings/l1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('publishListing sends POST /listings/:id/publish', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());
      await mobileClient.publishListing('l1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listings/l1/publish'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('deleteListing sends DELETE /listings/:id', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());
      await mobileClient.deleteListing('l1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/listings/l1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('search builds query string from params', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ listings: [], total: 0 }));

      await mobileClient.search({ q: 'camera', page: 1, limit: 10 } as any);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('/search?');
      expect(url).toContain('q=camera');
    });
  });

  /* ── Booking methods ── */
  describe('bookings', () => {
    it('getMyBookings fetches with optional status', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse([{ id: 'bk1' }]));

      await mobileClient.getMyBookings('confirmed');

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('status=CONFIRMED');
    });

    it('getMyBookings works without status', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse([]));

      await mobileClient.getMyBookings();

      const url = mockFetch.mock.calls[0][0];
      expect(url).not.toContain('status=');
    });

    it('createBooking sends POST /bookings', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'bk1' }));
      await mobileClient.createBooking({ listingId: 'l1' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('approveBooking sends POST /bookings/:id/approve', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'bk1' }));
      await mobileClient.approveBooking('bk1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/bookings/bk1/approve'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('cancelBooking sends reason in body', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'bk1' }));
      await mobileClient.cancelBooking('bk1', 'changed mind');
      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.reason).toBe('changed mind');
    });

    it('checkAvailability sends dates', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ available: true }));
      await mobileClient.checkAvailability('l1', '2024-01-01', '2024-01-07');
      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.startDate).toBe('2024-01-01');
      expect(body.endDate).toBe('2024-01-07');
    });
  });

  /* ── Conversation / message methods ── */
  describe('conversations', () => {
    it('getConversations maps response to items', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          conversations: [
            {
              id: 'c1',
              updatedAt: '2024-01-01',
              lastMessage: { content: 'hi' },
              participants: [{ userId: 'u1', user: { firstName: 'J', lastName: 'D', email: 'j@d.com' } }],
            },
          ],
        }),
      );

      const result = await mobileClient.getConversations();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('c1');
      expect(result.items[0].participants[0].name).toBe('J D');
    });

    it('getConversations handles missing participant names', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          conversations: [
            {
              id: 'c2',
              updatedAt: '2024-01-01',
              lastMessage: null,
              participants: [{ userId: 'u2', user: { email: 'a@b.com' } }],
            },
          ],
        }),
      );

      const result = await mobileClient.getConversations();

      expect(result.items[0].lastMessage).toBe('');
      expect(result.items[0].participants[0].name).toBe('a@b.com');
    });

    it('sendMessage sends POST with content', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'm1' }));

      await mobileClient.sendMessage('c1', { content: 'hello' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/conversations/c1/messages'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  /* ── User / profile methods ── */
  describe('users', () => {
    it('getProfile fetches GET /users/me', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'u1', firstName: 'A' }));
      const result = await mobileClient.getProfile();
      expect(result.id).toBe('u1');
    });

    it('updateProfile sends PATCH /users/me', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'u1' }));
      await mobileClient.updateProfile({ firstName: 'New' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('upgradeToOwner sends POST /users/upgrade-to-owner', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'u1', role: 'owner' }));
      await mobileClient.upgradeToOwner();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/upgrade-to-owner'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getUserStats fetches GET /users/me/stats', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ listings: 5 }));
      const result = await mobileClient.getUserStats();
      expect(result.listings).toBe(5);
    });
  });

  /* ── Organization methods ── */
  describe('organizations', () => {
    it('getOrganizations fetches /organizations/my', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ organizations: [], total: 0 }));
      await mobileClient.getOrganizations();
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/organizations/my'), expect.any(Object));
    });

    it('createOrganization sends POST', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'org1' }));
      await mobileClient.createOrganization({ name: 'Org' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('inviteOrganizationMember sends POST', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ message: 'ok', invitationId: 'inv1' }));
      await mobileClient.inviteOrganizationMember('org1', { email: 'a@b.com', role: 'member' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org1/members'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  /* ── Dispute methods ── */
  describe('disputes', () => {
    it('createDispute sends POST /disputes', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'd1' }));
      await mobileClient.createDispute({ bookingId: 'bk1', reason: 'broken' } as any);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/disputes'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getMyDisputes filters by status', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ disputes: [], total: 0 }));
      await mobileClient.getMyDisputes('open');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=open'),
        expect.any(Object),
      );
    });
  });

  /* ── Favorites ── */
  describe('favorites', () => {
    it('getFavorites maps favorites to listing array', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          favorites: [
            { createdAt: '2024-01-01', listing: { id: 'l1', title: 'Camera' } },
          ],
        }),
      );

      const result = await mobileClient.getFavorites();

      expect(result).toEqual([{ id: 'l1', title: 'Camera' }]);
    });

    it('addFavorite sends POST /favorites', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());
      await mobileClient.addFavorite('l1');
      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.listingId).toBe('l1');
    });

    it('removeFavorite sends DELETE /favorites/:id', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse());
      await mobileClient.removeFavorite('l1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/favorites/l1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  /* ── Payment methods ── */
  describe('payments', () => {
    it('createPaymentIntent sends POST', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ clientSecret: 'cs_1' }));
      await mobileClient.createPaymentIntent('bk1');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/intents/bk1'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getPaymentBalance fetches balance', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ available: 1000 }));
      const result = await mobileClient.getPaymentBalance();
      expect(result.available).toBe(1000);
    });

    it('getPaymentTransactions passes pagination', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ transactions: [], total: 0, page: 2, limit: 5 }));
      await mobileClient.getPaymentTransactions(2, 5);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=5');
    });
  });

  /* ── Geo methods ── */
  describe('geo', () => {
    it('geoAutocomplete builds query with options', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ results: [] }));

      await mobileClient.geoAutocomplete('Kath', { limit: 5, lang: 'en' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('q=Kath');
      expect(url).toContain('limit=5');
      expect(url).toContain('lang=en');
    });

    it('geoReverse sends lat/lon', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ result: null }));

      await mobileClient.geoReverse(27.7, 85.3);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('lat=27.7');
      expect(url).toContain('lon=85.3');
    });
  });

  /* ── AI methods ── */
  describe('ai', () => {
    it('generateDescription sends POST /ai/generate-description', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ description: 'Great cam', model: 'gpt' }));

      await mobileClient.generateDescription({ title: 'Camera' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/generate-description'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('getPriceSuggestion builds query params', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ averagePrice: 500 }));

      await mobileClient.getPriceSuggestion({ city: 'Kathmandu', condition: 'good' });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('city=Kathmandu');
      expect(url).toContain('condition=good');
    });
  });

  /* ── Error handling ── */
  describe('error handling', () => {
    it('throws on non-OK response', async () => {
      mockFetch.mockReturnValueOnce(textResponse('Not found', 404));

      await expect(mobileClient.getListing('x')).rejects.toThrow('Not found');
    });

    it('throws generic message on empty error body', async () => {
      mockFetch.mockReturnValueOnce(textResponse('', 500));

      await expect(mobileClient.getListing('x')).rejects.toThrow('Request failed (500)');
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */

describe('initializeAuth', () => {
  it('loads token from authStore', async () => {
    mockGetToken.mockResolvedValue('stored-token');

    const token = await initializeAuth();

    expect(token).toBe('stored-token');
    expect(mockGetToken).toHaveBeenCalled();
  });

  it('returns null when no stored token', async () => {
    mockGetToken.mockResolvedValue(null);

    const token = await initializeAuth();

    expect(token).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */

describe('authenticatedFetch', () => {
  it('attaches cached token as Authorization header', async () => {
    setCachedToken('my-token');
    mockFetch.mockReturnValueOnce(jsonResponse({ data: 'ok' }));

    const result = await authenticatedFetch('/test');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer my-token');
    expect(result).toEqual({ data: 'ok' });
  });

  it('retries on 401 with token refresh', async () => {
    setCachedToken('old-token');
    mockFetch
      .mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('') }),
      )
      .mockReturnValueOnce(jsonResponse({ accessToken: 'new-token', refreshToken: 'new-refresh' }))
      .mockReturnValueOnce(jsonResponse({ data: 'success' }));

    mockGetRefreshToken.mockResolvedValue('refresh-tok');

    const result = await authenticatedFetch('/protected');

    expect(mockSetTokens).toHaveBeenCalledWith('new-token', 'new-refresh');
    expect(result).toEqual({ data: 'success' });
  });

  it('calls onForceLogout when refresh fails', async () => {
    setCachedToken('old-token');
    const handler = jest.fn();
    setOnForceLogout(handler);

    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('') }),
    );
    mockGetRefreshToken.mockResolvedValue(null);

    await expect(authenticatedFetch('/protected')).rejects.toThrow('Session expired');

    expect(mockClearTokens).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('handles 204 no content', async () => {
    setCachedToken('tok');
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 204, json: () => Promise.reject() }),
    );

    const result = await authenticatedFetch('/empty');

    expect(result).toBeUndefined();
  });

  it('throws on non-401 errors', async () => {
    setCachedToken('tok');
    mockFetch.mockReturnValueOnce(textResponse('Bad Request', 400));

    await expect(authenticatedFetch('/fail')).rejects.toThrow('Bad Request');
  });
});
