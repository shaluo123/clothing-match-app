// 免费部署模式的衣橱页面
const app = getApp()

Page({
  data: {
    currentSeason: '',
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
    },
    serviceStatus: null
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
    const currentSeason = app.globalData.currentSeason
    this.setData({
      currentSeason: currentSeason
    })
  },

  // 加载衣物数据
  loadClothingData: function () {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    // 使用免费API服务获取衣物列表
    app.callApi('getClothingList', {
      page: 1,
      limit: 50
    })
    .then(result => {
      wx.hideLoading()
      
      if (result.success) {
        const clothing = result.data.map(item => ({
          id: item._id || item.id,
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
      } else {
        // 使用模拟数据
        this.loadMockData()
      }
    })
    .catch(error => {
      wx.hideLoading()
      console.error('加载衣物数据失败:', error)
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
      const categoryMap = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory']
      const index = categoryMap.indexOf(category)
      const categoryName = this.data.categories[index]
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
    wx.showToast({
      title: '编辑功能开发中',
      icon: 'none'
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
    wx.showLoading({
      title: '删除中...',
      mask: true
    })

    // 使用免费API服务删除衣物
    app.callApi('deleteClothing', id)
      .then(result => {
        wx.hideLoading()
        
        if (result.success) {
          app.showSuccess('删除成功')
          this.loadClothingData()
        } else {
          app.showError('删除失败')
        }
      })
      .catch(error => {
        wx.hideLoading()
        console.error('删除失败:', error)
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
    wx.showLoading({
      title: '处理图片中...',
      mask: true
    })

    // 使用免费API服务进行AI抠图
    app.callApi('removeBackground', tempFilePath)
      .then(result => {
        wx.hideLoading()
        
        if (result.success) {
          this.setData({
            'tempClothing.image': result.processedImage
          })
          app.showSuccess('图片处理成功')
        } else {
          // 如果抠图失败，使用原图
          this.setData({
            'tempClothing.image': tempFilePath
          })
          app.showSuccess('使用原图')
        }
      })
      .catch(error => {
        wx.hideLoading()
        console.error('图片处理失败:', error)
        
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

    // 先上传图片
    wx.showLoading({
      title: '保存中...',
      mask: true
    })

    app.callApi('uploadFile', clothing.image, { type: 'clothing-image' })
      .then(uploadResult => {
        if (uploadResult.success) {
          // 然后保存衣物信息
          const clothingData = {
            name: clothing.name.trim(),
            image: uploadResult.url,
            category: clothing.category,
            tags: clothing.tags
          }

          return app.callApi('saveClothing', clothingData)
        } else {
          throw new Error(uploadResult.error || '上传失败')
        }
      })
      .then(result => {
        wx.hideLoading()
        
        if (result.success) {
          app.showSuccess('添加成功')
          this.hideAddModal()
          this.loadClothingData()
        } else {
          app.showError('保存失败')
        }
      })
      .catch(error => {
        wx.hideLoading()
        console.error('保存失败:', error)
        app.showError('保存失败，请重试')
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
  }
})