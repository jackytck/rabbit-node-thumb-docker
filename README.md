#### Sample env
```yaml
thumb-worker:
  image: jackytck/rabbit-node-thumb-docker:v0.0.1
  network_mode: "host"
  user: "${UID}:${GID}"
  environment:
    - RABBIT_HOST=127.0.0.1
    - RABBIT_USER=XXXXXXXX
    - RABBIT_PASSWORD=XXXXXXXX
    - RABBIT_PORT=5672
    - RABBIT_QUEUE=XXXXXXXX
    - RABBIT_PING=XXXXXXXX
    - RABBIT_PONG=XXXXXXXX
    - CONCURRENCY=10
    - HOST_NAME=Thumb-Worker-0
    - HOST_TYPE=thumb-worker
    - TZ=Asia/Hong_Kong
  volumes:
    - /etc/group:/etc/group:ro
    - /etc/passwd:/etc/passwd:ro
    - /home/jacky/public/user_drive:/app/public/user_drive
    - /home/jacky/public/data:/app/public/data
  depends_on:
    - rabbit
  restart: on-failure
```
