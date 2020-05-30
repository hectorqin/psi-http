# psi-http

psi 的http服务版

## Docker 部署

```bash
docker run -d --name psi-http --restart always -p 8888:8888 hectorqin/psi-http
```

## 访问

```bash
curl http://127.0.0.1:8888/psi?url=https%3A%2F%2Fwww.baidu.com&strategy=mobile
```
