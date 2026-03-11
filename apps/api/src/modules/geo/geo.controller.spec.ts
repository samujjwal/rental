import { GeoController } from './geo.controller';

describe('GeoController', () => {
  let controller: GeoController;
  let geoService: any;

  beforeEach(() => {
    geoService = {
      autocomplete: jest.fn().mockResolvedValue([
        { name: 'Kathmandu', lat: 27.7172, lon: 85.324 },
      ]),
      reverse: jest.fn().mockResolvedValue({
        name: 'Thamel, Kathmandu',
        lat: 27.7152,
        lon: 85.3123,
      }),
    };

    controller = new GeoController(geoService);
  });

  describe('autocomplete', () => {
    it('should return matching locations', async () => {
      const result = await controller.autocomplete('Kathmandu');

      expect(result).toBeDefined();
      expect(geoService.autocomplete).toHaveBeenCalled();
    });

    it('should pass optional parameters', async () => {
      await controller.autocomplete('Pokhara', '5', 'en', '28.2', '83.9');

      expect(geoService.autocomplete).toHaveBeenCalled();
    });
  });

  describe('reverse', () => {
    it('should return location for coordinates', async () => {
      const result = await controller.reverse('27.7172', '85.324');

      expect(result).toBeDefined();
      expect(geoService.reverse).toHaveBeenCalled();
    });

    it('should pass language parameter', async () => {
      await controller.reverse('27.7172', '85.324', 'ne');

      expect(geoService.reverse).toHaveBeenCalled();
    });
  });
});
