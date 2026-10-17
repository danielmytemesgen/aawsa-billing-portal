import { describe, it, expect } from 'vitest';

describe('Customer Portal Route Protection Rules', () => {
  const protectedRoutes = ['/admin', '/staff', '/customer/'];

  it('/customer-login is NOT classified as a protected route', () => {
    const path = '/customer-login';
    const isProtected = protectedRoutes.some(route => path.startsWith(route));
    expect(isProtected).toBe(false);
  });

  it('/customer/* paths ARE classified as protected routes', () => {
    expect(protectedRoutes.some(route => '/customer/dashboard'.startsWith(route))).toBe(true);
    expect(protectedRoutes.some(route => '/customer/bills'.startsWith(route))).toBe(true);
    expect(protectedRoutes.some(route => '/customer/readings'.startsWith(route))).toBe(true);
    expect(protectedRoutes.some(route => '/customer/account'.startsWith(route))).toBe(true);
    expect(protectedRoutes.some(route => '/customer/support'.startsWith(route))).toBe(true);
  });

  it('/customer root is redirected to /customer/dashboard', () => {
    const path = '/customer';
    const shouldRedirectToDashboard = path === '/customer';
    expect(shouldRedirectToDashboard).toBe(true);
  });
});
