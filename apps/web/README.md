# Web

Angular 22 застосунок. Запускайте команди з [кореня monorepo](../../README.md):

```bash
npm ci
npm run dev:web
npm run build:web
npm run test -w web -- --watch=false
```

Dev-server на `localhost:4200` проксіює `/api` до NestJS на `localhost:3001`
через `proxy.conf.json`. У production потрібен такий самий reverse proxy.
