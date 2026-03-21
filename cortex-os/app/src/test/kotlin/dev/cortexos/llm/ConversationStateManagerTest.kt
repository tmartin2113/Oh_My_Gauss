package dev.cortexos.llm

import dev.cortexos.llm.model.Role
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ConversationStateManagerTest {

    private lateinit var manager: ConversationStateManager

    @Before
    fun setUp() {
        manager = ConversationStateManager()
    }

    @Test
    fun `addUserMessage appends user message`() = runTest {
        manager.addUserMessage("Hello")
        val msgs = manager.messages.first()
        assertEquals(1, msgs.size)
        assertEquals(Role.user, msgs[0].role)
        assertEquals("Hello", msgs[0].content)
    }

    @Test
    fun `beginAssistantMessage appends empty assistant message`() = runTest {
        manager.addUserMessage("Hi")
        manager.beginAssistantMessage()
        val msgs = manager.messages.first()
        assertEquals(2, msgs.size)
        assertEquals(Role.assistant, msgs[1].role)
        assertEquals("", msgs[1].content)
    }

    @Test
    fun `appendToLastAssistantMessage accumulates deltas`() = runTest {
        manager.addUserMessage("Hi")
        manager.beginAssistantMessage()
        manager.appendToLastAssistantMessage("Hello")
        manager.appendToLastAssistantMessage(" world")
        val msgs = manager.messages.first()
        assertEquals("Hello world", msgs.last().content)
    }

    @Test
    fun `finaliseLastAssistantMessage overwrites accumulated content`() = runTest {
        manager.addUserMessage("Hi")
        manager.beginAssistantMessage()
        manager.appendToLastAssistantMessage("partial")
        manager.finaliseLastAssistantMessage("full authoritative response")
        val msgs = manager.messages.first()
        assertEquals("full authoritative response", msgs.last().content)
    }

    @Test
    fun `removeLastMessage removes the tail`() = runTest {
        manager.addUserMessage("Hi")
        manager.beginAssistantMessage()
        manager.removeLastMessage()
        val msgs = manager.messages.first()
        assertEquals(1, msgs.size)
        assertEquals(Role.user, msgs[0].role)
    }

    @Test
    fun `clear empties all messages`() = runTest {
        manager.addUserMessage("Hi")
        manager.beginAssistantMessage()
        manager.appendToLastAssistantMessage("Response")
        manager.clear()
        assertTrue(manager.messages.first().isEmpty())
    }

    @Test
    fun `getApiMessages enforces alternating roles`() = runTest {
        manager.addUserMessage("First user message")
        manager.beginAssistantMessage()
        manager.finaliseLastAssistantMessage("Assistant response")
        manager.addUserMessage("Second user message")

        val apiMsgs = manager.getApiMessages()
        assertEquals(3, apiMsgs.size)
        assertEquals("user",      apiMsgs[0].role)
        assertEquals("assistant", apiMsgs[1].role)
        assertEquals("user",      apiMsgs[2].role)
    }

    @Test
    fun `getApiMessages starts with user message even if assistant came first`() = runTest {
        // Simulate a case where state is in an inconsistent state (assistant first)
        manager.beginAssistantMessage()
        manager.finaliseLastAssistantMessage("Stale assistant message")
        manager.addUserMessage("User follows")

        val apiMsgs = manager.getApiMessages()
        assertTrue(apiMsgs.isNotEmpty())
        assertEquals("user", apiMsgs.first().role)
    }

    @Test
    fun `getApiMessages skips blank messages`() = runTest {
        manager.addUserMessage("Valid")
        manager.beginAssistantMessage()
        // assistant message left empty (e.g. error before any delta)
        manager.addUserMessage("Next valid")

        val apiMsgs = manager.getApiMessages()
        // Only valid non-blank messages should appear
        assertTrue(apiMsgs.all { it.content.isNotBlank() })
    }
}
