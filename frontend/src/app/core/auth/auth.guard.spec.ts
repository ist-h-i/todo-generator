import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { adminGuard } from './admin.guard';
import { authChildGuard, authGuard } from './auth.guard';
import { AuthService } from './auth.service';

type AuthServiceDouble = {
  ensureInitialized: jasmine.Spy<() => Promise<void>>;
  isAuthenticated: jasmine.Spy<() => boolean>;
  isAdmin: jasmine.Spy<() => boolean>;
};

describe('auth guards', () => {
  let auth: AuthServiceDouble;
  let router: jasmine.SpyObj<Router>;
  let loginUrlTree: UrlTree;
  let boardUrlTree: UrlTree;

  beforeEach(() => {
    auth = {
      ensureInitialized: jasmine.createSpy('ensureInitialized').and.resolveTo(undefined),
      isAuthenticated: jasmine.createSpy('isAuthenticated'),
      isAdmin: jasmine.createSpy('isAdmin'),
    } as AuthServiceDouble;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth as unknown as AuthService },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['parseUrl']) },
      ],
    });

    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    loginUrlTree = { fragment: 'login' } as unknown as UrlTree;
    boardUrlTree = { fragment: 'board' } as unknown as UrlTree;

    router.parseUrl.withArgs('/login').and.returnValue(loginUrlTree);
    router.parseUrl.withArgs('/board').and.returnValue(boardUrlTree);
  });

  describe('authGuard', () => {
    it('allows navigation when the user is authenticated', async () => {
      auth.isAuthenticated.and.returnValue(true);

      const result = await TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(result).toBeTrue();
      expect(auth.ensureInitialized).toHaveBeenCalled();
      expect(auth.isAuthenticated).toHaveBeenCalled();
      expect(router.parseUrl).not.toHaveBeenCalled();
    });

    it('redirects to the login page when the user is not authenticated', async () => {
      auth.isAuthenticated.and.returnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(router.parseUrl).toHaveBeenCalledWith('/login');
      expect(result).toBe(loginUrlTree);
    });
  });

  describe('authChildGuard', () => {
    it('reuses the same logic as authGuard', async () => {
      auth.isAuthenticated.and.returnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        authChildGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(router.parseUrl).toHaveBeenCalledWith('/login');
      expect(result).toBe(loginUrlTree);
    });
  });

  describe('adminGuard', () => {
    it('allows navigation when the user is authenticated as an admin', async () => {
      auth.isAuthenticated.and.returnValue(true);
      auth.isAdmin.and.returnValue(true);

      const result = await TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(result).toBeTrue();
      expect(router.parseUrl).not.toHaveBeenCalled();
    });

    it('redirects to login when the user is not authenticated', async () => {
      auth.isAuthenticated.and.returnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(router.parseUrl).toHaveBeenCalledWith('/login');
      expect(result).toBe(loginUrlTree);
    });

    it('redirects to the board when the user lacks admin privileges', async () => {
      auth.isAuthenticated.and.returnValue(true);
      auth.isAdmin.and.returnValue(false);

      const result = await TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );

      expect(router.parseUrl).toHaveBeenCalledWith('/board');
      expect(result).toBe(boardUrlTree);
    });
  });
});
