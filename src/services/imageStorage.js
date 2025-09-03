const fs = require('fs-extra');
const path = require('path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

class ImageStorageService {
  constructor() {
    this.storageDir = process.env.IMAGE_STORAGE_DIR || './storage/images';
    this.encryptionKey = process.env.IMAGE_ENCRYPTION_KEY || this.generateDefaultKey();
    this.compressionQuality = parseInt(process.env.IMAGE_COMPRESSION_QUALITY) || 80;
    this.maxFileSize = parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024; // 5MB
    
    this.ensureStorageDirectory();
  }

  /**
   * Generate a default encryption key (for development only)
   * @returns {string} Base64 encoded key
   */
  generateDefaultKey() {
    console.warn('WARNING: Using default encryption key. Set IMAGE_ENCRYPTION_KEY in production!');
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Ensure storage directory exists
   */
  async ensureStorageDirectory() {
    try {
      await fs.ensureDir(this.storageDir);
      await fs.ensureDir(path.join(this.storageDir, 'person'));
      await fs.ensureDir(path.join(this.storageDir, 'vehicle'));
      await fs.ensureDir(path.join(this.storageDir, 'metadata'));
    } catch (error) {
      console.error('Error creating storage directories:', error);
      throw new Error('Failed to initialize image storage');
    }
  }

  /**
   * Process and store captured image
   * @param {Buffer} imageBuffer - Raw image data
   * @param {Object} metadata - Image metadata
   * @returns {Promise<Object>} Storage result with file info
   */
  async storeImage(imageBuffer, metadata) {
    try {
      const { residentInfo, captureType, timestamp } = metadata;
      
      // Validate input
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Image buffer is empty');
      }

      if (imageBuffer.length > this.maxFileSize) {
        throw new Error(`Image size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
      }

      // Generate unique filename
      const fileId = uuidv4();
      const timestampStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `${fileId}_${timestampStr}.jpg`;
      
      // Determine storage path based on capture type
      const subDir = captureType === 'vehicle' ? 'vehicle' : 'person';
      const filePath = path.join(this.storageDir, subDir, filename);

      // Process image (compress and optimize)
      const processedImage = await this.processImage(imageBuffer);

      // Encrypt image
      const encryptedImage = this.encryptImage(processedImage);

      // Save encrypted image
      await fs.writeFile(filePath, encryptedImage);

      // Create metadata record
      const imageMetadata = {
        id: fileId,
        filename,
        filePath,
        captureType,
        timestamp,
        residentInfo: {
          id: residentInfo.id,
          name: residentInfo.name,
          unitNumber: residentInfo.unitNumber
        },
        fileSize: encryptedImage.length,
        originalSize: imageBuffer.length,
        compressionRatio: (1 - encryptedImage.length / imageBuffer.length) * 100,
        checksum: crypto.createHash('sha256').update(encryptedImage).digest('hex')
      };

      // Save metadata
      await this.saveMetadata(imageMetadata);

      console.log(`Image stored successfully: ${filename}`);
      return {
        success: true,
        fileId,
        filename,
        filePath,
        metadata: imageMetadata
      };

    } catch (error) {
      console.error('Error storing image:', error);
      throw error;
    }
  }

  /**
   * Process image (compress, resize, optimize)
   * @param {Buffer} imageBuffer - Raw image data
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async processImage(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Resize if too large (max 1920x1080)
      let processedImage = image;
      if (metadata.width > 1920 || metadata.height > 1080) {
        processedImage = image.resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to JPEG with compression
      return await processedImage
        .jpeg({
          quality: this.compressionQuality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();

    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  /**
   * Encrypt image data
   * @param {Buffer} imageBuffer - Image data to encrypt
   * @returns {Buffer} Encrypted image data
   */
  encryptImage(imageBuffer) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.encryptionKey, 'base64');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipherGCM(algorithm, key, iv);
      cipher.setAAD(Buffer.from('seren-capture', 'utf8'));
      
      let encrypted = cipher.update(imageBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      return Buffer.concat([iv, authTag, encrypted]);
    } catch (error) {
      console.error('Error encrypting image:', error);
      throw new Error('Failed to encrypt image');
    }
  }

  /**
   * Decrypt image data
   * @param {Buffer} encryptedBuffer - Encrypted image data
   * @returns {Buffer} Decrypted image data
   */
  decryptImage(encryptedBuffer) {
    try {
      const algorithm = 'aes-256-gcm';
      const key = Buffer.from(this.encryptionKey, 'base64');
      
      // Extract IV, auth tag, and encrypted data
      const iv = encryptedBuffer.slice(0, 16);
      const authTag = encryptedBuffer.slice(16, 32);
      const encrypted = encryptedBuffer.slice(32);
      
      const decipher = crypto.createDecipherGCM(algorithm, key, iv);
      decipher.setAAD(Buffer.from('seren-capture', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting image:', error);
      throw new Error('Failed to decrypt image');
    }
  }

  /**
   * Save image metadata
   * @param {Object} metadata - Image metadata
   */
  async saveMetadata(metadata) {
    try {
      const metadataPath = path.join(this.storageDir, 'metadata', `${metadata.id}.json`);
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    } catch (error) {
      console.error('Error saving metadata:', error);
      throw new Error('Failed to save image metadata');
    }
  }

  /**
   * Retrieve image by ID
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Image data and metadata
   */
  async retrieveImage(imageId) {
    try {
      // Load metadata
      const metadataPath = path.join(this.storageDir, 'metadata', `${imageId}.json`);
      const metadata = await fs.readJson(metadataPath);

      // Load and decrypt image
      const encryptedImage = await fs.readFile(metadata.filePath);
      const decryptedImage = this.decryptImage(encryptedImage);

      return {
        image: decryptedImage,
        metadata
      };
    } catch (error) {
      console.error('Error retrieving image:', error);
      throw new Error('Failed to retrieve image');
    }
  }

  /**
   * Get all images for a resident
   * @param {string} residentId - Resident ID
   * @returns {Promise<Array>} List of image metadata
   */
  async getImagesByResident(residentId) {
    try {
      const metadataDir = path.join(this.storageDir, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      const images = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadata = await fs.readJson(path.join(metadataDir, file));
          if (metadata.residentInfo.id === residentId) {
            images.push(metadata);
          }
        }
      }
      
      return images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Error getting images by resident:', error);
      throw new Error('Failed to retrieve resident images');
    }
  }

  /**
   * Delete image and its metadata
   * @param {string} imageId - Image ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteImage(imageId) {
    try {
      const metadataPath = path.join(this.storageDir, 'metadata', `${imageId}.json`);
      const metadata = await fs.readJson(metadataPath);
      
      // Delete image file
      await fs.remove(metadata.filePath);
      
      // Delete metadata file
      await fs.remove(metadataPath);
      
      console.log(`Image deleted successfully: ${imageId}`);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    try {
      const stats = {
        totalImages: 0,
        totalSize: 0,
        personImages: 0,
        vehicleImages: 0,
        oldestImage: null,
        newestImage: null
      };

      const metadataDir = path.join(this.storageDir, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      let oldestDate = null;
      let newestDate = null;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadata = await fs.readJson(path.join(metadataDir, file));
          stats.totalImages++;
          stats.totalSize += metadata.fileSize;
          
          if (metadata.captureType === 'person') {
            stats.personImages++;
          } else if (metadata.captureType === 'vehicle') {
            stats.vehicleImages++;
          }

          const imageDate = new Date(metadata.timestamp);
          if (!oldestDate || imageDate < oldestDate) {
            oldestDate = imageDate;
            stats.oldestImage = metadata.timestamp;
          }
          if (!newestDate || imageDate > newestDate) {
            newestDate = imageDate;
            stats.newestImage = metadata.timestamp;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw new Error('Failed to get storage statistics');
    }
  }
}

module.exports = ImageStorageService;
