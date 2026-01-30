// 自建API服务管理
const config = require('../config/api.js');
const { showLoading, hideLoading, showError } = require('./util.js');

class ApiService {
  constructor() {
    this.config = config.getCurrentConfig();
  }

  // 统一的HTTP请求方法
  async request(url, options = {}) {
    const defaultOptions = {
      method: 'GET',
      timeout: this.config.timeout || 30000,
      header: {
        'content-type': 'application/json',
        ...this.config.headers
      }
    };

    const requestOptions = {
      url: `${this.config.baseURL}${url}`,
      ...defaultOptions,
      ...options
    };

    return new Promise((resolve, reject) => {
      wx.request({
        ...requestOptions,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: reject
      });
    });
  }

  // 上传文件到自建服务器
  async uploadFile(filePath, endpoint = '/upload') {
    showLoading('上传中...');
    
    try {
      const result = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${this.config.baseURL}${endpoint}`,
          filePath: filePath,
          name: 'file',
          formData: {
            type: 'clothing-image'
          },
          success: resolve,
          fail: reject
        });
      });

      hideLoading();
      return JSON.parse(result.data);
    } catch (error) {
      hideLoading();
      throw error;
    }
  }

  // AI抠图接口
  async removeBackground(imageUrl) {
    showLoading('AI抠图中...');
    
    try {
      const result = await this.request('/remove-background', {
        method: 'POST',
        data: {
          imageUrl: imageUrl,
          quality: 'high'
        }
      });

      hideLoading();
      return result;
    } catch (error) {
      hideLoading();
      console.error('抠图失败:', error);
      throw error;
    }
  }

  // 智能推荐接口
  async getRecommendations(params = {}) {
    const {
      type = 'smart',
      season = '',
      userId = '',
      clothingId = ''
    } = params;

    try {
      const result = await this.request('/recommend', {
        method: 'POST',
        data: {
          type,
          season,
          userId,
          clothingId
        }
      });

      return result;
    } catch (error) {
      console.error('获取推荐失败:', error);
      throw error;
    }
  }

  // 获取衣物列表
  async getClothingList(params = {}) {
    const {
      page = 1,
      limit = 20,
      category = '',
      tags = []
    } = params;

    try {
      const result = await this.request('/clothing', {
        method: 'GET',
        data: { page, limit, category, tags }
      });

      return result;
    } catch (error) {
      console.error('获取衣物列表失败:', error);
      throw error;
    }
  }

  // 保存衣物
  async saveClothing(clothingData) {
    showLoading('保存中...');
    
    try {
      const result = await this.request('/clothing', {
        method: 'POST',
        data: clothingData
      });

      hideLoading();
      return result;
    } catch (error) {
      hideLoading();
      console.error('保存衣物失败:', error);
      throw error;
    }
  }

  // 更新衣物
  async updateClothing(id, clothingData) {
    showLoading('更新中...');
    
    try {
      const result = await this.request(`/clothing/${id}`, {
        method: 'PUT',
        data: clothingData
      });

      hideLoading();
      return result;
    } catch (error) {
      hideLoading();
      console.error('更新衣物失败:', error);
      throw error;
    }
  }

  // 删除衣物
  async deleteClothing(id) {
    showLoading('删除中...');
    
    try {
      const result = await this.request(`/clothing/${id}`, {
        method: 'DELETE'
      });

      hideLoading();
      return result;
    } catch (error) {
      hideLoading();
      console.error('删除衣物失败:', error);
      throw error;
    }
  }

  // 保存搭配
  async saveOutfit(outfitData) {
    showLoading('保存搭配中...');
    
    try {
      const result = await this.request('/outfits', {
        method: 'POST',
        data: outfitData
      });

      hideLoading();
      return result;
    } catch (error) {
      hideLoading();
      console.error('保存搭配失败:', error);
      throw error;
    }
  }

  // 获取搭配列表
  async getOutfitList(params = {}) {
    const {
      page = 1,
      limit = 20,
      season = ''
    } = params;

    try {
      const result = await this.request('/outfits', {
        method: 'GET',
        data: { page, limit, season }
      });

      return result;
    } catch (error) {
      console.error('获取搭配列表失败:', error);
      throw error;
    }
  }

  // 测试API连接
  async testConnection() {
    try {
      const result = await this.request('/health', {
        method: 'GET'
      });
      return result.status === 'ok';
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }

  // 获取API配置状态
  getConfigStatus() {
    return {
      mode: config.DEPLOY_MODE,
      baseURL: this.config.baseURL,
      connected: false // 初始状态，需要实际测试
    };
  }
}

// 创建单例
const apiService = new ApiService();

module.exports = apiService;