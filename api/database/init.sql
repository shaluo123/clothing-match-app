-- ==========================================
-- 衣搭助手数据库初始化脚本
-- 
-- 使用说明：
-- 1. 小白用户：请查看 docs/部署指南.md 获取详细步骤说明
-- 2. 开发者：直接复制此文件到 Supabase SQL Editor 执行
-- 
-- 此脚本创建：
-- - 衣物表 (clothing)：存储用户的衣服信息
-- - 搭配表 (outfits)：存储衣服搭配方案
-- - 关联表 (outfit_clothing)：用于更灵活的关系查询
-- - 索引：优化查询性能
-- - RLS策略：保护用户数据隐私（行级安全）
-- - 触发器：自动更新时间戳
-- - 统计函数：支持数据分析
-- - 搜索函数：支持全文搜索
-- - 视图：简化查询操作
-- ==========================================

-- 创建衣物表
CREATE TABLE IF NOT EXISTS clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  image TEXT,
  tags TEXT[] DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建搭配表
CREATE TABLE IF NOT EXISTS outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  items UUID[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  season TEXT DEFAULT 'all' CHECK (season IN ('spring', 'summer', 'autumn', 'winter', 'all')),
  thumbnail TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建衣物与搭配的关联表（可选，用于更好的关系查询）
CREATE TABLE IF NOT EXISTS outfit_clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  clothing_id UUID NOT NULL REFERENCES clothing(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outfit_id, clothing_id)
);

-- 创建搜索索引
CREATE INDEX IF NOT EXISTS idx_clothing_name_gin ON clothing USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_clothing_tags_gin ON clothing USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_clothing_category ON clothing(category);
CREATE INDEX IF NOT EXISTS idx_clothing_created_at ON clothing(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clothing_user_id ON clothing(user_id);

CREATE INDEX IF NOT EXISTS idx_outfits_name_gin ON outfits USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_outfits_description_gin ON outfits USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_outfits_tags_gin ON outfits USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_outfits_season ON outfits(season);
CREATE INDEX IF NOT EXISTS idx_outfits_created_at ON outfits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outfits_user_id ON outfits(user_id);

-- 创建RLS策略（行级安全）
ALTER TABLE clothing ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的衣物和搭配
CREATE POLICY "Users can view their own clothing" ON clothing
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clothing" ON clothing
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clothing" ON clothing
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clothing" ON clothing
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own outfits" ON outfits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own outfits" ON outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own outfits" ON outfits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own outfits" ON outfits
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clothing_updated_at BEFORE UPDATE ON clothing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outfits_updated_at BEFORE UPDATE ON outfits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建统计函数
CREATE OR REPLACE FUNCTION get_clothing_category_stats()
RETURNS TABLE(category TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT category, COUNT(*)::BIGINT
  FROM clothing
  WHERE user_id = auth.uid()
  GROUP BY category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_outfit_season_stats()
RETURNS TABLE(season TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT season, COUNT(*)::BIGINT
  FROM outfits
  WHERE user_id = auth.uid()
  GROUP BY season;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_outfit_tag_stats()
RETURNS TABLE(tag TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT tag, COUNT(*)::BIGINT
  FROM outfits, unnest(tags) AS tag
  WHERE user_id = auth.uid()
  GROUP BY tag
  ORDER BY COUNT DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建搜索函数
CREATE OR REPLACE FUNCTION search_clothing(search_term TEXT)
RETURNS TABLE(id UUID, name TEXT, category TEXT, image TEXT, tags TEXT[], created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name, category, image, tags, created_at
  FROM clothing
  WHERE user_id = auth.uid()
    AND (
      to_tsvector('english', name || ' ' || COALESCE(array_to_string(tags, ' '), '')) @@ plainto_tsquery('english', search_term)
      OR name ILIKE '%' || search_term || '%'
      OR array_to_string(tags, ' ') ILIKE '%' || search_term || '%'
    )
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION search_outfits(search_term TEXT)
RETURNS TABLE(id UUID, name TEXT, description TEXT, season TEXT, thumbnail TEXT, tags TEXT[], created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name, description, season, thumbnail, tags, created_at
  FROM outfits
  WHERE user_id = auth.uid()
    AND (
      to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(array_to_string(tags, ' '), '')) @@ plainto_tsquery('english', search_term)
      OR name ILIKE '%' || search_term || '%'
      OR COALESCE(description, '') ILIKE '%' || search_term || '%'
      OR array_to_string(tags, ' ') ILIKE '%' || search_term || '%'
    )
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 插入一些示例数据（可选）
INSERT INTO clothing (name, category, image, tags) VALUES
  ('白色T恤', 'top', 'https://picsum.photos/200/250?random=1', ARRAY['基础款', '白色', '百搭']),
  ('牛仔裤', 'bottom', 'https://picsum.photos/200/250?random=2', ARRAY['休闲', '蓝色', '百搭']),
  ('连衣裙', 'dress', 'https://picsum.photos/200/250?random=3', ARRAY['优雅', '碎花', '春夏'])
ON CONFLICT DO NOTHING;

INSERT INTO outfits (name, description, items, season, tags) VALUES
  ('春日清新装', '温柔的粉色系搭配，适合春日踏青', 
   ARRAY[(SELECT id FROM clothing WHERE name = '白色T恤' LIMIT 1)], 
   'spring', ARRAY['春日', '休闲', '清新'])
ON CONFLICT DO NOTHING;

-- 创建视图用于简化查询
CREATE OR REPLACE VIEW clothing_with_tags AS
SELECT 
  c.*,
  CASE 
    WHEN array_length(c.tags, 1) > 0 THEN array_to_string(c.tags, ', ')
    ELSE '无标签'
  END as tags_string
FROM clothing c;

CREATE OR REPLACE VIEW outfits_with_item_count AS
SELECT 
  o.*,
  array_length(o.items, 1) as item_count
FROM outfits o;

-- 创建存储策略（如果需要文件上传）
-- INSERT INTO storage.policies (name, definition) VALUES 
-- ('Users can upload their own files', 'auth.uid() = user_id');