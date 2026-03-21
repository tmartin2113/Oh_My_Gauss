package dev.cortexos.security

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * NOTE: Run with Robolectric on the JVM. These tests require
 * `testImplementation("org.robolectric:robolectric:4.13")` in build.gradle.kts.
 *
 * EncryptedSharedPreferences falls back to an unencrypted in-memory implementation
 * in Robolectric when no Keystore is available — encryption behaviour is validated
 * on real hardware / emulator with instrumented tests.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SecureCredentialManagerTest {

    private lateinit var manager: SecureCredentialManager

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        manager = SecureCredentialManager(context)
    }

    @Test
    fun `hasAnthropicApiKey returns false when no key stored`() {
        assertFalse(manager.hasAnthropicApiKey())
    }

    @Test
    fun `getAnthropicApiKey returns null when no key stored`() {
        assertNull(manager.getAnthropicApiKey())
    }

    @Test
    fun `saveAnthropicApiKey persists and retrieves key`() {
        manager.saveAnthropicApiKey("sk-ant-valid-key-12345")
        assertTrue(manager.hasAnthropicApiKey())
        assertEquals("sk-ant-valid-key-12345", manager.getAnthropicApiKey())
    }

    @Test(expected = IllegalArgumentException::class)
    fun `saveAnthropicApiKey throws on blank key`() {
        manager.saveAnthropicApiKey("   ")
    }

    @Test(expected = IllegalArgumentException::class)
    fun `saveAnthropicApiKey throws on key with wrong prefix`() {
        manager.saveAnthropicApiKey("openai-wrong-prefix")
    }

    @Test
    fun `saveAnthropicApiKey trims whitespace`() {
        manager.saveAnthropicApiKey("  sk-ant-valid-key-trimmed  ")
        assertEquals("sk-ant-valid-key-trimmed", manager.getAnthropicApiKey())
    }

    @Test
    fun `clearAnthropicApiKey removes stored key`() {
        manager.saveAnthropicApiKey("sk-ant-valid-key-to-clear")
        manager.clearAnthropicApiKey()
        assertFalse(manager.hasAnthropicApiKey())
        assertNull(manager.getAnthropicApiKey())
    }
}
