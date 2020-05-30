# specify the node base image with your desired version node:<version>
FROM node:lts-alpine
# replace this with your application's default port
EXPOSE 8888

COPY . /usr/src/app

WORKDIR /usr/src/app

ENTRYPOINT ["node", "index.js"]