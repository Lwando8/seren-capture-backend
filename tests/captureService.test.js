const CaptureService = require('../src/services/captureService');
const EstateMateClient = require('../src/api/estateMateClient');
const ImageStorageService = require('../src/services/imageStorage');

// Mock dependencies
jest.mock('../src/api/estateMateClient');
jest.mock('../src/services/imageStorage');

describe('CaptureService', () => {
  let captureService;
  let mockEstateMateClient;
  let mockImageStorage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockEstateMateClient = {
      validateConfig: jest.fn().mockReturnValue(true),
      testConnection: jest.fn().mockResolvedValue(true),
      searchByOTP: jest.fn()
    };
    
    mockImageStorage = {
      storeImage: jest.fn()
    };

    // Mock the constructors
    EstateMateClient.mockImplementation(() => mockEstateMateClient);
    ImageStorageService.mockImplementation(() => mockImageStorage);

    captureService = new CaptureService();
  });

  describe('initialize', () => {
    it('should initialize successfully with valid configuration', async () => {
      const result = await captureService.initialize();
      expect(result).toBe(true);
      expect(mockEstateMateClient.validateConfig).toHaveBeenCalled();
      expect(mockEstateMateClient.testConnection).toHaveBeenCalled();
    });

    it('should throw error if API configuration is invalid', async () => {
      mockEstateMateClient.validateConfig.mockReturnValue(false);
      
      await expect(captureService.initialize()).rejects.toThrow('EstateMate API configuration is invalid');
    });

    it('should throw error if API connection fails', async () => {
      mockEstateMateClient.testConnection.mockResolvedValue(false);
      
      await expect(captureService.initialize()).rejects.toThrow('Unable to connect to EstateMate API');
    });
  });

  describe('startCaptureSession', () => {
    beforeEach(async () => {
      await captureService.initialize();
    });

    it('should start capture session successfully', async () => {
      const mockResidentInfo = {
        id: '123',
        name: 'John Doe',
        unitNumber: 'A101',
        phone: '+1234567890',
        email: 'john@example.com'
      };

      mockEstateMateClient.searchByOTP.mockResolvedValue(mockResidentInfo);

      const result = await captureService.startCaptureSession('123456');

      expect(result.sessionId).toBeDefined();
      expect(result.residentInfo).toEqual(mockResidentInfo);
      expect(result.status).toBe('ready_for_mode_selection');
      expect(captureService.getActiveSessionsCount()).toBe(1);
    });

    it('should throw error for empty OTP', async () => {
      await expect(captureService.startCaptureSession('')).rejects.toThrow('OTP is required');
      await expect(captureService.startCaptureSession(null)).rejects.toThrow('OTP is required');
    });

    it('should throw error if API search fails', async () => {
      mockEstateMateClient.searchByOTP.mockRejectedValue(new Error('OTP not found'));

      await expect(captureService.startCaptureSession('invalid')).rejects.toThrow('OTP not found');
    });
  });

  describe('setCaptureMode', () => {
    let sessionId;

    beforeEach(async () => {
      await captureService.initialize();
      const mockResidentInfo = {
        id: '123',
        name: 'John Doe',
        unitNumber: 'A101'
      };
      mockEstateMateClient.searchByOTP.mockResolvedValue(mockResidentInfo);
      const result = await captureService.startCaptureSession('123456');
      sessionId = result.sessionId;
    });

    it('should set pedestrian mode successfully', async () => {
      const result = await captureService.setCaptureMode(sessionId, 'pedestrian');

      expect(result.mode).toBe('pedestrian');
      expect(result.status).toBe('ready_for_capture');
      expect(result.availableCaptures).toEqual(['person']);
    });

    it('should set vehicle mode successfully', async () => {
      const result = await captureService.setCaptureMode(sessionId, 'vehicle');

      expect(result.mode).toBe('vehicle');
      expect(result.status).toBe('ready_for_capture');
      expect(result.availableCaptures).toEqual(['person', 'vehicle']);
    });

    it('should throw error for invalid mode', async () => {
      await expect(captureService.setCaptureMode(sessionId, 'invalid')).rejects.toThrow('Invalid capture mode');
    });

    it('should throw error for non-existent session', async () => {
      await expect(captureService.setCaptureMode('invalid-session', 'pedestrian')).rejects.toThrow('Session not found');
    });
  });

  describe('processCapture', () => {
    let sessionId;

    beforeEach(async () => {
      await captureService.initialize();
      const mockResidentInfo = {
        id: '123',
        name: 'John Doe',
        unitNumber: 'A101'
      };
      mockEstateMateClient.searchByOTP.mockResolvedValue(mockResidentInfo);
      const result = await captureService.startCaptureSession('123456');
      sessionId = result.sessionId;
      await captureService.setCaptureMode(sessionId, 'pedestrian');
    });

    it('should process person capture successfully', async () => {
      const mockImageBuffer = Buffer.from('mock-image-data');
      const mockStorageResult = {
        success: true,
        fileId: 'img-123',
        filename: 'image.jpg',
        metadata: {
          fileSize: 1024,
          checksum: 'abc123'
        }
      };

      mockImageStorage.storeImage.mockResolvedValue(mockStorageResult);

      const result = await captureService.processCapture(sessionId, 'person', mockImageBuffer);

      expect(result.success).toBe(true);
      expect(result.captureType).toBe('person');
      expect(result.imageId).toBe('img-123');
      expect(result.sessionComplete).toBe(true);
      expect(result.nextAction).toBe('complete_session');
    });

    it('should throw error for invalid capture type', async () => {
      const mockImageBuffer = Buffer.from('mock-image-data');

      await expect(captureService.processCapture(sessionId, 'invalid', mockImageBuffer)).rejects.toThrow('Invalid capture type');
    });

    it('should throw error for vehicle capture in pedestrian mode', async () => {
      const mockImageBuffer = Buffer.from('mock-image-data');

      await expect(captureService.processCapture(sessionId, 'vehicle', mockImageBuffer)).rejects.toThrow('Vehicle capture not allowed in pedestrian mode');
    });
  });

  describe('completeSession', () => {
    let sessionId;

    beforeEach(async () => {
      await captureService.initialize();
      const mockResidentInfo = {
        id: '123',
        name: 'John Doe',
        unitNumber: 'A101'
      };
      mockEstateMateClient.searchByOTP.mockResolvedValue(mockResidentInfo);
      const result = await captureService.startCaptureSession('123456');
      sessionId = result.sessionId;
      await captureService.setCaptureMode(sessionId, 'pedestrian');
      
      // Complete the session by processing a capture
      const mockImageBuffer = Buffer.from('mock-image-data');
      const mockStorageResult = {
        success: true,
        fileId: 'img-123',
        filename: 'image.jpg',
        metadata: { fileSize: 1024 }
      };
      mockImageStorage.storeImage.mockResolvedValue(mockStorageResult);
      await captureService.processCapture(sessionId, 'person', mockImageBuffer);
    });

    it('should complete session successfully', async () => {
      const result = await captureService.completeSession(sessionId);

      expect(result.sessionId).toBe(sessionId);
      expect(result.residentInfo.name).toBe('John Doe');
      expect(result.mode).toBe('pedestrian');
      expect(result.totalCaptures).toBe(1);
      expect(captureService.getActiveSessionsCount()).toBe(0);
    });

    it('should throw error for incomplete session', async () => {
      // Create a new incomplete session
      const result = await captureService.startCaptureSession('789012');
      const newSessionId = result.sessionId;
      await captureService.setCaptureMode(newSessionId, 'vehicle');

      await expect(captureService.completeSession(newSessionId)).rejects.toThrow('Session is not ready for completion');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      await captureService.initialize();
      
      // Create a session
      const mockResidentInfo = { id: '123', name: 'John Doe', unitNumber: 'A101' };
      mockEstateMateClient.searchByOTP.mockResolvedValue(mockResidentInfo);
      await captureService.startCaptureSession('123456');

      expect(captureService.getActiveSessionsCount()).toBe(1);

      // Clean up with very short max age (0ms)
      const cleanedCount = captureService.cleanupExpiredSessions(0);

      expect(cleanedCount).toBe(1);
      expect(captureService.getActiveSessionsCount()).toBe(0);
    });
  });
});
