const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const captureRoutes = require('./src/routes/captureRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// API Routes
app.use('/api/capture', captureRoutes);

// Main routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'seren-capture',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'OTP-based resident lookup',
      'Image capture for ID/Passport/Driver License',
      'Vehicle license disc/plate capture',
      'Secure encrypted image storage',
      'Residential access control integration'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist`
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🏠 Seren Capture - Residential Access Control Image Capture System');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/capture`);
  console.log('='.repeat(60));
  console.log('📋 Features:');
  console.log('  • OTP-based resident information lookup');
  console.log('  • Person identification capture (ID/Passport/Driver License)');
  console.log('  • Vehicle identification capture (License disc/plate)');
  console.log('  • Secure encrypted image storage');
  console.log('  • EstateMate API integration');
  console.log('='.repeat(60));
  
  // Check environment variables
  const requiredEnvVars = ['ESTATE_MATE_API_URL', 'ESTATE_MATE_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log('⚠️  WARNING: Missing environment variables:');
    missingVars.forEach(varName => {
      console.log(`    - ${varName}`);
    });
    console.log('   Please set these in your .env file for full functionality.');
  } else {
    console.log('✅ All required environment variables are set.');
  }
  
  console.log('='.repeat(60));
});
