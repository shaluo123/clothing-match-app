// 公共包装工具
const express = require('express');
const serverless = require('serverless-http');

module.exports = (router, apiPath) => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(apiPath, router);
  return serverless(app);
};