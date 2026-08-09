import { LocationService } from './location.service';

describe('LocationService', () => {
  it('upserts the current location for the active assignment', async () => {
    const db: any = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ id: 'order-1', driverId: 'driver-1' }]),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'location-1' }]),
          }),
        }),
      }),
    };

    const service = new LocationService(db);

    const result = await service.saveDriverLocation('driver-1', 'order-1', 12.34, 56.78);

    expect(result).toEqual([{ id: 'location-1' }]);
    expect(db.insert).toHaveBeenCalled();
  });
});
