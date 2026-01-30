// 免费Vercel后端API主文件
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

// 导入路由
const clothingRoutes = require('./routes/clothing');
const outfitRoutes = require('./routes/outfits');
const recommendRoutes = require('./routes/recommend');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const healthRoutes = require('./routes/health');

const app = express();

// 中间件配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  
  // 记录API调用（用于免费额度监控）
  req.requestTime = Date.now();
  
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

// 静态文件服务（上传的图片）
app.use('/uploads', express.static('uploads'));

// 根路径重定向
app.get('/', (req, res) => {
  res.json({
    name: '衣搭助手API',
    version: '1.0.0',
    mode: 'free-tier',
    deployment: 'vercel',
    endpoints: {
      clothing: '/api/clothing',
      outfits: '/api/outfits',
      recommend: '/api/recommend',
      upload: '/api/upload',
      search: '/api/search',
      health: '/api/health'
    },
    documentation: 'https://github.com/your-repo/clothing-match-app',
    status: 'active'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? '服务器内部错误' 
    : err.message;
    
  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// 数据库连接
let db;
MongoClient.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(client => {
  db = client.db('clothing-app');
  console.log('MongoDB连接成功');
  
  // 在请求对象中添加数据库访问
  app.locals.db = db;
})
.catch(err => {
  console.error('MongoDB连接失败:', err);
  process.exit(1);
});

// 优雅关闭处理
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  
  if (db) {
    db.close(() => {
      console.log('数据库连接已关闭');
      process.exit(0);
    });
  }
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  
  if (db) {
    db.close(() => {
      console.log('数据库连接已关闭');
      process.exit(0);
    });
  }
});

// Vercel serverless exports
module.exports = app;