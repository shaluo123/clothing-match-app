// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 智能推荐云函数
exports.main = async (event, context) => {
  const { type, season, userId, clothingId } = event
  
  try {
    let recommendations = []
    
    switch (type) {
      case 'smart':
        recommendations = await getSmartRecommendations(season, userId)
        break
      case 'similar':
        recommendations = await getSimilarRecommendations(clothingId)
        break
      case 'seasonal':
        recommendations = await getSeasonalRecommendations(season)
        break
      default:
        recommendations = await getDefaultRecommendations()
    }
    
    return {
      success: true,
      data: recommendations,
      type: type
    }
    
  } catch (error) {
    console.error('推荐获取失败:', error)
    return {
      success: false,
      error: error.message,
      data: getDefaultRecommendations()
    }
  }
}

// 获取智能推荐
async function getSmartRecommendations(season, userId) {
  const db = cloud.database()
  
  try {
    // 获取用户历史搭配记录
    const outfitHistory = await db.collection('outfits')
      .where({
        _openid: userId
      })
      .orderBy('createTime', 'desc')
      .limit(10)
      .get()
    
    // 获取用户衣物偏好
    const userClothing = await db.collection('clothing')
      .where({
        _openid: userId
      })
      .get()
    
    // 分析用户偏好
    const preferences = analyzeUserPreferences(userClothing.data, outfitHistory.data)
    
    // 生成推荐
    const recommendations = generateRecommendations(preferences, season)
    
    return recommendations
    
  } catch (error) {
    console.error('获取智能推荐失败:', error)
    return getDefaultRecommendations()
  }
}

// 获取相似推荐
async function getSimilarRecommendations(clothingId) {
  const db = cloud.database()
  
  try {
    // 获取目标衣物信息
    const targetClothing = await db.collection('clothing')
      .doc(clothingId)
      .get()
    
    // 查找相似衣物
    const similarClothing = await findSimilarClothing(targetClothing.data)
    
    // 生成搭配建议
    const recommendations = generateMatchingOutfits(targetClothing.data, similarClothing)
    
    return recommendations
    
  } catch (error) {
    console.error('获取相似推荐失败:', error)
    return getDefaultRecommendations()
  }
}

// 获取季节推荐
async function getSeasonalRecommendations(season) {
  const seasonColors = {
    spring: ['#FFB6C1', '#98FB98', '#87CEEB'],
    summer: ['#32CD32', '#87CEFA', '#FFA500'],
    autumn: ['#FF8C00', '#DAA520', '#8B4513'],
    winter: ['#4682B4', '#708090', '#2F4F4F']
  }
  
  const seasonStyles = {
    spring: ['清新', '花卉', '轻薄'],
    summer: ['清爽', '透气', '亮色'],
    autumn: ['温暖', '层次', '深色'],
    winter: ['保暖', '厚重', '暗色']
  }
  
  return {
    season: season,
    colors: seasonColors[season] || [],
    styles: seasonStyles[season] || [],
    recommendations: generateSeasonalOutfits(season)
  }
}

// 获取默认推荐
function getDefaultRecommendations() {
  return [
    {
      id: 'default1',
      title: '经典搭配',
      description: '简约而不简单的经典搭配',
      image: 'https://picsum.photos/300/400?random=100',
      tags: ['经典', '百搭', '简约'],
      season: 'all'
    },
    {
      id: 'default2',
      title: '休闲风格',
      description: '舒适自在的休闲穿搭',
      image: 'https://picsum.photos/300/400?random=101',
      tags: ['休闲', '舒适', '日常'],
      season: 'all'
    },
    {
      id: 'default3',
      title: '正式场合',
      description: '优雅得体的正式装扮',
      image: 'https://picsum.photos/300/400?random=102',
      tags: ['正式', '优雅', '商务'],
      season: 'all'
    }
  ]
}

// 分析用户偏好
function analyzeUserPreferences(clothing, outfits) {
  const preferences = {
    colors: {},
    styles: {},
    categories: {},
    seasons: {}
  }
  
  // 分析衣物偏好
  clothing.forEach(item => {
    // 统计颜色偏好
    if (item.tags) {
      item.tags.forEach(tag => {
        preferences.colors[tag] = (preferences.colors[tag] || 0) + 1
      })
    }
    
    // 统计分类偏好
    preferences.categories[item.category] = (preferences.categories[item.category] || 0) + 1
  })
  
  // 分析搭配偏好
  outfits.forEach(outfit => {
    if (outfit.tags) {
      outfit.tags.forEach(tag => {
        preferences.styles[tag] = (preferences.styles[tag] || 0) + 1
      })
    }
    
    if (outfit.season) {
      preferences.seasons[outfit.season] = (preferences.seasons[outfit.season] || 0) + 1
    }
  })
  
  return preferences
}

// 查找相似衣物
async function findSimilarClothing(targetClothing) {
  const db = cloud.database()
  
  try {
    // 基于分类和标签查找相似衣物
    const similarQuery = db.collection('clothing')
    
    if (targetClothing.category) {
      similarQuery.where({
        category: targetClothing.category,
        _id: db.command.neq(targetClothing._id)
      })
    }
    
    const result = await similarQuery.limit(5).get()
    return result.data
    
  } catch (error) {
    console.error('查找相似衣物失败:', error)
    return []
  }
}

// 生成推荐
function generateRecommendations(preferences, season) {
  const recommendations = []
  
  // 基于颜色偏好生成推荐
  const topColors = Object.entries(preferences.colors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([color]) => color)
  
  // 基于风格偏好生成推荐
  const topStyles = Object.entries(preferences.styles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([style]) => style)
  
  // 生成推荐项目
  for (let i = 0; i < 3; i++) {
    recommendations.push({
      id: `rec_${Date.now()}_${i}`,
      title: `${topStyles[i] || '时尚'}搭配`,
      description: `基于您喜爱的${topColors[i] || '风格'}打造的${season}搭配`,
      image: `https://picsum.photos/300/400?random=${Date.now() + i}`,
      tags: [...topColors, ...topStyles, season].slice(0, 3),
      season: season,
      type: 'personalized'
    })
  }
  
  return recommendations
}

// 生成搭配建议
function generateMatchingOutfits(targetClothing, similarClothing) {
  const recommendations = []
  
  // 基于衣物分类生成搭配规则
  const matchingRules = {
    top: ['bottom', 'outerwear', 'shoes'],
    bottom: ['top', 'shoes'],
    dress: ['shoes', 'accessory'],
    outerwear: ['top', 'bottom', 'shoes'],
    shoes: ['top', 'bottom'],
    accessory: ['top', 'bottom', 'dress']
  }
  
  const targetCategory = targetClothing.category
  const matchingCategories = matchingRules[targetCategory] || []
  
  matchingCategories.forEach((category, index) => {
    recommendations.push({
      id: `match_${Date.now()}_${index}`,
      title: `${targetClothing.name}搭配建议`,
      description: `搭配${category}类衣物，打造完美造型`,
      image: `https://picsum.photos/300/400?random=${Date.now() + index}`,
      tags: [targetClothing.category, category, '搭配建议'],
      type: 'matching',
      baseItem: targetClothing,
      suggestion: category
    })
  })
  
  return recommendations
}

// 生成季节搭配
function generateSeasonalOutfits(season) {
  const seasonalOutfits = {
    spring: [
      {
        id: 'spring1',
        title: '春日清新',
        description: '轻薄透气的春日搭配',
        image: 'https://picsum.photos/300/400?random=200',
        tags: ['清新', '春季', '花卉']
      },
      {
        id: 'spring2',
        title: '春游装扮',
        description: '适合春游的舒适搭配',
        image: 'https://picsum.photos/300/400?random=201',
        tags: ['春游', '舒适', '休闲']
      }
    ],
    summer: [
      {
        id: 'summer1',
        title: '夏日清凉',
        description: '清爽透气的夏日搭配',
        image: 'https://picsum.photos/300/400?random=210',
        tags: ['清凉', '夏季', '透气']
      },
      {
        id: 'summer2',
        title: '海滩度假',
        description: '适合海滩的度假装扮',
        image: 'https://picsum.photos/300/400?random=211',
        tags: ['海滩', '度假', '夏季']
      }
    ],
    autumn: [
      {
        id: 'autumn1',
        title: '秋日温暖',
        description: '温暖舒适的秋日搭配',
        image: 'https://picsum.photos/300/400?random=220',
        tags: ['温暖', '秋季', '层次']
      },
      {
        id: 'autumn2',
        title: '秋游装扮',
        description: '适合秋游的时尚搭配',
        image: 'https://picsum.photos/300/400?random=221',
        tags: ['秋游', '时尚', '秋季']
      }
    ],
    winter: [
      {
        id: 'winter1',
        title: '冬日保暖',
        description: '保暖厚实的冬日搭配',
        image: 'https://picsum.photos/300/400?random=230',
        tags: ['保暖', '冬季', '厚重']
      },
      {
        id: 'winter2',
        title: '节日装扮',
        description: '适合节日的华丽搭配',
        image: 'https://picsum.photos/300/400?random=231',
        tags: ['节日', '华丽', '冬季']
      }
    ]
  }
  
  return seasonalOutfits[season] || []
}