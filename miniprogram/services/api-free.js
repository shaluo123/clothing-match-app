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

  // 统一的HTTP请求方法（带智能缓存和重试）
  async request(url, options = {}) {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // 智能缓存策略
    if (options.cache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const cacheAge = Date.now() - cached.timestamp;
      const cacheTTL = this.getCacheTTL(url, options);
      
      if (cacheAge < cacheTTL) {
        console.log(`使用缓存数据: ${url} (剩余${Math.round((cacheTTL - cacheAge)/1000)}s)`);
        return cached.data;
      } else {
        // 缓存过期，清除
        this.cache.delete(cacheKey);
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
            
            // 智能缓存结果
            if (options.cache !== false && data.success) {
              this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now(),
                url: url,
                options: { ...options }
              });
              
              // 清理过期缓存
              this.cleanupExpiredCache();
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
          console.error('API请求失败:', {
            url: url,
            options: options,
            error: error.errMsg || error.message,
            statusCode: error.statusCode
          });
          
          // 根据错误类型提供更具体的错误信息
          let errorMessage = '网络请求失败';
          
          if (error.errMsg) {
            if (error.errMsg.includes('timeout')) {
              errorMessage = '请求超时，请检查网络连接';
            } else if (error.errMsg.includes('fail')) {
              errorMessage = '网络连接失败，请检查网络设置';
            } else if (error.errMsg.includes('abort')) {
              errorMessage = '请求被中断';
            }
          }
          
          reject(new Error(errorMessage));
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

  // 保存衣物（带完整数据验证）
  async saveClothing(clothingData) {
    showLoading('保存中...');
    
    try {
      // 完整数据验证
      const validationResult = this.validateClothingData(clothingData);
      if (!validationResult.valid) {
        throw new Error(validationResult.error);
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

  // 智能缓存TTL策略
  getCacheTTL(url, options) {
    // 根据URL类型和请求参数确定缓存时间
    if (url.includes('/recommend')) {
      return 600000; // 推荐数据10分钟
    } else if (url.includes('/clothing') && options.method === 'GET') {
      return 300000; // 衣物列表5分钟
    } else if (url.includes('/outfits') && options.method === 'GET') {
      return 300000; // 搭配列表5分钟
    } else if (url.includes('/search')) {
      return 180000; // 搜索结果3分钟
    } else if (url.includes('/health')) {
      return 60000; // 健康检查1分钟
    } else {
      return 120000; // 默认2分钟
    }
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      const cacheTTL = this.getCacheTTL(value.url, value.options);
      if (now - value.timestamp > cacheTTL) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
    
    if (toDelete.length > 0) {
      console.log(`清理了${toDelete.length}个过期缓存项`);
    }
  }

  // 清除缓存（增强版）
  clearCache(pattern = null) {
    if (pattern) {
      // 清除匹配模式的缓存
      const toDelete = [];
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          toDelete.push(key);
        }
      }
      toDelete.forEach(key => this.cache.delete(key));
      console.log(`清除了${toDelete.length}个匹配"${pattern}"的缓存项`);
    } else {
      const size = this.cache.size;
      this.cache.clear();
      console.log(`清除了所有缓存（共${size}项）`);
    }
  }

  // 获取缓存统计
  getCacheStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      const cacheTTL = this.getCacheTTL(value.url, value.options);
      if (now - value.timestamp > cacheTTL) {
        expiredCount++;
      } else {
        validCount++;
      }
    }
    
    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  // 估算缓存内存使用（KB）
  estimateMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache.entries()) {
      totalSize += JSON.stringify(value).length;
    }
    return Math.round(totalSize / 1024);
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

  // 衣物数据验证
  validateClothingData(data) {
    if (!data) {
      return { valid: false, error: '数据不能为空' };
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return { valid: false, error: '衣物名称不能为空且必须是字符串' };
    }
    
    if (data.name.trim().length > 50) {
      return { valid: false, error: '衣物名称不能超过50个字符' };
    }
    
    if (!data.category || typeof data.category !== 'string') {
      return { valid: false, error: '请选择衣物分类' };
    }
    
    const validCategories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
    if (!validCategories.includes(data.category)) {
      return { valid: false, error: `无效的分类，支持的分类: ${validCategories.join(', ')}` };
    }
    
    if (data.tags && (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== 'string'))) {
      return { valid: false, error: '标签必须是字符串数组' };
    }
    
    if (data.tags && data.tags.length > 10) {
      return { valid: false, error: '标签数量不能超过10个' };
    }
    
    if (data.tags) {
      for (const tag of data.tags) {
        if (tag.length > 20) {
          return { valid: false, error: '标签长度不能超过20个字符' };
        }
      }
    }
    
    return { valid: true };
  }

  // 搭配数据验证
  validateOutfitData(data) {
    if (!data) {
      return { valid: false, error: '数据不能为空' };
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return { valid: false, error: '搭配名称不能为空且必须是字符串' };
    }
    
    if (data.name.trim().length > 50) {
      return { valid: false, error: '搭配名称不能超过50个字符' };
    }
    
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      return { valid: false, error: '搭配必须包含至少一件衣物' };
    }
    
    if (data.items.length > 10) {
      return { valid: false, error: '搭配中的衣物数量不能超过10件' };
    }
    
    if (data.description && data.description.length > 200) {
      return { valid: false, error: '搭配描述不能超过200个字符' };
    }
    
    if (data.tags && (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== 'string'))) {
      return { valid: false, error: '标签必须是字符串数组' };
    }
    
    const validSeasons = ['spring', 'summer', 'autumn', 'winter', 'all'];
    if (data.season && !validSeasons.includes(data.season)) {
      return { valid: false, error: `无效的季节，支持的季节: ${validSeasons.join(', ')}` };
    }
    
    return { valid: true };
  }

  // 提取标签
  extractTags(items) {
    const tagSet = new Set();
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          if (typeof tag === 'string' && tag.trim().length > 0) {
            tagSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagSet);
  }

  // 错误分类和处理
  categorizeError(error) {
    if (!error) return 'unknown';
    
    const message = error.message || error.toString();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('fail')) return 'network';
    if (message.includes('CORS')) return 'cors';
    if (message.includes('limit') || message.includes('容量')) return 'quota';
    if (message.includes('验证') || message.includes('无效')) return 'validation';
    if (message.includes('权限') || message.includes('认证')) return 'authorization';
    if (message.includes('数据库') || message.includes('database')) return 'database';
    
    return 'unknown';
  }

  // 获取用户友好的错误消息
  getErrorMessage(error) {
    const category = this.categorizeError(error);
    const message = error.message || error.toString();
    
    switch (category) {
      case 'timeout':
        return '请求超时，请检查网络连接后重试';
      case 'network':
        return '网络连接失败，请检查网络设置';
      case 'cors':
        return '请求被安全策略阻止，请稍后重试';
      case 'quota':
        return '免费额度已用完，请稍后再试或升级服务';
      case 'validation':
        return message;
      case 'authorization':
        return '权限不足，请重新登录';
      case 'database':
        return '服务暂时不可用，请稍后重试';
      default:
        return '操作失败，请重试';
    }
  }
}

// 创建单例
const freeApiService = new FreeApiService();

module.exports = freeApiService;