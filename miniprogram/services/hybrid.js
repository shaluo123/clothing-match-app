// 混合模式服务管理器
const config = require('../config/api.js');

class HybridServiceManager {
  constructor() {
    this.mode = config.DEPLOY_MODE;
    this.initServices();
  }

  initServices() {
    switch (this.mode) {
      case 'cloud':
        this.initCloudServices();
        break;
      case 'self-hosted':
        this.initSelfHostedServices();
        break;
      case 'hybrid':
        this.initHybridServices();
        break;
      default:
        this.initSelfHostedServices();
    }
  }

  // 微信云开发服务
  initCloudServices() {
    this.cloud = wx.cloud;
    this.database = wx.cloud.database();
    this.storage = wx.cloud.getStorage();
  }

  // 自建服务
  initSelfHostedServices() {
    const ApiService = require('./api.js');
    this.api = new ApiService();
  }

  // 混合模式服务
  initHybridServices() {
    const { HYBRID_CONFIG } = config;
    
    // 根据配置初始化不同的服务
    if (HYBRID_CONFIG.useCloudForStorage) {
      this.initCloudServices();
    }
    
    if (HYBRID_CONFIG.useSelfHostedForAI) {
      this.initSelfHostedServices();
    }
    
    if (HYBRID_CONFIG.useSelfHostedForRecommend) {
      this.initSelfHostedServices();
    }
  }

  // 统一的数据服务接口
  async saveClothing(clothingData) {
    if (this.database && this.mode !== 'self-hosted') {
      // 使用云开发数据库
      return await this.database.collection('clothing').add({
        data: clothingData
      });
    } else if (this.api) {
      // 使用自建API
      return await this.api.saveClothing(clothingData);
    }
    
    throw new Error('未配置数据服务');
  }

  // 统一的文件存储接口
  async uploadFile(filePath, options = {}) {
    if (this.storage && !config.HYBRID_CONFIG?.useSelfHostedForStorage) {
      // 使用云开发存储
      const cloudPath = `clothing/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      
      return await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });
    } else if (this.api) {
      // 使用自建文件服务
      return await this.api.uploadFile(filePath, options.endpoint);
    }
    
    throw new Error('未配置存储服务');
  }

  // 统一的AI服务接口
  async removeBackground(imageUrl) {
    if (this.api && config.HYBRID_CONFIG?.useSelfHostedForAI) {
      // 使用自建AI服务
      return await this.api.removeBackground(imageUrl);
    } else if (this.cloud) {
      // 使用云函数
      return await this.cloud.callFunction({
        name: 'removeBackground',
        data: { imageUrl }
      });
    }
    
    throw new Error('未配置AI服务');
  }

  // 统一的推荐服务接口
  async getRecommendations(params) {
    if (this.api && config.HYBRID_CONFIG?.useSelfHostedForRecommend) {
      // 使用自建推荐服务
      return await this.api.getRecommendations(params);
    } else if (this.cloud) {
      // 使用云函数
      return await this.cloud.callFunction({
        name: 'recommend',
        data: params
      });
    }
    
    throw new Error('未配置推荐服务');
  }

  // 检查服务状态
  async checkServices() {
    const status = {
      mode: this.mode,
      services: {},
      healthy: true
    };

    if (this.api) {
      try {
        const apiHealthy = await this.api.testConnection();
        status.services.api = apiHealthy;
        if (!apiHealthy) status.healthy = false;
      } catch (error) {
        status.services.api = false;
        status.healthy = false;
      }
    }

    if (this.database) {
      try {
        // 简单的数据库连接测试
        await this.database.collection('test').limit(1).get();
        status.services.database = true;
      } catch (error) {
        status.services.database = false;
        status.healthy = false;
      }
    }

    if (this.storage) {
      status.services.storage = true; // 云存储通常总是可用的
    }

    return status;
  }

  // 动态切换部署模式
  switchMode(newMode) {
    config.DEPLOY_MODE = newMode;
    this.initServices();
    
    // 保存模式配置到本地
    wx.setStorageSync('deployMode', newMode);
    
    return this.checkServices();
  }

  // 获取推荐配置
  getRecommendedConfig() {
    const currentUsage = {
      storage: this.getCurrentStorageUsage(),
      apiCalls: this.getCurrentApiUsage(),
      cost: this.getCurrentCost()
    };

    // 根据使用情况推荐最佳配置
    if (currentUsage.storage < 100 && currentUsage.apiCalls < 1000) {
      return {
        mode: 'self-hosted',
        reason: '当前使用量较低，自建服务完全够用'
      };
    } else if (currentUsage.cost > 10) {
      return {
        mode: 'hybrid',
        reason: '使用量较高，建议混合模式优化成本'
      };
    } else {
      return {
        mode: 'cloud',
        reason: '使用量中等，云开发更稳定'
      };
    }
  }

  // 模拟获取当前存储使用情况
  getCurrentStorageUsage() {
    // 实际项目中应该从API获取真实数据
    return Math.floor(Math.random() * 500); // MB
  }

  // 模拟获取当前API调用次数
  getCurrentApiUsage() {
    // 实际项目中应该从API获取真实数据
    return Math.floor(Math.random() * 2000);
  }

  // 模拟获取当前成本
  getCurrentCost() {
    // 实际项目中应该从账单获取真实数据
    return Math.random() * 50; // 元
  }
}

// 创建单例
const hybridService = new HybridServiceManager();

module.exports = hybridService;