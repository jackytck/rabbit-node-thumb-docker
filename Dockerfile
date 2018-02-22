FROM jackytck/docker-node-imagemagick:v0.0.1

WORKDIR /app
COPY package.json .
RUN yarn && chmod -R 655 .

COPY src src
CMD ["yarn", "start"]
