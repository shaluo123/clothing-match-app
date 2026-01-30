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
    autoSaveTimer: null
  },

  onLaunch: function () {
    console.log('衣搭助手启动')
    
    // 初始化服务
    this.initServices()
    
    // 设置当前季节
    this.setCurrentSeason()
    
    // 获取用户信息
    this.getUserInfo()
    
    // 检查服务状态
    this.checkServiceHealth()
  },

  onShow: function () {
    console.log('应用显示')
  },

  onHide: function () {
    console.log('应用隐藏')
    
    // 清除自动保存定时器
    if (this.globalData.autoSaveTimer) {
      clearInterval(this.globalData.autoSaveTimer)
    }
  },

  // 根据月份设置当前季节
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
            }
          })
        }
      }
    })
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
  },

  // 初始化服务
  initServices: function () {
    const config = require('./miniprogram/config/api.js')
    const hybridService = require('./miniprogram/services/hybrid.js')
    
    // 根据配置初始化不同的服务
    if (config.DEPLOY_MODE === 'cloud') {
      // 云开发模式
      if (wx.cloud) {
        wx.cloud.init({
          env: config.CLOUD_CONFIG.env || 'your-env-id',
          traceUser: true,
        })
        console.log('云开发初始化成功')
      }
    } else {
      console.log(`使用自建API模式: ${config.DEPLOY_MODE}`)
    }
    
    // 检查服务健康状态
    this.checkServiceHealth()
  },

  // 检查服务健康状态
  checkServiceHealth: async function () {
    try {
      const hybridService = require('./miniprogram/services/hybrid.js')
      const status = await hybridService.checkServices()
      
      if (!status.healthy) {
        console.warn('服务检查异常:', status.services)
        
        // 如果自建服务不可用，自动切换到云开发
        if (config.DEPLOY_MODE !== 'cloud') {
          console.log('自动切换到云开发模式')
          hybridService.switchMode('cloud')
        }
      } else {
        console.log('所有服务运行正常')
      }
    } catch (error) {
      console.error('服务检查失败:', error)
    }
  },

  // 获取推荐配置
  getRecommendedConfig: function () {
    const hybridService = require('./miniprogram/services/hybrid.js')
    return hybridService.getRecommendedConfig()
  }
})