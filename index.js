const amqp = require('amqplib')
const chalk = require('chalk')
const config = require('./config')
const im = require('altiimagemagick')

let rabbitChannel
let successQueue
let failQueue

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
      queue
    } = config.rabbit

    const uri = `amqp://${user}:${password}@${host}:${port}`
    const connection = await amqp.connect(uri)

    rabbitChannel = await connection.createChannel()
    successQueue = `${queue}-success`
    failQueue = `${queue}-fail`

    await rabbitChannel.assertQueue(successQueue, { durable: true })
    await rabbitChannel.assertQueue(failQueue, { durable: true })

    await rabbitChannel.assertQueue(queue, { durable: true })
    rabbitChannel.prefetch(+config.concurrency)
    rabbitChannel.consume(queue, work)

    console.log(chalk.inverse(`Connected ${host}:${port}`))
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
 *   successCallback: true,
 *   errorCallback: false
 * }
 */
async function work (message) {
  let msg = {}
  try {
    console.log(chalk.cyan('Received a message:'))
    msg = JSON.parse(message.content.toString())
    console.log(msg)
    if (!checkMessage(msg)) {
      if (msg.errorCallback) {
        await rabbitChannel.sendToQueue(failQueue, new Buffer(JSON.stringify(msg)), { persistent: true })
      }
    } else {
      await resizeImage(msg.srcPath, msg.dstPath, msg.width, msg.height, msg.keepAspect)
      if (msg.successCallback) {
        await rabbitChannel.sendToQueue(successQueue, new Buffer(JSON.stringify(msg)), { persistent: true })
      }
    }
  } catch (err) {
    if (msg.errorCallback) {
      await rabbitChannel.sendToQueue(failQueue, new Buffer(JSON.stringify(msg)), { persistent: true })
    }
  }
  rabbitChannel.ack(message)
}

function checkMessage (msg) {
  if (msg.srcPath && msg.dstPath && +msg.width > 0 && +msg.height > 0) {
    return true
  }
  return false
}

/**
 * Resize a image.
 */
function resizeImage (srcPath, dstPath, width, height, keepAspect = false) {
  return new Promise((resolve, reject) => {
    let height = `${height}^`
    let customArgs = ['-gravity', 'center', '-extent', `${width}x${height}`]
    if (keepAspect) {
      height = ''
      customArgs = ['-gravity', 'center']
    }

    im.resize({
      srcPath: srcPath,
      dstPath: dstPath,
      width,
      height,
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
