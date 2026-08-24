package org.paperreader.dto

data class ProviderRelayModelsRequest(
    val baseUrl: String,
    val apiKey: String = "",
)

data class ProviderRelayChatRequest(
    val baseUrl: String,
    val apiKey: String = "",
    val model: String,
    val messages: List<ProviderRelayMessage>,
    val stream: Boolean = true,
)

data class ProviderRelayMessage(
    val role: String,
    val content: String,
)
