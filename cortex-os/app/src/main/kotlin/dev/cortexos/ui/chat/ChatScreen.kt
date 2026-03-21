package dev.cortexos.ui.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.cortexos.llm.model.Role
import dev.cortexos.ui.theme.CortexColors
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsStateWithLifecycle()
    val uiState  by viewModel.uiState.collectAsStateWithLifecycle()

    val listState        = rememberLazyListState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope            = rememberCoroutineScope()
    var inputText        by rememberSaveable { mutableStateOf("") }
    var showApiKeySheet  by rememberSaveable { mutableStateOf(false) }

    // Auto-scroll to the newest message when the list grows
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    // Show API key sheet on first launch
    LaunchedEffect(uiState.isApiKeyMissing) {
        if (uiState.isApiKeyMissing) showApiKeySheet = true
    }

    // Surface errors via snackbar
    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            scope.launch {
                snackbarHostState.showSnackbar(it)
                viewModel.dismissError()
            }
        }
    }

    Scaffold(
        containerColor = CortexColors.Background,
        snackbarHost = {
            SnackbarHost(snackbarHostState) { data ->
                Snackbar(
                    snackbarData     = data,
                    containerColor   = CortexColors.SurfaceVariant,
                    contentColor     = CortexColors.OnSurface,
                    shape            = RoundedCornerShape(12.dp)
                )
            }
        },
        topBar = {
            CortexTopBar(
                onClear         = viewModel::clearConversation,
                onSettings      = { showApiKeySheet = true }
            )
        },
        bottomBar = {
            InputBar(
                text         = inputText,
                isStreaming   = uiState.isStreaming,
                onTextChange  = { inputText = it },
                onSend        = {
                    viewModel.sendMessage(inputText)
                    inputText = ""
                },
                onStop        = viewModel::stopStreaming,
                modifier      = Modifier
                    .navigationBarsPadding()
                    .imePadding()
            )
        }
    ) { innerPadding ->
        if (messages.isEmpty()) {
            EmptyState(modifier = Modifier.padding(innerPadding))
        } else {
            LazyColumn(
                state           = listState,
                contentPadding  = PaddingValues(
                    top    = innerPadding.calculateTopPadding() + 8.dp,
                    bottom = innerPadding.calculateBottomPadding() + 8.dp,
                    start  = 16.dp,
                    end    = 16.dp
                ),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(messages, key = { it.id }) { message ->
                    MessageBubble(message = message)
                }
                if (uiState.isStreaming && messages.lastOrNull()?.content.isNullOrEmpty()) {
                    item(key = "typing_indicator") {
                        TypingIndicator()
                    }
                }
            }
        }
    }

    if (showApiKeySheet) {
        ApiKeyBottomSheet(
            onDismiss = { showApiKeySheet = false },
            onSave    = { key ->
                viewModel.saveApiKey(key)
                showApiKeySheet = false
            }
        )
    }
}

// ── Top bar ───────────────────────────────────────────────────────────────────

@Composable
private fun CortexTopBar(
    onClear: () -> Unit,
    onSettings: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment     = Alignment.CenterVertically
    ) {
        Text(
            text  = "Cortex",
            style = MaterialTheme.typography.titleMedium,
            color = CortexColors.Primary,
            modifier = Modifier.padding(start = 8.dp)
        )
        Row {
            IconButton(onClick = onClear) {
                Icon(
                    imageVector        = Icons.Default.DeleteOutline,
                    contentDescription = "Clear conversation",
                    tint               = CortexColors.OnSurfaceMuted
                )
            }
        }
    }
}

// ── Message bubble ────────────────────────────────────────────────────────────

@Composable
private fun MessageBubble(message: dev.cortexos.llm.model.Message) {
    val isUser = message.role == Role.user

    Row(
        modifier            = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(
                    RoundedCornerShape(
                        topStart     = if (isUser) 18.dp else 4.dp,
                        topEnd       = if (isUser) 4.dp  else 18.dp,
                        bottomStart  = 18.dp,
                        bottomEnd    = 18.dp
                    )
                )
                .background(
                    if (isUser) CortexColors.UserBubble else CortexColors.SurfaceVariant
                )
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Text(
                text  = message.content,
                style = MaterialTheme.typography.bodyMedium,
                color = CortexColors.OnSurface
            )
        }
    }
}

// ── Typing indicator ──────────────────────────────────────────────────────────

@Composable
private fun TypingIndicator() {
    val infiniteTransition = rememberInfiniteTransition(label = "typing")
    Row(
        modifier            = Modifier
            .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 18.dp, bottomStart = 18.dp, bottomEnd = 18.dp))
            .background(CortexColors.SurfaceVariant)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment     = Alignment.CenterVertically
    ) {
        listOf(0, 150, 300).forEach { delayMs ->
            val alpha by infiniteTransition.animateFloat(
                initialValue = 0.3f,
                targetValue  = 1f,
                animationSpec = infiniteRepeatable(
                    animation  = tween(500, delayMillis = delayMs, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "dot_$delayMs"
            )
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(CortexColors.Primary.copy(alpha = alpha))
            )
        }
    }
}

// ── Input bar ─────────────────────────────────────────────────────────────────

@Composable
private fun InputBar(
    text: String,
    isStreaming: Boolean,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier
) {
    val keyboard = LocalSoftwareKeyboardController.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(CortexColors.Background)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        TextField(
            value         = text,
            onValueChange = onTextChange,
            placeholder   = {
                Text(
                    "Ask anything…",
                    color = CortexColors.OnSurfaceMuted,
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            modifier = Modifier.weight(1f),
            colors   = TextFieldDefaults.colors(
                focusedContainerColor     = CortexColors.SurfaceVariant,
                unfocusedContainerColor   = CortexColors.SurfaceVariant,
                focusedTextColor          = CortexColors.OnSurface,
                unfocusedTextColor        = CortexColors.OnSurface,
                focusedIndicatorColor     = Color.Transparent,
                unfocusedIndicatorColor   = Color.Transparent,
                cursorColor               = CortexColors.Primary
            ),
            shape          = RoundedCornerShape(24.dp),
            textStyle      = MaterialTheme.typography.bodyMedium,
            maxLines       = 5,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Sentences,
                imeAction      = ImeAction.Send
            ),
            keyboardActions = KeyboardActions(
                onSend = {
                    keyboard?.hide()
                    onSend()
                }
            )
        )

        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(if (isStreaming) CortexColors.Error else CortexColors.Primary),
            contentAlignment = Alignment.Center
        ) {
            IconButton(onClick = { if (isStreaming) onStop() else { keyboard?.hide(); onSend() } }) {
                Icon(
                    imageVector        = if (isStreaming) Icons.Default.Stop else Icons.Default.ArrowUpward,
                    contentDescription = if (isStreaming) "Stop" else "Send",
                    tint               = Color.White,
                    modifier           = Modifier.size(22.dp)
                )
            }
        }
    }
}

// ── Empty state ───────────────────────────────────────────────────────────────

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Box(
        modifier          = modifier.fillMaxSize(),
        contentAlignment  = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text  = "Cortex",
                style = MaterialTheme.typography.titleMedium,
                color = CortexColors.Primary
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text  = "How can I help?",
                style = MaterialTheme.typography.bodyMedium,
                color = CortexColors.OnSurfaceMuted
            )
        }
    }
}

// ── API key sheet ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ApiKeyBottomSheet(
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    val sheetState    = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var keyInput      by rememberSaveable { mutableStateOf("") }
    var validationErr by rememberSaveable { mutableStateOf<String?>(null) }
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    ModalBottomSheet(
        onDismissRequest    = onDismiss,
        sheetState          = sheetState,
        containerColor      = CortexColors.Surface,
        dragHandle          = { BottomSheetDefaults.DragHandle(color = CortexColors.OutlineSubtle) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text  = "Connect to Claude",
                style = MaterialTheme.typography.titleMedium,
                color = CortexColors.OnSurface
            )
            Text(
                text  = "Enter your Anthropic API key to get started. Your key is stored securely on-device and never leaves it.",
                style = MaterialTheme.typography.bodySmall,
                color = CortexColors.OnSurfaceMuted
            )
            OutlinedTextField(
                value          = keyInput,
                onValueChange  = { keyInput = it; validationErr = null },
                label          = { Text("Anthropic API key") },
                placeholder    = { Text("sk-ant-api03-…") },
                singleLine     = true,
                visualTransformation = PasswordVisualTransformation(),
                isError        = validationErr != null,
                supportingText = validationErr?.let { err -> { Text(err, color = CortexColors.Error) } },
                modifier       = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
                colors         = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor   = CortexColors.Primary,
                    unfocusedBorderColor = CortexColors.OutlineSubtle,
                    focusedLabelColor    = CortexColors.Primary,
                    unfocusedLabelColor  = CortexColors.OnSurfaceMuted,
                    focusedTextColor     = CortexColors.OnSurface,
                    unfocusedTextColor   = CortexColors.OnSurface,
                    cursorColor          = CortexColors.Primary
                )
            )
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment     = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = CortexColors.OnSurfaceMuted)
                }
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(CortexColors.Primary)
                ) {
                    TextButton(
                        onClick = {
                            val key = keyInput.trim()
                            when {
                                key.isBlank()                  -> validationErr = "API key cannot be empty"
                                !key.startsWith("sk-ant-")     -> validationErr = "Key must start with sk-ant-"
                                else                           -> onSave(key)
                            }
                        }
                    ) {
                        Text("Connect", color = Color.White)
                    }
                }
            }
        }
    }
}
