const {
  RABBIT_HOST,
  RABBIT_PORT,
  RABBIT_USER,
  RABBIT_PASSWORD,
  RABBIT_QUEUE,
  CONCURRENCY
} = process.env

const config = {
  rabbit: {
    host: RABBIT_HOST,
    port: RABBIT_PORT,
    user: RABBIT_USER,
    password: RABBIT_PASSWORD,
    queue: RABBIT_QUEUE
  },
  concurrency: CONCURRENCY
}
module.exports = config
