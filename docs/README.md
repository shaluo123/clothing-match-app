# 衣搭助手 - 微信小程序开发文档

## 📱 项目概述

衣搭助手是一款智能衣物搭配管理微信小程序，帮助用户通过AI技术实现衣物的整理、搭配和管理。

### 🎯 核心功能

1. **图片导入** - 支持相册选择和相机拍摄
2. **AI智能抠图** - 自动去除衣物背景，无需手动操作
3. **拖拽搭配** - 直观的拖拽画布进行衣物组合
4. **自动保存** - 1分钟自动保存，支持二次编辑
5. **标签管理** - 智能标签系统和搜索功能
6. **季节主题** - 四季主题自动切换（春粉、夏绿、秋黄、冬白）
7. **智能推荐** - 基于规则的搭配建议

### 🛠️ 技术栈

- **前端**: 微信小程序原生框架 (WXML + WXSS + JavaScript)
- **后端**: 微信云开发 (云函数 + 云数据库 + 云存储)
- **AI抠图**: 免费第三方API集成
- **智能推荐**: 基于规则的推荐算法

## 🚀 快速开始

### 环境要求

1. **微信开发者工具** v1.06.2301160 或更高版本
2. **Node.js** v16.0.0 或更高版本
3. **微信小程序账号** (需要开通云开发功能)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-repo/clothing-match-app.git
   cd clothing-match-app
   ```

2. **打开微信开发者工具**
   - 点击"导入项目"
   - 选择项目目录
   - 填入AppID (测试阶段可使用测试号)

3. **配置云开发**
   - 在微信开发者工具中点击"云开发"
   - 创建云环境 (选择按量付费)
   - 记录环境ID

4. **更新配置**
   - 在 `app.js` 中更新云环境ID:
   ```javascript
   wx.cloud.init({
     env: 'your-env-id', // 替换为你的云环境ID
     traceUser: true,
   })
   ```
   - 在 `project.config.json` 中更新AppID

5. **部署云函数**
   ```bash
   # 在微信开发者工具中
   # 右键点击 cloudfunctions 文件夹
   # 选择"上传并部署：云端安装依赖"
   ```

6. **配置数据库**
   - 在云开发控制台创建以下集合:
     - `clothing` (衣物数据)
     - `outfits` (搭配数据)
     - `tags` (标签数据)

7. **启动项目**
   - 点击编译按钮
   - 在模拟器中预览

## 📁 项目结构

```
clothing-match-app/
├── miniprogram/                 # 小程序前端代码
│   ├── pages/                  # 页面文件
│   │   ├── home/              # 首页
│   │   ├── closet/            # 衣橱页面
│   │   ├── outfits/           # 搭配页面
│   │   ├── tags/              # 标签页面
│   │   └── profile/           # 个人中心
│   ├── components/            # 自定义组件
│   ├── utils/                 # 工具函数
│   ├── styles/                # 全局样式
│   ├── images/                # 静态图片资源
│   ├── app.js                 # 小程序入口
│   ├── app.json               # 小程序配置
│   └── app.wxss               # 全局样式
├── cloudfunctions/            # 云函数
│   ├── removeBackground/      # AI抠图服务
│   ├── recommend/            # 智能推荐服务
│   └── storage/              # 存储服务
├── database/                 # 数据库设计文档
├── docs/                     # 开发文档
├── project.config.json       # 项目配置
└── README.md                # 项目说明
```

## 💾 数据库设计

### clothing 集合 (衣物数据)

```javascript
{
  "_id": "自动生成的ID",
  "_openid": "用户openid",
  "name": "衣物名称",
  "image": "图片云存储路径",
  "category": "分类(top/bottom/dress/outerwear/shoes/accessory)",
  "tags": ["标签1", "标签2"],
  "color": "主要颜色",
  "season": "适用季节",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```

### outfits 集合 (搭配数据)

```javascript
{
  "_id": "自动生成的ID",
  "_openid": "用户openid",
  "name": "搭配名称",
  "description": "搭配描述",
  "thumbnail": "缩略图",
  "items": ["衣物ID数组"],
  "tags": ["场景标签"],
  "season": "适用季节",
  "createTime": "创建时间",
  "updateTime": "更新时间"
}
```

### tags 集合 (标签数据)

```javascript
{
  "_id": "自动生成的ID",
  "_openid": "用户openid",
  "name": "标签名称",
  "type": "标签类型(style/season/color/scene)",
  "count": "使用次数",
  "createTime": "创建时间"
}
```

## 🎨 UI设计规范

### 色彩系统

**季节主题色彩:**

- 🌸 **春季**: #FFB6C1 (粉色系)
- 🌿 **夏季**: #98FB98 (绿色系)
- 🍂 **秋季**: #FFD700 (黄色系)
- ❄️ **冬季**: #F0F8FF (白色系)

### 组件规范

- **卡片圆角**: 20rpx
- **按钮圆角**: 50rpx
- **间距**: 20rpx 的倍数
- **字体大小**: 24rpx, 28rpx, 32rpx, 36rpx, 48rpx

### 动画规范

- **页面切换**: 0.3s ease
- **悬停效果**: 0.2s ease
- **加载动画**: 1s infinite

## 🔧 云函数说明

### removeBackground 云函数

**功能**: AI智能抠图服务

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'removeBackground',
  data: {
    imageUrl: '图片路径'
  }
})
```

**返回结果**:
```javascript
{
  success: true,
  processedImage: '处理后图片路径',
  originalImage: '原图路径'
}
```

### recommend 云函数

**功能**: 智能推荐服务

**调用方式**:
```javascript
wx.cloud.callFunction({
  name: 'recommend',
  data: {
    type: 'smart|similar|seasonal',
    season: 'spring|summer|autumn|winter',
    userId: '用户ID',
    clothingId: '衣物ID'
  }
})
```

## 📱 API 接口说明

### 图片上传接口

```javascript
wx.cloud.uploadFile({
  cloudPath: '文件路径',
  filePath: '本地临时路径'
})
```

### 数据库操作接口

```javascript
// 查询
wx.cloud.database().collection('clothing').get()

// 添加
wx.cloud.database().collection('clothing').add({ data: {} })

// 更新
wx.cloud.database().collection('clothing').doc(id).update({ data: {} })

// 删除
wx.cloud.database().collection('clothing').doc(id).remove()
```

## 🎯 核心功能实现

### 1. AI抠图功能

- 支持自动识别衣物边缘
- 无需用户手动操作
- 处理速度 < 3秒
- 支持批量处理

### 2. 拖拽搭配功能

- 使用 Canvas 组件实现
- 支持多指操作
- 实时预览效果
- 自动保存位置

### 3. 智能推荐算法

- 基于用户历史数据
- 考虑季节因素
- 颜色搭配理论
- 风格匹配规则

### 4. 季节主题切换

- 根据当前月份自动切换
- 平滑过渡动画
- 保持用户偏好记忆

## 🚀 部署指南

### 1. 云开发配置

1. 登录微信小程序后台
2. 开通云开发服务
3. 创建云环境
4. 配置环境变量

### 2. 云函数部署

```bash
# 在微信开发者工具中
# 1. 右键 cloudfunctions/removeBackground
# 2. 选择"上传并部署：云端安装依赖"
# 3. 重复操作其他云函数
```

### 3. 数据库初始化

1. 在云开发控制台创建集合
2. 设置数据库权限
3. 创建索引提高查询性能

### 4. 测试环境配置

- 使用测试AppID进行开发
- 配置测试域名白名单
- 启用调试模式

## 🐛 常见问题

### 1. 云函数调用失败

**问题**: 云函数返回错误
**解决**: 检查云环境ID配置，确认云函数已正确部署

### 2. 图片上传失败

**问题**: 图片无法上传到云存储
**解决**: 检查云存储权限，确认文件名合法

### 3. AI抠图效果不佳

**问题**: 抠图结果不理想
**解决**: 建议用户选择背景简单的图片，或手动优化

### 4. 性能优化建议

- 图片压缩: 上传前压缩到合适尺寸
- 数据分页: 大数据量时使用分页加载
- 缓存策略: 合理使用本地缓存

## 📊 成本分析

### 免费额度使用

- **云函数**: 每月免费100万次调用
- **云存储**: 每月免费5GB存储
- **云数据库**: 每月免费2GB存储

### 成本优化建议

1. 图片压缩处理
2. 定期清理无用数据
3. 合理设置数据库索引
4. 使用CDN加速静态资源

## 🔄 版本更新

### v1.0.0 (当前版本)
- ✅ 基础功能实现
- ✅ AI抠图集成
- ✅ 季节主题切换
- ✅ 智能推荐

### v1.1.0 (计划中)
- 🔄 拖拽画布优化
- 🔄 更多推荐算法
- 🔄 社交功能
- 🔄 数据导出功能

## 📞 技术支持

- **邮箱**: support@example.com
- **GitHub**: https://github.com/your-repo/clothing-match-app
- **文档**: https://docs.example.com

## 📄 许可证

本项目采用 MIT 许可证，详情请见 LICENSE 文件。