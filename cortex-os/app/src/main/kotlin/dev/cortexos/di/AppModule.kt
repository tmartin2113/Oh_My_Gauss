package dev.cortexos.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import timber.log.Timber
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideHttpClient(json: Json): HttpClient = HttpClient(OkHttp) {

        install(ContentNegotiation) {
            json(json)
        }

        install(HttpTimeout) {
            connectTimeoutMillis = 15_000L   // 15 s connect
            socketTimeoutMillis  = 120_000L  // 2 min for long LLM responses
            requestTimeoutMillis = 120_000L
        }

        install(Logging) {
            level  = LogLevel.INFO
            logger = object : Logger {
                override fun log(message: String) {
                    Timber.tag("Ktor").d(message)
                }
            }
        }

        engine {
            config {
                // Follow HTTPS redirects only; never downgrade to HTTP
                followRedirects(true)
                followSslRedirects(true)
            }
        }
    }
}
