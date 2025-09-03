const EstateMateClient = require('../api/estateMateClient');
const DemoEstateMateClient = require('../api/demoEstateMateClient');
const ImageStorageService = require('./imageStorage');

class CaptureService {
  constructor() {
    this.estateMateClient = null;
    this.imageStorage = new ImageStorageService();
    this.activeSessions = new Map(); // Track active capture sessions
    this.demoMode = false;
  }

  /**
   * Initialize capture service
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize() {
    try {
      // Try to initialize real EstateMate client first
      this.estateMateClient = new EstateMateClient();
      
      // Validate API configuration
      if (!this.estateMateClient.validateConfig()) {
        console.warn('EstateMate API configuration is invalid, switching to demo mode');
        this.demoMode = true;
        this.estateMateClient = new DemoEstateMateClient();
      } else {
        // Test API connection
        const isConnected = await this.estateMateClient.testConnection();
        if (!isConnected) {
          console.warn('Unable to connect to EstateMate API, switching to demo mode');
          this.demoMode = true;
          this.estateMateClient = new DemoEstateMateClient();
        }
      }

      console.log(`Capture service initialized successfully${this.demoMode ? ' (Demo Mode)' : ''}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize capture service, trying demo mode:', error.message);
      this.demoMode = true;
      this.estateMateClient = new DemoEstateMateClient();
      console.log('Capture service initialized in demo mode');
      return true;
    }
  }

  /**
   * Start new capture session with OTP search
   * @param {string} otp - One-Time-PIN
   * @returns {Promise<Object>} Session info with resident data
   */
  async startCaptureSession(otp) {
    try {
      if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
        throw new Error('OTP is required and must be a non-empty string');
      }

      // Search for resident info using OTP
      const residentInfo = await this.estateMateClient.searchByOTP(otp.trim());

      // Create new session
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        otp: otp.trim(),
        residentInfo,
        status: 'active',
        createdAt: new Date().toISOString(),
        captures: {
          person: null,
          vehicle: null
        },
        mode: null // Will be set when mode is selected
      };

      // Store session
      this.activeSessions.set(sessionId, session);

      console.log(`Capture session started: ${sessionId} for resident ${residentInfo.name}`);
      return {
        sessionId,
        residentInfo,
        status: 'ready_for_mode_selection'
      };

    } catch (error) {
      console.error('Error starting capture session:', error);
      throw error;
    }
  }

  /**
   * Set capture mode for session
   * @param {string} sessionId - Session ID
   * @param {string} mode - 'pedestrian' or 'vehicle'
   * @returns {Promise<Object>} Updated session info
   */
  async setCaptureMode(sessionId, mode) {
    try {
      const session = this.getSession(sessionId);
      
      if (!['pedestrian', 'vehicle'].includes(mode)) {
        throw new Error('Invalid capture mode. Must be "pedestrian" or "vehicle"');
      }

      session.mode = mode;
      session.updatedAt = new Date().toISOString();

      console.log(`Capture mode set to ${mode} for session ${sessionId}`);
      return {
        sessionId,
        mode,
        status: 'ready_for_capture',
        availableCaptures: this.getAvailableCaptures(mode)
      };

    } catch (error) {
      console.error('Error setting capture mode:', error);
      throw error;
    }
  }

  /**
   * Process captured image
   * @param {string} sessionId - Session ID
   * @param {string} captureType - 'person' or 'vehicle'
   * @param {Buffer} imageBuffer - Image data
   * @returns {Promise<Object>} Capture result
   */
  async processCapture(sessionId, captureType, imageBuffer) {
    try {
      const session = this.getSession(sessionId);
      
      if (!['person', 'vehicle'].includes(captureType)) {
        throw new Error('Invalid capture type. Must be "person" or "vehicle"');
      }

      // Validate capture is allowed for current mode
      if (session.mode === 'pedestrian' && captureType === 'vehicle') {
        throw new Error('Vehicle capture not allowed in pedestrian mode');
      }

      // Prepare metadata
      const metadata = {
        residentInfo: session.residentInfo,
        captureType,
        timestamp: new Date().toISOString(),
        sessionId,
        otp: session.otp
      };

      // Store image
      const storageResult = await this.imageStorage.storeImage(imageBuffer, metadata);

      // Update session
      session.captures[captureType] = {
        imageId: storageResult.fileId,
        filename: storageResult.filename,
        timestamp: metadata.timestamp,
        fileSize: storageResult.metadata.fileSize
      };
      session.updatedAt = new Date().toISOString();

      console.log(`${captureType} capture processed for session ${sessionId}: ${storageResult.fileId}`);

      // Check if session is complete
      const isComplete = this.isSessionComplete(session);
      if (isComplete) {
        session.status = 'completed';
        session.completedAt = new Date().toISOString();
      }

      return {
        success: true,
        captureType,
        imageId: storageResult.fileId,
        sessionComplete: isComplete,
        nextAction: this.getNextAction(session, captureType)
      };

    } catch (error) {
      console.error('Error processing capture:', error);
      throw error;
    }
  }

  /**
   * Complete capture session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session completion summary
   */
  async completeSession(sessionId) {
    try {
      const session = this.getSession(sessionId);
      
      if (session.status !== 'completed') {
        throw new Error('Session is not ready for completion');
      }

      // Generate session summary
      const summary = {
        sessionId,
        residentInfo: session.residentInfo,
        mode: session.mode,
        captures: session.captures,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        totalCaptures: Object.values(session.captures).filter(c => c !== null).length
      };

      // Clean up session
      this.activeSessions.delete(sessionId);

      console.log(`Capture session completed: ${sessionId}`);
      return summary;

    } catch (error) {
      console.error('Error completing session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Object} Session object
   */
  getSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Get available captures for mode
   * @param {string} mode - Capture mode
   * @returns {Array} Available capture types
   */
  getAvailableCaptures(mode) {
    switch (mode) {
      case 'pedestrian':
        return ['person'];
      case 'vehicle':
        return ['person', 'vehicle'];
      default:
        return [];
    }
  }

  /**
   * Check if session is complete
   * @param {Object} session - Session object
   * @returns {boolean} True if session is complete
   */
  isSessionComplete(session) {
    const requiredCaptures = this.getAvailableCaptures(session.mode);
    return requiredCaptures.every(captureType => session.captures[captureType] !== null);
  }

  /**
   * Get next action for session
   * @param {Object} session - Session object
   * @param {string} completedCapture - Recently completed capture type
   * @returns {string} Next action
   */
  getNextAction(session, completedCapture) {
    const availableCaptures = this.getAvailableCaptures(session.mode);
    const remainingCaptures = availableCaptures.filter(
      captureType => session.captures[captureType] === null
    );

    if (remainingCaptures.length === 0) {
      return 'complete_session';
    } else {
      return `capture_${remainingCaptures[0]}`;
    }
  }

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active sessions count
   * @returns {number} Number of active sessions
   */
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  /**
   * Clean up expired sessions
   * @param {number} maxAge - Maximum session age in milliseconds
   */
  cleanupExpiredSessions(maxAge = 30 * 60 * 1000) { // 30 minutes default
    const now = new Date();
    const expiredSessions = [];

    for (const [sessionId, session] of this.activeSessions) {
      const sessionAge = now - new Date(session.createdAt);
      if (sessionAge > maxAge) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
      console.log(`Cleaned up expired session: ${sessionId}`);
    });

    return expiredSessions.length;
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    const status = {
      initialized: true,
      activeSessions: this.activeSessions.size,
      apiConnected: !this.demoMode,
      storageAvailable: true,
      lastCleanup: new Date().toISOString(),
      demoMode: this.demoMode
    };

    if (this.demoMode && this.estateMateClient.getDemoOTPs) {
      status.demoOTPs = this.estateMateClient.getDemoOTPs();
    }

    return status;
  }
}

module.exports = CaptureService;
