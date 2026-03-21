package dev.cortexos.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.cortexos.ui.chat.ChatScreen

private const val ROUTE_CHAT = "chat"

@Composable
fun CortexNavHost() {
    val navController = rememberNavController()

    NavHost(
        navController    = navController,
        startDestination = ROUTE_CHAT
    ) {
        composable(ROUTE_CHAT) {
            ChatScreen()
        }
        // Phase 2+: MCP app routes, settings, etc. added here
    }
}
