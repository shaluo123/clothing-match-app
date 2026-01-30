// 简化的个人中心（免费版）
const app = getApp()

Page({
  data: {
    userInfo: {},
    stats: {
      clothingCount: 0,
      outfitCount: 0,
      tagCount: 0
    },
    serviceStatus: null
  },

  onLoad: function (options) {
    this.initPage()
  },

  onShow: function () {
    this.loadUserInfo()
    this.loadStats()
  },

  // 初始化页面
  initPage: function () {
    this.setData({
      serviceStatus: app.globalData.serviceStatus
    })
  },

  // 加载用户信息
  loadUserInfo: function () {
    const userInfo = app.globalData.userInfo || {}
    this.setData({
      userInfo: userInfo
    })
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
        console.error('获取统计失败:', error)
        this.setMockStats()
      })
  },

  // 设置模拟统计
  setMockStats: function () {
    this.setData({
      stats: {
        clothingCount: 28,
        outfitCount: 12,
        tagCount: 15
      }
    })
  },

  // 查看使用情况
  viewUsageInfo: function () {
    if (!app.globalData.serviceStatus) {
      app.showError('暂无使用数据')
      return
    }

    const { api, storage } = app.globalData.serviceStatus.usage || {}
    
    wx.showModal({
      title: '免费额度使用情况',
      content: `API调用: ${api.used || 0}/${api.limit || 100000}\n存储空间: ${(storage.used || 0)/1024/1024}/${(storage.limit || 524288)/1024/1024}MB`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 关于我们
  showAbout: function () {
    wx.showModal({
      title: '关于衣搭助手',
      content: '衣搭助手 v1.0.0 (免费版)\n\n一款智能衣物搭配管理小程序\n\n技术栈：\n• 前端：微信小程序原生框架\n• 后端：Node.js + Express\n• 数据库：MongoDB Atlas (免费)\n• 部署：Vercel (免费)\n• AI：U²-Net开源模型\n\n特色功能：\n• 完全免费使用\n• 智能在线/离线切换\n• 自动故障转移\n• 免费额度监控',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 帮助中心
  showHelp: function () {
    wx.showModal({
      title: '帮助中心',
      content: '📖 使用指南：\n\n1. 添加衣物：在衣橱页面点击+号\n2. 创建搭配：选择衣物后创建搭配\n3. 智能推荐：首页查看推荐\n4. 离线模式：网络异常时自动启用\n\n📞 技术支持：\n• 邮箱：support@example.com\n• 文档：项目docs目录\n• 问题：GitHub Issues\n\n🎯 免费说明：\n• API调用：10万次/月免费\n• 存储空间：512MB免费\n• 自动降级：保障服务可用性',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 分享应用
  shareApp: function () {
    return {
      title: '衣搭助手 - 免费版',
      path: '/pages/home/home-free',
      imageUrl: '/images/share-logo.png',
      desc: '一款完全免费的智能衣物搭配管理小程序',
      success: () => {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '分享失败',
          icon: 'error'
        })
      }
    }
  },

  // 清除缓存
  clearCache: function () {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？\n\n这将删除本地缓存，但不会删除云端数据。',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除本地存储
            wx.clearStorageSync()
            
            wx.showToast({
              title: '缓存已清除',
              icon: 'success'
            })
            
            // 重新加载数据
            this.loadUserInfo()
            this.loadStats()
          } catch (error) {
            wx.showToast({
              title: '清除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  // 切换部署模式
  switchDeployMode: function () {
    wx.showActionSheet({
      itemList: ['免费模式', '云开发模式', '混合模式'],
      success: (res) => {
        const modes = ['self-hosted', 'cloud', 'hybrid']
        const selectedMode = modes[res.tapIndex]
        
        if (selectedMode !== 'self-hosted') {
          wx.showModal({
            title: '切换确认',
            content: '切换到付费模式可能产生费用，确认继续吗？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                app.switchDeployMode(selectedMode)
                  .then(status => {
                    this.setData({
                      serviceStatus: status
                    })
                  })
              }
            }
          })
        } else {
          app.switchDeployMode(selectedMode)
            .then(status => {
              this.setData({
                serviceStatus: status
              })
            })
        }
      }
    })
  }
})