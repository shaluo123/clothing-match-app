// 文件上传和AI处理路由 - Supabase Storage版本
const express = require('express');
const wrapServerless = require('../utils/serverless-wrapper');

const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

// 配置内存存储（Vercel无服务器环境）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB限制（Supabase限制）
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，支持的类型: JPEG, PNG, WebP'), false);
    }
  }
});

// Supabase Storage客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// 上传到Supabase Storage
async function uploadToSupabase(file, filename, buffer, bucket = 'clothing-images') {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase Storage上传失败: ${error.message}`);
    }

    // 获取公共URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filename);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
      size: buffer.length
    };

  } catch (error) {
    console.error('Supabase Storage上传失败:', error);
    throw error;
  }
}

// AI抠图处理并上传到Supabase Storage
router.post('/remove-background', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传图片文件'
      });
    }

    const { quality = 'medium', model = 'U2-Net', optimizeForMobile = true } = req.body;

    // 检查文件大小
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: '文件大小不能超过10MB（Supabase限制）'
      });
    }

    console.log(`开始处理图片: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

    // 使用Sharp进行图片处理（模拟AI抠图）
    let processedImageBuffer;
    let processingInfo = {};

    try {
      // 基础图片处理
      let imageProcessor = sharp(req.file.buffer);

      // 获取图片信息
      const metadata = await imageProcessor.metadata();
      processingInfo.original = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: req.file.size
      };

      // 根据质量设置进行处理
      switch (quality) {
        case 'high':
          imageProcessor = imageProcessor
            .resize(null, {
              height: Math.min(metadata.height, 1200),
              withoutEnlargement: true
            })
            .png({ quality: 95, compressionLevel: 6 });
          break;
        case 'medium':
          imageProcessor = imageProcessor
            .resize(null, {
              height: Math.min(metadata.height, 800),
              withoutEnlargement: true
            })
            .png({ quality: 85, compressionLevel: 8 });
          break;
        case 'low':
          imageProcessor = imageProcessor
            .resize(null, {
              height: Math.min(metadata.height, 600),
              withoutEnlargement: true
            })
            .jpeg({ quality: 75 });
          break;
        default:
          imageProcessor = imageProcessor
            .resize(null, {
              height: Math.min(metadata.height, 800),
              withoutEnlargement: true
            })
            .png({ quality: 85 });
      }

      // 移动端优化
      if (optimizeForMobile) {
        imageProcessor = imageProcessor.resize(null, {
          height: Math.min(metadata.height, 600),
          withoutEnlargement: true
        });
      }

      // 应用基本的背景移除效果（边缘检测和透明度）
      processedImageBuffer = await imageProcessor
        .composite([{
          input: await createBackgroundRemovalMask(req.file.buffer),
          blend: 'dest-in'
        }])
        .toBuffer();

      processingInfo.processed = {
        size: processedImageBuffer.length,
        quality,
        model,
        optimizeForMobile
      };

    } catch (processingError) {
      console.error('图片处理失败:', processingError);
      // 如果处理失败，返回原图
      processedImageBuffer = req.file.buffer;
      processingInfo.processed = {
        size: req.file.size,
        fallback: true
      };
    }

    // 生成文件名
    const timestamp = Date.now();
    const fileExtension = req.file.originalname.split('.').pop();
    const processedFilename = `processed_${timestamp}.${fileExtension}`;
    const originalFilename = `original_${timestamp}.${fileExtension}`;

    // 上传处理后的图片到Supabase
    const processedUpload = await uploadToSupabase(
      req.file, 
      processedFilename, 
      processedImageBuffer,
      'clothing-images'
    );

    // 上传原图到Supabase（可选）
    const originalUpload = await uploadToSupabase(
      req.file,
      originalFilename,
      req.file.buffer,
      'clothing-images'
    );

    if (!processedUpload.success || !originalUpload.success) {
      throw new Error('图片上传到Supabase失败');
    }

    // 生成处理统计
    const processingStats = {
      success: true,
      originalSize: req.file.size,
      processedSize: processedImageBuffer.length,
      compressionRatio: ((req.file.size - processedImageBuffer.length) / req.file.size * 100).toFixed(2),
      processingTime: Date.now() - req.requestTime,
      model,
      quality,
      fallback: processingInfo.processed.fallback || false,
      storage: {
        processed: {
          url: processedUpload.url,
          path: processedUpload.path,
          size: processedUpload.size
        },
        original: {
          url: originalUpload.url,
          path: originalUpload.path,
          size: originalUpload.size
        }
      }
    };

    console.log(`图片处理完成: ${processingStats.compressionRatio}% 压缩率`);

    res.json({
      success: true,
      processedImage: processedUpload.url,
      originalImage: originalUpload.url,
      processingInfo: processingStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI抠图处理失败:', error);
    const { statusCode, response } = require('../config/supabase').formatErrorResponse(error, req);
    res.status(statusCode).json(response);
  }
});

// 创建背景移除掩码（简化版U²-Net模拟）
async function createBackgroundRemovalMask(imageBuffer) {
  try {
    // 使用Sharp创建基本的边缘检测掩码
    const { data, info } = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true});

    const maskBuffer = Buffer.alloc(info.width * info.height * 4);
    
    // 简单的边缘检测和背景移除算法
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // 计算亮度
      const brightness = (r + g + b) / 3;
      
      // 简单的背景判断（根据亮度）
      const isForeground = brightness < 200; // 假设亮色是背景
      
      const maskIndex = (i / 3) * 4;
      if (isForeground) {
        // 前景 - 白色
        maskBuffer[maskIndex] = 255;     // R
        maskBuffer[maskIndex + 1] = 255; // G
        maskBuffer[maskIndex + 2] = 255; // B
        maskBuffer[maskIndex + 3] = 200; // A (稍微透明)
      } else {
        // 背景 - 透明
        maskBuffer[maskIndex] = 0;     // R
        maskBuffer[maskIndex + 1] = 0; // G
        maskBuffer[maskIndex + 2] = 0; // B
        maskBuffer[maskIndex + 3] = 0; // A
      }
    }

    return sharp(maskBuffer, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .resize(info.width * 2, info.height * 2) // 放大回原尺寸
    .png()
    .toBuffer();

  } catch (error) {
    console.error('创建掩码失败:', error);
    // 如果创建掩码失败，返回全白掩码（保留原图）
    const size = 256 * 256 * 4;
    const whiteMask = Buffer.alloc(size);
    for (let i = 0; i < size; i += 4) {
      whiteMask[i] = 255;     // R
      whiteMask[i + 1] = 255; // G
      whiteMask[i + 2] = 255; // B
      whiteMask[i + 3] = 255; // A
    }
    return whiteMask;
  }
}

// 通用文件上传接口
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const { type = 'general', quality = 'medium' } = req.body;

    // 文件信息
    const fileInfo = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadTime: new Date().toISOString()
    };

    // 根据类型处理文件
    let processedData;
    let uploadUrl = '';

    if (req.file.mimetype.startsWith('image/')) {
      // 图片处理
      const processedBuffer = await processImage(req.file.buffer, quality);
      const base64Data = processedBuffer.toString('base64');
      uploadUrl = `data:${req.file.mimetype};base64,${base64Data}`;
      
      processedData = {
        url: uploadUrl,
        size: processedBuffer.length,
        type: 'image',
        quality
      };
    } else {
      // 非图片文件，直接返回
      const base64Data = req.file.buffer.toString('base64');
      uploadUrl = `data:${req.file.mimetype};base64,${base64Data}`;
      
      processedData = {
        url: uploadUrl,
        size: req.file.size,
        type: 'file'
      };
    }

    res.json({
      success: true,
      data: processedData,
      file: fileInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({
      success: false,
      error: '文件上传失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 图片处理函数
async function processImage(buffer, quality = 'medium') {
  try {
    let processor = sharp(buffer);
    const metadata = await processor.metadata();

    switch (quality) {
      case 'high':
        processor = processor
          .resize(null, {
            height: Math.min(metadata.height, 1200),
            withoutEnlargement: true
          })
          .png({ quality: 95 });
        break;
      case 'medium':
        processor = processor
          .resize(null, {
            height: Math.min(metadata.height, 800),
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 });
        break;
      case 'low':
        processor = processor
          .resize(null, {
            height: Math.min(metadata.height, 600),
            withoutEnlargement: true
          })
          .jpeg({ quality: 70 });
        break;
    }

    return await processor.toBuffer();
  } catch (error) {
    console.error('图片处理失败:', error);
    return buffer; // 返回原图
  }
}

// 批量文件上传
router.post('/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请上传至少一个文件'
      });
    }

    const { quality = 'medium' } = req.body;
    const results = [];

    for (const file of req.files) {
      try {
        const processedBuffer = await processImage(file.buffer, quality);
        const base64Data = processedBuffer.toString('base64');
        const uploadUrl = `data:${file.mimetype};base64,${base64Data}`;

        results.push({
          success: true,
          originalName: file.originalname,
          url: uploadUrl,
          size: processedBuffer.length,
          mimeType: file.mimetype
        });
      } catch (error) {
        console.error(`处理文件 ${file.originalname} 失败:`, error);
        results.push({
          success: false,
          originalName: file.originalname,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    res.json({
      success: successCount > 0,
      data: results,
      summary: {
        total: req.files.length,
        success: successCount,
        failed: req.files.length - successCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('批量上传失败:', error);
    res.status(500).json({
      success: false,
      error: '批量上传失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取上传统计
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      uploadTime: new Date().toISOString(),
      supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxFileSize: '5MB',
      maxBatchSize: 10,
      processingOptions: ['high', 'medium', 'low'],
      features: {
        backgroundRemoval: true,
        imageOptimization: true,
        batchUpload: true,
        mobileOptimization: true
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取上传统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取上传统计失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports.handler = wrapServerless(router, '/api/upload');

module.exports = router;