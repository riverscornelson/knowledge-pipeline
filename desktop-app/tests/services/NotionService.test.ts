/**
 * Tests for NotionService
 */

import { NotionService, NotionConfig, CreatePageOptions } from '../../src/main/services/NotionService';
import { Client } from '@notionhq/client';

// Mock the Notion client
jest.mock('@notionhq/client');

describe('NotionService', () => {
  let service: NotionService;
  let mockClient: any;
  
  const mockConfig: NotionConfig = {
    token: 'secret_test_token',
    databaseId: 'test-database-id',
    rateLimitDelay: 100,
    maxRetries: 2,
    batchSize: 5
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock client with jest functions
    mockClient = {
      databases: {
        retrieve: jest.fn(),
        query: jest.fn()
      },
      pages: {
        create: jest.fn()
      }
    };

    // Mock Client constructor
    (Client as jest.MockedClass<typeof Client>).mockImplementation(() => mockClient);
    
    service = new NotionService(mockConfig);
  });

  afterEach(() => {
    if (service) {
      service.destroy();
    }
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
      expect(service.getConfig()).toMatchObject(mockConfig);
    });

    it('should throw error if token is missing', () => {
      expect(() => new NotionService({ ...mockConfig, token: '' }))
        .toThrow('Notion token is required');
    });

    it('should throw error if database ID is missing', () => {
      expect(() => new NotionService({ ...mockConfig, databaseId: '' }))
        .toThrow('Notion database ID is required');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockClient.databases.retrieve.mockResolvedValue({
        id: 'test-db',
        title: [{ plain_text: 'Test Database' }]
      } as any);

      const result = await service.testConnection();
      
      expect(result).toBe(true);
      expect(mockClient.databases.retrieve).toHaveBeenCalledWith({
        database_id: mockConfig.databaseId
      });
    });

    it('should throw error on connection failure', async () => {
      mockClient.databases.retrieve.mockRejectedValue(new Error('Network error'));

      await expect(service.testConnection()).rejects.toThrow('Failed to connect to Notion');
    });
  });

  describe('validateSchema', () => {
    it('should return valid when schema is correct', async () => {
      const mockService = new NotionService({
        ...mockConfig,
        createdDateProp: 'Created Date'
      });
      
      mockClient.databases.retrieve.mockResolvedValue({
        id: 'test-db',
        properties: {
          Name: { type: 'title' },
          'Created Date': { type: 'date' }
        }
      } as any);

      const result = await mockService.validateSchema();
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      
      mockService.destroy();
    });

    it('should return issues when required properties are missing', async () => {
      mockClient.databases.retrieve.mockResolvedValue({
        id: 'test-db',
        properties: {
          Description: { type: 'rich_text' }
        }
      } as any);

      const result = await service.validateSchema();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Database must have a "Name" or "Title" property');
    });
  });

  describe('createPage', () => {
    const mockPageOptions: CreatePageOptions = {
      title: 'Test Page',
      content: 'Test content',
      useEnhancedFormatting: false
    };

    it('should create a page successfully', async () => {
      const mockResponse = {
        id: 'page-123',
        properties: {
          Name: { 
            type: 'title',
            title: [{ plain_text: 'Test Page' }]
          }
        },
        created_time: '2024-01-01T00:00:00Z',
        last_edited_time: '2024-01-01T00:00:00Z',
        url: 'https://notion.so/test-page'
      };

      mockClient.pages.create.mockResolvedValue(mockResponse as any);

      const result = await service.createPage(mockPageOptions);
      
      expect(result).toMatchObject({
        id: 'page-123',
        title: 'Test Page',
        url: 'https://notion.so/test-page'
      });
      
      expect(mockClient.pages.create).toHaveBeenCalledWith({
        parent: { database_id: mockConfig.databaseId },
        properties: {
          Name: {
            title: [{ text: { content: 'Test Page' } }]
          }
        },
        children: expect.any(Array)
      });
    });

    it('should handle content chunking for long text', async () => {
      const longContent = 'A'.repeat(3000); // Exceeds 2000 char limit
      
      mockClient.pages.create.mockResolvedValue({
        id: 'page-123',
        properties: { Name: { type: 'title', title: [{ plain_text: 'Test' }] } }
      } as any);

      await service.createPage({
        ...mockPageOptions,
        content: longContent
      });

      const createCall = mockClient.pages.create.mock.calls[0][0];
      expect(createCall.children.length).toBeGreaterThan(1); // Should be chunked
    });

    it('should support enhanced formatting', async () => {
      const formattedContent = '# Header\n- List item 1\n- List item 2\n## Subheader';
      
      mockClient.pages.create.mockResolvedValue({
        id: 'page-123',
        properties: { Name: { type: 'title', title: [{ plain_text: 'Test' }] } }
      } as any);

      await service.createPage({
        ...mockPageOptions,
        content: formattedContent,
        useEnhancedFormatting: true
      });

      const createCall = mockClient.pages.create.mock.calls[0][0];
      const children = createCall.children;
      
      expect(children[0].type).toBe('heading_1');
      expect(children[1].type).toBe('bulleted_list_item');
      expect(children[2].type).toBe('bulleted_list_item');
      expect(children[3].type).toBe('heading_2');
    });
  });

  describe('batchCreate', () => {
    it('should process batches successfully', async () => {
      const pages: CreatePageOptions[] = Array(12).fill(null).map((_, i) => ({
        title: `Page ${i + 1}`,
        content: `Content ${i + 1}`
      }));

      mockClient.pages.create.mockResolvedValue({
        id: 'page-id',
        properties: { Name: { type: 'title', title: [{ plain_text: 'Test' }] } }
      } as any);

      const progressEvents: any[] = [];
      service.on('progress', (progress) => progressEvents.push(progress));

      const result = await service.batchCreate(pages);
      
      expect(result.successful).toHaveLength(12);
      expect(result.failed).toHaveLength(0);
      expect(mockClient.pages.create).toHaveBeenCalledTimes(12);
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should handle failures in batch', async () => {
      const pages: CreatePageOptions[] = [
        { title: 'Page 1', content: 'Content 1' },
        { title: 'Page 2', content: 'Content 2' },
        { title: 'Page 3', content: 'Content 3' }
      ];

      mockClient.pages.create
        .mockResolvedValueOnce({
          id: 'page-1',
          properties: { Name: { type: 'title', title: [{ plain_text: 'Page 1' }] } }
        } as any)
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          id: 'page-3',
          properties: { Name: { type: 'title', title: [{ plain_text: 'Page 3' }] } }
        } as any);

      const result = await service.batchCreate(pages);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.message).toBe('Failed to create page');
    });
  });

  describe('queryDatabase', () => {
    it('should query with pagination', async () => {
      mockClient.databases.query
        .mockResolvedValueOnce({
          results: [
            {
              id: 'page-1',
              properties: { Name: { type: 'title', title: [{ plain_text: 'Page 1' }] } }
            }
          ],
          has_more: true,
          next_cursor: 'cursor-1'
        } as any)
        .mockResolvedValueOnce({
          results: [
            {
              id: 'page-2',
              properties: { Name: { type: 'title', title: [{ plain_text: 'Page 2' }] } }
            }
          ],
          has_more: false,
          next_cursor: null
        } as any);

      const results = await service.queryDatabase();
      
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Page 1');
      expect(results[1].title).toBe('Page 2');
      expect(mockClient.databases.query).toHaveBeenCalledTimes(2);
    });

    it('should apply filters and sorts', async () => {
      mockClient.databases.query.mockResolvedValue({
        results: [],
        has_more: false,
        next_cursor: null
      } as any);

      const options = {
        filter: { property: 'Status', select: { equals: 'Published' } },
        sorts: [{ property: 'Created', direction: 'descending' }],
        pageSize: 50
      };

      await service.queryDatabase(options);
      
      expect(mockClient.databases.query).toHaveBeenCalledWith({
        database_id: mockConfig.databaseId,
        filter: options.filter,
        sorts: options.sorts,
        start_cursor: undefined,
        page_size: 50
      });
    });
  });

  describe('rate limiting', () => {
    it('should apply rate limiting between requests', async () => {
      mockClient.databases.retrieve.mockResolvedValue({
        id: 'test-db',
        title: [{ plain_text: 'Test' }]
      } as any);

      const start = Date.now();
      
      await Promise.all([
        service.testConnection(),
        service.testConnection()
      ]);
      
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(mockConfig.rateLimitDelay!);
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitError: any = new Error('Rate limited');
      rateLimitError.code = 'rate_limited';
      rateLimitError.retry_after = 0.1;

      mockClient.databases.retrieve
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          id: 'test-db',
          title: [{ plain_text: 'Test' }]
        } as any);

      const result = await service.testConnection();
      
      expect(result).toBe(true);
      expect(mockClient.databases.retrieve).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should retry on network errors', async () => {
      const networkError: any = new Error('ECONNRESET');
      networkError.code = 'ECONNRESET';
      
      mockClient.databases.retrieve
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          id: 'test-db',
          title: [{ plain_text: 'Test' }]
        } as any);

      const result = await service.testConnection();
      
      expect(result).toBe(true);
      expect(mockClient.databases.retrieve).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError: any = new Error('Unauthorized');
      authError.status = 401;

      mockClient.databases.retrieve.mockRejectedValue(authError);

      await expect(service.testConnection()).rejects.toThrow('Failed to connect to Notion');
      expect(mockClient.databases.retrieve).toHaveBeenCalledTimes(1);
    });
  });
});