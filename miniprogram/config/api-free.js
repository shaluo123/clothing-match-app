// API配置管理 - 专为免费部署优化
const config = {
  // 部署模式：'self-hosted' | 'cloud' | 'hybrid'
  DEPLOY_MODE: 'self-hosted',
  
  // 免费服务配置
  FREE_SERVICES: {
    // Vercel免费额度
    vercel: {
      baseURL: process.env.VERCEL_URL || 'https://your-app.vercel.app/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClothingMatch-App/1.0'
      },
      limits: {
        invocations: 100000,    // 每月10万次免费调用
        bandwidth: 100 * 1024 * 1024 * 1024, // 100GB免费带宽
        storage: 'unlimited'       // 无限制存储空间
      }
    },
    
    // MongoDB Atlas免费额度
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb+srv://user:pass@cluster.mongodb.net/clothing',
      limits: {
        storage: 512 * 1024 * 1024,  // 512MB免费存储
        transfer: 10 * 1024 * 1024 * 1024, // 10GB免费传输
        connections: 500               // 500个免费连接
      }
    },
    
    // 自建AI抠图配置
    aiBackgroundRemoval: {
      model: 'U2-Net',
      limits: {
        maxImageSize: 5 * 1024 * 1024, // 5MB最大图片
        processingTime: 10000,           // 10秒超时
        batchSize: 10                   // 最多10张批量处理
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
    switch (this.DEPLOY_MODE) {
      case 'self-hosted':
        return this.FREE_SERVICES.vercel;
      case 'cloud':
        return { ...this.CLOUD_CONFIG, mode: 'cloud' };
      case 'hybrid':
        return {
          ...this.FREE_SERVICES.vercel,
          ...this.CLOUD_CONFIG,
          mode: 'hybrid'
        };
      default:
        return this.FREE_SERVICES.vercel;
    }
  },
  
  // 检查免费额度使用情况
  checkUsageLimits() {
    return {
      api: {
        used: this.getMonthlyApiUsage(),
        limit: this.FREE_SERVICES.vercel.limits.invocations,
        remaining: this.FREE_SERVICES.vercel.limits.invocations - this.getMonthlyApiUsage()
      },
      storage: {
        used: this.getCurrentStorageUsage(),
        limit: this.FREE_SERVICES.mongodb.limits.storage,
        remaining: this.FREE_SERVICES.mongodb.limits.storage - this.getCurrentStorageUsage()
      },
      bandwidth: {
        used: this.getMonthlyBandwidthUsage(),
        limit: this.FREE_SERVICES.vercel.limits.bandwidth,
        remaining: this.FREE_SERVICES.vercel.limits.bandwidth - this.getMonthlyBandwidthUsage()
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