package dev.cortexos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import dev.cortexos.ui.navigation.CortexNavHost
import dev.cortexos.ui.theme.CortexTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        suppressLauncherBackNavigation()
        setContent {
            CortexTheme {
                CortexNavHost()
            }
        }
    }

    /**
     * A launcher / home screen must never close on back press — doing so leaves the user
     * with no way to return to the device home. We register a callback that absorbs all
     * back events while this activity is the foreground home.
     */
    private fun suppressLauncherBackNavigation() {
        onBackPressedDispatcher.addCallback(
            owner = this,
            onBackPressedCallback = object : OnBackPressedCallback(enabled = true) {
                override fun handleOnBackPressed() {
                    // Intentionally empty — this IS the home screen.
                }
            }
        )
    }
}
