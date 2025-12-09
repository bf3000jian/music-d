
const LIMIT = 60;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'music_api_timestamps';

type QueueItem = {
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    signal?: AbortSignal;
};

class RateLimiter {
    private timestamps: number[] = [];
    private queue: QueueItem[] = [];
    private listeners: Set<(count: number, limit: number) => void> = new Set();
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.loadTimestamps();
        // Periodic cleanup to ensure UI stays updated even if no requests are made
        setInterval(() => this.cleanup(), 10000); 
    }

    private loadTimestamps() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    this.timestamps = parsed.filter((t: number) => Date.now() - t < WINDOW_MS);
                }
            }
        } catch (e) {
            this.timestamps = [];
        }
    }

    private saveTimestamps() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.timestamps));
        this.notifyListeners();
    }

    private cleanup() {
        const now = Date.now();
        const initialCount = this.timestamps.length;
        this.timestamps = this.timestamps.filter(t => now - t < WINDOW_MS);
        
        if (this.timestamps.length !== initialCount) {
            this.saveTimestamps();
            this.processQueue();
        } else {
            // Even if count didn't change, verify queue processing (e.g. strict timing)
             this.processQueue();
        }
    }

    private notifyListeners() {
        const count = this.timestamps.length;
        this.listeners.forEach(l => l(count, LIMIT));
    }

    public subscribe(listener: (count: number, limit: number) => void) {
        this.listeners.add(listener);
        listener(this.timestamps.length, LIMIT);
        return () => this.listeners.delete(listener);
    }

    public async schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
        if (signal?.aborted) {
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
        }

        this.cleanup();

        // If we have capacity and no queue, execute immediately
        if (this.timestamps.length < LIMIT && this.queue.length === 0) {
            return this.execute(task);
        }

        // Otherwise, enqueue
        return new Promise<T>((resolve, reject) => {
            const queueItem: QueueItem = {
                task,
                resolve,
                reject,
                signal
            };

            this.queue.push(queueItem);
            this.notifyListeners(); // Optionally notify that something is queued? For now just usage.

            if (signal) {
                signal.addEventListener('abort', () => {
                    const index = this.queue.indexOf(queueItem);
                    if (index > -1) {
                        this.queue.splice(index, 1);
                        reject(new DOMException('Aborted', 'AbortError'));
                    }
                });
            }

            this.scheduleNextCheck();
        });
    }

    private scheduleNextCheck() {
        if (this.timestamps.length === 0) return;
        
        const oldest = this.timestamps[0];
        const now = Date.now();
        const releaseTime = oldest + WINDOW_MS;
        const delay = Math.max(0, releaseTime - now);

        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.cleanup();
        }, delay + 50); // Small buffer
    }

    private async execute<T>(task: () => Promise<T>): Promise<T> {
        this.timestamps.push(Date.now());
        this.saveTimestamps();
        
        // Schedule cleanup for when this specific timestamp expires
        setTimeout(() => this.cleanup(), WINDOW_MS);

        try {
            return await task();
        } catch (error) {
            throw error;
        }
    }

    private processQueue() {
        if (this.queue.length === 0) return;

        const slots = LIMIT - this.timestamps.length;
        if (slots <= 0) {
            this.scheduleNextCheck();
            return;
        }

        // Process one item
        const item = this.queue.shift();
        if (item) {
            if (item.signal?.aborted) {
                this.processQueue();
                return;
            }

            this.execute(item.task)
                .then(item.resolve)
                .catch(item.reject)
                .finally(() => {
                    this.processQueue();
                });
        }
    }
}

export const rateLimiter = new RateLimiter();
