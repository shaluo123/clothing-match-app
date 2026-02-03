// Supabase数据库连接和配置
const { createClient } = require('@supabase/supabase-js');

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 数据库连接测试和健康检查
async function testConnection() {
  try {
    console.log('正在测试Supabase连接...');
    
    // 测试基本连接
    const { data, error } = await supabase
      .from('clothing')
      .select('id', { count: 'exact', head: true });
      
    if (error) {
      console.error('❌ Supabase连接失败:', error.message);
      
      // 如果是表不存在的错误，视为正常（初始化时会创建）
      if (error.code === 'PGRST116' || error.message.includes('relation "clothing" does not exist')) {
        console.log('⚠️ 表不存在，将在初始化时创建');
        return true;
      }
      
      return false;
    }
    
    console.log('✅ Supabase连接成功');
    
    // 测试RPC功能
    try {
      await supabase.rpc('version');
      console.log('✅ RPC功能正常');
    } catch (rpcError) {
      console.warn('⚠️ RPC功能未初始化，将在数据库初始化时设置');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Supabase连接测试失败:', error.message);
    return false;
  }
}

// 初始化数据库表结构
async function initializeDatabase() {
  try {
    console.log('正在初始化Supabase数据库...');
    
    // 检查表是否存在
    const { data: existingTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
      
    const tableNames = existingTables?.map(t => t.table_name) || [];
    console.log('现有表:', tableNames);
    
    // 创建衣物表
    if (!tableNames.includes('clothing')) {
      const { error: clothingError } = await supabase.rpc('create_clothing_table');
      if (clothingError) {
        console.error('创建衣物表失败:', clothingError);
        return false;
      }
      console.log('✅ 衣物表创建成功');
    }
    
    // 创建搭配表
    if (!tableNames.includes('outfits')) {
      const { error: outfitsError } = await supabase.rpc('create_outfits_table');
      if (outfitsError) {
        console.error('创建搭配表失败:', outfitsError);
        return false;
      }
      console.log('✅ 搭配表创建成功');
    }
    
    // 创建搜索索引和函数
    await createSearchIndexes();
    
    // 设置RLS策略
    await setupRLSPolicies();
    
    console.log('✅ Supabase数据库初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    
    // 提供SQL脚本手动执行建议
    if (error.message.includes('function') || error.message.includes('RPC')) {
      console.log('💡 提示: 请在Supabase SQL编辑器中执行 database/init.sql 脚本');
    }
    
    return false;
  }
}

// 创建搜索索引和函数
async function createSearchIndexes() {
  try {
    console.log('正在创建搜索索引...');
    
    // 测试搜索功能
    const { error: testError } = await supabase
      .from('clothing')
      .select('id')
      .textSearch('name', 'test');
      
    if (testError && testError.code === 'PGRST106') {
      console.log('⚠️ 搜索功能需要手动创建索引');
      console.log('💡 请在Supabase SQL编辑器中执行 database/init.sql 中的索引创建语句');
    } else {
      console.log('✅ 搜索功能正常');
    }
    
    return true;
  } catch (error) {
    console.warn('搜索索引检查失败:', error.message);
    return false;
  }
}

// 设置行级安全策略
async function setupRLSPolicies() {
  try {
    console.log('正在设置RLS策略...');
    
    // 检查RLS是否启用
    const { data: rlsStatus } = await supabase
      .from('pg_class')
      .select('relrowsecurity')
      .eq('relname', 'clothing');
      
    if (rlsStatus && rlsStatus.some(t => t.relrowsecurity)) {
      console.log('✅ RLS已启用');
    } else {
      console.log('⚠️ RLS未启用，建议执行 database/init.sql 中的RLS设置');
    }
    
    return true;
  } catch (error) {
    console.warn('RLS策略检查失败:', error.message);
    return false;
  }
}

// 错误处理函数
function handleSupabaseError(error) {
  console.error('Supabase操作失败:', {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
  });
  
  // 转换为标准错误格式
  const standardError = new Error(error.message);
  standardError.code = error.code;
  standardError.status = mapErrorToStatusCode(error);
  standardError.details = error.details;
  
  return standardError;
}

// 映射Supabase错误到HTTP状态码
function mapErrorToStatusCode(error) {
  if (!error) return 500;
  
  switch (error.code) {
    case 'PGRST116': // 没有找到记录
      return 404;
    case 'PGRST204': // 成功但没有内容
      return 204;
    case '23505': // 唯一约束违反
    case '23503': // 外键约束违反
    case '23514': // 检查约束违反
      return 400;
    case '42501': // 权限不足
      return 403;
    case 'PGRST301': // 关系不存在
    case 'PGRST304': // 预条件失败
      return 400;
    default:
      return 500;
  }
}

// 分页参数处理
function processPaginationParams(req) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

// 排序参数处理
function processSortingParams(req, defaultSort = 'created_at') {
  const sortBy = req.query.sortBy || defaultSort;
  const sortOrder = req.query.sortOrder || 'desc';
  const ascending = sortOrder === 'asc';
  
  return { sortBy, ascending };
}

// 构建搜索查询
function buildSearchQuery(baseQuery, searchTerm, searchFields = ['name']) {
  if (!searchTerm || searchTerm.trim() === '') {
    return baseQuery;
  }
  
  // 使用PostgreSQL全文搜索
  const searchColumn = searchFields.join(' || \' \' || ');
  return baseQuery.or(`name.ilike.%${searchTerm}%,tags.cs.{${searchTerm}}`);
}

// 响应格式化
function formatResponse(data, pagination = null, message = null) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  if (pagination) {
    response.pagination = pagination;
  }
  
  if (message) {
    response.message = message;
  }
  
  return response;
}

// 错误响应格式化
function formatErrorResponse(error, req, additionalInfo = {}) {
  const statusCode = error.status || 500;
  const response = {
    success: false,
    error: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };
  
  if (process.env.NODE_ENV === 'development') {
    response.details = error.details || error.stack;
    response.code = error.code;
  }
  
  Object.assign(response, additionalInfo);
  
  return { statusCode, response };
}

// UUID验证
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = {
  supabase,
  testConnection,
  initializeDatabase,
  handleSupabaseError,
  mapErrorToStatusCode,
  processPaginationParams,
  processSortingParams,
  buildSearchQuery,
  formatResponse,
  formatErrorResponse,
  isValidUUID
};