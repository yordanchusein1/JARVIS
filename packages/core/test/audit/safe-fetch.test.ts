import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSafeFetcher,
  isPublicAddress,
  UnsafeTargetError,
} from '../../src/audit/safe-fetch.ts';

describe('isPublicAddress', () => {
  it.each([
    ['8.8.8.8', true],
    ['103.28.12.4', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false],
    ['100.100.1.1', false],
    ['0.0.0.0', false],
    ['::1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false],
    ['::ffff:8.8.8.8', true],
    ['not-an-ip', false],
  ])('%s → %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });
});

describe('createSafeFetcher', () => {
  let server: Server;
  let port = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(301, { location: '/final' }).end();
      } else if (req.url === '/loop') {
        res.writeHead(302, { location: '/loop' }).end();
      } else if (req.url === '/to-internal') {
        res.writeHead(302, { location: `http://internal.test:${port}/final` }).end();
      } else if (req.url === '/to-file') {
        res.writeHead(302, { location: 'file:///etc/passwd' }).end();
      } else if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'text/html' }).end('x'.repeat(5000));
      } else {
        res
          .writeHead(200, { 'content-type': 'text/html' })
          .end(`<p>${req.headers['user-agent']}</p>`);
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  // "public.test" stands in for a public website; it resolves to the local test server.
  const hosts: Record<string, string> = {
    'public.test': '127.0.0.1',
    'internal.test': '127.0.0.2',
  };
  const testFetcher = (options = {}) =>
    createSafeFetcher({
      lookup: (hostname, callback) => {
        const address = hosts[hostname];
        if (address) callback(null, [{ address, family: 4 }]);
        else callback(new Error(`ENOTFOUND ${hostname}`), []);
      },
      isAllowedAddress: (address) => address === '127.0.0.1',
      ...options,
    });

  it('fetches a page and follows redirects', async () => {
    const page = await testFetcher()(`http://public.test:${port}/redirect`);
    expect(page.status).toBe(200);
    expect(page.url).toBe(`http://public.test:${port}/final`);
    expect(page.redirects).toHaveLength(2);
    expect(page.body).toContain('Arclight-Audit');
  });

  it('refuses hosts that resolve to blocked addresses', async () => {
    const fetchPage = createSafeFetcher({
      lookup: (_hostname, callback) => callback(null, [{ address: '10.0.0.5', family: 4 }]),
    });
    await expect(fetchPage('http://intranet.example.com/')).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
  });

  it('refuses IP address URLs that are not allowed', async () => {
    await expect(createSafeFetcher()('http://127.0.0.1:9/')).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
  });

  it('refuses redirects to blocked addresses', async () => {
    await expect(testFetcher()(`http://public.test:${port}/to-internal`)).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
  });

  it('refuses redirects to non-http URLs', async () => {
    await expect(testFetcher()(`http://public.test:${port}/to-file`)).rejects.toBeInstanceOf(
      UnsafeTargetError,
    );
  });

  it('stops after too many redirects', async () => {
    await expect(
      testFetcher({ maxRedirects: 3 })(`http://public.test:${port}/loop`),
    ).rejects.toThrow('Too many redirects');
  });

  it('truncates large responses', async () => {
    const page = await testFetcher({ maxBytes: 1000 })(`http://public.test:${port}/big`);
    expect(page.body).toHaveLength(1000);
  });
});
