const { v4: uuidv4 } = require('uuid');

/**
 * Demo EstateMate Client for testing and development
 * Simulates API responses without requiring actual API connection
 */
class DemoEstateMateClient {
  constructor() {
    console.log('[Demo Mode] Using Demo EstateMate Client - no real API connection required');
    
    // Demo residents database
    this.demoResidents = {
      '123456': {
        resident_id: 'res_001',
        resident_name: 'John Doe',
        unit_number: 'A101',
        phone: '+27123456789',
        email: 'john.doe@example.com',
        visitor_type: 'pedestrian',
        status: 'active',
        created_at: new Date().toISOString()
      },
      '789012': {
        resident_id: 'res_002',
        resident_name: 'Jane Smith',
        unit_number: 'B205',
        phone: '+27987654321',
        email: 'jane.smith@example.com',
        visitor_type: 'vehicle',
        status: 'active',
        created_at: new Date().toISOString()
      },
      '456789': {
        resident_id: 'res_003',
        resident_name: 'Michael Johnson',
        unit_number: 'C312',
        phone: '+27555123456',
        email: 'michael.j@example.com',
        visitor_type: 'pedestrian',
        status: 'active',
        created_at: new Date().toISOString()
      }
    };
  }

  /**
   * Search for resident information using OTP (Demo Mode)
   * @param {string} otp - One-Time-PIN provided by visitor
   * @returns {Promise<Object>} Resident information
   */
  async searchByOTP(otp) {
    try {
      console.log(`[Demo Mode] Searching for OTP: ${otp}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
        throw new Error('OTP is required and must be a non-empty string');
      }

      const residentData = this.demoResidents[otp.trim()];
      
      if (!residentData) {
        throw new Error('OTP not found or expired');
      }

      const response = {
        data: residentData
      };

      console.log(`[Demo Mode] Found resident: ${residentData.resident_name}`);
      return this.formatResidentInfo(response);
      
    } catch (error) {
      console.error('[Demo Mode] Error searching by OTP:', error.message);
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
      otp: 'hidden',
      demoMode: true
    };
  }

  /**
   * Validate API configuration (Demo Mode)
   * @returns {boolean} Always true for demo mode
   */
  validateConfig() {
    console.log('[Demo Mode] Configuration validation skipped');
    return true;
  }

  /**
   * Test API connection (Demo Mode)
   * @returns {Promise<boolean>} Always true for demo mode
   */
  async testConnection() {
    console.log('[Demo Mode] Connection test successful (simulated)');
    return true;
  }

  /**
   * Get demo OTPs for testing
   * @returns {Array} List of available demo OTPs
   */
  getDemoOTPs() {
    return Object.keys(this.demoResidents).map(otp => ({
      otp,
      resident: this.demoResidents[otp].resident_name,
      unit: this.demoResidents[otp].unit_number,
      type: this.demoResidents[otp].visitor_type
    }));
  }
}

module.exports = DemoEstateMateClient;
