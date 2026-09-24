import { describe, expect, it } from 'vitest';
import { InvalidWebsiteError, normalizeWebsite } from '../src/website.ts';

describe('normalizeWebsite', () => {
  it.each([
    ['klinik.co.id', 'https://klinik.co.id/', 'klinik.co.id'],
    ['  https://WWW.Klinik.co.id/  ', 'https://www.klinik.co.id/', 'klinik.co.id'],
    ['http://klinik.co.id/cabang/', 'http://klinik.co.id/cabang', 'klinik.co.id/cabang'],
    ['https://klinik.co.id/?lang=id#top', 'https://klinik.co.id/?lang=id', 'klinik.co.id'],
    ['https://klinik.co.id:8443', 'https://klinik.co.id:8443/', 'klinik.co.id:8443'],
  ])('normalises %s', (input, url, key) => {
    expect(normalizeWebsite(input)).toEqual({ url, key });
  });

  it.each([
    '',
    'not a url',
    'ftp://klinik.co.id',
    'https://user:pass@klinik.co.id',
    'http://127.0.0.1',
    'http://0x7f.1',
    'http://[::1]',
    'http://localhost:3000',
    'http://intranet',
    'http://printer.local',
  ])('rejects %s', (input) => {
    expect(() => normalizeWebsite(input)).toThrow(InvalidWebsiteError);
  });
});
