// API配置管理 - Supabase版本
const config = {
  // 部署模式：'supabase' | 'vercel-supabase'
  DEPLOY_MODE: 'supabase',
  
  // Supabase免费服务配置
  SUPABASE_SERVICES: {
    // Supabase项目配置
    project: {
      url: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
      anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        'User-Agent': 'ClothingMatch-App/2.0-Supabase'
      },
      limits: {
        bandwidth: 100 * 1024 * 1024 * 1024,  // 100GB免费带宽
        storage: 1024 * 1024 * 1024,           // 1GB免费存储
        users: 50000,                         // 5万免费MAU
        api: 'unlimited'                       // 无限制API调用
      }
    },
    
    // Supabase AI抠图配置
    aiBackgroundRemoval: {
      model: 'U2-Net-Supabase',
      limits: {
        maxImageSize: 10 * 1024 * 1024, // 10MB最大图片（Supabase限制）
        processingTime: 10000,              // 10秒超时
        batchSize: 10,                     // 最多10张批量处理
        storageBucket: 'clothing-images'       // Supabase存储桶
      }
    }
  },
  
  // 云开发配置（备用方案）
  CLOUD_CONFIG: {
    env: process.env.CLOUD_ENV || '',
    traceUser: true,
    costs: {
      function: 0.000016,     // 每次调用费用
      storage: 0.0043,        // 每GB每天费用
      database: 0.07           // 每GB每天费用
    }
  },
  
  // 获取当前配置
  getCurrentConfig() {
    const baseConfig = this.SUPABASE_SERVICES.project;
    
    // 为不同模式添加相应的baseURL
    switch (this.DEPLOY_MODE) {
      case 'supabase':
        return {
          ...baseConfig,
          baseURL: baseConfig.url // 直接使用Supabase URL
        };
      case 'vercel-supabase':
        return {
          ...baseConfig,
          baseURL: process.env.VERCEL_API_URL || 'https://your-project.vercel.app', // Vercel API地址
          mode: 'vercel-supabase'
        };
      default:
        return {
          ...baseConfig,
          baseURL: baseConfig.url
        };
    }
  },
  
  // 检查免费额度使用情况
  checkUsageLimits() {
    return {
      api: {
        used: this.getMonthlyApiUsage(),
        limit: this.SUPABASE_SERVICES.project.limits.users,
        remaining: this.SUPABASE_SERVICES.project.limits.users - this.getMonthlyApiUsage()
      },
      storage: {
        used: this.getCurrentStorageUsage(),
        limit: this.SUPABASE_SERVICES.project.limits.storage,
        remaining: this.SUPABASE_SERVICES.project.limits.storage - this.getCurrentStorageUsage()
      },
      bandwidth: {
        used: this.getMonthlyBandwidthUsage(),
        limit: this.SUPABASE_SERVICES.project.limits.bandwidth,
        remaining: this.SUPABASE_SERVICES.project.limits.bandwidth - this.getMonthlyBandwidthUsage()
      }
    };
  },
  
  // 获取推荐配置（基于使用量）
  getRecommendedConfig(currentUsage) {
    const { api, storage, bandwidth } = currentUsage;
    
    // 如果接近免费限额，推荐切换模式
    if (api.used / api.limit > 0.8 || storage.used / storage.limit > 0.8) {
      return {
        mode: 'hybrid',
        reason: '接近免费限额，建议使用混合模式降低成本',
        action: '部分功能切换到云开发，保持免费额度'
      };
    }
    
    if (api.used / api.limit > 0.5 || storage.used / storage.limit > 0.5) {
      return {
        mode: 'hybrid',
        reason: '使用量中等，可考虑混合模式',
        action: '存储使用云开发，API继续免费服务'
      };
    }
    
    return {
      mode: 'self-hosted',
      reason: '使用量较低，免费服务完全够用',
      action: '继续使用完全免费方案'
    };
  },
  
  // 获取实际API使用量（模拟）
  getMonthlyApiUsage() {
    const stored = wx.getStorageSync('monthly_api_usage') || '0';
    return parseInt(stored);
  },
  
  // 更新API使用量
  updateApiUsage(count = 1) {
    const current = this.getMonthlyApiUsage();
    const newUsage = current + count;
    wx.setStorageSync('monthly_api_usage', newUsage.toString());
    
    // 检查是否接近限额
    if (newUsage > 80000) {
      wx.showToast({
        title: 'API使用量接近限额',
        icon: 'none',
        duration: 3000
      });
    }
  },
  
  // 获取存储使用量（模拟）
  getCurrentStorageUsage() {
    const stored = wx.getStorageSync('storage_usage') || '0';
    return parseInt(stored);
  },
  
  // 更新存储使用量
  updateStorageUsage(size) {
    const current = this.getCurrentStorageUsage();
    const newUsage = current + size;
    wx.setStorageSync('storage_usage', newUsage.toString());
  },
  
  // 获取带宽使用量（模拟）
  getMonthlyBandwidthUsage() {
    const stored = wx.getStorageSync('monthly_bandwidth_usage') || '0';
    return parseInt(stored);
  },
  
  // 更新带宽使用量
  updateBandwidthUsage(size) {
    const current = this.getMonthlyBandwidthUsage();
    const newUsage = current + size;
    wx.setStorageSync('monthly_bandwidth_usage', newUsage.toString());
  },
  
  // 重置月度使用量（每月1日调用）
  resetMonthlyUsage() {
    const today = new Date().getDate();
    if (today === 1) {
      wx.removeStorageSync('monthly_api_usage');
      wx.removeStorageSync('storage_usage');
      wx.removeStorageSync('monthly_bandwidth_usage');
    }
  }
};

module.exports = config;