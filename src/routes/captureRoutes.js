const express = require('express');
const multer = require('multer');
const CaptureService = require('../services/captureService');

const router = express.Router();
const captureService = new CaptureService();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Initialize capture service
captureService.initialize().catch(error => {
  console.error('Failed to initialize capture service:', error);
});

// Middleware for error handling
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'capture',
    timestamp: new Date().toISOString(),
    ...captureService.getStatus()
  });
});

// Start new capture session with OTP
router.post('/session/start', handleAsync(async (req, res) => {
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({
      success: false,
      error: 'OTP is required'
    });
  }

  try {
    const result = await captureService.startCaptureSession(otp);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error starting capture session:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Set capture mode for session
router.post('/session/:sessionId/mode', handleAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { mode } = req.body;

  if (!mode) {
    return res.status(400).json({
      success: false,
      error: 'Mode is required'
    });
  }

  try {
    const result = await captureService.setCaptureMode(sessionId, mode);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error setting capture mode:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Capture person image (ID/Passport/Driver License)
router.post('/session/:sessionId/capture/person', upload.single('image'), handleAsync(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Image file is required'
    });
  }

  try {
    const result = await captureService.processCapture(
      sessionId,
      'person',
      req.file.buffer
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error processing person capture:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Capture vehicle image (License disc/plate)
router.post('/session/:sessionId/capture/vehicle', upload.single('image'), handleAsync(async (req, res) => {
  const { sessionId } = req.params;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Image file is required'
    });
  }

  try {
    const result = await captureService.processCapture(
      sessionId,
      'vehicle',
      req.file.buffer
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error processing vehicle capture:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Complete capture session
router.post('/session/:sessionId/complete', handleAsync(async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await captureService.completeSession(sessionId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Get session status
router.get('/session/:sessionId/status', handleAsync(async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = captureService.getSession(sessionId);
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        mode: session.mode,
        residentInfo: session.residentInfo,
        captures: session.captures,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
}));

// Retrieve captured image
router.get('/image/:imageId', handleAsync(async (req, res) => {
  const { imageId } = req.params;

  try {
    const imageData = await captureService.imageStorage.retrieveImage(imageId);
    
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': imageData.image.length,
      'X-Image-ID': imageId,
      'X-Resident-ID': imageData.metadata.residentInfo.id,
      'X-Capture-Type': imageData.metadata.captureType
    });

    res.send(imageData.image);
  } catch (error) {
    console.error('Error retrieving image:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
}));

// Get images by resident
router.get('/resident/:residentId/images', handleAsync(async (req, res) => {
  const { residentId } = req.params;

  try {
    const images = await captureService.imageStorage.getImagesByResident(residentId);
    res.json({
      success: true,
      data: {
        residentId,
        images: images.map(img => ({
          id: img.id,
          captureType: img.captureType,
          timestamp: img.timestamp,
          fileSize: img.fileSize,
          filename: img.filename
        }))
      }
    });
  } catch (error) {
    console.error('Error getting resident images:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}));

// Get storage statistics
router.get('/storage/stats', handleAsync(async (req, res) => {
  try {
    const stats = await captureService.imageStorage.getStorageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Cleanup expired sessions
router.post('/cleanup', handleAsync(async (req, res) => {
  try {
    const cleanedCount = captureService.cleanupExpiredSessions();
    res.json({
      success: true,
      data: {
        cleanedSessions: cleanedCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Capture route error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

module.exports = router;
