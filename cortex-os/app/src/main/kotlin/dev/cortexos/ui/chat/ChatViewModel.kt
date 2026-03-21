package dev.cortexos.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dev.cortexos.llm.LlmEngine
import dev.cortexos.llm.LlmException
import dev.cortexos.llm.ConversationStateManager
import dev.cortexos.llm.model.Message
import dev.cortexos.security.SecureCredentialManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class ChatUiState(
    val isStreaming: Boolean       = false,
    val errorMessage: String?      = null,
    val isApiKeyMissing: Boolean   = false
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val llmEngine: LlmEngine,
    private val conversationState: ConversationStateManager,
    private val credentialManager: SecureCredentialManager
) : ViewModel() {

    val messages: StateFlow<List<Message>> = conversationState.messages
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    private var streamingJob: Job? = null

    init {
        checkApiKey()
    }

    // ── Public actions ────────────────────────────────────────────────────────

    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank() || _uiState.value.isStreaming) return
        if (_uiState.value.isApiKeyMissing) {
            _uiState.update { it.copy(errorMessage = "Set your API key first.") }
            return
        }

        _uiState.update { it.copy(isStreaming = true, errorMessage = null) }

        streamingJob = viewModelScope.launch {
            try {
                llmEngine.chat(trimmed).collect { /* deltas already applied to state */ }
            } catch (e: CancellationException) {
                throw e // always re-throw CancellationException
            } catch (e: LlmException.ApiError) {
                Timber.e(e, "API error during chat")
                val msg = when (e.statusCode) {
                    401  -> "Invalid API key. Check your settings."
                    429  -> "Rate limited — please wait a moment."
                    529  -> "Claude is overloaded — please try again shortly."
                    in 500..599 -> "Anthropic server error. Try again."
                    else -> "Error ${e.statusCode}: ${e.apiMessage}"
                }
                _uiState.update { it.copy(errorMessage = msg) }
            } catch (e: LlmException.NetworkError) {
                Timber.e(e, "Network error during chat")
                _uiState.update { it.copy(errorMessage = "Network error — check your connection.") }
            } finally {
                _uiState.update { it.copy(isStreaming = false) }
            }
        }
    }

    fun stopStreaming() {
        streamingJob?.cancel()
        // removeLastMessage() is NOT called here. With CancellationException properly
        // re-thrown in AnthropicApiClient, the cancellation propagates cleanly through
        // LlmEngine.chat() without hitting the NetworkError path. The assistant placeholder
        // is left in state so the conversation history is not corrupted. If a partial
        // response was streamed before stop, it remains visible — which is correct UX.
        _uiState.update { it.copy(isStreaming = false) }
    }

    fun clearConversation() {
        streamingJob?.cancel()
        conversationState.clear()
        _uiState.update { ChatUiState(isApiKeyMissing = _uiState.value.isApiKeyMissing) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun saveApiKey(key: String) {
        try {
            credentialManager.saveAnthropicApiKey(key)
            _uiState.update { it.copy(isApiKeyMissing = false, errorMessage = null) }
        } catch (e: IllegalArgumentException) {
            _uiState.update { it.copy(errorMessage = e.message) }
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private fun checkApiKey() {
        _uiState.update { it.copy(isApiKeyMissing = !credentialManager.hasAnthropicApiKey()) }
    }
}
