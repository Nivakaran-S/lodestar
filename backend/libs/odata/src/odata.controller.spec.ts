/**
 * HTTP-level caching behaviour of the OData controller (real Express + Nest +
 * engine; Prisma is a plain stub). Regression for 2026-10-22: after a loader
 * flagged a shortfall, GET Trips('…')?$expand=loadRecord kept returning
 * "loadRecord": null because the response carried an ETag of the ROOT row
 * (Trip.updatedAt, unchanged by creating the LoadRecord); the browser
 * revalidated with If-None-Match, Express answered 304 and the stale cached
 * body was used.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AUDIT_SINK } from '@lodestar/security';
import { personas } from '../../security/test/principals';
import { testModel } from '../test/fixtures';
import { ODataEngine } from './engine';
import { EntitySet, ODataEntitySet } from './entity-set';
import { ODataController } from './odata.controller';
import { ODataExceptionFilter } from './odata-exception.filter';
import { ODataRegistry } from './registry';

@EntitySet({ name: 'Orders', model: 'Order', read: ['admin'], abac: { open: '*' }, navigation: ['lineItems'] })
class OrdersSet extends ODataEntitySet {}

describe('ODataController caching', () => {
  const updatedAt = new Date(1_700_000_000_000);
  const etag = `W/"${updatedAt.getTime()}"`;
  let lineItems: { id: string; name: string }[] = [];
  let app: INestApplication;

  beforeAll(async () => {
    const order = {
      findFirst: jest.fn(async () => ({ id: 'A', units: 3, notes: null, updatedAt, lineItems })),
      findMany: jest.fn(async () => [{ id: 'A', units: 3, notes: null, updatedAt }]),
      count: jest.fn(async () => 1),
    };
    const registry = new ODataRegistry('orders', testModel(), [new OrdersSet({ order })], []);
    const moduleRef = await Test.createTestingModule({
      controllers: [ODataController],
      providers: [
        { provide: ODataEngine, useValue: new ODataEngine(registry) },
        { provide: AUDIT_SINK, useValue: { record: jest.fn() } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use((req: any, _res: unknown, next: () => void) => {
      req.principal = personas.admin;
      next();
    });
    app.useGlobalFilters(new ODataExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('marks every OData answer (success and error) Cache-Control: no-store', async () => {
    const ok = await request(app.getHttpServer()).get('/odata/v4/Orders');
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    const missing = await request(app.getHttpServer()).get('/odata/v4/Nope');
    expect(missing.status).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  it('a single-entity read without $expand keeps its ETag header, and is never turned into a 304', async () => {
    const res = await request(app.getHttpServer()).get("/odata/v4/Orders('A')");
    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe(etag);
    const again = await request(app.getHttpServer()).get("/odata/v4/Orders('A')").set('If-None-Match', etag);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: 'A', '@odata.etag': etag });
  });

  it('collections carry no Express body-hash ETag (ETags are entity versions only)', async () => {
    const res = await request(app.getHttpServer()).get('/odata/v4/Orders');
    expect(res.headers.etag).toBeUndefined();
    expect(Number(res.headers['content-length'])).toBe(Buffer.byteLength(res.text));
  });

  it('an expanded read is never answered 304 from the root ETag, even when only the expansion changed', async () => {
    lineItems = [];
    const first = await request(app.getHttpServer()).get("/odata/v4/Orders('A')?$expand=lineItems");
    expect(first.status).toBe(200);
    expect(first.headers.etag).toBeUndefined();
    expect(first.body['@odata.etag']).toBe(etag);
    expect(first.body.lineItems).toEqual([]);

    // A related row appears; the root's updatedAt (and so its ETag) does not move.
    lineItems = [{ id: 'L1', name: 'Milk' }];
    const again = await request(app.getHttpServer()).get("/odata/v4/Orders('A')?$expand=lineItems").set('If-None-Match', etag);
    expect(again.status).toBe(200);
    expect(again.body.lineItems).toEqual([{ id: 'L1', name: 'Milk' }]);
  });
});
