// The receiver's signature (DR-03 / DR-20): the pad draws an SVG, Complete stop waits for it, and it leaves the phone
// through the outbox as a POD_PHOTO of kind SIGNATURE (POST /media/pod-photos?…&kind=SIGNATURE, image/svg+xml).
import { fireEvent, render, screen } from '@testing-library/react-native';
import { memoryQueueStorage, OfflineQueue } from '@/offline/queue';
import { base64ToBytes, SyncEngine } from '@/offline/sync';
import { inkLength, MIN_SIGNATURE_LENGTH, SignaturePad, signatureSvg } from '@/lodestar/signature';
import { asciiToBase64 } from '@/model/actions';
import { draw } from './signature-draw';

describe('signature pad', () => {
  it('a real stroke gives an SVG of path data; a dot does not count; Clear empties it', async () => {
    const onChange = jest.fn();
    await render(<SignaturePad onChange={onChange} caption="Receiver signs above the line" />);
    await draw('signature-pad', [[10, 10], [12, 11]]);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await draw('signature-pad', [[20, 50], [60, 20], [120, 55], [200, 30]]);
    const svg = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
    // the drawing space has the pad's own shape (here 280 × 70), so the ink is exactly where the finger was
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 280 70">/);
    expect(svg).toContain('<path d="M20 50 L60 20 L120 55 L200 30"/>');
    await fireEvent.press(screen.getByTestId('signature-pad-clear'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('measures ink and encodes the SVG as base64 that decodes back', () => {
    expect(inkLength([[[0, 0], [3, 4]]])).toBe(5);
    expect(signatureSvg([[[0, 0], [MIN_SIGNATURE_LENGTH - 1, 0]]])).toBeNull();
    const svg = signatureSvg([[[0, 0], [100, 0]]])!;
    expect(String.fromCharCode(...base64ToBytes(asciiToBase64(svg)))).toBe(svg);
  });
});

describe('the outbox sends a signature as kind SIGNATURE', () => {
  it('POSTs the SVG to /media/pod-photos with kind=SIGNATURE and image/svg+xml', async () => {
    let n = 0;
    const q = new OfflineQueue(memoryQueueStorage(), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, () => Date.now());
    await q.ready();
    const request = jest.fn(async () => ({ status: 201, data: {} }));
    const engine = new SyncEngine(q, { action: jest.fn(), create: jest.fn(), list: jest.fn(), request } as any, { sub: () => 'u-1', online: () => true, now: () => Date.now() });
    const svg = signatureSvg([[[0, 0], [100, 0]]])!;
    const item = await q.enqueue('POD_PHOTO', { sub: 'u-1', tripId: 'T1', ref: 'S1', label: 'Signature', payload: { kind: 'SIGNATURE', stopId: 'S1', mime: 'image/svg+xml', dataBase64: asciiToBase64(svg), takenAt: '2026-04-07T01:28:00.000Z' } });
    expect((await engine.flush()).synced).toBe(1);
    const [, path, opts] = (request.mock.calls[0] as unknown) as [string, string, any];
    expect(path).toContain('kind=SIGNATURE');
    expect(path).toContain(`eventId=${item.id}`);
    expect(opts.headers).toEqual({ 'Content-Type': 'image/svg+xml' });
    expect(String.fromCharCode(...(opts.raw as Uint8Array))).toBe(svg);
  });
});
