import { DatabaseManager } from './databaseManager'

export class UserPreferencesStoreManager {
    static instance = null
    static DB_NAME = 'CLIENT_APP_DATABASE'
    static STORE_NAME = 'userPreferences'

    static getInstance(username) {
        if (
            !UserPreferencesStoreManager.instance ||
            UserPreferencesStoreManager.instance.username !== username
        ) {
            UserPreferencesStoreManager.instance =
                new UserPreferencesStoreManager(username)
        }
        return UserPreferencesStoreManager.instance
    }

    constructor(username) {
        if (!username) {
            throw new Error('Username is required')
        }

        this.username = username
        this.isInitialized = false
        this.storeName = UserPreferencesStoreManager.STORE_NAME
        this.dbManager = DatabaseManager.getInstance(
            UserPreferencesStoreManager.DB_NAME
        )
    }

    async initialize() {
        if (this.isInitialized) {
            return
        }

        try {
            await this.dbManager.initialize()

            if (!this.dbManager.db.objectStoreNames.contains(this.storeName)) {
                await this.dbManager.createObjectStore(this.storeName, {
                    keyPath: 'username',
                })
            }

            this.isInitialized = true
        } catch (error) {
            console.error(
                'Failed to initialize UserPreferencesStoreManager:',
                error
            )
            throw error
        }
    }

    async get(key) {
        if (!this.isInitialized) {
            await this.initialize()
        }

        const userPreferences = await this.dbManager.getStoreValue(
            this.storeName,
            this.username
        )
        return userPreferences?.value?.[key] ?? null
    }

    async set(value) {
        if (!this.isInitialized) {
            await this.initialize()
        }

        return this.dbManager.setStoreValue(this.storeName, {
            username: this.username,
            value,
        })
    }
}
