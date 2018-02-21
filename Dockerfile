FROM jackytck/docker-node-imagemagick:v0.0.1

WORKDIR /usr/src/app
COPY package.json ./
RUN yarn
COPY . .
RUN rm .env
CMD ["yarn", "start"]
