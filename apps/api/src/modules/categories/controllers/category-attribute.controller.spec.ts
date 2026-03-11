import { CategoryAttributeController } from './category-attribute.controller';

describe('CategoryAttributeController', () => {
  let controller: CategoryAttributeController;
  let attrService: any;

  beforeEach(() => {
    attrService = {
      createDefinition: jest.fn().mockResolvedValue({ id: 'attr-1', label: 'Bedrooms' }),
      findDefinitionsByCategory: jest.fn().mockResolvedValue([
        { id: 'attr-1', label: 'Bedrooms', fieldType: 'NUMBER' },
      ]),
      findDefinitionById: jest.fn().mockResolvedValue({ id: 'attr-1', label: 'Bedrooms' }),
      updateDefinition: jest.fn().mockResolvedValue({ id: 'attr-1', label: 'Rooms' }),
      deleteDefinition: jest.fn().mockResolvedValue(undefined),
      setValue: jest.fn().mockResolvedValue({ attributeDefinitionId: 'attr-1', value: '3' }),
      bulkSetValues: jest.fn().mockResolvedValue({ count: 2 }),
      getValuesForListing: jest.fn().mockResolvedValue([{ id: 'val-1', value: '3' }]),
      deleteValue: jest.fn().mockResolvedValue(undefined),
      validateRequiredAttributes: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    };

    controller = new CategoryAttributeController(attrService);
  });

  describe('createDefinition', () => {
    it('should create attribute definition', async () => {
      const body = { name: 'Bedrooms', type: 'NUMBER', required: true };
      const result = await controller.createDefinition('cat-1', body as any);

      expect(result).toBeDefined();
      expect(attrService.createDefinition).toHaveBeenCalled();
    });
  });

  describe('getDefinitions', () => {
    it('should return definitions for category', async () => {
      const result = await controller.getDefinitions('cat-1');

      expect(Array.isArray(result)).toBe(true);
      expect(attrService.findDefinitionsByCategory).toHaveBeenCalledWith('cat-1');
    });
  });

  describe('getDefinition', () => {
    it('should return single definition', async () => {
      const result = await controller.getDefinition('attr-1');

      expect(result).toBeDefined();
      expect(attrService.findDefinitionById).toHaveBeenCalledWith('attr-1');
    });
  });

  describe('updateDefinition', () => {
    it('should update definition', async () => {
      const body = { name: 'Rooms' };
      const result = await controller.updateDefinition('attr-1', body as any);

      expect((result as any).label).toBe('Rooms');
    });
  });

  describe('deleteDefinition', () => {
    it('should delete definition', async () => {
      await controller.deleteDefinition('attr-1');

      expect(attrService.deleteDefinition).toHaveBeenCalledWith('attr-1');
    });
  });

  describe('setValue', () => {
    it('should set attribute value for listing', async () => {
      const body = { attributeDefinitionId: 'attr-1', value: '3' };
      const result = await controller.setValue('listing-1', body as any);

      expect(result).toBeDefined();
    });
  });

  describe('bulkSetValues', () => {
    it('should bulk set attribute values', async () => {
      const body = {
        values: [
          { attributeDefinitionId: 'attr-1', value: '3' },
          { attributeDefinitionId: 'attr-2', value: 'true' },
        ],
      };
      const result = await controller.bulkSetValues('listing-1', body as any);

      expect(result).toBeDefined();
    });
  });

  describe('getValues', () => {
    it('should return attribute values for listing', async () => {
      const result = await controller.getValues('listing-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('deleteValue', () => {
    it('should delete attribute value', async () => {
      await controller.deleteValue('listing-1', 'attr-1');

      expect(attrService.deleteValue).toHaveBeenCalled();
    });
  });

  describe('validateAttributes', () => {
    it('should validate attributes for listing', async () => {
      const result = await controller.validateAttributes('listing-1', { categoryId: 'cat-1' });

      expect(result.valid).toBe(true);
    });
  });
});
