// 通用工具函数
const app = getApp()

/**
 * 显示加载提示
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title: title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
function showSuccess(title = '操作成功', duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: duration
  })
}

/**
 * 显示错误提示
 */
function showError(title = '操作失败', duration = 2000) {
  wx.showToast({
    title: title,
    icon: 'error',
    duration: duration
  })
}

/**
 * 显示确认对话框
 */
function showModal(title, content, confirmText = '确定', cancelText = '取消') {
  return new Promise((resolve) => {
    wx.showModal({
      title: title,
      content: content,
      confirmText: confirmText,
      cancelText: cancelText,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

/**
 * 格式化时间
 */
function formatTime(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second)
}

/**
 * 相对时间格式化
 */
function formatRelativeTime(timestamp) {
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
  } else if (diff < 2592000000) {
    return Math.floor(diff / 604800000) + '周前'
  } else {
    return formatTime(timestamp, 'YYYY-MM-DD')
  }
}

/**
 * 防抖函数
 */
function debounce(func, delay = 300) {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 */
function throttle(func, delay = 300) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      func.apply(this, args)
      lastTime = now
    }
  }
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj)
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (typeof obj === 'object') {
    const cloned = {}
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key])
    })
    return cloned
  }
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * 文件上传
 */
function uploadFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 文件下载
 */
function downloadFile(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID: fileID,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  return new Promise((resolve, reject) => {
    wx.getUserInfo({
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 检查授权状态
 */
function checkAuth(scope) {
  return new Promise((resolve) => {
    wx.getSetting({
      success: (res) => {
        resolve(!!res.authSetting[scope])
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 请求授权
 */
function requestAuth(scope) {
  return new Promise((resolve) => {
    wx.authorize({
      scope: scope,
      success: () => {
        resolve(true)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

/**
 * 设置剪贴板
 */
function setClipboardData(data) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: data,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 预览图片
 */
function previewImage(urls, current = 0) {
  wx.previewImage({
    urls: urls,
    current: current
  })
}

/**
 * 选择媒体文件
 */
function chooseMedia(count = 1, mediaType = ['image'], sourceType = ['album', 'camera']) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: count,
      mediaType: mediaType,
      sourceType: sourceType,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 压缩图片
 */
function compressImage(src, quality = 80) {
  return new Promise((resolve, reject) => {
    wx.compressImage({
      src: src,
      quality: quality,
      success: resolve,
      fail: reject
    })
  })
}

/**
 * 颜色工具
 */
const colorUtils = {
  /**
   * 判断颜色是否为亮色
   */
  isLightColor(color) {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return brightness > 155
  },

  /**
   * 获取对比色
   */
  getContrastColor(color) {
    return this.isLightColor(color) ? '#000000' : '#FFFFFF'
  }
}

/**
 * 存储工具
 */
const storage = {
  /**
   * 设置存储
   */
  set(key, value) {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (e) {
      console.error('存储失败:', e)
      return false
    }
  },

  /**
   * 获取存储
   */
  get(key, defaultValue = null) {
    try {
      const value = wx.getStorageSync(key)
      return value !== '' ? value : defaultValue
    } catch (e) {
      console.error('获取存储失败:', e)
      return defaultValue
    }
  },

  /**
   * 删除存储
   */
  remove(key) {
    try {
      wx.removeStorageSync(key)
      return true
    } catch (e) {
      console.error('删除存储失败:', e)
      return false
    }
  },

  /**
   * 清空存储
   */
  clear() {
    try {
      wx.clearStorageSync()
      return true
    } catch (e) {
      console.error('清空存储失败:', e)
      return false
    }
  }
}

/**
 * 页面工具
 */
const pageUtils = {
  /**
   * 页面跳转
   */
  navigateTo(url, params = {}) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')
    
    const fullUrl = queryString ? `${url}?${queryString}` : url
    
    wx.navigateTo({
      url: fullUrl
    })
  },

  /**
   * 返回上一页
   */
  navigateBack(delta = 1) {
    wx.navigateBack({
      delta: delta
    })
  },

  /**
   * 切换到Tab页面
   */
  switchTab(url) {
    wx.switchTab({
      url: url
    })
  }
}

module.exports = {
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  showModal,
  formatTime,
  formatRelativeTime,
  debounce,
  throttle,
  deepClone,
  generateId,
  uploadFile,
  downloadFile,
  getUserInfo,
  checkAuth,
  requestAuth,
  setClipboardData,
  previewImage,
  chooseMedia,
  compressImage,
  colorUtils,
  storage,
  pageUtils
}