export class TaskQueue {
  constructor(concurrency = 1, spacingMs = 0) {
    this.concurrency = concurrency
    this.spacingMs = spacingMs
    this.active = 0
    this.pending = []
    this.lastStartedAt = 0
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject })
      this.drain()
    })
  }

  drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const wait = Math.max(0, this.spacingMs - (Date.now() - this.lastStartedAt))
      if (wait > 0) {
        setTimeout(() => this.drain(), wait)
        return
      }
      const item = this.pending.shift()
      this.active += 1
      this.lastStartedAt = Date.now()
      Promise.resolve().then(item.task).then(item.resolve, item.reject).finally(() => {
        this.active -= 1
        this.drain()
      })
    }
  }
}
