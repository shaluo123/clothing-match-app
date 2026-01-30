// 简化的标签页面（免费版）
const app = getApp()

Page({
  data: {
    serviceStatus: null
  },

  onLoad: function (options) {
    this.setData({
      serviceStatus: app.globalData.serviceStatus
    })
  },

  onShow: function () {
    this.setData({
      serviceStatus: app.globalData.serviceStatus
    })
  }
})