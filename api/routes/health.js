// 健康检查路由 - Supabase版本
const express = require('express');
const router = express.Router();
const { supabase, formatResponse, formatErrorResponse } = require('../config/supabase');

// 基础健康检查
router.get('/', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    
    // 检查Supabase数据库连接
    let dbStatus = 'disconnected';
    let dbResponseTime = null;
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from('clothing')
        .select('id', { count: 'exact', head: true });
      
      dbResponseTime = Date.now() - startTime;
      
      if (!error) {
        dbStatus = 'connected';
      } else {
        console.error('Supabase连接检查失败:', error.message);
      }
    } catch (error) {
      console.error('数据库连接检查失败:', error);
    }

    // 检查内存使用
    const memUsage = process.memoryUsage();
    const memInfo = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    };

    res.json(formatResponse({
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp,
      service: 'clothing-match-api',
      version: '1.0.0',
      deployment: 'supabase-free',
      database: {
        status: dbStatus,
        type: 'supabase',
        responseTime: dbResponseTime
      },
      memory: memInfo,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }));
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 详细健康检查（包含性能指标）
router.get('/detailed', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 数据库性能测试
    let dbResponseTime = null;
    let dbStatus = 'disconnected';
    let tableStats = {};
    
    try {
      const dbStart = Date.now();
      const { error: testError } = await supabase
        .from('clothing')
        .select('id', { count: 'exact', head: true });
      
      dbResponseTime = Date.now() - dbStart;
      
      if (!testError) {
        dbStatus = 'connected';
        
        // 获取表统计
        const [clothingCount, outfitsCount] = await Promise.all([
          supabase.from('clothing').select('*', { count: 'exact', head: true }),
          supabase.from('outfits').select('*', { count: 'exact', head: true })
        ]);
        
        tableStats = {
          clothing: {
            count: clothingCount.count || 0
          },
          outfits: {
            count: outfitsCount.count || 0
          }
        };
      }
    } catch (error) {
      console.error('数据库性能测试失败:', error);
    }

    const totalTime = Date.now() - startTime;
    const memUsage = process.memoryUsage();

    res.json(formatResponse({
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      performance: {
        responseTime: totalTime,
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
          tables: tableStats
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
          external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
          rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
        },
        system: {
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version
        }
      }
    }));
  } catch (error) {
    console.error('详细健康检查失败:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
