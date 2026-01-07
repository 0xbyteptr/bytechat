// Worker pool for crypto operations to prevent main thread blocking
class CryptoWorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private pendingTasks: Array<{ resolve: Function; reject: Function; task: any }> = []
  private taskCounter = 0
  private callbacks = new Map<number, { resolve: Function; reject: Function }>()
  
  constructor(size: number = 2) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = this.handleWorkerMessage.bind(this)
      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }
  
  private handleWorkerMessage(e: MessageEvent) {
    const { type, id, result, error } = e.data
    const callback = this.callbacks.get(id)
    
    if (!callback) return
    
    this.callbacks.delete(id)
    
    if (type === 'success') {
      callback.resolve(result)
    } else {
      callback.reject(new Error(error))
    }
    
    // Return worker to pool and process next task
    const worker = e.target as Worker
    if (this.pendingTasks.length > 0) {
      const { resolve, reject, task } = this.pendingTasks.shift()!
      this.executeTask(worker, task, resolve, reject)
    } else {
      this.availableWorkers.push(worker)
    }
  }
  
  private executeTask(worker: Worker, task: any, resolve: Function, reject: Function) {
    const id = this.taskCounter++
    this.callbacks.set(id, { resolve, reject })
    
    // Add timeout to prevent hanging (30s for slower devices)
    const timeout = setTimeout(() => {
      this.callbacks.delete(id)
      reject(new Error('Crypto operation timeout'))
    }, 30000)
    
    const originalResolve = resolve
    resolve = (result: any) => {
      clearTimeout(timeout)
      originalResolve(result)
    }
    
    this.callbacks.set(id, { resolve, reject })
    worker.postMessage({ ...task, id })
  }
  
  async execute(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.pop()!
        this.executeTask(worker, task, resolve, reject)
      } else {
        this.pendingTasks.push({ resolve, reject, task })
      }
    })
  }
  
  async decrypt(secretKey: string, publicKey: string, cipher: string, nonce: string): Promise<string> {
    return this.execute({ type: 'decrypt', data: { secretKey, publicKey, cipher, nonce } })
  }
  
  async encrypt(secretKey: string, publicKey: string, text: string): Promise<{ cipher: string; nonce: string }> {
    return this.execute({ type: 'encrypt', data: { secretKey, publicKey, text } })
  }
  
  async batchEncrypt(secretKey: string, recipients: Record<string, string>, text: string): Promise<Record<string, { cipher: string; nonce: string }>> {
    return this.execute({ type: 'batchEncrypt', data: { secretKey, recipients, text } })
  }
  
  terminate() {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.availableWorkers = []
  }
}

export const cryptoPool = new CryptoWorkerPool(2)
