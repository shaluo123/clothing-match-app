// 衣物管理路由 - Supabase版本
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
const validateClothingInput = (req, res, next) => {
  const { name, category, tags } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    const { statusCode, response } = formatErrorResponse(
      new Error('衣物名称不能为空且必须是字符串'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (name.trim().length > 50) {
    const { statusCode, response } = formatErrorResponse(
      new Error('衣物名称不能超过50个字符'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (!category || typeof category !== 'string') {
    const { statusCode, response } = formatErrorResponse(
      new Error('衣物分类不能为空且必须是字符串'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  const validCategories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory'];
  if (!validCategories.includes(category)) {
    const { statusCode, response } = formatErrorResponse(
      new Error(`无效的分类，支持的分类: ${validCategories.join(', ')}`), 
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
  
  if (tags && tags.length > 10) {
    const { statusCode, response } = formatErrorResponse(
      new Error('标签数量不能超过10个'), 
      req
    );
    return res.status(statusCode).json(response);
  }
  
  if (tags) {
    for (const tag of tags) {
      if (tag.length > 20) {
        const { statusCode, response } = formatErrorResponse(
          new Error('标签长度不能超过20个字符'), 
          req
        );
        return res.status(statusCode).json(response);
      }
    }
  }
  
  next();
};

// 获取衣物列表
router.get('/', async (req, res) => {
  try {
    const { page, limit, offset } = processPaginationParams(req);
    const { sortBy, ascending } = processSortingParams(req, 'created_at');
    const { category, tags } = req.query;

    // 构建查询
    let query = supabase.from('clothing').select('*', { count: 'exact' });
    
    // 分类筛选
    if (category && category !== 'all') {
      query = query.eq('category', category);
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
    const { data: clothing, error, count } = await query;

    if (error) {
      throw handleSupabaseError(error);
    }

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

    res.json(formatResponse(clothing, pagination));

  } catch (error) {
    console.error('获取衣物列表失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 获取单个衣物详情
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

    const { data: clothing, error } = await supabase
      .from('clothing')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!clothing) {
      const { statusCode, response } = formatErrorResponse(
        new Error('衣物不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    res.json(formatResponse(clothing));

  } catch (error) {
    console.error('获取衣物详情失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 创建新衣物
router.post('/', validateClothingInput, async (req, res) => {
  try {
    const { name, category, image, tags = [] } = req.body;

    const newClothing = {
      name: name.trim(),
      category,
      image: image || '',
      tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('clothing')
      .insert(newClothing)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    res.status(201).json(formatResponse(data, null, '衣物创建成功'));

  } catch (error) {
    console.error('创建衣物失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 更新衣物
router.put('/:id', validateClothingInput, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, image, tags } = req.body;
    
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
      category,
      updated_at: new Date().toISOString()
    };

    if (image !== undefined) {
      updateData.image = image;
    }

    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [];
    }

    const { data, error } = await supabase
      .from('clothing')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!data) {
      const { statusCode, response } = formatErrorResponse(
        new Error('衣物不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    res.json(formatResponse(data, null, '衣物更新成功'));

  } catch (error) {
    console.error('更新衣物失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 删除衣物
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
      .from('clothing')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error);
    }

    if (!data) {
      const { statusCode, response } = formatErrorResponse(
        new Error('衣物不存在'), 
        req
      );
      return res.status(404).json(response);
    }

    res.json(formatResponse(null, null, '衣物删除成功'));

  } catch (error) {
    console.error('删除衣物失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 批量操作衣物
router.post('/batch', async (req, res) => {
  try {
    const { operation, ids, tags, category } = req.body;
    
    if (!operation || !Array.isArray(ids) || ids.length === 0) {
      const { statusCode, response } = formatErrorResponse(
        new Error('操作类型和ID数组不能为空'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    // 验证ID格式
    const validIds = ids.filter(id => require('../config/supabase').isValidUUID(id));
    if (validIds.length !== ids.length) {
      const { statusCode, response } = formatErrorResponse(
        new Error('包含无效的ID格式'), 
        req
      );
      return res.status(statusCode).json(response);
    }

    let result;

    switch (operation) {
      case 'delete':
        const { data: deletedData, error: deleteError } = await supabase
          .from('clothing')
          .delete()
          .in('id', validIds)
          .select();
        
        if (deleteError) throw handleSupabaseError(deleteError);
        result = deletedData;
        break;
        
      case 'update-tags':
        if (!Array.isArray(tags)) {
          const { statusCode, response } = formatErrorResponse(
            new Error('标签必须是数组'), 
            req
          );
          return res.status(statusCode).json(response);
        }
        
        const { data: updatedTagsData, error: tagsError } = await supabase
          .from('clothing')
          .update({ 
            tags: tags.filter(tag => tag.trim()),
            updated_at: new Date().toISOString()
          })
          .in('id', validIds)
          .select();
        
        if (tagsError) throw handleSupabaseError(tagsError);
        result = updatedTagsData;
        break;
        
      case 'move-category':
        if (!category) {
          const { statusCode, response } = formatErrorResponse(
            new Error('目标分类不能为空'), 
            req
          );
          return res.status(statusCode).json(response);
        }
        
        const { data: updatedCategoryData, error: categoryError } = await supabase
          .from('clothing')
          .update({ 
            category,
            updated_at: new Date().toISOString()
          })
          .in('id', validIds)
          .select();
        
        if (categoryError) throw handleSupabaseError(categoryError);
        result = updatedCategoryData;
        break;
        
      default:
        const { statusCode, response } = formatErrorResponse(
          new Error('不支持的操作类型，支持: delete, update-tags, move-category'), 
          req
        );
        return res.status(statusCode).json(response);
    }

    res.json(formatResponse(result, null, `批量${operation}操作成功`));

  } catch (error) {
    console.error('批量操作失败:', error);
    const { statusCode, response } = formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

module.exports = router;