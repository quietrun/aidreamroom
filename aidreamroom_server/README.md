# aidreamroom_server

基于 `NestJS + Prisma` 的 `ai_dreamroom_server` 重构版本，目标是保留旧项目已有能力，同时把散落的 SQL、第三方调用和业务流程收敛到清晰的模块层级里，便于后续维护和迭代。

## 技术栈

- NestJS 11
- Prisma 6
- MySQL
- MinIO
- OpenAI / Bedrock
- AWS SES
- 原生 WebSocket 兼容旧版游戏对话协议

## 模块结构

```text
src/
  common/
    auth/         session_token 鉴权与用户上下文
    config/       环境变量读取
    database/     PrismaService + 兼容旧表结构的 SQL 封装
    utils/        旧项目常量、ID、手机号等公共工具
  modules/
    users/        登录注册、验证码、资料、收藏、好友、排队注册
    outlooks/     世界观信息
    plots/        剧情、分支、知识库、节点坐标
    characters/   角色信息
    elements/     元素库、隐藏、购物车、导入
    play/         游戏创建、历史、次数限制、WebSocket 对话运行时
    gpt/          统一 AI 调用出口
    auto/         自动生成人设与背景
    files/        图片上传
    numerical/    数值模板
    notifications/ 邮件与短信发送
    storage/      MinIO 读写
```

## 设计说明

1. 控制器只保留路由协议和入参校验，核心逻辑统一下沉到 service。
2. 公共能力统一抽到了 `common` 与基础设施模块，避免旧项目里跨目录复制函数。
3. 数据层使用 Prisma 承担连接与 client 生成，同时保留对旧表结构友好的 SQL 封装，降低一次性迁表的风险。
4. 旧版 WebSocket 游戏协议保留，便于老前端继续接入。
5. 所有敏感配置都改成 `.env` 注入，不再把密钥硬编码到代码里。

## 环境变量

先复制一份环境变量模板：

```bash
cp .env.example .env
```

重点配置：

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `BEDROCK_ACCESS_KEY_ID`
- `BEDROCK_SECRET_ACCESS_KEY`
- `SES_ACCESS_KEY_ID`
- `SES_SECRET_ACCESS_KEY`
- `MINIO_*`
- `SMS_*`

## 运行方式

```bash
npm install
npm run prisma:generate
npm run build
npm run start:dev
```

默认 HTTP 端口是 `8380`，旧版 WebSocket 端口是 `3300`。

## 兼容说明

当前接口路径尽量保持与旧项目一致，包括：

- `/users/*`
- `/plot/*`
- `/outlook/*`
- `/character/*`
- `/element/*`
- `/play/*`
- `/gpt/*`
- `/auto/*`
- `/numerical/*`
- `/upload`

这样前端可以先无感切换，再逐步做更细的协议治理。
