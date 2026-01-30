// API配置管理
const config = {
  // 部署模式选择：'cloud' | 'self-hosted' | 'hybrid'
  DEPLOY_MODE: 'self-hosted', // 默认使用自建模式
  
  // 微信云开发配置
  CLOUD_CONFIG: {
    env: '', // 云环境ID
    traceUser: true
  },
  
  // 自建API配置
  SELF_HOSTED_CONFIG: {
    baseURL: 'https://your-app.vercel.app/api', // 您的API地址
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  // 混合模式配置
  HYBRID_CONFIG: {
    useCloudForStorage: true,  // 存储使用云开发
    useSelfHostedForAI: true,  // AI处理使用自建API
    useSelfHostedForRecommend: true // 推荐使用自建API
  },
  
  // 获取当前配置
  getCurrentConfig() {
    switch (this.DEPLOY_MODE) {
      case 'cloud':
        return this.CLOUD_CONFIG;
      case 'self-hosted':
        return this.SELF_HOSTED_CONFIG;
      case 'hybrid':
        return { ...this.SELF_HOSTED_CONFIG, ...this.HYBRID_CONFIG };
      default:
        return this.SELF_HOSTED_CONFIG;
    }
  }
};

module.exports = config;