# 衣搭助手 - 微信小程序

一个简洁优雅的衣服搭配管理小程序，帮助你整理衣橱、创建搭配方案。

## 功能特点

- 👕 **衣橱管理**：上传衣服照片，分类管理
- 👗 **搭配方案**：创建多套衣服搭配
- 🏷️ **标签系统**：给衣服打标签，方便搜索
- 🎨 **季节主题**：根据季节自动切换主题色
- 📱 **微信小程序**：随时随地查看搭配

## 技术架构

- **前端**：微信小程序原生开发
- **后端**：Node.js + Express
- **数据库**：Supabase (PostgreSQL)
- **文件存储**：Supabase Storage
- **托管平台**：Vercel（免费版）

## 快速开始

### 1. 部署后端API

#### 1.1 创建 Supabase 项目
1. 访问 https://supabase.com 注册账号
2. 创建新项目，记录以下信息：
   - Project URL
   - anon public key
   - service_role key

3. **数据库初始化**：
   - 在 Supabase 控制台点击 **"SQL Editor"**
   - 新建查询，复制执行 [`api/database/init.sql`](api/database/init.sql) 中的内容
   - 详细步骤请参考 [docs/部署指南.md](docs/部署指南.md) 第 1.5 节

4. 在 Storage 中创建 `clothing-images` 存储桶（设置为 Public）

#### 1.2 部署到 Vercel
1. 访问 https://vercel.com 注册账号
2. 导入本项目代码
3. 设置 Root Directory 为 `api`
4. 添加环境变量：
   ```
   NEXT_PUBLIC_SUPABASE_URL=你的Supabase URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon key
   NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=你的service_role key
   NODE_ENV=production
   ```
5. 部署项目

### 2. 配置小程序

1. 注册微信小程序账号：https://mp.weixin.qq.com
2. 下载微信开发者工具
3. 导入项目代码
4. 修改 `miniprogram/config/api-free.js` 中的 API 地址
5. 在小程序后台配置服务器域名
6. 编译预览

详细步骤请参考 [docs/部署指南.md](docs/部署指南.md)

## 项目结构

```
.
├── api/                      # 后端API代码
│   ├── config/
│   │   └── supabase.js      # Supabase配置
│   ├── routes/
│   │   ├── clothing.js      # 衣物管理API
│   │   ├── outfits.js       # 搭配管理API
│   │   ├── recommend.js     # 推荐API
│   │   ├── upload.js        # 文件上传API
│   │   ├── search.js        # 搜索API
│   │   └── health.js        # 健康检查API
│   ├── database/
│   │   └── init.sql         # 数据库初始化脚本
│   ├── .env.example         # 环境变量模板
│   ├── index.js             # 主入口
│   ├── package.json         # 依赖配置
│   └── vercel.json          # Vercel部署配置
├── miniprogram/             # 小程序前端代码
│   ├── pages/               # 页面文件
│   ├── services/            # API服务
│   ├── utils/               # 工具函数
│   └── config/              # 配置文件
├── docs/                    # 文档
│   └── 部署指南.md          # 详细部署教程
├── app.json                 # 小程序配置
├── app.js                   # 小程序入口
└── README.md               # 项目说明
```

## 环境变量

复制 `api/.env.example` 为 `api/.env`，并填写以下变量：

| 变量名 | 说明 | 获取位置 |
|--------|------|----------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase项目URL | Supabase Project Settings > API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 匿名公钥 | Supabase Project Settings > API |
| NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY | 服务密钥 | Supabase Project Settings > API |
| NODE_ENV | 环境模式 | production |

## API接口

### 衣物管理
- `GET /api/clothing` - 获取衣物列表
- `POST /api/clothing` - 创建衣物
- `PUT /api/clothing/:id` - 更新衣物
- `DELETE /api/clothing/:id` - 删除衣物

### 搭配管理
- `GET /api/outfits` - 获取搭配列表
- `POST /api/outfits` - 创建搭配
- `PUT /api/outfits/:id` - 更新搭配
- `DELETE /api/outfits/:id` - 删除搭配

### 智能推荐
- `POST /api/recommend` - 获取推荐搭配

### 文件上传
- `POST /api/upload` - 上传文件
- `POST /api/upload/remove-background` - AI抠图

### 搜索
- `GET /api/search?q=关键词` - 搜索衣物和搭配

### 健康检查
- `GET /api/health` - 服务状态检查

## 免费额度说明

本项目使用免费服务，额度如下：

**Supabase 免费版**：
- 数据库：500MB 存储
- 带宽：2GB/月
- API调用：无限

**Vercel 免费版**：
- 托管：无限
- 函数调用：100GB 带宽/月
- 构建：6000分钟/月

**微信小程序**：
- 个人开发者免费
- 需要实名认证

## 开发说明

### 本地开发

1. 安装依赖：
```bash
cd api
npm install
```

2. 配置环境变量：
```bash
cp .env.example .env
# 编辑 .env 文件填写配置
```

3. 启动开发服务器：
```bash
npm run dev
```

4. 在微信开发者工具中预览小程序

### 技术栈

- **后端**：Node.js, Express, Supabase
- **前端**：微信小程序原生框架
- **数据库**：PostgreSQL (Supabase)
- **存储**：Supabase Storage

## 更新日志

### v1.0.0 (2026-02-03)
- 初始版本发布
- 支持衣物管理
- 支持搭配方案
- 支持标签系统
- 支持智能推荐
- 支持图片上传和AI抠图

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

如有问题，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件

---

**注意**：本项目仅供学习交流使用，请勿用于商业用途。
