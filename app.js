// 免费部署模式的应用入口
const config = require('./config/api-free.js');
const freeApiService = require('./services/api-free.js');

App({
  globalData: {
    userInfo: null,
    seasonThemes: {
      spring: {
        primary: '#FFB6C1',
        secondary: '#FFC0CB',
        background: '#FFF5F7',
        accent: '#FF69B4',
        name: '春季',
        icon: '🌸'
      },
      summer: {
        primary: '#98FB98',
        secondary: '#90EE90',
        background: '#F0FFF8',
        accent: '#32CD32',
        name: '夏季',
        icon: '🌿'
      },
      autumn: {
        primary: '#FFD700',
        secondary: '#F0E68C',
        background: '#FFFACD',
        accent: '#FF8C00',
        name: '秋季',
        icon: '🍂'
      },
      winter: {
        primary: '#F0F8FF',
        secondary: '#FFFFFF',
        background: '#F5F5F5',
        accent: '#4682B4',
        name: '冬季',
        icon: '❄️'
      }
    },
    currentSeason: 'spring',
    autoSaveTimer: null,
    apiService: freeApiService,
    serviceStatus: null
  },

  onLaunch: function () {
    console.log('衣搭助手启动 - 免费部署模式')
    
    // 初始化服务
    this.initServices()
    
    // 设置当前季节
    this.setCurrentSeason()
    
    // 获取用户信息
    this.getUserInfo()
    
    // 检查服务状态
    this.checkServiceHealth()
    
    // 重置月度使用量
    config.resetMonthlyUsage()
    
    // 初始化本地存储
    this.initLocalStorage()
  },

  onShow: function () {
    console.log('应用显示')
    this.setCurrentSeason()
    this.checkServiceHealth()
  },

  onHide: function () {
    console.log('应用隐藏')
    
    // 清除自动保存定时器
    if (this.globalData.autoSaveTimer) {
      clearInterval(this.globalData.autoSaveTimer)
    }
  },

  // 初始化服务
  initServices: function () {
    console.log(`部署模式: ${config.DEPLOY_MODE} - 免费服务`)
    console.log('服务初始化完成')
  },

  // 初始化本地存储
  initLocalStorage: function () {
    // 确保必要的存储键存在
    const requiredKeys = [
      'local_clothing',
      'local_outfits', 
      'local_tags',
      'user_preferences',
      'usage_stats'
    ]
    
    requiredKeys.forEach(key => {
      if (!wx.getStorageSync(key)) {
        wx.setStorageSync(key, JSON.stringify([]))
      }
    })
  },

  // 检查服务健康状态
  checkServiceHealth: async function () {
    try {
      const status = await this.globalData.apiService.testConnection()
      this.globalData.serviceStatus = {
        connected: status,
        lastCheck: new Date(),
        mode: config.DEPLOY_MODE
      }
      
      if (!status) {
        console.warn('API服务连接失败，使用离线模式')
      } else {
        console.log('API服务连接正常')
      }
    } catch (error) {
      console.error('服务检查失败:', error)
      this.globalData.serviceStatus = {
        connected: false,
        lastCheck: new Date(),
        error: error.message,
        mode: config.DEPLOY_MODE
      }
    }
  },

  // 设置当前季节
  setCurrentSeason: function () {
    const month = new Date().getMonth() + 1
    let season = 'spring'
    
    if (month >= 3 && month <= 5) {
      season = 'spring'
    } else if (month >= 6 && month <= 8) {
      season = 'summer'
    } else if (month >= 9 && month <= 11) {
      season = 'autumn'
    } else {
      season = 'winter'
    }
    
    this.globalData.currentSeason = season
    this.updateAppTheme(season)
  },

  // 更新应用主题
  updateAppTheme: function (season) {
    const theme = this.globalData.seasonThemes[season]
    
    // 更新导航栏颜色
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: theme.primary
    })
    
    console.log(`主题已切换到${theme.name}`)
  },

  // 获取用户信息
  getUserInfo: function () {
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: res => {
              this.globalData.userInfo = res.userInfo
              wx.setStorageSync('userInfo', res.userInfo)
            }
          })
        } else {
          // 尝试从本地获取用户信息
          const localUserInfo = wx.getStorageSync('userInfo')
          if (localUserInfo) {
            this.globalData.userInfo = localUserInfo
          }
        }
      }
    })
  },

  // 统一的API调用方法
  async callApi(method, ...args) {
    try {
      const result = await this.globalData.apiService[method](...args)
      return result
    } catch (error) {
      console.error(`API调用失败 [${method}]:`, error)
      
      // 显示错误提示
      this.showError('操作失败，请检查网络连接')
      
      // 如果是网络错误，尝试使用本地数据
      if (error.message.includes('network') || error.message.includes('timeout')) {
        return this.getOfflineData(method, ...args)
      }
      
      throw error
    }
  },

  // 获取离线数据
  getOfflineData(method, ...args) {
    console.log(`使用离线数据 [${method}]`)
    
    switch (method) {
      case 'getClothingList':
        return this.getOfflineClothingList(...args)
      case 'getOutfitList':
        return this.getOfflineOutfitList(...args)
      case 'getRecommendations':
        return this.globalData.apiService.getDefaultRecommendations(...args)
      case 'getUsageStats':
        return this.globalData.apiService.getLocalStats()
      default:
        return { success: false, error: '离线模式不支持此操作' }
    }
  },

  // 获取离线衣物列表
  getOfflineClothingList(params = {}) {
    const clothing = JSON.parse(wx.getStorageSync('local_clothing') || '[]')
    const { page = 1, limit = 20, category } = params
    
    let filteredClothing = clothing
    if (category) {
      filteredClothing = clothing.filter(item => item.category === category)
    }
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedClothing = filteredClothing.slice(start, end)
    
    return {
      success: true,
      data: paginatedClothing,
      total: filteredClothing.length,
      page,
      limit,
      offline: true
    }
  },

  // 获取离线搭配列表
  getOfflineOutfitList(params = {}) {
    const outfits = JSON.parse(wx.getStorageSync('local_outfits') || '[]')
    const { page = 1, limit = 20, season } = params
    
    let filteredOutfits = outfits
    if (season) {
      filteredOutfits = outfits.filter(item => item.season === season)
    }
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedOutfits = filteredOutfits.slice(start, end)
    
    return {
      success: true,
      data: paginatedOutfits,
      total: filteredOutfits.length,
      page,
      limit,
      offline: true
    }
  },

  // 显示加载提示
  showLoading: function (title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    })
  },

  // 隐藏加载提示
  hideLoading: function () {
    wx.hideLoading()
  },

  // 显示成功提示
  showSuccess: function (title = '操作成功') {
    wx.showToast({
      title: title,
      icon: 'success',
      duration: 2000
    })
  },

  // 显示错误提示
  showError: function (title = '操作失败') {
    wx.showToast({
      title: title,
      icon: 'error',
      duration: 2000
    })
  }
})