// 免费API服务管理 - 专为Vercel + MongoDB Atlas优化
const config = require('../config/api-free.js');
const { showLoading, hideLoading, showError, showSuccess } = require('../utils/util.js');

class FreeApiService {
  constructor() {
    this.config = config.getCurrentConfig();
    this.baseURL = this.config.baseURL;
    this.cache = new Map(); // 本地缓存减少API调用
    this.requestQueue = []; // 请求队列，避免并发过多
  }

  // 统一的HTTP请求方法（带缓存和重试）
  async request(url, options = {}) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // 检查缓存
    if (options.cache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
        return cached.data;
      }
    }

    // 检查API使用量
    const usage = config.checkUsageLimits();
    if (usage.api.remaining < 100) {
      showError('API使用量接近限额，请稍后再试');
      throw new Error('API usage limit approaching');
    }

    const defaultOptions = {
      method: 'GET',
      timeout: this.config.timeout || 30000,
      header: {
        'content-type': 'application/json',
        ...this.config.headers
      }
    };

    const requestOptions = {
      url: `${this.baseURL}${url}`,
      ...defaultOptions,
      ...options
    };

    return new Promise((resolve, reject) => {
      wx.request({
        ...requestOptions,
        success: (res) => {
          // 更新API使用量
          config.updateApiUsage();
          
          if (res.statusCode === 200) {
            const data = res.data;
            
            // 缓存结果
            if (options.cache !== false) {
              this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
              });
            }
            
            resolve(data);
          } else if (res.statusCode === 429) {
            // API限流，等待后重试
            setTimeout(() => {
              this.request(url, options).then(resolve).catch(reject);
            }, 2000);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (error) => {
          console.error('API请求失败:', error);
          reject(error);
        }
      });
    });
  }

  // 文件上传到Vercel
  async uploadFile(filePath, options = {}) {
    showLoading('上传中...');
    
    try {
      // 检查文件大小（免费限制5MB）
      const fileInfo = await wx.getFileInfo({ filePath });
      if (fileInfo.size > 5 * 1024 * 1024) {
        throw new Error('文件大小超过5MB限制');
      }

      const result = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${this.baseURL}/upload`,
          filePath: filePath,
          name: 'file',
          formData: {
            type: options.type || 'clothing-image',
            quality: options.quality || 'medium'
          },
          success: resolve,
          fail: reject
        });
      });

      hideLoading();
      
      // 更新存储使用量
      config.updateStorageUsage(fileInfo.size);
      
      const data = JSON.parse(result.data);
      if (data.success) {
        showSuccess('上传成功');
        return data;
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (error) {
      hideLoading();
      console.error('文件上传失败:', error);
      throw error;
    }
  }

  // AI抠图服务（使用开源U²-Net模型）
  async removeBackground(imageUrl, options = {}) {
    showLoading('AI抠图中...');
    
    try {
      const result = await this.request('/remove-background', {
        method: 'POST',
        data: {
          imageUrl: imageUrl,
          quality: options.quality || 'high',
          model: 'U2-Net',
          optimizeForMobile: true
        },
        cache: false // 抠图结果不缓存
      });

      hideLoading();
      
      if (result.success) {
        showSuccess('抠图完成');
        return result;
      } else {
        throw new Error(result.error || '抠图失败');
      }
    } catch (error) {
      hideLoading();
      console.error('AI抠图失败:', error);
      
      // 如果AI抠图失败，返回原图
      return {
        success: true,
        processedImage: imageUrl,
        originalImage: imageUrl,
        fallback: true
      };
    }
  }

  // 智能推荐服务（基于规则算法）
  async getRecommendations(params = {}) {
    const {
      type = 'smart',
      season = '',
      userId = '',
      clothingId = '',
      limit = 10
    } = params;

    try {
      const result = await this.request('/recommend', {
        method: 'POST',
        data: {
          type,
          season,
          userId,
          clothingId,
          limit,
          algorithm: 'rule-based', // 使用基于规则的免费算法
          cache: true
        }
      });

      return result;
    } catch (error) {
      console.error('获取推荐失败:', error);
      
      // 返回默认推荐
      return this.getDefaultRecommendations(season);
    }
  }

  // 获取衣物列表（带分页和缓存）
  async getClothingList(params = {}) {
    const {
      page = 1,
      limit = 20,
      category = '',
      tags = [],
      sortBy = 'createTime',
      sortOrder = 'desc'
    } = params;

    try {
      const result = await this.request('/clothing', {
        method: 'GET',
        data: { 
          page, 
          limit, 
          category, 
          tags: tags.join(','),
          sortBy,
          sortOrder
        },
        cache: true
      });

      return result;
    } catch (error) {
      console.error('获取衣物列表失败:', error);
      throw error;
    }
  }

  // 保存衣物（带数据验证）
  async saveClothing(clothingData) {
    showLoading('保存中...');
    
    try {
      // 数据验证
      if (!clothingData.name || !clothingData.name.trim()) {
        throw new Error('衣物名称不能为空');
      }
      
      if (!clothingData.category) {
        throw new Error('请选择衣物分类');
      }

      const result = await this.request('/clothing', {
        method: 'POST',
        data: {
          ...clothingData,
          name: clothingData.name.trim(),
          tags: clothingData.tags || [],
          createTime: new Date().toISOString()
        },
        cache: false
      });

      hideLoading();
      
      if (result.success) {
        showSuccess('保存成功');
        // 清除相关缓存
        this.clearCache('/clothing');
        return result;
      } else {
        throw new Error(result.error || '保存失败');
      }
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
        data: {
          ...clothingData,
          updateTime: new Date().toISOString()
        },
        cache: false
      });

      hideLoading();
      
      if (result.success) {
        showSuccess('更新成功');
        this.clearCache('/clothing');
        return result;
      } else {
        throw new Error(result.error || '更新失败');
      }
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
        method: 'DELETE',
        cache: false
      });

      hideLoading();
      
      if (result.success) {
        showSuccess('删除成功');
        this.clearCache('/clothing');
        return result;
      } else {
        throw new Error(result.error || '删除失败');
      }
    } catch (error) {
      hideLoading();
      console.error('删除衣物失败:', error);
      throw error;
    }
  }

  // 批量操作衣物
  async batchClothingOperation(operation, ids) {
    showLoading('批量处理中...');
    
    try {
      const result = await this.request('/clothing/batch', {
        method: 'POST',
        data: {
          operation, // 'delete', 'update-tags', 'move-category'
          ids,
          timestamp: Date.now()
        },
        cache: false
      });

      hideLoading();
      
      if (result.success) {
        showSuccess(`批量${operation}成功`);
        this.clearCache('/clothing');
        return result;
      } else {
        throw new Error(result.error || '批量操作失败');
      }
    } catch (error) {
      hideLoading();
      console.error('批量操作失败:', error);
      throw error;
    }
  }

  // 保存搭配
  async saveOutfit(outfitData) {
    showLoading('保存搭配中...');
    
    try {
      if (!outfitData.name || !outfitData.name.trim()) {
        throw new Error('搭配名称不能为空');
      }

      if (!outfitData.items || outfitData.items.length === 0) {
        throw new Error('请至少选择一件衣物');
      }

      const result = await this.request('/outfits', {
        method: 'POST',
        data: {
          ...outfitData,
          name: outfitData.name.trim(),
          items: outfitData.items,
          tags: outfitData.tags || [],
          createTime: new Date().toISOString()
        },
        cache: false
      });

      hideLoading();
      
      if (result.success) {
        showSuccess('搭配保存成功');
        this.clearCache('/outfits');
        return result;
      } else {
        throw new Error(result.error || '保存搭配失败');
      }
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
      season = '',
      tags = []
    } = params;

    try {
      const result = await this.request('/outfits', {
        method: 'GET',
        data: { 
          page, 
          limit, 
          season,
          tags: tags.join(',')
        },
        cache: true
      });

      return result;
    } catch (error) {
      console.error('获取搭配列表失败:', error);
      throw error;
    }
  }

  // 搜索功能
  async search(query, type = 'all') {
    try {
      const result = await this.request('/search', {
        method: 'GET',
        data: {
          q: query,
          type, // 'clothing', 'outfits', 'all'
          limit: 50
        },
        cache: true
      });

      return result;
    } catch (error) {
      console.error('搜索失败:', error);
      throw error;
    }
  }

  // 获取使用统计
  async getUsageStats() {
    try {
      const result = await this.request('/stats', {
        method: 'GET',
        cache: true
      });

      return result;
    } catch (error) {
      console.error('获取统计失败:', error);
      return this.getLocalStats();
    }
  }

  // 测试API连接
  async testConnection() {
    try {
      const result = await this.request('/health', {
        method: 'GET',
        timeout: 5000
      });
      return result.status === 'ok';
    } catch (error) {
      console.error('API连接测试失败:', error);
      return false;
    }
  }

  // 获取服务状态
  getServiceStatus() {
    const usage = config.checkUsageLimits();
    const recommendation = config.getRecommendedConfig(usage);
    
    return {
      mode: config.DEPLOY_MODE,
      baseURL: this.baseURL,
      connected: false, // 需要实际测试
      usage: usage,
      recommendation: recommendation,
      cache: {
        size: this.cache.size,
        keys: Array.from(this.cache.keys())
      }
    };
  }

  // 清除缓存
  clearCache(pattern = null) {
    if (pattern) {
      // 清除匹配模式的缓存
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }
  }

  // 获取默认推荐（离线模式）
  getDefaultRecommendations(season = '') {
    const defaultRecommendations = [
      {
        id: 'default1',
        title: '经典搭配',
        description: '简约而不简单的经典搭配',
        image: 'https://picsum.photos/300/400?random=100',
        tags: ['经典', '百搭', '简约'],
        season: 'all'
      },
      {
        id: 'default2',
        title: '休闲风格',
        description: '舒适自在的休闲穿搭',
        image: 'https://picsum.photos/300/400?random=101',
        tags: ['休闲', '舒适', '日常'],
        season: 'all'
      },
      {
        id: 'default3',
        title: '正式场合',
        description: '优雅得体的正式装扮',
        image: 'https://picsum.photos/300/400?random=102',
        tags: ['正式', '优雅', '商务'],
        season: 'all'
      }
    ];

    // 根据季节过滤
    if (season && season !== 'all') {
      return defaultRecommendations.filter(item => 
        item.season === season || item.season === 'all'
      );
    }

    return {
      success: true,
      data: defaultRecommendations,
      type: 'default',
      season: season
    };
  }

  // 获取本地统计（离线模式）
  getLocalStats() {
    const clothing = wx.getStorageSync('local_clothing') || [];
    const outfits = wx.getStorageSync('local_outfits') || [];
    
    return {
      success: true,
      data: {
        clothingCount: clothing.length,
        outfitCount: outfits.length,
        tagCount: this.extractTags(clothing).length,
        storageUsage: config.getCurrentStorageUsage(),
        apiUsage: config.getMonthlyApiUsage()
      }
    };
  }

  // 提取标签
  extractTags(items) {
    const tagSet = new Set();
    items.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }
}

// 创建单例
const freeApiService = new FreeApiService();

module.exports = freeApiService;