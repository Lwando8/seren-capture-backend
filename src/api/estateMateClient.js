const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class EstateMateClient {
  constructor() {
    this.baseURL = process.env.ESTATE_MATE_API_URL || 'https://api.estatemate.com';
    this.apiKey = process.env.ESTATE_MATE_API_KEY;
    this.timeout = 10000; // 10 seconds
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Request-ID': uuidv4()
      }
    });

    // Add request/response interceptors for logging and error handling
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[EstateMate API] ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[EstateMate API] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[EstateMate API] Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        console.error('[EstateMate API] Response error:', error.response?.data || error.message);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  /**
   * Search for resident information using OTP
   * @param {string} otp - One-Time-PIN provided by visitor
   * @returns {Promise<Object>} Resident information
   */
  async searchByOTP(otp) {
    try {
      if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
        throw new Error('OTP is required and must be a non-empty string');
      }

      const response = await this.client.post('/visitor/otp-search', {
        otp: otp.trim(),
        timestamp: new Date().toISOString()
      });

      return this.formatResidentInfo(response.data);
    } catch (error) {
      console.error('Error searching by OTP:', error);
      throw error;
    }
  }

  /**
   * Format resident information from API response
   * @param {Object} apiResponse - Raw API response
   * @returns {Object} Formatted resident information
   */
  formatResidentInfo(apiResponse) {
    const { data } = apiResponse;
    
    return {
      id: data.resident_id || data.id,
      name: data.resident_name || data.name,
      unitNumber: data.unit_number || data.unit,
      phone: data.phone || data.contact_number,
      email: data.email,
      visitorType: data.visitor_type || 'pedestrian',
      validUntil: data.valid_until || data.expires_at,
      status: data.status || 'active',
      createdAt: data.created_at || new Date().toISOString(),
      // Additional metadata
      searchTimestamp: new Date().toISOString(),
      otp: data.otp || 'hidden'
    };
  }

  /**
   * Handle API errors and provide meaningful error messages
   * @param {Error} error - Axios error object
   * @returns {Error} Formatted error
   */
  handleApiError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new Error('Invalid OTP format or missing required data');
        case 401:
          return new Error('Unauthorized access - check API credentials');
        case 404:
          return new Error('OTP not found or expired');
        case 429:
          return new Error('Too many requests - please try again later');
        case 500:
          return new Error('Server error - please try again later');
        default:
          return new Error(data?.message || `API error: ${status}`);
      }
    } else if (error.request) {
      // Network error
      return new Error('Network error - unable to connect to EstateMate API');
    } else {
      // Other error
      return new Error(error.message || 'Unknown error occurred');
    }
  }

  /**
   * Validate API configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    const errors = [];
    
    if (!this.apiKey) {
      errors.push('ESTATE_MATE_API_KEY is required');
    }
    
    if (!this.baseURL) {
      errors.push('ESTATE_MATE_API_URL is required');
    }

    if (errors.length > 0) {
      console.error('EstateMate API configuration errors:', errors);
      return false;
    }

    return true;
  }

  /**
   * Test API connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      console.error('EstateMate API connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = EstateMateClient;
