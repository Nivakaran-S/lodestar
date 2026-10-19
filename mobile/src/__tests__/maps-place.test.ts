import { mapsPlace, mapsUrl } from '@/model/run';

describe('Maps directions for a stop', () => {
  const outlet = (o: Record<string, unknown>) => ({ id: 'OUT076', name: 'Waypoint Fresh Kandy 076', district: 'Kandy', ...o }) as any;

  it('uses the coordinates, else a real street address', () => {
    expect(mapsPlace(outlet({ lat: 7.29, lng: 80.63, address: '12 Temple St' }))).toEqual({ query: '7.29,80.63', exact: true, town: 'Kandy' });
    expect(mapsPlace(outlet({ address: '12 Temple St, Kandy' }))).toEqual({ query: '12 Temple St, Kandy', exact: true, town: 'Kandy' });
  });

  it('with no location on file (the synthetic network): the outlet’s town, said as such', () => {
    expect(mapsPlace(outlet({ address: 'synthetic' }))).toEqual({ query: 'Kandy, Sri Lanka', exact: false, town: 'Kandy' });
    expect(mapsPlace(outlet({ address: null, lat: null, lng: null }))).toEqual({ query: 'Kandy, Sri Lanka', exact: false, town: 'Kandy' });
    expect(mapsUrl([{ outlet: outlet({ address: null }) } as any])).toBe('https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=Kandy%2C%20Sri%20Lanka');
  });

  it('nothing to go to without an outlet', () => {
    expect(mapsPlace(null)).toBeNull();
  });
});
