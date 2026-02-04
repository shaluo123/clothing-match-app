// 搜索功能路由 - Supabase版本
const express = require('express');
const wrapServerless = require('../utils/serverless-wrapper');

const router = express.Router();
const { 
  supabase, 
  handleSupabaseError, 
  processPaginationParams, 
  formatResponse, 
  formatErrorResponse 
} = require('../config/supabase');

// 搜索接口 - 使用Supabase全文搜索
router.get('/', async (req, res) => {
  try {
    const {
      q = '',          // 搜索关键词
      type = 'all',    // 搜索类型: clothing, outfits, all
      limit = 50,      // 返回数量限制
      page = 1,        // 页码
      category = '',   // 衣物分类
      season = '',     // 季节
      tags = '',       // 标签
      sortBy = 'relevance', // 排序方式
      sortOrder = 'desc'     // 排序顺序
    } = req.query;

    // 参数验证
    if (!q || q.trim().length === 0) {
      const { statusCode, response } = formatErrorResponse(
        new Error('搜索关键词不能为空'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    const keyword = q.trim();
    const { page: pageNum, limit: limitNum } = processPaginationParams(req);
    const finalLimit = Math.min(limitNum, 100);

    // 构建搜索结果
    let results = [];
    const searchPromises = [];

    // 搜索衣物
    if (type === 'all' || type === 'clothing') {
      searchPromises.push(searchClothingWithSupabase(keyword, {
        category,
        tags,
        limit: finalLimit,
        page: pageNum,
        sortBy
      }));
    }

    // 搜索搭配
    if (type === 'all' || type === 'outfits') {
      searchPromises.push(searchOutfitsWithSupabase(keyword, {
        season,
        tags,
        limit: finalLimit,
        page: pageNum,
        sortBy
      }));
    }

    // 执行搜索
    const searchResults = await Promise.all(searchPromises);

    // 合并结果
    searchResults.forEach(result => {
      if (result && result.data) {
        results.push(...result.data);
      }
    });

    // 按相关性排序
    if (sortBy === 'relevance') {
      results = sortResultsByRelevance(results, keyword);
    }

    // 分页处理
    const startIndex = (pageNum - 1) * finalLimit;
    const endIndex = startIndex + finalLimit;
    const paginatedResults = results.slice(startIndex, endIndex);

    // 统计信息
    const stats = {
      total: results.length,
      clothing: results.filter(item => item.type === 'clothing').length,
      outfits: results.filter(item => item.type === 'outfit').length
    };

    res.json(formatResponse(paginatedResults, {
      query: {
        keyword,
        type,
        page: pageNum,
        limit: finalLimit
      },
      stats,
      pagination: {
        page: pageNum,
        limit: finalLimit,
        total: results.length,
        pages: Math.ceil(results.length / finalLimit),
        hasNext: pageNum * finalLimit < results.length,
        hasPrev: pageNum > 1
      },
      searchTime: Date.now() - req.requestTime
    }));

  } catch (error) {
    console.error('搜索失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 使用Supabase全文搜索衣物
async function searchClothingWithSupabase(keyword, options) {
  try {
    const { category, tags, limit, page, sortBy } = options;
    
    // 使用Supabase的全文搜索
    let query = supabase
      .from('clothing')
      .select('id, name, image, category, tags, created_at, updated_at');
    
    // 添加分类筛选
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    // 使用文本搜索
    query = query.or(`name.ilike.%${keyword}%,tags.cs.{${keyword}}`);
    
    // 添加标签筛选
    if (tags) {
      const tagArray = tags.split(',').filter(tag => tag.trim());
      if (tagArray.length > 0) {
        query = query.contains('tags', tagArray);
      }
    }
    
    // 分页
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    // 排序
    switch (sortBy) {
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'created_at':
        query = query.order('created_at', { ascending: false });
        break;
      case 'relevance':
      default:
        // 按创建时间排序作为默认
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase衣物搜索失败:', error);
      return { data: [], type: 'clothing' };
    }

    const scoredClothing = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      image: item.image,
      category: item.category,
      tags: item.tags || [],
      type: 'clothing',
      score: calculateRelevanceScore(item, keyword),
      createTime: item.created_at,
      updateTime: item.updated_at,
      highlights: generateHighlights(item, keyword)
    }));

    return {
      data: scoredClothing,
      type: 'clothing'
    };

  } catch (error) {
    console.error('搜索衣物失败:', error);
    return { data: [], type: 'clothing' };
  }
}

// 使用Supabase全文搜索搭配
async function searchOutfitsWithSupabase(keyword, options) {
  try {
    const { season, tags, limit, page, sortBy } = options;
    
    // 构建查询
    let query = supabase
      .from('outfits')
      .select('id, name, description, thumbnail, season, tags, items, created_at, updated_at');
    
    // 文本搜索
    query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%,tags.cs.{${keyword}}`);
    
    // 添加季节筛选
    if (season && season !== 'all') {
      query = query.eq('season', season);
    }
    
    // 添加标签筛选
    if (tags) {
      const tagArray = tags.split(',').filter(tag => tag.trim());
      if (tagArray.length > 0) {
        query = query.contains('tags', tagArray);
      }
    }
    
    // 分页
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    // 排序
    switch (sortBy) {
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'created_at':
        query = query.order('created_at', { ascending: false });
        break;
      case 'relevance':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase搭配搜索失败:', error);
      return { data: [], type: 'outfit' };
    }

    // 获取搭配中的衣物详情
    const scoredOutfits = await Promise.all(
      (data || []).map(async (outfit) => {
        const score = calculateRelevanceScore(outfit, keyword);
        
        // 获取衣物信息
        const clothingDetails = [];
        if (outfit.items && outfit.items.length > 0) {
          const items = outfit.items.slice(0, 3);
          for (const itemId of items) {
            try {
              const { data: clothing, error: clothingError } = await supabase
                .from('clothing')
                .select('id, name, image, category')
                .eq('id', itemId)
                .single();
              
              if (clothingError) {
                console.warn(`获取衣物详情失败 (${itemId}):`, clothingError.message);
                continue;
              }
              
              if (clothing) {
                clothingDetails.push({
                  id: clothing.id,
                  name: clothing.name,
                  image: clothing.image,
                  category: clothing.category
                });
              }
            } catch (error) {
              console.error(`获取衣物详情失败 (${itemId}):`, error);
            }
          }
        }

        return {
          id: outfit.id,
          name: outfit.name,
          description: outfit.description || '',
          items: clothingDetails,
          tags: outfit.tags || [],
          season: outfit.season || 'all',
          thumbnail: outfit.thumbnail || '',
          type: 'outfit',
          score,
          createTime: outfit.created_at,
          updateTime: outfit.updated_at,
          highlights: generateHighlights(outfit, keyword),
          itemCount: (outfit.items || []).length
        };
      })
    );

    return {
      data: scoredOutfits,
      type: 'outfit'
    };

  } catch (error) {
    console.error('搜索搭配失败:', error);
    return { data: [], type: 'outfit' };
  }
}

// 计算相关性分数
function calculateRelevanceScore(item, keyword) {
  let score = 0;
  const keywordLower = keyword.toLowerCase();

  // 名称匹配（权重最高）
  if (item.name) {
    if (item.name.toLowerCase() === keywordLower) {
      score += 100;
    } else if (item.name.toLowerCase().includes(keywordLower)) {
      score += 50;
    }
  }

  // 描述匹配
  if (item.description && item.description.toLowerCase().includes(keywordLower)) {
    score += 30;
  }

  // 标签匹配
  if (item.tags && Array.isArray(item.tags)) {
    item.tags.forEach(tag => {
      if (tag.toLowerCase() === keywordLower) {
        score += 40;
      } else if (tag.toLowerCase().includes(keywordLower)) {
        score += 20;
      }
    });
  }

  // 分类匹配
  if (item.category && item.category.toLowerCase().includes(keywordLower)) {
    score += 35;
  }

  // 季节匹配
  if (item.season && item.season.toLowerCase().includes(keywordLower)) {
    score += 25;
  }

  return score;
}

// 生成搜索高亮
function generateHighlights(item, keyword) {
  const highlights = [];
  const keywordLower = keyword.toLowerCase();

  // 名称高亮
  if (item.name && item.name.toLowerCase().includes(keywordLower)) {
    highlights.push({
      field: 'name',
      value: highlightText(item.name, keyword)
    });
  }

  // 描述高亮
  if (item.description && item.description.toLowerCase().includes(keywordLower)) {
    highlights.push({
      field: 'description',
      value: highlightText(item.description, keyword)
    });
  }

  // 标签高亮
  if (item.tags && Array.isArray(item.tags)) {
    const matchedTags = item.tags.filter(tag => 
      tag.toLowerCase().includes(keywordLower)
    );
    if (matchedTags.length > 0) {
      highlights.push({
        field: 'tags',
        value: matchedTags.map(tag => highlightText(tag, keyword))
      });
    }
  }

  return highlights;
}

// 文本高亮处理
function highlightText(text, keyword) {
  if (!text || !keyword) return text;
  
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// 按相关性排序
function sortResultsByRelevance(results, keyword) {
  return results.sort((a, b) => {
    // 首先按分数排序
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    
    // 分数相同时，按类型优先级排序（衣物优先）
    if (a.type !== b.type) {
      return a.type === 'clothing' ? -1 : 1;
    }
    
    // 最后按创建时间排序
    return new Date(b.createTime) - new Date(a.createTime);
  });
}

// 搜索建议接口
router.get('/suggestions', async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json(formatResponse([]));
    }

    const keyword = q.trim();
    const limitNum = Math.min(parseInt(limit) || 10, 20);

    // 获取搜索建议
    const [clothingResult, outfitResult] = await Promise.all([
      // 从衣物名称获取建议
      supabase
        .from('clothing')
        .select('name')
        .ilike('name', `%${keyword}%`)
        .limit(limitNum),
      
      // 从搭配名称获取建议
      supabase
        .from('outfits')
        .select('name')
        .ilike('name', `%${keyword}%`)
        .limit(limitNum)
    ]);

    // 整合建议
    const suggestions = new Set();

    // 添加衣物名称建议
    (clothingResult.data || []).forEach(item => {
      suggestions.add(item.name);
    });

    // 添加搭配名称建议
    (outfitResult.data || []).forEach(item => {
      suggestions.add(item.name);
    });

    // 转换为数组并排序
    const sortedSuggestions = Array.from(suggestions)
      .slice(0, limitNum)
      .sort((a, b) => {
        // 优先显示以关键词开头的
        const aStarts = a.toLowerCase().startsWith(keyword.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(keyword.toLowerCase());
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // 然后按长度排序（短的优先）
        return a.length - b.length;
      });

    res.json(formatResponse(sortedSuggestions, null, '搜索建议获取成功'));

  } catch (error) {
    console.error('获取搜索建议失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 热门搜索接口
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 20);

    // 获取热门标签（从衣物）
    const { data: clothingTags, error: tagsError } = await supabase
      .rpc('get_clothing_tag_stats');
    
    if (tagsError) throw handleSupabaseError(tagsError);

    // 获取最近创建的物品名称
    const { data: recentClothing, error: recentError } = await supabase
      .from('clothing')
      .select('name')
      .order('created_at', { ascending: false })
      .limit(limitNum);
    
    if (recentError) throw handleSupabaseError(recentError);

    const popularSearches = [];

    // 添加热门标签
    (clothingTags || []).forEach(tag => {
      popularSearches.push({
        term: tag.tag,
        type: 'tag',
        count: tag.count
      });
    });

    // 添加最近搜索（从物品名称）
    (recentClothing || []).forEach(item => {
      popularSearches.push({
        term: item.name,
        type: 'item',
        count: 1
      });
    });

    // 排序并限制数量
    const sortedSearches = popularSearches
      .sort((a, b) => b.count - a.count)
      .slice(0, limitNum);

    res.json(formatResponse(sortedSearches, null, '热门搜索获取成功'));

  } catch (error) {
    console.error('获取热门搜索失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

module.exports = router;
module.exports.handler = wrapServerless(router, '/api/search');
