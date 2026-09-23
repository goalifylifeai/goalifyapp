jest.mock('expo-constants', () => ({
  expoConfig: { extra: { revenuecatIosKey: 'appl_x', revenuecatAndroidKey: 'goog_x', revenuecatWebKey: '' } },
}));

const mockPurchasePackage = jest.fn();
const mockSetAttributes = jest.fn().mockResolvedValue(undefined);
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    purchasePackage: (...a: unknown[]) => mockPurchasePackage(...a),
    setAttributes: (...a: unknown[]) => mockSetAttributes(...a),
  },
  INTRO_ELIGIBILITY_STATUS: {},
}));

import { revenueCatApiKey, purchase, type PaywallPackage } from '../lib/purchases';

const pkg: PaywallPackage = {
  period: 'monthly', productId: 'beyond_monthly', priceString: '$3.99', price: 3.99, hasFreeTrial: true, raw: {},
};

describe('revenueCatApiKey', () => {
  it('picks the key for each platform', () => {
    expect(revenueCatApiKey('ios')).toBe('appl_x');
    expect(revenueCatApiKey('android')).toBe('goog_x');
    expect(revenueCatApiKey('web')).toBe('');
  });
});

describe('purchase', () => {
  it('tags the paywall source and returns the new plan state', async () => {
    mockPurchasePackage.mockResolvedValue({
      customerInfo: { managementURL: null, entitlements: { active: { beyond: {
        periodType: 'TRIAL', expirationDate: '2026-10-08T00:00:00Z', willRenew: true, store: 'APP_STORE', productIdentifier: 'beyond_monthly',
      } } } },
    });
    const r = await purchase(pkg, 'vision_regen');
    expect(mockSetAttributes).toHaveBeenCalledWith({ paywall_source: 'vision_regen' });
    expect(r).toMatchObject({ status: 'purchased', state: { plan: 'beyond', isTrial: true } });
  });
  it('reports a cancelled payment sheet without throwing', async () => {
    mockPurchasePackage.mockRejectedValue({ userCancelled: true });
    await expect(purchase(pkg, 'profile')).resolves.toEqual({ status: 'cancelled' });
  });
  it('rethrows real errors', async () => {
    mockPurchasePackage.mockRejectedValue(new Error('network'));
    await expect(purchase(pkg, 'profile')).rejects.toThrow('network');
  });
});
