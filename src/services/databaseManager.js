/**
 * Manages IndexedDB database connections and operations with multi-tab support.
 * This class implements the singleton pattern to ensure only one database
 * connection exists across the application.
 */
export class DatabaseManager {
    static instances = new Map();

    constructor(dbName) {
        if (DatabaseManager.instances.has(dbName)) {
            return DatabaseManager.instances.get(dbName);
        }

        this.dbName = dbName
        this.db = null
        this.isInitialized = false
        this._connectionPromise = null
        this.versionChangeListeners = new Set()
        this.broadcastChannel = new BroadcastChannel(`${dbName}_channel`)

        this._setupCommunication()
        this._requestPersistence()
        this.connectionRetryCount = 0;
        this.maxRetries = 3;

        DatabaseManager.instances.set(dbName, this);
        
    }

    static getInstance(dbName) {
        if (!this.instances.has(dbName)) {
            this.instances.set(dbName, new DatabaseManager(dbName));
        }
        return this.instances.get(dbName);
    }

    async _requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist()
            if (!isPersisted) {
                console.warn(
                    'Storage persistence denied. Data may be cleared by the browser.'
                )
            }
        }
    }

    _setupCommunication() {
        this.broadcastChannel.onmessage = async (event) => {
            if (event.data.type === 'VERSION_CHANGE') {
                await this._handleVersionChange()
            }
        }

        window.addEventListener('unload', () => {
            this.broadcastChannel.close()
        })
    }

    async _handleVersionChange() {
        if (this.db) {
            this.versionChangeListeners.forEach((listener) => listener())
            this.db.close()
            this.db = null
            this.isInitialized = false
            this._connectionPromise = null
            await this.initialize()
        }
    }

    async initialize() {
        if (this._connectionPromise) {
            return this._connectionPromise
        }

        this._connectionPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName)

            request.onerror = () => {
                this.isInitialized = false
                this._connectionPromise = null
                reject(new Error('Failed to open database'))
            }

            request.onsuccess = (event) => {
                this.db = event.target.result
                this.isInitialized = true

                this.db.onversionchange = () => {
                    this.db.close()
                    this.isInitialized = false
                    this._connectionPromise = null
                    this.broadcastChannel.postMessage({
                        type: 'VERSION_CHANGE',
                    })
                }

                resolve(this.db)
            }
        })

        return this._connectionPromise
    }

    async createObjectStore(storeName, options = { keyPath: 'id' }) {
        const currentVersion = this.db ? this.db.version : 0
        const newVersion = currentVersion + 1

        if (this.db) {
            this.db.close()
            this.db = null
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, newVersion)

            request.onupgradeneeded = (event) => {
                const db = event.target.result
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, options)
                }
            }

            request.onsuccess = (event) => {
                this.db = event.target.result
                this.isInitialized = true
                resolve(this.db)
            }

            request.onerror = () => reject(request.error)
        })
    }

    onVersionChange(callback) {
        this.versionChangeListeners.add(callback)
        return () => {
            this.versionChangeListeners.delete(callback)
        }
    }

    async _retryConnection() {
        if (this.connectionRetryCount >= this.maxRetries) {
            throw new Error('Max retry attempts reached for database connection');
        }

        this.connectionRetryCount++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.connectionRetryCount));
        
        // Reset connection state
        this.db = null;
        this.isInitialized = false;
        this._connectionPromise = null;
        this.connectionRetryCount = 0;
        return this.initialize();
    }

    async transaction(storeNames, mode = 'readonly') {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            if (!this.db) {
                throw new Error('Database connection lost');
            }

            const transaction = this.db.transaction(storeNames, mode);
            
            // Add transaction-level error handling
            return new Promise((resolve, reject) => {
                transaction.onerror = () => {
                    reject(transaction.error);
                };

                transaction.onabort = () => {
                    reject(new Error('Transaction was aborted'));
                };

                resolve(transaction);
            });

        } catch (error) {
            if (
                error.name === 'InvalidStateError' || 
                error.message.includes('database connection is closing') ||
                error.message.includes('Database connection lost')
            ) {
                // Attempt to reconnect and retry the transaction
                await this._retryConnection();
                return this.transaction(storeNames, mode);
            }
            if(error.name === "NotFoundError" && !this.db.objectStoreNames?.includes(storeNames)){
                createObjectStore(storeNames)
            }
            throw error;
        }
    }

    async getStoreValue(storeName, key) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const transaction = await this.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async setStoreValue(storeName, value) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const transaction = await this.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.put(value);
            transaction.oncomplete = () => resolve(request);
            transaction.onerror = () => reject(transaction.error);
        });
    }
}
