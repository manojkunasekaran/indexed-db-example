
export const userPreferenceStoreKeys = {
    buttonClickCount: "buttonClickCount"
};


import { useEffect, useState, useCallback } from 'react';
import { UserPreferencesStoreManager } from '../services/UserPreferenceStoreManager';

export function useUserPreferences() {

    const username = 'DEFAULT'
    

    const [isReady, setIsReady] = useState(false);
    const [store, setStore] = useState(null);

    useEffect(() => {
        if (!username) return;

        const initializeStore = async () => {
            try {
                const prefStore = UserPreferencesStoreManager.getInstance(username);
                await prefStore.initialize();
                setStore(prefStore);
                setIsReady(true);
            } catch (error) {
                console.error('Failed to initialize user preferences:', error);
                setIsReady(false);
            }
        };

        initializeStore();

        return () => {
            setIsReady(false);
            setStore(null);
        };
    }, [username]);

    const getPreference = useCallback(async (key) => {
        if (!isReady || !store) throw new Error('Store not initialized');
        return store.get(key);
    }, [isReady, store]);

    const setPreference = useCallback(async (key, value) => {
        if (!isReady || !store) throw new Error('Store not initialized');
        return store.set({[key]: value});
    }, [isReady, store]);

    const deletePreference = useCallback(async (key) => {
        if (!isReady || !store) throw new Error('Store not initialized');
        return store.delete(key);
    }, [isReady, store]);

    return {
        isPreferenceDBInitialized: isReady,
        getPreference,
        setPreference,
        deletePreference
    };
}
 