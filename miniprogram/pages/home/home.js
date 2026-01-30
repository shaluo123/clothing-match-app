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
    }
  },

  onLoad: function (options) {
    this.initPage()
  },

  onShow: function () {
    this.setCurrentSeason()
    this.loadRecentData()
    this.refreshRecommendation()
  },

  onPullDownRefresh: function () {
    this.refreshRecommendation()
    this.loadRecentData()
    wx.stopPullDownRefresh()
  },

  // 初始化页面
  initPage: function () {
    this.setCurrentSeason()
    this.setGreeting()
    this.loadRecentData()
    this.refreshRecommendation()
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

    // 跳转到搜索结果页面
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(keyword)}`
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
    
    wx.cloud.callFunction({
      name: 'recommend',
      data: {
        type: 'smart',
        season: this.data.currentSeason
      }
    })
    .then(res => {
      app.hideLoading()
      if (res.result.success) {
        this.setData({
          recommendations: res.result.data
        })
        app.showSuccess('推荐更新成功')
      } else {
        app.showError('获取推荐失败')
      }
    })
    .catch(err => {
      app.hideLoading()
      console.error('获取推荐失败:', err)
      app.showError('网络错误，请重试')
    })
  },

  // 刷新推荐
  refreshRecommendation: function () {
    // 模拟推荐数据
    const mockRecommendations = [
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
      recommendations: mockRecommendations
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
    // 从云数据库获取统计数据
    wx.cloud.database().collection('clothing').count()
      .then(res => {
        const clothingCount = res.total
        
        wx.cloud.database().collection('outfits').count()
          .then(res => {
            const outfitCount = res.total
            
            wx.cloud.database().collection('tags').count()
              .then(res => {
                const tagCount = res.total
                
                this.setData({
                  stats: {
                    clothingCount: clothingCount,
                    outfitCount: outfitCount,
                    tagCount: tagCount
                  }
                })
              })
          })
      })
      .catch(err => {
        console.error('加载统计数据失败:', err)
        // 使用模拟数据
        this.setData({
          stats: {
            clothingCount: 28,
            outfitCount: 12,
            tagCount: 15
          }
        })
      })
  },

  // 加载最近搭配
  loadRecentOutfits: function () {
    // 从云数据库获取最近搭配
    wx.cloud.database().collection('outfits')
      .orderBy('createTime', 'desc')
      .limit(5)
      .get()
      .then(res => {
        const outfits = res.data.map(item => ({
          id: item._id,
          name: item.name,
          thumbnail: item.thumbnail || 'https://picsum.photos/200/250?random=' + item._id,
          timeText: this.formatTime(item.createTime)
        }))
        
        this.setData({
          recentOutfits: outfits
        })
      })
      .catch(err => {
        console.error('加载最近搭配失败:', err)
        // 使用模拟数据
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
  }
})