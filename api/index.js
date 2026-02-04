// 衣搭助手后端API - Supabase版本
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// 导入Supabase配置和路由
const { supabase, testConnection, initializeDatabase } = require('./config/supabase');
const clothingRoutes = require('./routes/clothing');
const outfitRoutes = require('./routes/outfits');
const recommendRoutes = require('./routes/recommend');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const healthRoutes = require('./routes/health');

const app = express();

// 安全CORS配置
const allowedOrigins = [
  'https://your-app.vercel.app',
  'https://service-wx.qcloud.com',
  'https://servicewechat.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（如移动应用）
    if (!origin) return callback(null, true);
    
    // 开发环境允许所有origin
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不被CORS策略允许'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 安全中间件
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false, // 小程序需要关闭CSP
  crossOriginEmbedderPolicy: false
}));

// 请求日志和安全中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${clientIP}`);
  
  // 记录请求时间和IP（用于监控）
  req.requestTime = Date.now();
  req.clientIP = clientIP;
  
  // 限制请求大小
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 50 * 1024 * 1024) {
    return res.status(413).json({
      success: false,
      error: '请求体过大'
    });
  }
  
  next();
});

// API响应头设置
app.use((req, res, next) => {
  res.header('X-API-Version', '1.0.0');
  res.header('X-Deployment-Mode', 'free');
  res.header('Cache-Control', 'public, max-age=300'); // 5分钟缓存
  
  next();
});

// 路由注册
app.use('/api/clothing', clothingRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/health', healthRoutes);

// 注意：Supabase文件通过Storage API提供，无需静态文件服务

// 根路径重定向
app.get('/', (req, res) => {
  res.json({
    name: '衣搭助手API',
    version: '1.0.0',
    mode: 'supabase-free-tier',
    deployment: 'vercel-supabase',
    endpoints: {
      clothing: '/api/clothing',
      outfits: '/api/outfits',
      recommend: '/api/recommend',
      upload: '/api/upload',
      search: '/api/search',
      health: '/api/health'
    },
    documentation: 'https://github.com/your-repo/clothing-match-app-supabase',
    status: 'active'
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error(`全局错误 [${req.method} ${req.path}]:`, {
    message: err.message,
    stack: err.stack,
    ip: req.clientIP,
    userAgent: req.get('User-Agent')
  });
  
  // CORS错误特殊处理
  if (err.message.includes('不被CORS策略允许')) {
    return res.status(403).json({
      success: false,
      error: 'CORS策略不允许此请求',
      code: 'CORS_ERROR',
      timestamp: new Date().toISOString(),
      path: req.path
    });
  }
  
  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: '文件大小超过限制（最大5MB）',
      code: 'FILE_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }
  
  // 验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: '输入数据验证失败',
      details: err.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
  
  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message;
    
  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    path: req.path,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404处理
app.use((req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.path} - IP: ${req.clientIP}`);
  
  res.status(404).json({
    success: false,
    error: '请求的接口不存在',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      '/api/health',
      '/api/clothing',
      '/api/outfits',
      '/api/recommend',
      '/api/upload',
      '/api/search'
    ],
    timestamp: new Date().toISOString()
  });
});

// 初始化Supabase连接
async function initializeSupabase() {
  try {
    console.log('正在连接Supabase...');
    
    // 测试连接
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Supabase连接测试失败');
    }
    
    // 初始化数据库
    await initializeDatabase();
    
    console.log('✅ Supabase初始化成功');
    
  } catch (error) {
    console.error('❌ Supabase初始化失败:', error.message);
    console.log('正在重试初始化...');
    
    // 5秒后重试
    setTimeout(() => {
      initializeSupabase();
    }, 5000);
  }
}

// 初始化Supabase
initializeSupabase();

// 优雅关闭处理
async function gracefulShutdown(signal) {
  console.log(`\n收到${signal}信号，开始优雅关闭...`);
  
  try {
    // Supabase是服务型数据库，无需显式关闭连接
    console.log('✅ Supabase连接正常关闭');
    
    console.log('✅ 服务器已优雅关闭');
    process.exit(0);
  } catch (error) {
    console.error('❌ 优雅关闭失败:', error);
    process.exit(1);
  }
}

// 监听关闭信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 监听未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
});

// Vercel serverless exports
module.exports = app;