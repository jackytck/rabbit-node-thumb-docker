const amqp = require('amqplib')
const chalk = require('chalk')
const config = require('./config')
const im = require('altiimagemagick')
const lodash = require('lodash')
const moment = require('moment')

let rabbitChannel

/**
 * Setup rabbit.
 */
async function connectRabbit () {
  try {
    const {
      user,
      password,
      host,
      port,
      queue,
      ping,
      pong
    } = config.rabbit

    const uri = `amqp://${user}:${password}@${host}:${port}`
    const connection = await amqp.connect(uri)

    rabbitChannel = await connection.createChannel()
    await rabbitChannel.assertQueue(queue, { durable: true })
    rabbitChannel.prefetch(+config.concurrency)
    rabbitChannel.consume(queue, work)

    // for heartbeat ping pong
    await rabbitChannel.assertExchange(ping, 'fanout', { durable: true })
    const tmpQueue = await rabbitChannel.assertQueue('', { exclusive: true })
    await rabbitChannel.bindQueue(tmpQueue.queue, ping, '')
    rabbitChannel.consume(tmpQueue.queue, handlePing, { noAck: true })
    await rabbitChannel.assertQueue(pong, { durable: true })

    console.log(chalk.inverse(`Connected ${host}:${port}`))
  } catch (err) {
    console.error(err)
  }
}

/**
 * Handle ping message from heartbeater.
 */
async function handlePing (message) {
  const msg = message.content.toString()
  try {
    const mach = JSON.parse(msg)
    mach.name = config.host.name
    mach.nickname = config.host.name
    mach.type = config.host.type
    mach.pong = moment().format('YYYY-MM-DD hh:mm:ss.SSSS A')
    const pong = lodash.pick(mach, [
      'name',
      'nickname',
      'type',
      'ping',
      'pong',
      'extra'
    ])
    await rabbitChannel.sendToQueue(config.rabbit.pong, new Buffer(JSON.stringify(pong)))
  } catch (err) {
    console.error(err)
  }
}

/**
 * Main work.
 * {
 *   srcPath: '/mnt/data/abc/def-ghi-jkl.jpg',
 *   dstPath: '/mnt/data/abc/.small/def-ghi-jkl-64.jpg',
 *   width: 64,
 *   height: 64,
 *   keepAspect: false,
 *   done: [{
 *     queue: "any-next-queue",
 *     msg: "any msg"
 *   }],
 *   error: [{
 *     queue: "any-error-queue",
 *     msg: "any msg"
 *   }]
 * }
 */
async function work (message) {
  let msg = {}
  try {
    // a. Parse and log message
    console.log(chalk.cyan('Received a message:'))
    msg = JSON.parse(message.content.toString())
    console.log(msg)

    if (!checkMessage(msg)) {
      // b. Expected error
      await sendCallback(msg, 'error')
      console.log('Failed')
    } else {
      // c. Image ops
      await resizeImage(msg.srcPath, msg.dstPath, msg.width, msg.height, msg.keepAspect)
      await sendCallback(msg)
      console.log('Done')
    }
  } catch (err) {
    // d. Unexpected error
    console.error(err)
    await sendCallback(msg, 'error')
    console.log('Failed')
  }
  rabbitChannel.ack(message)
}

/**
 * Check essential data fields.
 */
function checkMessage (msg) {
  if (msg.srcPath && msg.dstPath && +msg.width > 0 && +msg.height > 0) {
    return true
  }
  return false
}

/**
 * Send callback message to custom 'done' or 'error' queues.
 * type: done or error
 */
function sendCallback (message, type='done') {
  if (!message[type] || message[type].length === 0) {
    return
  }

  const jobs = message[type].map(msg => {
    return rabbitChannel.assertQueue(msg.queue, { durable: true })
      .then(() => rabbitChannel.sendToQueue(msg.queue, new Buffer(JSON.stringify(msg.msg))))
  })

  return Promise.all(jobs)
}

/**
 * Resize (and center crop) a image.
 * If keepAspect is true, width is fixed as specified, but height will be adjusted accordingly.
 */
function resizeImage (srcPath, dstPath, width, height, keepAspect = false) {
  return new Promise((resolve, reject) => {
    let h = `${height}^`
    let customArgs = ['-gravity', 'center', '-extent', `${width}x${h}`]
    if (keepAspect) {
      h = ''
      customArgs = ['-gravity', 'center']
    }

    im.resize({
      srcPath: srcPath,
      dstPath: dstPath,
      width,
      height: h,
      customArgs
    }, err => {
      if (err) {
        console.error('resizeImage:', err)
        return reject(err)
      }
      resolve()
    })
  })
}

connectRabbit()
