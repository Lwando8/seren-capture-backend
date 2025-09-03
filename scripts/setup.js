#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🏠 Seren Capture Setup');
console.log('='.repeat(40));

// Create storage directories
const storageDir = path.join(__dirname, '..', 'storage', 'images');
const metadataDir = path.join(storageDir, 'metadata');
const personDir = path.join(storageDir, 'person');
const vehicleDir = path.join(storageDir, 'vehicle');

console.log('📁 Creating storage directories...');
[storageDir, metadataDir, personDir, vehicleDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`   ✓ Created: ${dir}`);
  } else {
    console.log(`   ✓ Exists: ${dir}`);
  }
});

// Generate encryption key if .env doesn't exist
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('🔑 Generating encryption key...');
  const encryptionKey = crypto.randomBytes(32).toString('base64');
  
  const envContent = `# Seren Capture Environment Configuration

# Server Configuration
PORT=3000
NODE_ENV=development

# EstateMate API Configuration
ESTATE_MATE_API_URL=https://api.estatemate.com
ESTATE_MATE_API_KEY=your_estatemate_api_key_here

# Image Storage Configuration
IMAGE_STORAGE_DIR=./storage/images
IMAGE_ENCRYPTION_KEY=${encryptionKey}
IMAGE_COMPRESSION_QUALITY=80
MAX_IMAGE_SIZE=5242880

# Security Configuration
SESSION_TIMEOUT=1800000
MAX_FILE_SIZE=10485760

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/seren-capture.log
`;

  fs.writeFileSync(envPath, envContent);
  console.log(`   ✓ Created: ${envPath}`);
  console.log('   ⚠️  Please update ESTATE_MATE_API_KEY with your actual API key');
} else {
  console.log('   ✓ Environment file already exists');
}

// Create logs directory
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`   ✓ Created: ${logsDir}`);
}

console.log('');
console.log('✅ Setup completed successfully!');
console.log('');
console.log('Next steps:');
console.log('1. Update your .env file with the correct EstateMate API credentials');
console.log('2. Run: npm install');
console.log('3. Run: npm start');
console.log('');
console.log('🌐 Access the application at: http://localhost:3000');
