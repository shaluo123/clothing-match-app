// 智能推荐路由 - Supabase版本
const express = require('express');
const router = express.Router();
const { 
  supabase, 
  handleSupabaseError, 
  formatResponse, 
  formatErrorResponse 
} = require('../config/supabase');

// 获取推荐搭配
router.post('/', async (req, res) => {
  try {
    const {
      type = 'smart',
      season = '',
      userId = '',
      clothingId = '',
      limit = 10
    } = req.body;

    // 参数验证
    const validTypes = ['smart', 'random', 'seasonal', 'similar'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `不支持的推荐类型，支持的类型: ${validTypes.join(', ')}`
      });
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 50);

    let recommendations = [];

    switch (type) {
      case 'seasonal':
        recommendations = await getSeasonalRecommendations(supabase, season, limitNum);
        break;
      case 'similar':
        if (!clothingId) {
          return res.status(400).json({
            success: false,
            error: '相似推荐需要提供衣物ID'
          });
        }
        recommendations = await getSimilarRecommendations(supabase, clothingId, limitNum);
        break;
      case 'random':
        recommendations = await getRandomRecommendations(supabase, limitNum);
        break;
      case 'smart':
      default:
        recommendations = await getSmartRecommendations(supabase, season, userId, limitNum);
        break;
    }

    res.json(formatResponse(recommendations, null, '推荐获取成功'));

  } catch (error) {
    console.error('获取推荐失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 获取季节性推荐
async function getSeasonalRecommendations(supabase, season, limit) {
  const currentSeason = season || getCurrentSeason();
  
  try {
    // 获取季节性搭配
    const { data: outfits, error: outfitsError } = await supabase
      .from('outfits')
      .select('id, name, description, thumbnail, season, tags, created_at')
      .or(`season.eq.${currentSeason},season.eq.all`)
      .order('created_at', { ascending: false })
      .limit(limit * 2);
    
    if (outfitsError) throw handleSupabaseError(outfitsError);

    // 获取衣物
    const { data: clothing, error: clothingError } = await supabase
      .from('clothing')
      .select('id, name, image, category, tags, created_at')
      .limit(limit * 3);
    
    if (clothingError) throw handleSupabaseError(clothingError);

    return generateRecommendations(outfits || [], clothing || [], currentSeason, limit);
  } catch (error) {
    console.error('获取季节性推荐失败:', error);
    return getDefaultRecommendations(currentSeason).slice(0, limit);
  }
}

// 获取相似推荐
async function getSimilarRecommendations(supabase, clothingId, limit) {
  if (!require('../config/supabase').isValidUUID(clothingId)) {
    throw new Error('无效的衣物ID格式');
  }

  try {
    // 获取目标衣物
    const { data: targetClothing, error: targetError } = await supabase
      .from('clothing')
      .select('*')
      .eq('id', clothingId)
      .single();

    if (targetError) throw handleSupabaseError(targetError);
    if (!targetClothing) throw new Error('衣物不存在');

    const recommendations = [];

    // 获取相同分类的衣物
    const { data: similarClothing, error: similarError } = await supabase
      .from('clothing')
      .select('id, name, image, category, tags')
      .eq('category', targetClothing.category)
      .neq('id', clothingId)
      .limit(limit * 2);

    if (similarError) throw handleSupabaseError(similarError);

    // 添加相似衣物推荐
    for (const item of (similarClothing || []).slice(0, Math.floor(limit / 2))) {
      recommendations.push({
        id: `similar_clothing_${item.id}`,
        title: `与 ${targetClothing.name} 相似`,
        description: `同类推荐: ${item.name}`,
        image: item.image,
        type: 'clothing',
        category: item.category,
        tags: item.tags || [],
        reason: 'similar_category',
        confidence: 0.8
      });
    }

    // 获取包含此衣物的搭配
    const { data: outfits, error: outfitsError } = await supabase
      .from('outfits')
      .select('id, name, thumbnail, season, tags, items')
      .contains('items', [clothingId])
      .limit(limit);

    if (outfitsError) throw handleSupabaseError(outfitsError);

    // 添加搭配推荐
    for (const outfit of (outfits || [])) {
      const otherItems = (outfit.items || []).filter(id => id !== clothingId);
      if (otherItems.length > 0) {
        const { data: otherClothing, error: otherError } = await supabase
          .from('clothing')
          .select('name')
          .eq('id', otherItems[0])
          .single();

        if (otherError) {
          console.warn('获取其他衣物信息失败:', otherError.message);
          continue;
        }

        recommendations.push({
          id: `outfit_match_${outfit.id}`,
          title: outfit.name,
          description: `与 ${targetClothing.name} 搭配: ${otherClothing?.name || '未知衣物'}`,
          image: outfit.thumbnail,
          type: 'outfit',
          season: outfit.season,
          tags: outfit.tags || [],
          reason: 'outfit_match',
          confidence: 0.9
        });
      }
    }

    return recommendations.slice(0, limit);

  } catch (error) {
    console.error('获取相似推荐失败:', error);
    return getDefaultRecommendations('all').slice(0, limit);
  }
}

// 获取随机推荐
async function getRandomRecommendations(supabase, limit) {
  try {
    // 随机获取衣物和搭配
    const [clothingResult, outfitsResult] = await Promise.all([
      supabase
        .from('clothing')
        .select('id, name, image, category, tags')
        .order('random()')
        .limit(limit),
      supabase
        .from('outfits')
        .select('id, name, description, thumbnail, season, tags')
        .order('random()')
        .limit(limit)
    ]);

    const recommendations = [];
    const clothing = clothingResult.data || [];
    const outfits = outfitsResult.data || [];

    // 添加随机衣物
    clothing.forEach(item => {
      recommendations.push({
        id: `random_clothing_${item.id}`,
        title: item.name,
        description: '随机推荐的衣物',
        image: item.image,
        type: 'clothing',
        category: item.category,
        tags: item.tags || [],
        reason: 'random',
        confidence: 0.5
      });
    });

    // 添加随机搭配
    outfits.forEach(outfit => {
      recommendations.push({
        id: `random_outfit_${outfit.id}`,
        title: outfit.name,
        description: outfit.description || '随机推荐的搭配',
        image: outfit.thumbnail,
        type: 'outfit',
        season: outfit.season,
        tags: outfit.tags || [],
        reason: 'random',
        confidence: 0.5
      });
    });

    return recommendations.slice(0, limit);

  } catch (error) {
    console.error('获取随机推荐失败:', error);
    return getDefaultRecommendations('all').slice(0, limit);
  }
}

// 获取智能推荐
async function getSmartRecommendations(supabase, season, userId, limit) {
  const currentSeason = season || getCurrentSeason();
  
  try {
    // 获取当季搭配
    const { data: seasonalOutfits, error: outfitsError } = await supabase
      .from('outfits')
      .select('id, name, description, thumbnail, season, tags, created_at')
      .or(`season.eq.${currentSeason},season.eq.all`)
      .order('created_at', { ascending: false })
      .limit(limit * 2);

    if (outfitsError) throw handleSupabaseError(outfitsError);

    // 获取热门衣物
    const { data: popularClothing, error: clothingError } = await supabase
      .from('clothing')
      .select('id, name, image, category, tags, created_at')
      .order('random()')
      .limit(limit * 3);

    if (clothingError) throw handleSupabaseError(clothingError);

    // 分析标签频率
    const tagFrequency = {};
    const allTags = [...(seasonalOutfits || []), ...(popularClothing || [])]
      .flatMap(item => item.tags || []);
    allTags.forEach(tag => {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    });

    // 生成智能推荐
    const recommendations = [];
    const used = new Set();

    // 优先推荐当季搭配
    for (const outfit of seasonalOutfits || []) {
      if (recommendations.length >= limit) break;
      if (used.has(outfit.id)) continue;

      const score = calculateRecommendationScore(outfit, currentSeason, tagFrequency);
      recommendations.push({
        id: `smart_outfit_${outfit.id}`,
        title: outfit.name,
        description: outfit.description || `适合${getSeasonName(currentSeason)}的搭配`,
        image: outfit.thumbnail,
        type: 'outfit',
        season: outfit.season,
        tags: outfit.tags || [],
        reason: 'seasonal_match',
        confidence: score
      });

      used.add(outfit.id);
    }

    // 补充衣物推荐
    for (const clothing of popularClothing || []) {
      if (recommendations.length >= limit) break;
      if (used.has(clothing.id)) continue;

      const score = calculateRecommendationScore(clothing, currentSeason, tagFrequency);
      recommendations.push({
        id: `smart_clothing_${clothing.id}`,
        title: clothing.name,
        description: `适合${getSeasonName(currentSeason)}的单品`,
        image: clothing.image,
        type: 'clothing',
        category: clothing.category,
        tags: clothing.tags || [],
        reason: 'seasonal_item',
        confidence: score
      });

      used.add(clothing.id);
    }

    // 按置信度排序
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return recommendations.slice(0, limit);

  } catch (error) {
    console.error('获取智能推荐失败:', error);
    return getDefaultRecommendations(currentSeason).slice(0, limit);
  }
}

// 计算推荐分数
function calculateRecommendationScore(item, currentSeason, tagFrequency) {
  let score = 0.5;

  // 季节匹配加分
  if (item.season === currentSeason || item.season === 'all') {
    score += 0.3;
  }

  // 标签热门度加分
  if (item.tags && Array.isArray(item.tags)) {
    item.tags.forEach(tag => {
      if (tagFrequency[tag] > 0) {
        score += Math.min(tagFrequency[tag] * 0.01, 0.2);
      }
    });
  }

  // 最近创建的加分
  if (item.created_at) {
    const daysSinceCreation = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}

// 生成推荐结果
function generateRecommendations(outfits, clothing, season, limit) {
  const recommendations = [];
  let count = 0;

  // 添加搭配推荐
  for (const outfit of outfits) {
    if (count >= limit) break;
    
    recommendations.push({
      id: `seasonal_outfit_${outfit.id}`,
      title: outfit.name,
      description: outfit.description || `${getSeasonName(season)}推荐搭配`,
      image: outfit.thumbnail,
      type: 'outfit',
      season: outfit.season,
      tags: outfit.tags || [],
      reason: 'seasonal',
      confidence: 0.8
    });
    count++;
  }

  // 添加衣物推荐
  for (const item of clothing) {
    if (count >= limit) break;
    
    recommendations.push({
      id: `seasonal_clothing_${item.id}`,
      title: item.name,
      description: `${getSeasonName(season)}推荐单品`,
      image: item.image,
      type: 'clothing',
      category: item.category,
      tags: item.tags || [],
      reason: 'seasonal',
      confidence: 0.7
    });
    count++;
  }

  return recommendations.slice(0, limit);
}

// 获取当前季节
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 获取季节名称
function getSeasonName(season) {
  const names = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
    all: '全年'
  };
  return names[season] || '未知';
}

// 获取默认推荐
function getDefaultRecommendations(season) {
  const defaults = [
    {
      id: 'default_1',
      title: '经典搭配',
      description: '简约而不简单的经典搭配',
      image: 'https://picsum.photos/300/400?random=1',
      type: 'outfit',
      season: 'all',
      tags: ['经典', '百搭'],
      reason: 'default',
      confidence: 0.6
    },
    {
      id: 'default_2',
      title: '休闲风格',
      description: '舒适自在的休闲穿搭',
      image: 'https://picsum.photos/300/400?random=2',
      type: 'outfit',
      season: 'all',
      tags: ['休闲', '舒适'],
      reason: 'default',
      confidence: 0.6
    },
    {
      id: 'default_3',
      title: '正式场合',
      description: '优雅得体的正式装扮',
      image: 'https://picsum.photos/300/400?random=3',
      type: 'outfit',
      season: 'all',
      tags: ['正式', '优雅'],
      reason: 'default',
      confidence: 0.6
    }
  ];

  // 根据季节过滤
  if (season && season !== 'all') {
    return defaults.filter(item => item.season === season || item.season === 'all');
  }

  return defaults;
}

// 获取推荐统计
router.get('/stats', async (req, res) => {
  try {
    // 总数统计
    const { count: clothingCount, error: clothingError } = await supabase
      .from('clothing')
      .select('*', { count: 'exact', head: true });
    
    if (clothingError) throw handleSupabaseError(clothingError);

    const { count: outfitCount, error: outfitError } = await supabase
      .from('outfits')
      .select('*', { count: 'exact', head: true });
    
    if (outfitError) throw handleSupabaseError(outfitError);

    // 按季节统计
    const { data: seasonData, error: seasonError } = await supabase
      .rpc('get_outfit_season_stats');
    
    if (seasonError) throw handleSupabaseError(seasonError);

    const seasonDistribution = (seasonData || []).reduce((acc, item) => {
      acc[item.season || 'unknown'] = item.count;
      return acc;
    }, {});

    res.json(formatResponse({
      totalClothing: clothingCount || 0,
      totalOutfits: outfitCount || 0,
      currentSeason: getCurrentSeason(),
      seasonDistribution,
      recommendationTypes: ['smart', 'seasonal', 'similar', 'random'],
      lastUpdated: new Date().toISOString()
    }));

  } catch (error) {
    console.error('获取推荐统计失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

module.exports = router;
