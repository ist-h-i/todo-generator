import { TestBed } from '@angular/core/testing';

import { App } from './app';

describe('App', () => {
  it('should create the app shell', async () => {
    const fixture = await TestBed.configureTestingModule({ imports: [App] }).createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
