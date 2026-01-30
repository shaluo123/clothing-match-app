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
    
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-env-id', // 需要替换为您的云环境ID
        traceUser: true,
      })
      console.log('云开发初始化成功')
    }

    // 设置当前季节
    this.setCurrentSeason()
    
    // 获取用户信息
    this.getUserInfo()
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
  }
})