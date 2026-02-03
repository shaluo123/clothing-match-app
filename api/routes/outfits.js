// 搭配管理路由 - Supabase版本
const express = require('express');
const router = express.Router();
const { 
  supabase, 
  handleSupabaseError, 
  processPaginationParams, 
  processSortingParams, 
  buildSearchQuery, 
  formatResponse, 
  formatErrorResponse 
} = require('../config/supabase');

// 输入验证中间件
const validateOutfitInput = (req, res, next) => {
  const { name, items, tags, season } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const { statusCode, response } = formatErrorResponse(
      new Error('搭配名称不能为空且必须是字符串'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (name.trim().length > 50) {
    const { statusCode, response } = formatErrorResponse(
      new Error('搭配名称不能超过50个字符'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    const { statusCode, response } = formatErrorResponse(
      new Error('搭配必须包含至少一件衣物'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (items.length > 10) {
    const { statusCode, response } = formatErrorResponse(
      new Error('搭配中的衣物数量不能超过10件'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (tags && (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string'))) {
    const { statusCode, response } = formatErrorResponse(
      new Error('标签必须是字符串数组'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  const validSeasons = ['spring', 'summer', 'autumn', 'winter', 'all'];
  if (season && !validSeasons.includes(season)) {
    const { statusCode, response } = formatErrorResponse(
      new Error(`无效的季节，支持的季节: ${validSeasons.join(', ')}`), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  next();
};

// 获取搭配列表
router.get('/', async (req, res) => {
  try {
    const { page, limit, offset } = processPaginationParams(req);
    const { sortBy, ascending } = processSortingParams(req, 'created_at');
    const { season, tags } = req.query;

    // 构建查询
    let query = supabase
      .from('outfits')
      .select(`
        *,
        clothing_items (
          id,
          name,
          image,
          category,
          tags
        )
      `, { count: 'exact' });
    
    // 季节筛选
    if (season && season !== 'all') {
      query = query.eq('season', season);
    }
    
    // 标签筛选
    if (tags) {
      const tagArray = tags.split(',').filter(tag => tag.trim());
      if (tagArray.length > 0) {
        query = query.contains('tags', tagArray);
      }
    }
    
    // 搜索筛选
    const searchQuery = req.query.q;
    if (searchQuery) {
      query = buildSearchQuery(query, searchQuery);
    }
    
    // 排序和分页
    query = query
      .order(sortBy, { ascending })
      .range(offset, offset + limit - 1);

    // 执行查询
    const { data: outfits, error, count } = await query;

    if (error) {
      throw handleSupabaseError(error);
    }

    // 处理返回数据格式
    const processedOutfits = outfits.map(outfit => ({
      ...outfit,
      items: outfit.clothing_items || [],
      itemCount: (outfit.clothing_items || []).length,
      // 移除内嵌的clothing_items字段，避免混淆
      clothing_items: undefined
    }));

    // 构建分页信息
    const totalPages = Math.ceil((count || 0) / limit);
    const pagination = {
      page,
      limit,
      total: count || 0,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };

    res.json(formatResponse(processedOutfits, pagination));

  } catch (error) {
    console.error('获取搭配列表失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 获取单个搭配详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证UUID格式
    if (!require('../config/supabase').isValidUUID(id)) {
      const { statusCode, response } = formatErrorResponse(
        new Error('无效的ID格式'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    const { data: outfit, error } = await supabase
      .from('outfits')
      .select(`
        *,
        clothing_items (
          id,
          name,
          image,
          category,
          tags,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!outfit) {
      const { statusCode, response } = formatErrorResponse(
        new Error('搭配不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    // 处理返回数据格式
    const processedOutfit = {
      ...outfit,
      items: outfit.clothing_items || [],
      // 移除内嵌的clothing_items字段，避免混淆
      clothing_items: undefined
    };

    res.json(formatResponse(processedOutfit));

  } catch (error) {
    console.error('获取搭配详情失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 创建新搭配
router.post('/', validateOutfitInput, async (req, res) => {
  try {
    const { name, description, items, tags = [], season = 'all' } = req.body;

    // 验证衣物ID是否存在
    const validItemIds = [];
    for (const itemId of items) {
      if (require('../config/supabase').isValidUUID(itemId)) {
        const { data: clothing } = await supabase
          .from('clothing')
          .select('id')
          .eq('id', itemId)
          .single();
        
        if (clothing) {
          validItemIds.push(itemId);
        }
      }
    }

    if (validItemIds.length === 0) {
      const { statusCode, response } = formatErrorResponse(
        new Error('没有找到有效的衣物'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    // 生成缩略图（使用第一件衣物的图片）
    let thumbnail = '';
    if (validItemIds.length > 0) {
      const { data: firstClothing } = await supabase
        .from('clothing')
        .select('image')
        .eq('id', validItemIds[0])
        .single();
      thumbnail = firstClothing?.image || '';
    }

    const newOutfit = {
      name: name.trim(),
      description: description?.trim() || '',
      items: validItemIds,
      tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
      season,
      thumbnail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('outfits')
      .insert(newOutfit)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    res.status(201).json(formatResponse(data, null, '搭配创建成功'));

  } catch (error) {
    console.error('创建搭配失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 更新搭配
router.put('/:id', validateOutfitInput, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, items, tags, season } = req.body;
    
    // 验证UUID格式
    if (!require('../config/supabase').isValidUUID(id)) {
      const { statusCode, response } = formatErrorResponse(
        new Error('无效的ID格式'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    const updateData = {
      name: name.trim(),
      updated_at: new Date().toISOString()
    };

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (season !== undefined) {
      updateData.season = season;
    }

    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [];
    }

    // 验证并更新衣物ID
    if (items !== undefined) {
      const validItemIds = [];
      for (const itemId of items) {
        if (require('../config/supabase').isValidUUID(itemId)) {
          const { data: clothing } = await supabase
            .from('clothing')
            .select('id')
            .eq('id', itemId)
            .single();
          
          if (clothing) {
            validItemIds.push(itemId);
          }
        }
      }
      updateData.items = validItemIds;

      // 更新缩略图
      if (validItemIds.length > 0) {
        const { data: firstClothing } = await supabase
          .from('clothing')
          .select('image')
          .eq('id', validItemIds[0])
          .single();
        updateData.thumbnail = firstClothing?.image || '';
      }
    }

    const { data, error } = await supabase
      .from('outfits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!data) {
      const { statusCode, response } = formatErrorResponse(
        new Error('搭配不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    res.json(formatResponse(data, null, '搭配更新成功'));
  } catch (error) {
    console.error('更新搭配失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 删除搭配
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证UUID格式
    if (!require('../config/supabase').isValidUUID(id)) {
      const { statusCode, response } = formatErrorResponse(
        new Error('无效的ID格式'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    const { data, error } = await supabase
      .from('outfits')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!data) {
      const { statusCode, response } = formatErrorResponse(
        new Error('搭配不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    res.json(formatResponse(null, null, '搭配删除成功'));
  } catch (error) {
    console.error('删除搭配失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 获取搭配统计
router.get('/stats/overview', async (req, res) => {
  try {
    // 总数统计
    const { count: totalOutfits, error: countError } = await supabase
      .from('outfits')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw handleSupabaseError(countError);

    // 按季节统计
    const { data: seasonData, error: seasonError } = await supabase
      .rpc('get_outfit_season_stats');
    
    if (seasonError) throw handleSupabaseError(seasonError);

    const bySeason = seasonData?.reduce((acc, item) => {
      acc[item.season || 'unknown'] = item.count;
      return acc;
    }, {}) || {};

    // 按标签统计（前10个常用标签）
    const { data: tagData, error: tagError } = await supabase
      .rpc('get_outfit_tag_stats');
    
    if (tagError) throw handleSupabaseError(tagError);

    const popularTags = tagData?.map(item => ({
      tag: item.tag,
      count: item.count
    })) || [];

    // 最近创建的搭配
    const { data: recentOutfits, error: recentError } = await supabase
      .from('outfits')
      .select('id, name, thumbnail, season, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) throw handleSupabaseError(recentError);

    const stats = {
      total: totalOutfits || 0,
      bySeason,
      popularTags,
      recentOutfits: recentOutfits.map(outfit => ({
        id: outfit.id,
        name: outfit.name,
        thumbnail: outfit.thumbnail,
        season: outfit.season,
        createTime: outfit.created_at
      }))
    };

    res.json(formatResponse(stats));

  } catch (error) {
    console.error('获取搭配统计失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

module.exports = router;