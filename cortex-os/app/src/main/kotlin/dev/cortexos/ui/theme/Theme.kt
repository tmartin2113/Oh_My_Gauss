package dev.cortexos.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography

// ── Palette ──────────────────────────────────────────────────────────────────
object CortexColors {
    val Background      = Color(0xFF060608)   // Near-OLED black
    val Surface         = Color(0xFF0F0E14)   // Slightly lifted surface
    val SurfaceVariant  = Color(0xFF1A1824)   // Card / bubble background
    val UserBubble      = Color(0xFF2E1F5E)   // Deep violet — user messages
    val OutlineSubtle   = Color(0xFF2C2940)   // Dividers, borders
    val Primary         = Color(0xFF8B6FE8)   // Violet accent
    val PrimaryVariant  = Color(0xFF6A4FCC)
    val OnPrimary       = Color(0xFFFFFFFF)
    val OnSurface       = Color(0xFFE2DEEF)   // Body text
    val OnSurfaceMuted  = Color(0xFF7A7590)   // Timestamps, hints
    val Error           = Color(0xFFCF6679)
    val OnError         = Color(0xFFFFFFFF)
}

private val DarkColorScheme = darkColorScheme(
    primary             = CortexColors.Primary,
    onPrimary           = CortexColors.OnPrimary,
    primaryContainer    = CortexColors.UserBubble,
    onPrimaryContainer  = CortexColors.OnSurface,
    secondary           = CortexColors.PrimaryVariant,
    onSecondary         = CortexColors.OnPrimary,
    background          = CortexColors.Background,
    onBackground        = CortexColors.OnSurface,
    surface             = CortexColors.Surface,
    onSurface           = CortexColors.OnSurface,
    surfaceVariant      = CortexColors.SurfaceVariant,
    onSurfaceVariant    = CortexColors.OnSurfaceMuted,
    outline             = CortexColors.OutlineSubtle,
    error               = CortexColors.Error,
    onError             = CortexColors.OnError
)

// ── Typography — system default (JetBrains Mono available via code font) ─────
private val CortexTypography = Typography(
    bodyLarge = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize   = 16.sp,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize   = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontWeight = FontWeight.Normal,
        fontSize   = 12.sp,
        lineHeight = 16.sp
    ),
    labelSmall = TextStyle(
        fontWeight = FontWeight.Medium,
        fontSize   = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.5.sp
    ),
    titleMedium = TextStyle(
        fontWeight = FontWeight.SemiBold,
        fontSize   = 16.sp,
        lineHeight = 24.sp
    )
)

@Composable
fun CortexTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography  = CortexTypography,
        content     = content
    )
}
