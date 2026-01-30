// 免费部署模式的首页
const app = getApp()

Page({
  data: {
    currentSeason: '',
    currentTheme: {},
    greeting: '',
    searchKeyword: '',
    recommendations: [],
    recentOutfits: [],
    stats: {
      clothingCount: 0,
      outfitCount: 0,
      tagCount: 0
    },
    serviceStatus: null,
    usageInfo: null
  },

  onLoad: function (options) {
    this.initPage()
  },

  onShow: function () {
    this.setCurrentSeason()
    this.loadRecentData()
    this.refreshRecommendation()
    this.checkServiceStatus()
  },

  onPullDownRefresh: function () {
    this.refreshRecommendation()
    this.loadRecentData()
    this.checkServiceStatus()
    wx.stopPullDownRefresh()
  },

  // 初始化页面
  initPage: function () {
    this.setCurrentSeason()
    this.setGreeting()
    this.loadRecentData()
    this.refreshRecommendation()
    this.checkServiceStatus()
  },

  // 设置当前季节主题
  setCurrentSeason: function () {
    const currentSeason = app.globalData.currentSeason
    const currentTheme = app.globalData.seasonThemes[currentSeason]
    
    this.setData({
      currentSeason: currentSeason,
      currentTheme: currentTheme
    })
    
    // 更新页面背景色
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: currentTheme.primary
    })
  },

  // 设置问候语
  setGreeting: function () {
    const hour = new Date().getHours()
    let greeting = '早上好'
    
    if (hour >= 12 && hour < 18) {
      greeting = '下午好'
    } else if (hour >= 18) {
      greeting = '晚上好'
    }
    
    this.setData({
      greeting: greeting
    })
  },

  // 检查服务状态
  checkServiceStatus: function () {
    const status = app.getServiceStatus()
    this.setData({
      serviceStatus: status,
      usageInfo: status.usage
    })
    
    // 如果API不可用，显示提示
    if (!status.connected) {
      wx.showToast({
        title: 'API服务不可用，使用离线模式',
        icon: 'none',
        duration: 3000
      })
    }
  },

  // 搜索输入
  onSearch: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 执行搜索
  performSearch: function () {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      app.showError('请输入搜索内容')
      return
    }

    // 使用免费API服务进行搜索
    app.callApi('search', keyword, 'all')
      .then(result => {
        if (result.success) {
          // 跳转到搜索结果页面
          wx.navigateTo({
            url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}&results=${encodeURIComponent(JSON.stringify(result.data))}`
          })
        } else {
          app.showError('搜索失败')
        }
      })
      .catch(error => {
        console.error('搜索失败:', error)
        app.showError('搜索失败，请重试')
      })
  },

  // 导航到衣橱页面
  navigateToCloset: function () {
    wx.switchTab({
      url: '/pages/closet/closet'
    })
  },

  // 导航到搭配页面
  navigateToOutfit: function () {
    wx.switchTab({
      url: '/pages/outfits/outfits'
    })
  },

  // 导航到标签页面
  navigateToTags: function () {
    wx.switchTab({
      url: '/pages/tags/tags'
    })
  },

  // 导航到搭配列表页面
  navigateToOutfits: function () {
    wx.switchTab({
      url: '/pages/outfits/outfits'
    })
  },

  // 获取智能推荐
  getRecommendation: function () {
    app.showLoading('获取推荐中...')
    
    // 使用免费API服务获取推荐
    app.callApi('getRecommendations', {
      type: 'smart',
      season: this.data.currentSeason,
      limit: 5
    })
    .then(result => {
      app.hideLoading()
      if (result.success) {
        this.setData({
          recommendations: result.data
        })
        app.showSuccess('推荐更新成功')
      } else {
        app.showError('获取推荐失败')
      }
    })
    .catch(error => {
      app.hideLoading()
      console.error('获取推荐失败:', error)
      app.showError('网络错误，请重试')
    })
  },

  // 刷新推荐
  refreshRecommendation: function () {
    // 使用免费API服务刷新推荐
    app.callApi('getRecommendations', {
      type: 'smart',
      season: this.data.currentSeason,
      limit: 3,
      refresh: true
    })
    .then(result => {
      if (result.success) {
        this.setData({
          recommendations: result.data
        })
      } else {
        // 使用默认推荐
        this.setDefaultRecommendations()
      }
    })
    .catch(error => {
      console.error('刷新推荐失败:', error)
      this.setDefaultRecommendations()
    })
  },

  // 设置默认推荐
  setDefaultRecommendations: function () {
    const defaultRecommendations = [
      {
        id: 1,
        title: '春日清新搭配',
        description: '温柔的粉色系搭配，适合春日踏青',
        image: 'https://picsum.photos/300/400?random=1',
        tags: ['春日', '休闲', '清新']
      },
      {
        id: 2,
        title: '职场精英范',
        description: '简约干练的职场穿搭方案',
        image: 'https://picsum.photos/300/400?random=2',
        tags: ['职场', '简约', '正式']
      },
      {
        id: 3,
        title: '周末休闲装',
        description: '舒适的周末休闲搭配',
        image: 'https://picsum.photos/300/400?random=3',
        tags: ['休闲', '舒适', '周末']
      }
    ]

    this.setData({
      recommendations: defaultRecommendations
    })
  },

  // 查看推荐详情
  viewRecommendation: function (e) {
    const item = e.currentTarget.dataset.item
    wx.showModal({
      title: item.title,
      content: item.description,
      showCancel: false,
      confirmText: '查看搭配',
      success: (res) => {
        if (res.confirm) {
          this.createOutfitFromRecommendation(item)
        }
      }
    })
  },

  // 根据推荐创建搭配
  createOutfitFromRecommendation: function (recommendation) {
    wx.navigateTo({
      url: `/pages/outfit-create/outfit-create?template=${encodeURIComponent(JSON.stringify(recommendation))}`
    })
  },

  // 加载最近数据
  loadRecentData: function () {
    this.loadStats()
    this.loadRecentOutfits()
  },

  // 加载统计数据
  loadStats: function () {
    // 使用免费API服务获取统计
    app.callApi('getUsageStats')
      .then(result => {
        if (result.success) {
          this.setData({
            stats: {
              clothingCount: result.data.clothingCount,
              outfitCount: result.data.outfitCount,
              tagCount: result.data.tagCount
            }
          })
        } else {
          this.setMockStats()
        }
      })
      .catch(error => {
        console.error('加载统计数据失败:', error)
        this.setMockStats()
      })
  },

  // 设置模拟统计数据
  setMockStats: function () {
    this.setData({
      stats: {
        clothingCount: 28,
        outfitCount: 12,
        tagCount: 15
      }
    })
  },

  // 加载最近搭配
  loadRecentOutfits: function () {
    // 使用免费API服务获取最近搭配
    app.callApi('getOutfitList', {
      page: 1,
      limit: 5,
      sortBy: 'createTime',
      sortOrder: 'desc'
    })
    .then(result => {
      if (result.success) {
        const outfits = result.data.map(item => ({
          id: item._id,
          name: item.name,
          thumbnail: item.thumbnail || `https://picsum.photos/200/250?random=${item._id}`,
          timeText: this.formatTime(item.createTime)
        }))
        
        this.setData({
          recentOutfits: outfits
        })
      } else {
        this.setMockOutfits()
      }
    })
    .catch(error => {
      console.error('加载最近搭配失败:', error)
      this.setMockOutfits()
    })
  },

  // 设置模拟最近搭配
  setMockOutfits: function () {
    const mockOutfits = [
      {
        id: '1',
        name: '春日清新装',
        thumbnail: 'https://picsum.photos/200/250?random=10',
        timeText: '2小时前'
      },
      {
        id: '2',
        name: '职场精英装',
        thumbnail: 'https://picsum.photos/200/250?random=11',
        timeText: '1天前'
      },
      {
        id: '3',
        name: '周末休闲装',
        thumbnail: 'https://picsum.photos/200/250?random=12',
        timeText: '3天前'
      }
    ]
    
    this.setData({
      recentOutfits: mockOutfits
    })
  },

  // 查看搭配详情
  viewOutfit: function (e) {
    const outfitId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/outfit-detail/outfit-detail?id=${outfitId}`
    })
  },

  // 格式化时间
  formatTime: function (timestamp) {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now - time
    
    if (diff < 60000) {
      return '刚刚'
    } else if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前'
    } else if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前'
    } else if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前'
    } else {
      return time.toLocaleDateString()
    }
  },

  // 查看使用情况
  viewUsageInfo: function () {
    if (!this.data.usageInfo) {
      app.showError('暂无使用数据')
      return
    }

    const { api, storage, bandwidth } = this.data.usageInfo
    
    wx.showModal({
      title: '免费额度使用情况',
      content: `API调用: ${api.used}/${api.limit}\n存储空间: ${(storage.used/1024/1024).toFixed(1)}MB/${(storage.limit/1024/1024).toFixed(1)}MB\n带宽使用: ${(bandwidth.used/1024/1024).toFixed(1)}MB/${(bandwidth.limit/1024/1024/1024).toFixed(1)}GB`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 切换部署模式
  switchDeployMode: function () {
    wx.showActionSheet({
      itemList: ['免费模式', '云开发模式', '混合模式'],
      success: (res) => {
        const modes = ['self-hosted', 'cloud', 'hybrid']
        const selectedMode = modes[res.tapIndex]
        
        if (selectedMode !== app.config.DEPLOY_MODE) {
          app.switchDeployMode(selectedMode)
            .then(status => {
              this.checkServiceStatus()
            })
        }
      }
    })
  }
})