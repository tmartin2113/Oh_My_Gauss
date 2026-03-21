package dev.cortexos.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [EncryptedSharedPreferences] backed by an AES-256-GCM master key
 * stored in the Android Keystore.
 *
 * All reads and writes are synchronous (SharedPreferences contract). Call from a
 * background coroutine context if you want to avoid any chance of blocking the main
 * thread during the first-run key-generation step.
 */
@Singleton
class SecureCredentialManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val PREFS_FILENAME    = "cortex_secure_prefs"
        private const val KEY_ANTHROPIC_API = "anthropic_api_key"
        private const val VALID_KEY_PREFIX  = "sk-ant-"
    }

    private val prefs: SharedPreferences by lazy { createEncryptedPrefs() }

    // ── Public API ───────────────────────────────────────────────────────────

    /** Returns the stored Anthropic API key, or null if none has been saved. */
    fun getAnthropicApiKey(): String? {
        return prefs.getString(KEY_ANTHROPIC_API, null)?.takeIf { it.isNotBlank() }
    }

    /** Returns true if a non-blank API key is currently stored. */
    fun hasAnthropicApiKey(): Boolean = getAnthropicApiKey() != null

    /**
     * Persists the given API key.
     *
     * @throws [IllegalArgumentException] if the key fails basic format validation.
     */
    fun saveAnthropicApiKey(key: String) {
        val trimmed = key.trim()
        require(trimmed.isNotBlank()) { "API key must not be blank" }
        require(trimmed.startsWith(VALID_KEY_PREFIX)) {
            "API key must start with '$VALID_KEY_PREFIX'"
        }
        prefs.edit().putString(KEY_ANTHROPIC_API, trimmed).apply()
    }

    /** Permanently removes the stored API key. */
    fun clearAnthropicApiKey() {
        prefs.edit().remove(KEY_ANTHROPIC_API).apply()
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private fun createEncryptedPrefs(): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_FILENAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // If the Keystore is corrupted (rare; happens after failed device re-enrolment),
            // log and fall back to a fresh encrypted prefs instance after clearing the old file.
            Timber.e(e, "EncryptedSharedPreferences initialisation failed; resetting secure store.")
            context.deleteSharedPreferences(PREFS_FILENAME)
            // Re-attempt once with a clean slate
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                PREFS_FILENAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }
}
