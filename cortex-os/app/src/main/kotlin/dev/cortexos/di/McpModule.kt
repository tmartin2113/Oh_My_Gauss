package dev.cortexos.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import dev.cortexos.mcp.McpServerProvider
import dev.cortexos.mcp.servers.contacts.ContactsMcpProvider
import dev.cortexos.mcp.servers.sms.SmsMcpProvider

/**
 * Hilt module that contributes on-device [McpServerProvider] implementations into
 * a [Set] that [dev.cortexos.mcp.McpToolRegistry] receives at injection time.
 *
 * To add a new MCP capability (Calendar, Settings, etc.) in a later phase:
 *   1. Create the provider class implementing [McpServerProvider].
 *   2. Add a `@Binds @IntoSet` entry here — no other wiring needed.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class McpModule {

    @Binds
    @IntoSet
    abstract fun bindContactsProvider(impl: ContactsMcpProvider): McpServerProvider

    @Binds
    @IntoSet
    abstract fun bindSmsProvider(impl: SmsMcpProvider): McpServerProvider
}
