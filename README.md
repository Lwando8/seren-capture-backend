# 🏠 Seren Capture

**Residential Access Control Image Capture System**

A comprehensive image capture module for the Seren Residential access control system. This system integrates with EstateMate API to fetch resident information and capture visitor identification images (ID, Passport, Driver License) and vehicle images (License disc/plate).

## ✨ Features

- **🔍 OTP-Based Lookup**: Search resident information using One-Time-PIN
- **📄 Person Capture**: Capture ID, Passport, or Driver's License images
- **🚗 Vehicle Capture**: Capture vehicle license disc (RSA) or license plate (foreign)
- **🔒 Secure Storage**: Encrypted and compressed image storage
- **🏠 EstateMate Integration**: Seamless API integration for resident data
- **📱 Modern UI**: Responsive web interface optimized for tablets/devices
- **⚡ Real-time Processing**: Fast image processing and storage
- **🛡️ Error Handling**: Comprehensive error handling and validation

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- EstateMate API credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd seren-capture
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

5. **Access the application**
   - Web Interface: http://localhost:3000
   - API Health: http://localhost:3000/health
   - API Endpoint: http://localhost:3000/api/capture

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# EstateMate API Configuration
ESTATE_MATE_API_URL=https://api.estatemate.com
ESTATE_MATE_API_KEY=your_estatemate_api_key_here

# Image Storage Configuration
IMAGE_STORAGE_DIR=./storage/images
IMAGE_ENCRYPTION_KEY=your_32_character_encryption_key_here
IMAGE_COMPRESSION_QUALITY=80
MAX_IMAGE_SIZE=5242880
```

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ESTATE_MATE_API_URL` | EstateMate API base URL | Yes |
| `ESTATE_MATE_API_KEY` | EstateMate API authentication key | Yes |
| `IMAGE_ENCRYPTION_KEY` | 32-character encryption key for images | Yes |
| `PORT` | Server port (default: 3000) | No |
| `IMAGE_STORAGE_DIR` | Directory for image storage | No |

## 📖 Usage Guide

### 1. OTP Search Flow

1. **Enter OTP**: Operator enters the One-Time-PIN provided by the visitor
2. **API Lookup**: System calls EstateMate API to retrieve resident information
3. **Display Info**: Resident details (name, unit number) are displayed

### 2. Mode Selection

**Pedestrian Mode**:
- Activates Person Capture button only
- Captures ID, Passport, or Driver's License

**Vehicle Mode**:
- Activates both Person Capture and Vehicle Capture buttons
- Captures ID + Vehicle license disc/plate

### 3. Image Capture

**Person Capture**:
- Opens device camera
- Captures image of ID, Passport, or Driver's License
- Validates file type and size
- Shows preview before processing

**Vehicle Capture**:
- Opens camera
- Captures vehicle license disc (RSA) or license plate (foreign)
- Same validation and preview process

### 4. Process Completion

- Images are encrypted and compressed
- Linked to resident/visitor entry
- Session is completed
- Operator returns to Home Screen

## 🔧 API Reference

### Endpoints

#### Health Check
```http
GET /health
```

#### Start Capture Session
```http
POST /api/capture/session/start
Content-Type: application/json

{
  "otp": "123456"
}
```

#### Set Capture Mode
```http
POST /api/capture/session/{sessionId}/mode
Content-Type: application/json

{
  "mode": "pedestrian" | "vehicle"
}
```

#### Capture Person Image
```http
POST /api/capture/session/{sessionId}/capture/person
Content-Type: multipart/form-data

image: [file]
```

#### Capture Vehicle Image
```http
POST /api/capture/session/{sessionId}/capture/vehicle
Content-Type: multipart/form-data

image: [file]
```

#### Complete Session
```http
POST /api/capture/session/{sessionId}/complete
```

#### Get Session Status
```http
GET /api/capture/session/{sessionId}/status
```

#### Retrieve Image
```http
GET /api/capture/image/{imageId}
```

## 🏗️ Architecture

### Project Structure

```
seren-capture/
├── src/
│   ├── api/
│   │   └── estateMateClient.js      # EstateMate API integration
│   ├── services/
│   │   ├── captureService.js        # Main capture workflow
│   │   └── imageStorage.js          # Image storage and encryption
│   ├── routes/
│   │   └── captureRoutes.js         # API routes
│   ├── utils/                       # Utility functions
│   └── middleware/                  # Express middleware
├── public/
│   └── index.html                   # Web interface
├── storage/                         # Image storage directory
├── index.js                         # Main server file
├── package.json
└── README.md
```

### Key Components

1. **EstateMateClient**: Handles API communication with EstateMate
2. **ImageStorageService**: Manages secure image storage with encryption
3. **CaptureService**: Orchestrates the entire capture workflow
4. **Web Interface**: Modern, responsive UI for operators

## 🔒 Security Features

- **Image Encryption**: AES-256-GCM encryption for stored images
- **File Validation**: Type and size validation for uploaded images
- **Secure Storage**: Images stored with metadata and checksums
- **Session Management**: Secure session handling with timeouts
- **Error Handling**: Comprehensive error handling and logging

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Monitoring

### Health Check
The system provides comprehensive health monitoring:

```bash
curl http://localhost:3000/health
```

### Storage Statistics
```bash
curl http://localhost:3000/api/capture/storage/stats
```

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **SSL/TLS**: Use HTTPS in production
3. **File Permissions**: Ensure proper permissions for storage directory
4. **Backup Strategy**: Implement regular backups of stored images
5. **Monitoring**: Set up logging and monitoring

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API health endpoint

## 🔮 Future Enhancements

- [ ] Biometric capture integration
- [ ] Facial recognition capabilities
- [ ] Mobile app version
- [ ] Advanced reporting features
- [ ] Multi-language support
- [ ] Integration with other access control systems
