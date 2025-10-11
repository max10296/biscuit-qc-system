// Alert and Sound Utility Module
// ===============================

(function() {
    'use strict';

    // Sound configuration with multiple alert types
    const SOUND_LIBRARY = {
        success: "data:audio/wav;base64,UklGRhwMAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgMAADpn6gE9FYMJvJgJj==",
        error: "data:audio/wav;base64,UklGRjgGAABXQVZFZm10IBAAAAABAAEASL0AAIiYAQACABAAZGF0YQQGAACnp6enp6enp6dTU1NT",
        warning: "data:audio/wav;base64,UklGRqoFAABXQVZFZm10IBAAAAABAAEASL0AAIiYAQACABAAZGF0YYYFAADgAADAoKCgoKCAgICA",
        notification: "data:audio/wav;base64,UklGRhwMAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQgMAACA"
    };

    // Create audio objects for different sound types
    const audioObjects = {};
    Object.keys(SOUND_LIBRARY).forEach(type => {
        audioObjects[type] = new Audio(SOUND_LIBRARY[type]);
        audioObjects[type].volume = 0.7;
    });

    // Global sound settings - ENABLED BY DEFAULT
    let soundEnabled = true;
    let soundVolume = 0.7;

    // Initialize the alert and sound system
    window.AlertSoundSystem = {
        // Enable or disable sound
        enableSound: function(enable = true) {
            soundEnabled = enable;
            // Note: Test sound removed to comply with browser autoplay policy
            // Sound will work when triggered by user interactions
            return soundEnabled;
        },

        // Set sound volume (0.0 to 1.0)
        setVolume: function(volume) {
            soundVolume = Math.max(0, Math.min(1, volume));
            Object.values(audioObjects).forEach(audio => {
                audio.volume = soundVolume;
            });
        },

        // Play a specific sound type
        playSound: function(type = 'notification') {
            if (!soundEnabled) return;
            
            const audio = audioObjects[type] || audioObjects.notification;
            audio.currentTime = 0;
            audio.play().catch(error => {
                console.warn('Sound playback failed:', error);
            });
        },

        // Enhanced notification with sound
        showNotificationWithSound: function(message, type = 'success', duration = 3000) {
            // Play appropriate sound
            if (soundEnabled) {
                this.playSound(type);
            }

            // Show the notification
            if (typeof showNotification === 'function') {
                showNotification(message, type, duration);
            } else {
                // Fallback notification implementation
                this.fallbackNotification(message, type, duration);
            }
        },

        // Fallback notification if main system fails
        fallbackNotification: function(message, type = 'success', duration = 3000) {
            const notification = document.getElementById('notification');
            if (!notification) {
                console.error('Notification element not found');
                alert(`${type.toUpperCase()}: ${message}`);
                return;
            }

            // Clear any existing timeout
            if (window.notificationTimeout) {
                clearTimeout(window.notificationTimeout);
            }

            // Set notification content and style
            notification.className = 'notification show ' + type;
            
            // Create notification HTML
            const iconMap = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            const icon = iconMap[type] || iconMap.info;
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>
                        <i class="fas ${icon}" style="margin-right: 10px;"></i>
                        ${message}
                    </span>
                    <button onclick="this.parentElement.parentElement.classList.remove('show')" 
                            style="background: none; border: none; color: inherit; font-size: 20px; cursor: pointer; margin-left: 15px;">
                        ×
                    </button>
                </div>
            `;

            // Auto-hide after duration
            window.notificationTimeout = setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        },

        // Test all sound types
        testAllSounds: function() {
            const types = ['success', 'error', 'warning', 'notification'];
            let index = 0;
            
            const playNext = () => {
                if (index < types.length) {
                    console.log(`Playing ${types[index]} sound...`);
                    this.showNotificationWithSound(`Testing ${types[index]} sound`, types[index], 2000);
                    index++;
                    setTimeout(playNext, 2500);
                }
            };
            
            playNext();
        },

        // Initialize the system
        init: function() {
            // Auto-enable sound alerts
            soundEnabled = true;
            console.log('Sound alerts enabled by default');
            
            // Remove or hide the enable audio button since it's no longer needed
            const enableAudioBtn = document.getElementById('enable-audio-btn');
            if (enableAudioBtn) {
                enableAudioBtn.style.display = 'none';
            }

            // Override existing showNotification if it exists
            if (typeof window.showNotification === 'function') {
                const originalShowNotification = window.showNotification;
                window.showNotification = (message, type, duration) => {
                    // Play sound if enabled
                    if (soundEnabled) {
                        this.playSound(type);
                    }
                    // Call original notification function
                    originalShowNotification(message, type, duration);
                };
            }

            console.log('Alert and Sound System initialized');
        }
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.AlertSoundSystem.init();
        });
    } else {
        window.AlertSoundSystem.init();
    }

})();