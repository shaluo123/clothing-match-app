const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    userInfo: {},
    stats: {
      clothingCount: 0,
      outfitCount: 0,
      tagCount: 0
    }
  },

  onLoad: function (options) {
    this.loadUserInfo()
    this.loadStats()
  },

  onShow: function () {
    this.loadStats()
  },

  // 加载用户信息
  loadUserInfo: function () {
    const userInfo = util.storage.get('userInfo') || {}
    this.setData({
      userInfo: userInfo
    })
  },

  // 加载统计数据
  loadStats: function () {
    // 这里应该从云数据库获取真实数据
    // 暂时使用模拟数据
    this.setData({
      stats: {
        clothingCount: 28,
        outfitCount: 12,
        tagCount: 15
      }
    })
  },

  // 导航到设置页面
  navigateToSettings: function () {
    util.showModal('设置功能', '设置功能正在开发中，敬请期待！')
  },

  // 导航到帮助中心
  navigateToHelp: function () {
    util.showModal('帮助中心', '如需帮助，请联系客服邮箱: support@example.com')
  },

  // 导航到关于页面
  navigateToAbout: function () {
    util.showModal('关于我们', '衣搭助手 v1.0.0\n一款智能衣物搭配助手小程序\n帮助您轻松管理衣橱，创造完美搭配')
  },

  // 分享应用
  shareApp: function () {
    return {
      title: '衣搭助手 - 智能衣物搭配',
      path: '/pages/home/home',
      imageUrl: '/images/share-logo.png'
    }
  },

  // 清除缓存
  clearCache: function () {
    util.showModal('清除缓存', '确定要清除所有缓存数据吗？', '清除', '取消')
      .then((confirm) => {
        if (confirm) {
          util.storage.clear()
          util.showSuccess('缓存已清除')
        }
      })
  }
})