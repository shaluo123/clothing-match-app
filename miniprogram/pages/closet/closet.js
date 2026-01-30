const app = getApp()

Page({
  data: {
    currentSeason: '',
    selectedCategory: '',
    filteredClothing: [],
    selectedItems: [],
    categoryStats: {
      all: 0,
      top: 0,
      bottom: 0,
      dress: 0,
      outerwear: 0,
      shoes: 0,
      accessory: 0
    },
    categories: ['上衣', '下装', '裙子', '外套', '鞋子', '配饰'],
    categoryIndex: 0,
    showAddModal: false,
    tempClothing: {
      image: '',
      name: '',
      category: '',
      tags: []
    }
  },

  onLoad: function (options) {
    this.initPage()
  },

  onShow: function () {
    this.setCurrentSeason()
    this.loadClothingData()
  },

  onPullDownRefresh: function () {
    this.loadClothingData()
    wx.stopPullDownRefresh()
  },

  // 初始化页面
  initPage: function () {
    this.setCurrentSeason()
    this.loadClothingData()
  },

  // 设置当前季节
  setCurrentSeason: function () {
    this.setData({
      currentSeason: app.globalData.currentSeason
    })
  },

  // 加载衣物数据
  loadClothingData: function () {
    app.showLoading('加载中...')
    
    wx.cloud.database().collection('clothing')
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        app.hideLoading()
        const clothing = res.data.map(item => ({
          id: item._id,
          name: item.name,
          image: item.image,
          category: item.category,
          tags: item.tags || [],
          selected: false,
          createTime: item.createTime
        }))

        this.setData({
          allClothing: clothing,
          filteredClothing: clothing
        })

        this.updateCategoryStats()
      })
      .catch(err => {
        app.hideLoading()
        console.error('加载衣物数据失败:', err)
        // 使用模拟数据
        this.loadMockData()
      })
  },

  // 加载模拟数据
  loadMockData: function () {
    const mockClothing = [
      {
        id: '1',
        name: '白色T恤',
        image: 'https://picsum.photos/200/250?random=1',
        category: 'top',
        tags: ['基础款', '白色', '百搭'],
        selected: false
      },
      {
        id: '2',
        name: '牛仔裤',
        image: 'https://picsum.photos/200/250?random=2',
        category: 'bottom',
        tags: ['休闲', '蓝色', '百搭'],
        selected: false
      },
      {
        id: '3',
        name: '连衣裙',
        image: 'https://picsum.photos/200/250?random=3',
        category: 'dress',
        tags: ['优雅', '碎花', '春夏'],
        selected: false
      },
      {
        id: '4',
        name: '风衣',
        image: 'https://picsum.photos/200/250?random=4',
        category: 'outerwear',
        tags: ['经典', '卡其色', '秋季'],
        selected: false
      },
      {
        id: '5',
        name: '小白鞋',
        image: 'https://picsum.photos/200/250?random=5',
        category: 'shoes',
        tags: ['舒适', '白色', '运动'],
        selected: false
      },
      {
        id: '6',
        name: '丝巾',
        image: 'https://picsum.photos/200/250?random=6',
        category: 'accessory',
        tags: ['优雅', '丝绸', '装饰'],
        selected: false
      }
    ]

    this.setData({
      allClothing: mockClothing,
      filteredClothing: mockClothing
    })

    this.updateCategoryStats()
  },

  // 更新分类统计
  updateCategoryStats: function () {
    const clothing = this.data.allClothing || []
    const stats = {
      all: clothing.length,
      top: clothing.filter(item => item.category === 'top').length,
      bottom: clothing.filter(item => item.category === 'bottom').length,
      dress: clothing.filter(item => item.category === 'dress').length,
      outerwear: clothing.filter(item => item.category === 'outerwear').length,
      shoes: clothing.filter(item => item.category === 'shoes').length,
      accessory: clothing.filter(item => item.category === 'accessory').length
    }

    this.setData({
      categoryStats: stats
    })
  },

  // 选择分类
  selectCategory: function (e) {
    const category = e.currentTarget.dataset.category
    const allClothing = this.data.allClothing || []
    
    let filteredClothing = allClothing
    if (category !== '') {
      filteredClothing = allClothing.filter(item => item.category === category)
    }

    this.setData({
      selectedCategory: category,
      filteredClothing: filteredClothing
    })
  },

  // 选择衣物
  selectClothing: function (e) {
    const item = e.currentTarget.dataset.item
    const index = this.data.filteredClothing.findIndex(c => c.id === item.id)
    
    if (index !== -1) {
      const filteredClothing = [...this.data.filteredClothing]
      filteredClothing[index].selected = !filteredClothing[index].selected
      
      const selectedItems = filteredClothing.filter(item => item.selected)
      
      this.setData({
        filteredClothing: filteredClothing,
        selectedItems: selectedItems
      })
    }
  },

  // 切换选择状态
  toggleSelect: function (e) {
    const id = e.currentTarget.dataset.id
    const index = this.data.filteredClothing.findIndex(item => item.id === id)
    
    if (index !== -1) {
      const filteredClothing = [...this.data.filteredClothing]
      filteredClothing[index].selected = !filteredClothing[index].selected
      
      const selectedItems = filteredClothing.filter(item => item.selected)
      
      this.setData({
        filteredClothing: filteredClothing,
        selectedItems: selectedItems
      })
    }
  },

  // 编辑衣物
  editClothing: function (e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/clothing-edit/clothing-edit?id=${id}`
    })
  },

  // 删除衣物
  deleteClothing: function (e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这件衣物吗？',
      success: (res) => {
        if (res.confirm) {
          this.performDelete(id)
        }
      }
    })
  },

  // 执行删除
  performDelete: function (id) {
    app.showLoading('删除中...')
    
    wx.cloud.database().collection('clothing')
      .doc(id)
      .remove()
      .then(res => {
        app.hideLoading()
        app.showSuccess('删除成功')
        this.loadClothingData()
      })
      .catch(err => {
        app.hideLoading()
        console.error('删除失败:', err)
        app.showError('删除失败，请重试')
      })
  },

  // 创建搭配
  createOutfit: function () {
    if (this.data.selectedItems.length === 0) {
      app.showError('请至少选择一件衣物')
      return
    }

    const selectedItems = this.data.selectedItems.map(item => item.id)
    wx.navigateTo({
      url: `/pages/outfit-create/outfit-create?items=${encodeURIComponent(JSON.stringify(selectedItems))}`
    })
  },

  // 显示添加弹窗
  showAddModal: function () {
    this.setData({
      showAddModal: true,
      tempClothing: {
        image: '',
        name: '',
        category: '',
        tags: []
      }
    })
  },

  // 隐藏添加弹窗
  hideAddModal: function () {
    this.setData({
      showAddModal: false
    })
  },

  // 阻止事件冒泡
  stopPropagation: function () {
    // 空函数，仅用于阻止事件冒泡
  },

  // 从相册选择
  chooseFromAlbum: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.processSelectedImage(res.tempFiles[0].tempFilePath)
      }
    })
  },

  // 拍照
  takePhoto: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.processSelectedImage(res.tempFiles[0].tempFilePath)
      }
    })
  },

  // 处理选中的图片
  processSelectedImage: function (tempFilePath) {
    app.showLoading('处理图片中...')
    
    // 调用云函数进行AI抠图
    wx.cloud.callFunction({
      name: 'removeBackground',
      data: {
        imageUrl: tempFilePath
      }
    })
    .then(res => {
      app.hideLoading()
      if (res.result.success) {
        this.setData({
          'tempClothing.image': res.result.processedImage
        })
        app.showSuccess('图片处理成功')
      } else {
        // 如果抠图失败，使用原图
        this.setData({
          'tempClothing.image': tempFilePath
        })
        app.showError('抠图失败，使用原图')
      }
    })
    .catch(err => {
      app.hideLoading()
      console.error('图片处理失败:', err)
      // 使用原图
      this.setData({
        'tempClothing.image': tempFilePath
      })
    })
  },

  // 输入名称
  onNameInput: function (e) {
    this.setData({
      'tempClothing.name': e.detail.value
    })
  },

  // 选择分类
  onCategoryChange: function (e) {
    const index = e.detail.value
    const categoryMap = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']
    
    this.setData({
      categoryIndex: index,
      'tempClothing.category': categoryMap[index]
    })
  },

  // 添加标签
  addTag: function (e) {
    const tag = e.detail.value.trim()
    if (tag && !this.data.tempClothing.tags.includes(tag)) {
      const tags = [...this.data.tempClothing.tags, tag]
      this.setData({
        'tempClothing.tags': tags
      })
    }
  },

  // 保存衣物
  saveClothing: function () {
    const clothing = this.data.tempClothing
    
    if (!clothing.image) {
      app.showError('请选择图片')
      return
    }
    
    if (!clothing.name.trim()) {
      app.showError('请输入衣物名称')
      return
    }
    
    if (!clothing.category) {
      app.showError('请选择分类')
      return
    }

    app.showLoading('保存中...')
    
    // 上传图片到云存储
    const cloudPath = `clothing/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: clothing.image
    })
    .then(res => {
      // 保存到数据库
      return wx.cloud.database().collection('clothing').add({
        data: {
          name: clothing.name,
          image: res.fileID,
          category: clothing.category,
          tags: clothing.tags,
          createTime: new Date()
        }
      })
    })
    .then(res => {
      app.hideLoading()
      app.showSuccess('添加成功')
      this.hideAddModal()
      this.loadClothingData()
    })
    .catch(err => {
      app.hideLoading()
      console.error('保存失败:', err)
      app.showError('保存失败，请重试')
    })
  },

  // 加载更多衣物
  loadMoreClothing: function () {
    // 实现分页加载逻辑
    console.log('加载更多衣物')
  },

  // 显示筛选弹窗
  showFilterModal: function () {
    wx.showToast({
      title: '筛选功能开发中',
      icon: 'none'
    })
  },

  // 显示排序弹窗
  showSortModal: function () {
    wx.showToast({
      title: '排序功能开发中',
      icon: 'none'
    })
  }
})